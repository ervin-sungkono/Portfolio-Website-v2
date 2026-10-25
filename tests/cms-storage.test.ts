import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { afterEach, test } from 'node:test';
import { getCmsConfig } from '../src/lib/cms/config.ts';
import { CmsError } from '../src/lib/cms/errors.ts';
import { githubJson } from '../src/lib/cms/github.ts';
import { uploadMedia } from '../src/lib/cms/media.ts';
import { getSnapshot } from '../src/lib/cms/repository.ts';
import { initializeRepository, publishContent } from '../src/lib/cms/service.ts';
import {
  categoriesSchema,
  projectSchema,
  publishMutationSchema,
  siteSchema,
  technologiesSchema,
  uploadMediaSchema,
} from '../src/lib/cms/schemas.ts';

const originalFetch = globalThis.fetch;
const originalAdmin = process.env.GITHUB_ADMIN_ID;
const originalRepository = process.env.GITHUB_REPO;
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const ownerId = 12345;
const site = {
  schemaVersion: 1 as const,
  siteTitle: 'Developer Portfolio',
  headline: 'Selected work',
  introduction: 'A set of projects.',
  socialLinks: [{ label: 'GitHub', url: 'https://github.com/example' }],
};
const categories = { web: { label: 'Website', sortOrder: 10 } };
const technologies = { nextjs: { label: 'Next.js' } };
const project = {
  schemaVersion: 1 as const,
  title: 'Example project',
  summary: 'A small example.',
  description: 'An example project used to verify the CMS content repository.',
  published: true,
  featured: false,
  sortOrder: 10,
  year: 2026,
  categories: ['web'],
  technologies: ['nextjs'],
  tags: ['example'],
  links: { source: 'https://github.com/example/project' },
  media: { cover: 'media/projects/example-project/cover.png', gallery: [] as string[] },
};

type StoredFile = { bytes: Uint8Array; sha: string };
type FakeState = {
  exists: boolean;
  private: boolean;
  branch: string;
  userId: number;
  files: Map<string, StoredFile>;
  calls: Array<{ url: URL; init: RequestInit & { next?: unknown } }>;
  nextSha: number;
  forceWriteStatus?: number;
};

function restoreEnvironment() {
  if (originalAdmin === undefined) {
    delete process.env.GITHUB_ADMIN_ID;
  } else {
    process.env.GITHUB_ADMIN_ID = originalAdmin;
  }
  if (originalRepository === undefined) {
    delete process.env.GITHUB_REPO;
  } else {
    process.env.GITHUB_REPO = originalRepository;
  }
  globalThis.fetch = originalFetch;
}

afterEach(restoreEnvironment);

