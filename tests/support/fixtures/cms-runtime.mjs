import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const nativeFetch = globalThis.fetch;

process.env.GITHUB_PAT = 'fixture-owner-token';
process.env.GITHUB_REPO = 'portfolio-content-fixture';
process.env.DRIBBBLE_TOKEN = 'fixture-dribbble-token';
process.env.AUTH_SECRET = 'cms-browser-fixture-secret-with-at-least-thirty-two-characters';
process.env.AUTH_GITHUB_ID = 'fixture-github-client-id';
process.env.AUTH_GITHUB_SECRET = 'fixture-github-client-secret';

const owner = 'fixture-owner';
const repository = process.env.GITHUB_REPO;
const defaultBranch = 'published';
const adminId = 42424242;
const ownerToken = 'fixture-owner-token';
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/L8kAAAAASUVORK5CYII=',
  'base64',
);

const site = {
  schemaVersion: 1,
  siteTitle: 'Fixture Portfolio',
  headline: 'Fixture portfolio headline',
  introduction: 'Published content from the in-memory GitHub fixture.',
  socialLinks: [],
};
const categories = { web: { label: 'Website', sortOrder: 10 } };
const technologies = { nextjs: { label: 'Next.js' } };
const portfolio = {
  schemaVersion: 2,
  profile: {
    name: 'Fixture Portfolio Owner',
    title: 'Software Engineer',
    linkedin: 'https://example.com/linkedin',
    github: 'https://example.com/github',
    dribbble: 'https://example.com/dribbble',
    instagram: 'https://example.com/instagram',
    cv: 'https://example.com/cv',
    intro: 'A profile served from the fixture content repository.',
    experiences: [],
    education: { school: 'Fixture University', degree: 'Computer Science', years: '2020–2024' },
  },
  skills: [{ label: 'React', icon: 'react' }],
  designs: ['1', '2', '3', '4'],
  projectStudies: {},
  portfolioSource: 'https://github.com/fixture-owner/portfolio',
  portfolioSourceRef: 'fixture-ref',
};
const fixtureProject = {
  schemaVersion: 2,
  githubRepositoryId: null,
  title: 'Fixture Portfolio Project',
  summary: 'A project served by the isolated CMS browser fixture.',
  description: 'This project verifies the production CMS editor and GitHub-backed public reads.',
  published: true,
  featured: true,
  sortOrder: 10,
  year: 2026,
  categories: ['web'],
  technologies: ['nextjs'],
  tags: ['fixture', 'cms'],
  links: { source: 'https://github.com/fixture-owner/example-project' },
  media: { cover: 'media/projects/fixture-project/cover.png', gallery: [] },
};

function sha1(bytes) {
  return createHash('sha1').update(bytes).digest('hex');
}

function blobSha(bytes) {
  return sha1(Buffer.concat([Buffer.from(`blob ${bytes.byteLength}\0`), Buffer.from(bytes)]));
}

const files = new Map();
const commitsByPath = new Map();
const gitBlobs = new Map();
const commitTrees = new Map();
const treeFiles = new Map();
const pendingCommits = new Map();
const commitParents = new Map();
const gitStats = { blobCreations: 0, treeCreations: 0, commitsCreated: 0, refUpdates: 0 };
let commitCounter = 1;
let gitObjectCounter = 1;
let latestCommit = '0'.repeat(40);
let latestTreeSha = 'f'.repeat(40);

function store(path, bytes, sha = blobSha(bytes)) {
  files.set(path, { bytes: Buffer.from(bytes), sha });
}

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

store('README.md', Buffer.from('# Portfolio content fixture\n', 'utf8'));
store('content/site.json', jsonBytes(site));
store('content/categories.json', jsonBytes(categories));
store('content/technologies.json', jsonBytes(technologies));
store('content/portfolio.json', jsonBytes(portfolio));
store('content/project-index.json', jsonBytes({ schemaVersion: 1, projects: ['fixture-project'] }));
store('content/projects/fixture-project.json', jsonBytes(fixtureProject));
store(fixtureProject.media.cover, png);
store('media/projects/browser-cms-project/cover.png', png);
treeFiles.set(latestTreeSha, new Map(files));
commitTrees.set(latestCommit, latestTreeSha);
commitParents.set(latestCommit, null);

