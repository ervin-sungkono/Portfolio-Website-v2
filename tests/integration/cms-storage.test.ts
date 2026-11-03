import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { afterEach, test } from 'vitest';
import { getCmsConfig } from '../../src/lib/cms/config.ts';
import { CmsError } from '../../src/lib/cms/errors.ts';
import { githubJson } from '../../src/lib/cms/github.ts';
import { stageMediaBlob } from '../../src/lib/cms/media.ts';
import { getSnapshot } from '../../src/lib/cms/repository.ts';
import { initializeRepository } from '../../src/lib/cms/initialization.ts';
import {
  categoriesSchema,
  finalizeCmsDraftSchema,
  projectSchema,
  stageMediaBlobSchema,
  siteSchema,
  technologiesSchema,
  type ProjectDocument,
} from '../../src/lib/cms/schemas.ts';

const originalFetch = globalThis.fetch;
const originalPat = process.env.GITHUB_PAT;
const originalDribbble = process.env.DRIBBBLE_TOKEN;
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
  schemaVersion: 2 as const,
  githubRepositoryId: null,
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
type StoredCommit = {
  treeSha: string;
  parentSha: string | null;
  message: string;
  author: { name: string; email: string };
  committer: { name: string; email: string };
};
type StoredTreeChange = { path: string; sha: string | null };
type FakeState = {
  exists: boolean;
  private: boolean;
  branch: string;
  branchRefStatus?: number;
  branchSha: string;
  treeSha: string;
  userId: number;
  files: Map<string, StoredFile>;
  blobs: Map<string, Uint8Array>;
  commits: Map<string, StoredCommit>;
  trees: Map<string, StoredTreeChange[]>;
  calls: Array<{ url: URL; init: RequestInit & { next?: unknown } }>;
  nextSha: number;
  failCommitOnce?: boolean;
};

function restoreEnvironment() {
  if (originalPat === undefined) {
    delete process.env.GITHUB_PAT;
  } else {
    process.env.GITHUB_PAT = originalPat;
  }
  if (originalRepository === undefined) {
    delete process.env.GITHUB_REPO;
  } else {
    process.env.GITHUB_REPO = originalRepository;
  }
  if (originalDribbble === undefined) {
    delete process.env.DRIBBBLE_TOKEN;
  } else {
    process.env.DRIBBBLE_TOKEN = originalDribbble;
  }
  globalThis.fetch = originalFetch;
}

afterEach(restoreEnvironment);

function setupEnvironment(repo = 'portfolio-content') {
  process.env.GITHUB_PAT = 'owner-token';
  process.env.DRIBBBLE_TOKEN = 'fixture-dribbble-token';
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

function gitBlobSha(bytes: Uint8Array): string {
  return createHash('sha1')
    .update(Buffer.concat([Buffer.from(`blob ${bytes.byteLength}\0`), Buffer.from(bytes)]))
    .digest('hex');
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
    branchSha: 'd'.repeat(40),
    treeSha: 'e'.repeat(40),
    userId: ownerId,
    files: new Map(),
    blobs: new Map(),
    commits: new Map([
      [
        'd'.repeat(40),
        {
          treeSha: 'e'.repeat(40),
          parentSha: null,
          message: 'fixture: initial commit',
          author: { name: 'Fixture', email: 'fixture@example.com' },
          committer: { name: 'Fixture', email: 'fixture@example.com' },
        },
      ],
    ]),
    trees: new Map(),
    calls: [],
    nextSha: 1,
    ...options,
  };
}

function nextGitSha(state: FakeState): string {
  return (state.nextSha++).toString(16).padStart(40, '0');
}