function setupEnvironment(repo = 'portfolio-content') {
  process.env.GITHUB_ADMIN_ID = String(ownerId);
  process.env.GITHUB_REPO = repo;
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(value === null ? null : JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function fileRecord(value: unknown, sha = 'a'.repeat(40)): StoredFile {
  const bytes = value instanceof Uint8Array ? value : Buffer.from(String(value), 'utf8');
  return { bytes, sha };
}

function fileApiItem(path: string, stored: StoredFile) {
  return {
    type: 'file',
    name: path.split('/').at(-1),
    path,
    sha: stored.sha,
    size: stored.bytes.byteLength,
    encoding: 'base64',
    content: Buffer.from(stored.bytes).toString('base64'),
  };
}

function createState(options: Partial<FakeState> = {}): FakeState {
  return {
    exists: true,
    private: false,
    branch: 'trunk',
    userId: ownerId,
    files: new Map(),
    calls: [],
    nextSha: 1,
    ...options,
  };
}

function installGithub(state: FakeState): void {
  globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    );
    const requestInit = init as RequestInit & { next?: unknown };
    state.calls.push({ url, init: requestInit });
    const method = init.method ?? 'GET';

    if (url.hostname === 'raw.githubusercontent.com') {
      const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
      const path = parts.slice(3).join('/');
      const stored = state.files.get(path);
      return stored ? new Response(stored.bytes) : jsonResponse(null, 404);
    }
    if (url.hostname !== 'api.github.com') {
      return jsonResponse({ message: 'Unexpected host' }, 500);
    }

    if (url.pathname === '/user' && method === 'GET') {
      return jsonResponse({ id: state.userId, login: 'owner' });
    }
    if (url.pathname === `/user/${ownerId}` && method === 'GET') {
      return jsonResponse({ id: ownerId, login: 'owner' });
    }
    if (url.pathname === '/user/repos' && method === 'POST') {
      const body = JSON.parse(String(init.body)) as {
        name: string;
        private: boolean;
        auto_init: boolean;
      };
      assert.equal(body.private, false);
      assert.equal(body.auto_init, false);
      state.exists = true;
      return jsonResponse({
        name: body.name,
        full_name: `owner/${body.name}`,
        default_branch: state.branch,
        private: false,
      });
    }

    const repoPath = `/repos/owner/${process.env.GITHUB_REPO}`;
    if (url.pathname === repoPath && method === 'GET') {
      return state.exists
        ? jsonResponse({
            name: process.env.GITHUB_REPO,
            full_name: `owner/${process.env.GITHUB_REPO}`,
            default_branch: state.branch,
            private: state.private,
          })
        : jsonResponse(null, 404);
    }
    if (url.pathname === `${repoPath}/commits` && method === 'GET') {
      return jsonResponse([
        {
          sha: 'd'.repeat(40),
          html_url: `https://github.com/owner/${process.env.GITHUB_REPO}/commit/${'d'.repeat(40)}`,
        },
      ]);
    }

    if (url.pathname.startsWith(`${repoPath}/contents`)) {
      if (!state.exists) {
        return jsonResponse(null, 404);
      }
      const path = decodeURIComponent(
        url.pathname.slice(`${repoPath}/contents`.length).replace(/^\//, ''),
      );
      if (method === 'GET') {
        if (url.searchParams.get('ref') !== state.branch) {
          return jsonResponse({ message: 'Missing branch ref' }, 400);
        }
        const stored = state.files.get(path);
        if (stored) {
          return jsonResponse(fileApiItem(path, stored));
        }
        const prefix = path ? `${path}/` : '';
        const immediate = new Map<string, 'file' | 'dir'>();
        for (const filePath of state.files.keys()) {
          if (!filePath.startsWith(prefix)) {
            continue;
          }
          const child = filePath.slice(prefix.length).split('/')[0];
          if (child) {
            immediate.set(child, filePath.slice(prefix.length).includes('/') ? 'dir' : 'file');
          }
        }
        if (!immediate.size) {
          return jsonResponse(null, 404);
        }
        return jsonResponse(
          [...immediate].map(([name, type]) => ({
            type,
            name,
            path: prefix + name,
            sha: 'b'.repeat(40),
            size: 0,
          })),
        );
      }
      if (method === 'PUT') {
        if (state.forceWriteStatus) {
          return jsonResponse({ message: 'write rejected' }, state.forceWriteStatus);
        }
        const body = JSON.parse(String(init.body)) as {
          content: string;
          branch: string;
          sha?: string;
          author: { name: string; email: string };
          committer: { name: string; email: string };
        };
        assert.equal(body.branch, state.branch);
        assert.deepEqual(body.author, { name: 'Portfolio CMS', email: 'cms@portfolio.local' });
        assert.deepEqual(body.committer, body.author);
        const existing = state.files.get(path);
        if (existing && body.sha !== existing.sha) {
          return jsonResponse({ message: 'stale' }, 409);
        }
        if (!existing && body.sha) {
          return jsonResponse({ message: 'missing' }, 409);
        }
        const sha = (state.nextSha++).toString(16).padStart(40, '0');
        const bytes = Buffer.from(body.content, 'base64');
        state.files.set(path, { bytes, sha });
        return jsonResponse({
          content: { sha },
          commit: {
            sha: 'c'.repeat(40),
            html_url: `https://github.com/owner/${process.env.GITHUB_REPO}/commit/${'c'.repeat(40)}`,
          },
        });
      }
    }
    return jsonResponse({ message: `Unexpected ${method} ${url.pathname}` }, 500);
  }) as typeof fetch;
}