function jsonResponse(value, status = 200, headers = {}) {
  return new Response(value === null ? null : JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function authorized(headers) {
  const value = new Headers(headers).get('authorization');
  return !value || value === `Bearer ${ownerToken}`;
}

function contentsEntry(path, stored) {
  const name = path.split('/').at(-1);
  return {
    type: 'file',
    name,
    path,
    sha: stored.sha,
    size: stored.bytes.byteLength,
    encoding: 'base64',
    content: stored.bytes.toString('base64'),
    download_url: `https://raw.githubusercontent.com/${owner}/${repository}/${defaultBranch}/${path}`,
  };
}

function listDirectory(path, sourceFiles = files) {
  const prefix = path ? `${path}/` : '';
  const entries = new Map();
  for (const filePath of sourceFiles.keys()) {
    if (!filePath.startsWith(prefix)) {
      continue;
    }
    const rest = filePath.slice(prefix.length);
    const name = rest.split('/')[0];
    if (!name) {
      continue;
    }
    entries.set(name, rest.includes('/') ? 'dir' : 'file');
  }
  if (!entries.size) {
    return null;
  }
  return [...entries].map(([name, type]) => ({
    type,
    name,
    path: prefix + name,
    sha: 'b'.repeat(40),
    size: 0,
  }));
}

function createCommit(path, bytes) {
  const sequence = String(commitCounter++).padStart(8, '0');
  const sha = sha1(Buffer.concat([Buffer.from(`${path}\0${sequence}\0`), Buffer.from(bytes)]));
  const treeSha = sha1(Buffer.from(`tree\0${sequence}\0${[...files.keys()].sort().join('\0')}`));
  const parentSha = latestCommit;
  const commit = {
    sha,
    html_url: `https://github.com/${owner}/${repository}/commit/${sha}`,
  };
  latestCommit = sha;
  latestTreeSha = treeSha;
  treeFiles.set(treeSha, new Map(files));
  commitTrees.set(sha, treeSha);
  commitParents.set(sha, parentSha);
  commitsByPath.set(path, commit);
  return commit;
}

function filesAtRef(ref) {
  if (ref === defaultBranch) {
    return files;
  }
  const treeSha = commitTrees.get(ref);
  return treeSha ? (treeFiles.get(treeSha) ?? null) : null;
}

function rawLocation(url) {
  const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  if (
    parts[0] !== owner ||
    parts[1] !== repository ||
    (parts[2] !== defaultBranch && !/^[a-f0-9]{40}$/.test(parts[2]))
  ) {
    return null;
  }
  return { ref: parts[2], path: parts.slice(3).join('/') };
}

function nextGitSha(label, value) {
  const sequence = String(gitObjectCounter++).padStart(8, '0');
  return sha1(Buffer.concat([Buffer.from(`${label}\0${sequence}\0`), Buffer.from(value)]));
}

function storeGitBlob(bytes) {
  const content = Buffer.from(bytes);
  const sha = blobSha(content);
  gitBlobs.set(sha, content);
  return sha;
}

function applyGitTree(baseTreeSha, entries) {
  const base = treeFiles.get(baseTreeSha);
  if (!base) {
    return null;
  }
  const next = new Map(base);
  for (const entry of entries) {
    if (!entry || typeof entry.path !== 'string' || entry.type !== 'blob') {
      return null;
    }
    if (entry.sha === null) {
      next.delete(entry.path);
      continue;
    }
    const bytes = gitBlobs.get(entry.sha);
    if (!bytes) {
      return null;
    }
    next.set(entry.path, { bytes: Buffer.from(bytes), sha: entry.sha });
  }
  return next;
}

function findMergeBase(leftSha, rightSha) {
  const leftAncestors = new Set();
  for (let sha = leftSha; sha; sha = commitParents.get(sha)) {
    leftAncestors.add(sha);
  }
  for (let sha = rightSha; sha; sha = commitParents.get(sha)) {
    if (leftAncestors.has(sha)) {
      return sha;
    }
  }
  return null;
}

function externalPortfolioIntro() {
  const path = process.env.CMS_FIXTURE_PORTFOLIO_OVERRIDE;
  if (!path) {
    return null;
  }
  try {
    const value = JSON.parse(readFileSync(path, 'utf8'));
    return typeof value.intro === 'string' ? value.intro : null;
  } catch {
    return null;
  }
}

globalThis.fetch = async (input, init = {}) => {
  let requestUrl;
  try {
    requestUrl = input instanceof Request ? new URL(input.url) : new URL(input.toString());
  } catch {
    return jsonResponse({ error: 'Unexpected request in the CMS browser fixture.' }, 502);
  }
  if (
    requestUrl.protocol === 'http:' &&
    requestUrl.hostname === '127.0.0.1' &&
    requestUrl.port === '3104'
  ) {
    return nativeFetch(input, init);
  }
  const method = init.method ?? (input instanceof Request ? input.method : 'GET');
  const headers = new Headers(
    init.headers ?? (input instanceof Request ? input.headers : undefined),
  );

  if (requestUrl.hostname === 'api.dribbble.com' && requestUrl.pathname === '/v2/user/shots') {
    if (headers.get('authorization') !== 'Bearer fixture-dribbble-token') {
      return jsonResponse({ message: 'bad credentials' }, 401);
    }
    return jsonResponse(
      Array.from({ length: 4 }, (_, index) => ({
        id: index + 1,
        title: `Fixture Design ${index + 1}`,
        html_url: `https://dribbble.com/shots/${index + 1}`,
        images: { hidpi: null, normal: `https://example.com/image/${index + 1}.png` },
      })),
    );
  }

  if (
    requestUrl.hostname === 'github.com' &&
    requestUrl.pathname === `/${owner}/${repository}/commits/${defaultBranch}.atom`
  ) {
    const intro = externalPortfolioIntro();
    const revision = intro ? sha1(Buffer.from(`${latestCommit}:${intro}`)) : latestCommit;
    return new Response(
      `<feed><entry><id>tag:github.com,2008:Grit::Commit/${revision}</id></entry></feed>`,
      { headers: { 'Content-Type': 'application/atom+xml' } },
    );
  }

  if (
    requestUrl.protocol !== 'https:' ||
    !['api.github.com', 'raw.githubusercontent.com'].includes(requestUrl.hostname)
  ) {
    return jsonResponse({ error: 'Unexpected request in the CMS browser fixture.' }, 502);
  }

  if (requestUrl.hostname === 'raw.githubusercontent.com') {
    const location = rawLocation(requestUrl);
    const snapshot = location ? filesAtRef(location.ref) : null;
    const stored = snapshot && location ? snapshot.get(location.path) : undefined;
    const intro = externalPortfolioIntro();
    if (stored && location?.path === 'content/portfolio.json' && intro) {
      const data = JSON.parse(stored.bytes.toString('utf8'));
      data.profile.intro = intro;
      return new Response(jsonBytes(data), { headers: { 'Content-Type': 'application/json' } });
    }
    return stored
      ? new Response(stored.bytes, { headers: { 'Content-Type': 'image/png' } })
      : jsonResponse(null, 404);
  }

  if (requestUrl.pathname === '/user' && method === 'GET') {
    const token = headers.get('authorization');
    if (token === 'Bearer fixture-rate-limited-token') {
      return jsonResponse({ message: 'rate limited' }, 403, { 'X-RateLimit-Remaining': '0' });
    }
    if (token !== `Bearer ${ownerToken}`) {
      return jsonResponse({ message: 'bad credentials' }, 401);
    }
    return jsonResponse({ id: adminId, login: owner });
  }
  if (requestUrl.pathname === `/user/${adminId}` && method === 'GET') {
    return jsonResponse({ id: adminId, login: owner });
  }
  if (!authorized(headers)) {
    return jsonResponse({ message: 'bad credentials' }, 401);
  }
  if (method !== 'GET' && headers.get('authorization') !== `Bearer ${ownerToken}`) {
    return jsonResponse({ message: 'bad credentials' }, 401);
  }

  if (requestUrl.pathname === '/graphql' && method === 'POST') {
    const body = JSON.parse(String(init.body ?? ''));
    const input = body.variables?.input;
    const [update] = input?.refUpdates ?? [];
    const commit = pendingCommits.get(update?.afterOid);
    if (
      input?.repositoryId !== 'R_kgDOFixtureRepository' ||
      input?.clientMutationId !== update?.afterOid ||
      update?.name !== `refs/heads/${defaultBranch}` ||
      update?.force !== false ||
      !commit
    ) {
      return jsonResponse({ errors: [{ message: 'A valid non-force ref update is required.' }] });
    }
    if (update.beforeOid !== latestCommit || commit.parentSha !== update.beforeOid) {
      return jsonResponse({
        errors: [{ message: 'The branch head no longer matches beforeOid.' }],
      });
    }
    const nextFiles = treeFiles.get(commit.treeSha);
    if (!nextFiles) {
      return jsonResponse({ errors: [{ message: 'The commit tree was not found.' }] });
    }
    files.clear();
    for (const [path, stored] of nextFiles) {
      files.set(path, stored);
    }
    latestCommit = commit.sha;
    latestTreeSha = commit.treeSha;
    gitStats.refUpdates++;
    return jsonResponse({ data: { updateRefs: { clientMutationId: input.clientMutationId } } });
  }

  if (requestUrl.pathname === '/user/repos' && method === 'GET') {
    return jsonResponse(
      [false, true].map((isPrivate, index) => ({
        id: 310001 + index,
        name: isPrivate ? 'private-app' : 'sample-app',
        full_name: `${owner}/${isPrivate ? 'private-app' : 'sample-app'}`,
        private: isPrivate,
        html_url: `https://github.com/${owner}/${isPrivate ? 'private-app' : 'sample-app'}`,
        description: 'A repository available to the fixture owner.',
        homepage: null,
        topics: ['nextjs'],
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-02-01T00:00:00Z',
        default_branch: 'main',
        language: 'TypeScript',
        archived: false,
        fork: false,
        owner: { id: adminId, login: owner },
      })),
    );
  }

  const repoPath = `/repos/${owner}/${repository}`;
  if (requestUrl.pathname === repoPath && method === 'GET') {
    return jsonResponse({
      node_id: 'R_kgDOFixtureRepository',
      name: repository,
      full_name: `${owner}/${repository}`,
      default_branch: defaultBranch,
      private: false,
    });
  }
  if (requestUrl.pathname === '/user/repos' && method === 'POST') {
    return jsonResponse({
      name: repository,
      full_name: `${owner}/${repository}`,
      default_branch: defaultBranch,
      private: false,
    });
  }
  if (requestUrl.pathname === `${repoPath}/commits` && method === 'GET') {
    const path = requestUrl.searchParams.get('path') ?? '';
    const commit = commitsByPath.get(path);
    return jsonResponse(commit ? [commit] : []);
  }
  if (requestUrl.pathname === `${repoPath}/git/ref/heads/${defaultBranch}` && method === 'GET') {
    return jsonResponse({
      ref: `refs/heads/${defaultBranch}`,
      object: { sha: latestCommit, type: 'commit' },
    });
  }
  const gitCommitMatch = new RegExp(`^${repoPath}/git/commits/([a-f0-9]{40})$`).exec(
    requestUrl.pathname,
  );
  if (gitCommitMatch && method === 'GET') {
    const treeSha = commitTrees.get(gitCommitMatch[1]);
    return treeSha
      ? jsonResponse({ sha: gitCommitMatch[1], tree: { sha: treeSha } })
      : jsonResponse({ message: 'Commit not found.' }, 404);
  }
  const gitBlobPath = `${repoPath}/git/blobs`;
  if (requestUrl.pathname === gitBlobPath && method === 'POST') {
    const body = JSON.parse(String(init.body ?? ''));
    if (body.encoding !== 'base64' || typeof body.content !== 'string') {
      return jsonResponse({ message: 'Base64 blob data is required.' }, 422);
    }
    const bytes = Buffer.from(body.content, 'base64');
    const sha = storeGitBlob(bytes);
    gitStats.blobCreations++;
    return jsonResponse({ sha, size: bytes.byteLength });
  }
  const gitBlobMatch = new RegExp(`^${gitBlobPath}/([a-f0-9]{40})$`).exec(requestUrl.pathname);
  if (gitBlobMatch && method === 'GET') {
    const bytes = gitBlobs.get(gitBlobMatch[1]);
    return bytes
      ? jsonResponse({
          sha: gitBlobMatch[1],
          size: bytes.byteLength,
          encoding: 'base64',
          content: bytes.toString('base64'),
        })
      : jsonResponse({ message: 'Blob not found.' }, 404);
  }
  if (requestUrl.pathname === `${repoPath}/git/trees` && method === 'POST') {
    const body = JSON.parse(String(init.body ?? ''));
    if (typeof body.base_tree !== 'string' || !Array.isArray(body.tree)) {
      return jsonResponse({ message: 'A base tree and entries are required.' }, 422);
    }
    const next = applyGitTree(body.base_tree, body.tree);
    if (!next) {
      return jsonResponse({ message: 'The tree contains an unknown blob or base.' }, 422);
    }
    const sha = nextGitSha('tree', Buffer.from(JSON.stringify(body.tree)));
    treeFiles.set(sha, next);
    gitStats.treeCreations++;
    return jsonResponse({ sha });
  }
  if (requestUrl.pathname === `${repoPath}/git/commits` && method === 'POST') {
    const body = JSON.parse(String(init.body ?? ''));
    const tree = treeFiles.get(body.tree);
    const parentSha = Array.isArray(body.parents) ? body.parents[0] : undefined;
    if (
      !tree ||
      !parentSha ||
      body.author?.name !== 'Portfolio CMS' ||
      body.author?.email !== 'cms@portfolio.local' ||
      body.committer?.name !== 'Portfolio CMS' ||
      body.committer?.email !== 'cms@portfolio.local'
    ) {
      return jsonResponse({ message: 'A valid tree, parent, and CMS identity are required.' }, 422);
    }
    const sha = nextGitSha('commit', Buffer.from(JSON.stringify(body)));
    const commit = {
      sha,
      commitUrl: `https://github.com/${owner}/${repository}/commit/${sha}`,
      treeSha: body.tree,
      parentSha,
    };
    pendingCommits.set(sha, commit);
    commitTrees.set(sha, body.tree);
    commitParents.set(sha, parentSha);
    gitStats.commitsCreated++;
    return jsonResponse({ sha, html_url: commit.commitUrl });
  }
  const comparePrefix = `${repoPath}/compare/`;
  const comparison = requestUrl.pathname.startsWith(comparePrefix)
    ? requestUrl.pathname.slice(comparePrefix.length).split('...')
    : [];
  if (
    method === 'GET' &&
    comparison.length === 2 &&
    comparison.every((sha) => /^[a-f0-9]{40}$/.test(sha))
  ) {
    const mergeBase = findMergeBase(comparison[0], comparison[1]);
    return jsonResponse({ merge_base_commit: mergeBase ? { sha: mergeBase } : null });
  }
  if (requestUrl.pathname.startsWith(`${repoPath}/contents`)) {
    const ref = requestUrl.searchParams.get('ref');
    const snapshot = ref ? filesAtRef(ref) : null;
    if (method === 'GET' && !snapshot) {
      return jsonResponse({ message: 'A valid branch or commit ref is required.' }, 400);
    }
    const path = decodeURIComponent(
      requestUrl.pathname.slice(`${repoPath}/contents`.length).replace(/^\//, ''),
    );
    if (method === 'GET') {
      const stored = snapshot.get(path);
      if (stored) {
        return jsonResponse(contentsEntry(path, stored));
      }
      const directory = listDirectory(path, snapshot);
      return directory ? jsonResponse(directory) : jsonResponse(null, 404);
    }
    if (method === 'PUT') {
      const body = JSON.parse(String(init.body ?? ''));
      if (body.branch !== defaultBranch) {
        return jsonResponse({ message: 'Unexpected branch.' }, 422);
      }
      if (
        body.author?.name !== 'Portfolio CMS' ||
        body.author?.email !== 'cms@portfolio.local' ||
        body.committer?.name !== 'Portfolio CMS' ||
        body.committer?.email !== 'cms@portfolio.local'
      ) {
        return jsonResponse({ message: 'CMS commit attribution is required.' }, 422);
      }
      const existing = files.get(path);
      if ((existing && body.sha !== existing.sha) || (!existing && body.sha)) {
        return jsonResponse({ message: 'Content changed.' }, 409);
      }
      const bytes = Buffer.from(String(body.content), 'base64');
      store(path, bytes);
      const commit = createCommit(path, bytes);
      const saved = files.get(path);
      return jsonResponse({ content: { sha: saved.sha }, commit });
    }
    if (method === 'DELETE') {
      const body = JSON.parse(String(init.body ?? ''));
      const existing = files.get(path);
      if (!existing || body.sha !== existing.sha) {
        return jsonResponse({ message: 'Content changed.' }, 409);
      }
      files.delete(path);
      return jsonResponse({ content: null, commit: createCommit(path, Buffer.from('deleted')) });
    }
  }

  return jsonResponse({ error: 'Unexpected GitHub API request in the CMS browser fixture.' }, 502);
};

// Keep a named handle so tests can inspect fixture mode without exposing credentials.
globalThis.__cmsBrowserFixture = Object.freeze({
  adminId,
  owner,
  repository,
  defaultBranch,
  gitStats,
});