function installGithub(state: FakeState): void {
  globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    );
    const requestInit = init as RequestInit & { next?: unknown };
    state.calls.push({ url, init: requestInit });
    const method = init.method ?? 'GET';

    if (url.hostname === 'api.dribbble.com' && url.pathname === '/v2/user/shots') {
      return jsonResponse(
        [1, 2].map((id) => ({
          id,
          title: `Design ${id}`,
          html_url: `https://dribbble.com/shots/${id}`,
          images: { normal: `https://cdn.dribbble.com/${id}.png`, hidpi: null },
        })),
      );
    }
    if (url.hostname === 'raw.githubusercontent.com') {
      const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
      const path = parts.slice(3).join('/');
      const stored = state.files.get(path);
      return stored ? new Response(Uint8Array.from(stored.bytes).buffer) : jsonResponse(null, 404);
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
      assert.equal(body.auto_init, true);
      state.exists = true;
      state.files.set('README.md', fileRecord(`# ${body.name}\n`));
      state.branchSha = nextGitSha(state);
      state.treeSha = nextGitSha(state);
      state.commits.set(state.branchSha, {
        treeSha: state.treeSha,
        parentSha: null,
        message: 'Initial commit',
        author: { name: 'GitHub', email: 'noreply@github.com' },
        committer: { name: 'GitHub', email: 'noreply@github.com' },
      });
      return jsonResponse({
        name: body.name,
        full_name: `owner/${body.name}`,
        default_branch: state.branch,
        private: false,
      });
    }
    if (url.pathname === '/user/repos' && method === 'GET') {
      return jsonResponse([
        {
          id: 310001,
          name: 'example',
          full_name: 'owner/example',
          private: false,
          html_url: 'https://github.com/owner/example',
          description: 'Example',
          homepage: null,
          topics: [],
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
          default_branch: 'main',
          language: null,
          archived: false,
          fork: false,
          owner: { id: state.userId, login: 'owner' },
        },
      ]);
    }

    const repoPath = `/repos/owner/${process.env.GITHUB_REPO}`;
    if (url.pathname === repoPath && method === 'GET') {
      return state.exists
        ? jsonResponse({
            name: process.env.GITHUB_REPO,
            full_name: `owner/${process.env.GITHUB_REPO}`,
            default_branch: state.branch,
            private: state.private,
            node_id: 'fixture-repository-node-id',
          })
        : jsonResponse(null, 404);
    }
    if (url.pathname === `${repoPath}/git/ref/heads/${state.branch}` && method === 'GET') {
      if (state.branchRefStatus) {
        return jsonResponse({ message: 'Git reference is unavailable' }, state.branchRefStatus);
      }
      return jsonResponse({ object: { sha: state.branchSha, type: 'commit' } });
    }
    const gitCommitMatch = new RegExp(`^${repoPath}/git/commits/([a-f0-9]{40})$`).exec(
      url.pathname,
    );
    if (gitCommitMatch && method === 'GET') {
      const commit = state.commits.get(gitCommitMatch[1]);
      return commit ? jsonResponse({ tree: { sha: commit.treeSha } }) : jsonResponse(null, 404);
    }
    if (url.pathname === `${repoPath}/commits` && method === 'GET') {
      return jsonResponse([
        {
          sha: 'd'.repeat(40),
          html_url: `https://github.com/owner/${process.env.GITHUB_REPO}/commit/${'d'.repeat(40)}`,
        },
      ]);
    }

    if (url.pathname === `${repoPath}/git/blobs` && method === 'POST') {
      const body = JSON.parse(String(init.body)) as { content: string; encoding: string };
      assert.equal(body.encoding, 'base64');
      const bytes = Buffer.from(body.content, 'base64');
      const sha = gitBlobSha(bytes);
      state.blobs.set(sha, bytes);
      return jsonResponse({ sha, size: bytes.byteLength });
    }
    if (url.pathname === `${repoPath}/git/trees` && method === 'POST') {
      const body = JSON.parse(String(init.body)) as {
        base_tree: string;
        tree: Array<{ path: string; mode: string; type: string; sha: string | null }>;
      };
      assert.equal(body.base_tree, state.treeSha);
      assert.ok(body.tree.length > 0);
      assert.ok(body.tree.every(({ mode, type }) => mode === '100644' && type === 'blob'));
      const sha = nextGitSha(state);
      state.trees.set(
        sha,
        body.tree.map(({ path, sha: blobSha }) => ({ path, sha: blobSha })),
      );
      return jsonResponse({ sha });
    }
    if (url.pathname === `${repoPath}/git/commits` && method === 'POST') {
      if (state.failCommitOnce) {
        state.failCommitOnce = false;
        return jsonResponse({ message: 'transient commit failure' }, 500);
      }
      const body = JSON.parse(String(init.body)) as {
        message: string;
        tree: string;
        parents: string[];
        author: { name: string; email: string };
        committer: { name: string; email: string };
      };
      assert.equal(body.message, 'cms: initialize portfolio content');
      assert.deepEqual(body.parents, [state.branchSha]);
      assert.deepEqual(body.author, { name: 'Portfolio CMS', email: 'cms@portfolio.local' });
      assert.deepEqual(body.committer, body.author);
      const sha = nextGitSha(state);
      state.commits.set(sha, {
        treeSha: body.tree,
        parentSha: body.parents[0],
        message: body.message,
        author: body.author,
        committer: body.committer,
      });
      return jsonResponse({
        sha,
        html_url: `https://github.com/owner/${process.env.GITHUB_REPO}/commit/${sha}`,
      });
    }
    if (url.hostname === 'api.github.com' && url.pathname === '/graphql' && method === 'POST') {
      const body = JSON.parse(String(init.body)) as {
        variables: {
          input: {
            repositoryId: string;
            refUpdates: Array<{
              name: string;
              beforeOid: string;
              afterOid: string;
              force: boolean;
            }>;
            clientMutationId: string;
          };
        };
      };
      const input = body.variables.input;
      assert.equal(input.repositoryId, 'fixture-repository-node-id');
      assert.deepEqual(input.refUpdates, [
        {
          name: `refs/heads/${state.branch}`,
          beforeOid: state.branchSha,
          afterOid: input.clientMutationId,
          force: false,
        },
      ]);
      const commit = state.commits.get(input.clientMutationId);
      assert.ok(commit);
      assert.equal(commit.parentSha, state.branchSha);
      const treeChanges = state.trees.get(commit.treeSha);
      assert.ok(treeChanges);
      for (const { path, sha } of treeChanges) {
        if (sha === null) {
          state.files.delete(path);
          continue;
        }
        const bytes = state.blobs.get(sha);
        assert.ok(bytes);
        state.files.set(path, { bytes, sha });
      }
      state.branchSha = input.clientMutationId;
      state.treeSha = commit.treeSha;
      return jsonResponse({ data: { updateRefs: { clientMutationId: input.clientMutationId } } });
    }

    if (url.pathname.startsWith(`${repoPath}/contents`)) {
      if (!state.exists) {
        return jsonResponse(null, 404);
      }
      const path = decodeURIComponent(
        url.pathname.slice(`${repoPath}/contents`.length).replace(/^\//, ''),
      );
      if (method === 'GET') {
        const ref = url.searchParams.get('ref');
        if (ref !== state.branch && ref !== state.branchSha && !state.commits.has(ref ?? '')) {
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

function addProject(
  state: FakeState,
  slug: string,
  data: ProjectDocument = project,
  sha = '4'.repeat(40),
) {
  state.files.set(`content/projects/${slug}.json`, fileRecord(JSON.stringify(data), sha));
  state.files.set(data.media.cover, fileRecord(png));
}

test('repository configuration accepts a repository name and rejects paths/source repositories', () => {
  setupEnvironment();
  assert.deepEqual(getCmsConfig(), { repository: 'portfolio-content' });
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
  assert.equal(projectSchema.safeParse({ ...project, schemaVersion: 1 }).success, false);
  assert.equal(
    projectSchema.safeParse({ ...project, links: { demo: 'javascript:alert(1)' } }).success,
    false,
  );
  assert.equal(
    finalizeCmsDraftSchema.safeParse({
      kind: 'finalize',
      projects: {
        upsert: [{ slug: '../secret', expectedSha: null, data: project }],
        delete: [],
      },
      media: [],
    }).success,
    false,
  );
  assert.equal(
    stageMediaBlobSchema.safeParse({
      scope: 'project',
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
  assert.ok(state.calls.some(({ url }) => url.pathname === '/user'));
  assert.ok(
    state.calls
      .filter(({ url }) => url.pathname.includes('/contents'))
      .every(({ url }) => url.searchParams.get('ref') === 'trunk'),
  );
  assert.ok(state.calls.some(({ url }) => url.hostname === 'raw.githubusercontent.com'));
  assert.ok(
    state.calls.some(
      ({ url, init }) =>
        url.pathname === '/user' &&
        (init.headers as Record<string, string> | undefined)?.Authorization ===
          'Bearer owner-token',
    ),
  );
});

test('authenticated snapshots use the owner token when resolving the repository owner', async () => {
  setupEnvironment();
  const state = createState();
  addSeedContent(state);
  addProject(state, 'example-project');
  installGithub(state);

  await getSnapshot('owner-token');

  const ownerRequest = state.calls.find(({ url }) => url.pathname === '/user');
  assert.equal(
    (ownerRequest?.init.headers as Record<string, string>).Authorization,
    'Bearer owner-token',
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
  assert.deepEqual(
    JSON.parse(Buffer.from(state.files.get('content/project-index.json')!.bytes).toString('utf8')),
    { schemaVersion: 1, projects: ['example-project'] },
  );
  assert.equal(
    state.calls.filter(
      ({ url, init }) => url.pathname.endsWith('/git/commits') && init.method === 'POST',
    ).length,
    1,
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
    'content/project-index.json',
    'content/site.json',
    'content/technologies.json',
  ]);
  assert.equal(
    Buffer.from(state.files.get('README.md')!.bytes).toString('utf8'),
    '# portfolio-content\n',
  );
  const contentReads = state.calls.filter(
    ({ url, init }) => url.pathname.includes('/contents') && (init.method ?? 'GET') === 'GET',
  );
  assert.ok(contentReads.length > 0);
  assert.ok(
    contentReads.every(({ url }) => {
      const ref = url.searchParams.get('ref');
      return ref !== null && state.commits.has(ref);
    }),
    'initialization reads content from branch commit SHAs',
  );
  const cmsCommitCalls = state.calls.filter(
    ({ url, init }) => url.pathname.endsWith('/git/commits') && init.method === 'POST',
  );
  assert.equal(cmsCommitCalls.length, 1);
  assert.equal(
    state.calls.filter(({ url, init }) => url.pathname === '/graphql' && init.method === 'POST')
      .length,
    1,
  );
  assert.equal(
    state.calls.some(
      ({ url, init }) => url.pathname.includes('/contents') && init.method === 'PUT',
    ),
    false,
  );
  const initialCmsCommit = state.commits.get(state.branchSha);
  assert.ok(initialCmsCommit);
  assert.equal(initialCmsCommit.message, 'cms: initialize portfolio content');
  assert.deepEqual(initialCmsCommit.author, {
    name: 'Portfolio CMS',
    email: 'cms@portfolio.local',
  });
  assert.deepEqual(initialCmsCommit.committer, initialCmsCommit.author);

  await initializeRepository('owner-token');
  assert.equal(
    state.calls.filter(
      ({ url, init }) => url.pathname.endsWith('/git/commits') && init.method === 'POST',
    ).length,
    1,
    'a repeated initialization is a no-op',
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
  assert.deepEqual(
    JSON.parse(
      Buffer.from(partial.files.get('content/project-index.json')!.bytes).toString('utf8'),
    ),
    { schemaVersion: 1, projects: [] },
  );
  assert.equal(
    partial.calls.filter(
      ({ url, init }) => url.pathname.endsWith('/git/commits') && init.method === 'POST',
    ).length,
    1,
  );

  const unrelated = createState();
  unrelated.files.set('data/old.json', fileRecord('{}'));
  installGithub(unrelated);
  await assert.rejects(initializeRepository('owner-token'), (error: unknown) => {
    assert.ok(error instanceof CmsError);
    assert.equal(error.code, 'unsupported_repository');
    return true;
  });
  assert.equal([...unrelated.files.keys()].length, 1);
  assert.equal(
    unrelated.calls.some(
      ({ url, init }) => url.pathname.endsWith('/git/commits') && init.method === 'POST',
    ),
    false,
  );
});

test('initialization asks for an initial commit before handling a pre-existing empty repository', async () => {
  setupEnvironment();
  const emptyRepositories = [
    createState({ branch: '' }),
    createState({ branchRefStatus: 404 }),
    createState({ branchRefStatus: 409 }),
  ];

  for (const emptyRepository of emptyRepositories) {
    installGithub(emptyRepository);
    await assert.rejects(initializeRepository('owner-token'), (error: unknown) => {
      assert.ok(error instanceof CmsError);
      assert.equal(error.code, 'not_found');
      assert.match(error.message, /initial README commit/);
      return true;
    });
    assert.equal(
      emptyRepository.calls.some(({ init }) => init.method === 'POST'),
      false,
      'empty repositories are rejected before any GitHub write',
    );
  }
});

test('initialization retry accepts and preserves the auto-init README after a failed first attempt', async () => {
  setupEnvironment();
  const state = createState({ exists: false, failCommitOnce: true });
  installGithub(state);

  await assert.rejects(initializeRepository('owner-token'), { code: 'unavailable' });
  const readme = Buffer.from(state.files.get('README.md')!.bytes);
  assert.equal(readme.toString('utf8'), '# portfolio-content\n');
  assert.deepEqual([...state.files.keys()], ['README.md']);

  const snapshot = await initializeRepository('owner-token');

  assert.equal(snapshot.site.data.siteTitle, 'Developer Portfolio');
  assert.deepEqual(Buffer.from(state.files.get('README.md')!.bytes), readme);
  assert.ok(state.files.has('content/categories.json'));
  assert.ok(state.files.has('content/site.json'));
  assert.ok(state.files.has('content/technologies.json'));
  assert.ok(state.files.has('content/project-index.json'));
  assert.equal(
    state.calls.filter(({ url, init }) => url.pathname === '/graphql' && init.method === 'POST')
      .length,
    1,
    'retry updates the branch with a single CMS commit',
  );
});

test('private repositories are rejected by authenticated reads', async () => {
  setupEnvironment();
  const privateRepo = createState({ private: true });
  installGithub(privateRepo);
  await assert.rejects(getSnapshot(), (error: unknown) => {
    assert.ok(error instanceof CmsError);
    assert.equal(error.code, 'unsupported_repository');
    return true;
  });
});

test('media staging validates raster bytes and creates content-addressed Git blobs without moving the ref', async () => {
  setupEnvironment();
  const state = createState();
  installGithub(state);
  const content = Buffer.from(png).toString('base64');

  await assert.rejects(
    stageMediaBlob('owner-token', {
      scope: 'project',
      slug: '../escape',
      filename: 'cover.png',
      mime: 'image/png',
      content,
    }),
    /slug/,
  );
  await assert.rejects(
    stageMediaBlob('owner-token', {
      scope: 'project',
      slug: 'sample-project',
      filename: 'cover.jpg',
      mime: 'image/jpeg',
      content,
    }),
    /match its type/,
  );

  const uploaded = await stageMediaBlob('owner-token', {
    scope: 'project',
    slug: 'sample-project',
    filename: 'Cover image.png',
    mime: 'image/png',
    content,
  });
  const expectedDigest = createHash('sha256').update(png).digest('hex');
  assert.ok(uploaded.path.startsWith(`media/projects/sample-project/${expectedDigest}-`));
  assert.equal(uploaded.blobSha, gitBlobSha(png));
  assert.ok(Buffer.from(state.blobs.get(uploaded.blobSha)!).equals(Buffer.from(png)));
  assert.equal(state.files.has(uploaded.path), false);

  const duplicate = await stageMediaBlob('owner-token', {
    scope: 'project',
    slug: 'sample-project',
    filename: 'Cover image.png',
    mime: 'image/png',
    content,
  });
  assert.equal(duplicate.path, uploaded.path);
  assert.equal(duplicate.blobSha, uploaded.blobSha);

  const icon = await stageMediaBlob('owner-token', {
    scope: 'technology',
    slug: 'technologies',
    filename: 'React.png',
    mime: 'image/png',
    content,
  });
  assert.ok(icon.path.startsWith(`media/technologies/${expectedDigest}-`));
  assert.equal(state.files.size, 0);
  assert.equal(
    state.calls.filter(
      ({ url, init }) => url.pathname.endsWith('/git/blobs') && init.method === 'POST',
    ).length,
    3,
  );
  assert.equal(
    state.calls.some(
      ({ url, init }) =>
        url.pathname.includes('/git/refs/') ||
        url.pathname.endsWith('/git/trees') ||
        url.pathname.endsWith('/git/commits') ||
        init.method === 'PUT',
    ),
    false,
  );
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