function addSeedContent(state: FakeState) {
  state.files.set('content/site.json', fileRecord(JSON.stringify(site), '1'.repeat(40)));
  state.files.set(
    'content/categories.json',
    fileRecord(JSON.stringify(categories), '2'.repeat(40)),
  );
  state.files.set(
    'content/technologies.json',
    fileRecord(JSON.stringify(technologies), '3'.repeat(40)),
  );
}

function addProject(state: FakeState, slug: string, data = project, sha = '4'.repeat(40)) {
  state.files.set(`content/projects/${slug}.json`, fileRecord(JSON.stringify(data), sha));
  state.files.set(data.media.cover, fileRecord(png));
}

test('repository configuration accepts a repository name and rejects paths/source repositories', () => {
  setupEnvironment();
  assert.deepEqual(getCmsConfig(), { adminId: ownerId, repository: 'portfolio-content' });
  process.env.GITHUB_REPO = 'owner/content';
  assert.throws(getCmsConfig, /repository name without an owner or path/);
  process.env.GITHUB_REPO = 'Portofolio-Website-v2';
  assert.throws(getCmsConfig, /separate content repository/);
});

test('shared schemas reject unknown fields, unsafe URLs, and future versions', () => {
  setupEnvironment();
  assert.equal(siteSchema.safeParse(site).success, true);
  assert.equal(categoriesSchema.safeParse(categories).success, true);
  assert.equal(technologiesSchema.safeParse(technologies).success, true);
  assert.equal(projectSchema.safeParse(project).success, true);
  assert.equal(projectSchema.safeParse({ ...project, unexpected: true }).success, false);
  assert.equal(projectSchema.safeParse({ ...project, schemaVersion: 2 }).success, false);
  assert.equal(
    projectSchema.safeParse({ ...project, links: { demo: 'javascript:alert(1)' } }).success,
    false,
  );
  assert.equal(
    publishMutationSchema.safeParse({
      kind: 'project',
      slug: '../secret',
      expectedSha: null,
      data: project,
    }).success,
    false,
  );
  assert.equal(
    uploadMediaSchema.safeParse({
      slug: 'sample-project',
      filename: 'cover.png',
      mime: 'image/png',
      content: 'cG5n',
      extra: true,
    }).success,
    false,
  );
});

test('public snapshot resolves numeric owner, honors the non-main default branch, and checks media bytes', async () => {
  setupEnvironment();
  const state = createState();
  addSeedContent(state);
  addProject(state, 'example-project');
  installGithub(state);

  const snapshot = await getSnapshot();

  assert.equal(snapshot.repository.defaultBranch, 'trunk');
  assert.equal(snapshot.repository.owner, 'owner');
  assert.equal(snapshot.site.sha, '1'.repeat(40));
  assert.deepEqual(
    snapshot.projects.map(({ slug }) => slug),
    ['example-project'],
  );
  assert.ok(state.calls.some(({ url, init }) => url.pathname === `/user/${ownerId}` && init.next));
  assert.ok(
    state.calls
      .filter(({ url }) => url.pathname.includes('/contents'))
      .every(({ url }) => url.searchParams.get('ref') === 'trunk'),
  );
  assert.ok(state.calls.some(({ url }) => url.hostname === 'raw.githubusercontent.com'));
  assert.ok(
    state.calls.every(
      ({ init }) => !(init.headers as Record<string, string> | undefined)?.Authorization,
    ),
  );
});

test('compatible migrated repositories retain legacy asset URLs without bootstrap writes', async () => {
  setupEnvironment();
  const state = createState();
  addSeedContent(state);
  addProject(state, 'example-project');
  state.files.set('images/legacy.png', fileRecord(png));
  state.files.set('icons/legacy.svg', fileRecord('<svg xmlns="http://www.w3.org/2000/svg"/>'));
  installGithub(state);
  const snapshot = await initializeRepository('owner-token');
  assert.equal(snapshot.projects.length, 1);
  assert.equal(
    state.calls.some(({ init }) => init.method === 'PUT'),
    false,
  );

  const legacyOnly = createState();
  legacyOnly.files.set('images/legacy.png', fileRecord(png));
  installGithub(legacyOnly);
  await assert.rejects(initializeRepository('owner-token'), { code: 'unsupported_repository' });
  assert.equal(
    legacyOnly.calls.some(({ init }) => init.method === 'PUT'),
    false,
  );
});

test('initialization creates a public repository and seeds it with custom CMS attribution', async () => {
  setupEnvironment();
  const state = createState({ exists: false });
  installGithub(state);

  const snapshot = await initializeRepository('owner-token');

  assert.equal(snapshot.repository.defaultBranch, 'trunk');
  assert.deepEqual([...state.files.keys()].sort(), [
    'README.md',
    'content/categories.json',
    'content/site.json',
    'content/technologies.json',
  ]);
  const writes = state.calls.filter(
    ({ url, init }) => url.pathname.includes('/contents/') && init.method === 'PUT',
  );
  assert.equal(writes.length, 4);
  assert.ok(writes.every(({ init }) => init.cache === 'no-store'));
  assert.equal(
    state.calls.some(({ url }) => url.pathname.includes('/git/')),
    false,
  );
});

test('initialization repairs only an exact known seed subset and refuses unrelated repository files', async () => {
  setupEnvironment();
  const partial = createState();
  partial.files.set(
    'README.md',
    fileRecord(
      '# Portfolio content\n\nThis public repository stores the published content and media for a portfolio website.\n\nContent is managed by Portfolio CMS.\n',
      '5'.repeat(40),
    ),
  );
  partial.files.set(
    'content/site.json',
    fileRecord(
      JSON.stringify({
        schemaVersion: 1,
        siteTitle: 'Developer Portfolio',
        headline: 'Selected work and engineering projects',
        introduction: 'A portfolio of projects and engineering work.',
        socialLinks: [],
      }),
      '6'.repeat(40),
    ),
  );
  installGithub(partial);

  const snapshot = await initializeRepository('owner-token');
  assert.equal(snapshot.site.sha, '6'.repeat(40));
  assert.ok(partial.files.has('content/categories.json'));
  assert.ok(partial.files.has('content/technologies.json'));

  const unrelated = createState();
  unrelated.files.set('data/old.json', fileRecord('{}'));
  installGithub(unrelated);
  await assert.rejects(initializeRepository('owner-token'), (error: unknown) => {
    assert.ok(error instanceof CmsError);
    assert.equal(error.code, 'unsupported_repository');
    return true;
  });
  assert.equal([...unrelated.files.keys()].length, 1);
});

test('owner identity, private repositories, and SHA conflicts stop writes safely', async () => {
  setupEnvironment();
  const wrongOwner = createState({ userId: 999 });
  installGithub(wrongOwner);
  await assert.rejects(
    publishContent('other-token', { kind: 'site', expectedSha: null, data: site }),
    (error: unknown) => {
      assert.ok(error instanceof CmsError);
      assert.equal(error.code, 'unauthorized');
      return true;
    },
  );
  assert.equal(
    wrongOwner.calls.some(({ init }) => init.method === 'PUT'),
    false,
  );

  const privateRepo = createState({ private: true });
  installGithub(privateRepo);
  await assert.rejects(getSnapshot(), (error: unknown) => {
    assert.ok(error instanceof CmsError);
    assert.equal(error.code, 'unsupported_repository');
    return true;
  });

  const stale = createState();
  addSeedContent(stale);
  addProject(stale, 'example-project');
  installGithub(stale);
  await assert.rejects(
    publishContent('owner-token', {
      kind: 'project',
      slug: 'example-project',
      expectedSha: 'f'.repeat(40),
      data: project,
    }),
    (error: unknown) => {
      assert.ok(error instanceof CmsError);
      assert.equal(error.code, 'conflict');
      return true;
    },
  );
  assert.equal(
    stale.calls.some(({ init }) => init.method === 'PUT'),
    false,
  );
});

test('project publish validates current registries and media, then writes the matching branch and SHA', async () => {
  setupEnvironment();
  const state = createState();
  addSeedContent(state);
  state.files.set(project.media.cover, fileRecord(png));
  installGithub(state);

  const result = await publishContent('owner-token', {
    kind: 'project',
    slug: 'example-project',
    expectedSha: null,
    data: project,
  });

  assert.equal(
    result.commitUrl,
    `https://github.com/owner/portfolio-content/commit/${'c'.repeat(40)}`,
  );
  const write = state.calls.find(
    ({ url, init }) =>
      url.pathname.endsWith('/contents/content/projects/example-project.json') &&
      init.method === 'PUT',
  );
  assert.ok(write);
  const body = JSON.parse(String(write.init.body)) as {
    branch: string;
    sha?: string;
    content: string;
  };
  assert.equal(body.branch, 'trunk');
  assert.equal(body.sha, undefined);
  assert.equal(
    JSON.parse(Buffer.from(body.content, 'base64').toString('utf8')).title,
    project.title,
  );
});

test('registry edits cannot orphan an existing project and concurrent writes return a conflict', async () => {
  setupEnvironment();
  const state = createState();
  addSeedContent(state);
  addProject(state, 'example-project');
  installGithub(state);

  await assert.rejects(
    publishContent('owner-token', {
      kind: 'categories',
      expectedSha: '2'.repeat(40),
      data: { mobile: { label: 'Mobile', sortOrder: 20 } },
    }),
    (error: unknown) => {
      assert.ok(error instanceof CmsError);
      assert.equal(error.code, 'validation');
      assert.match(error.message, /category/);
      return true;
    },
  );
  assert.equal(
    state.calls.some(({ init }) => init.method === 'PUT'),
    false,
  );

  state.forceWriteStatus = 409;
  await assert.rejects(
    publishContent('owner-token', {
      kind: 'project',
      slug: 'example-project',
      expectedSha: '4'.repeat(40),
      data: { ...project, title: 'Updated title' },
    }),
    (error: unknown) => {
      assert.ok(error instanceof CmsError);
      assert.equal(error.code, 'conflict');
      return true;
    },
  );
});

test('media uploads require matching raster bytes and store binary bytes with immutable names', async () => {
  setupEnvironment();
  const state = createState();
  installGithub(state);
  const content = Buffer.from(png).toString('base64');

  await assert.rejects(
    uploadMedia('owner-token', {
      slug: '../escape',
      filename: 'cover.png',
      mime: 'image/png',
      content,
    }),
    /slug/,
  );
  await assert.rejects(
    uploadMedia('owner-token', {
      slug: 'sample-project',
      filename: 'cover.jpg',
      mime: 'image/jpeg',
      content,
    }),
    /match its type/,
  );

  const uploaded = await uploadMedia('owner-token', {
    slug: 'sample-project',
    filename: 'Cover image.png',
    mime: 'image/png',
    content,
  });
  const expectedDigest = createHash('sha256').update(png).digest('hex');
  assert.ok(uploaded.path.startsWith(`media/projects/sample-project/${expectedDigest}-`));
  assert.equal(uploaded.alreadyExists, false);
  const stored = state.files.get(uploaded.path);
  assert.ok(stored);
  assert.deepEqual(new Uint8Array(stored.bytes), png);

  const duplicate = await uploadMedia('owner-token', {
    slug: 'sample-project',
    filename: 'Cover image.png',
    mime: 'image/png',
    content,
  });
  assert.equal(duplicate.alreadyExists, true);
  assert.equal(duplicate.sha, 'd'.repeat(40));
  assert.equal(duplicate.contentSha, stored.sha);

  const icon = await uploadMedia('owner-token', {
    slug: 'technologies',
    filename: 'React.png',
    mime: 'image/png',
    content,
  });
  assert.ok(icon.path.startsWith(`media/technologies/${expectedDigest}-`));
});

test('GitHub throttling becomes a safe actionable CMS error', async () => {
  setupEnvironment();
  globalThis.fetch = (async () => new Response(null, { status: 429 })) as typeof fetch;
  await assert.rejects(githubJson('/users/12345'), (error: unknown) => {
    assert.ok(error instanceof CmsError);
    assert.equal(error.code, 'rate_limited');
    assert.match(error.message, /Wait a while/);
    return true;
  });
});
