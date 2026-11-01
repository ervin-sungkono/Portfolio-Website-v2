import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const nativeFetch = globalThis.fetch;

process.env.GITHUB_ADMIN_ID = '42424242';
process.env.GITHUB_REPO = 'portfolio-content-fixture';
process.env.GITHUB_CONTENT_OWNER = 'fixture-owner';
process.env.GITHUB_CONTENT_BRANCH = 'published';
process.env.AUTH_SECRET = 'cms-browser-fixture-secret-with-at-least-thirty-two-characters';
process.env.AUTH_GITHUB_ID = 'fixture-github-client-id';
process.env.AUTH_GITHUB_SECRET = 'fixture-github-client-secret';

const owner = 'fixture-owner';
const repository = process.env.GITHUB_REPO;
const defaultBranch = 'published';
const adminId = Number(process.env.GITHUB_ADMIN_ID);
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
  schemaVersion: 1,
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
  designs: Array.from({ length: 4 }, (_, index) => ({
    title: `Fixture Design ${index + 1}`,
    url: `https://example.com/design/${index + 1}`,
    id: String(index + 1),
    image: `https://example.com/image/${index + 1}.png`,
    category: 'Web',
  })),
  projectStudies: {},
  portfolioSource: 'https://github.com/fixture-owner/portfolio',
  portfolioSourceRef: 'fixture-ref',
};
const fixtureProject = {
  schemaVersion: 1,
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
let commitCounter = 1;
let latestCommit = '0'.repeat(40);

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

function listDirectory(path) {
  const prefix = path ? `${path}/` : '';
  const entries = new Map();
  for (const filePath of files.keys()) {
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
  const commit = {
    sha,
    html_url: `https://github.com/${owner}/${repository}/commit/${sha}`,
  };
  latestCommit = sha;
  commitsByPath.set(path, commit);
  return commit;
}

function rawPath(url) {
  const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  if (
    parts[0] !== owner ||
    parts[1] !== repository ||
    (parts[2] !== defaultBranch && !/^[a-f0-9]{40}$/.test(parts[2]))
  ) {
    return null;
  }
  return parts.slice(3).join('/');
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
    const path = rawPath(requestUrl);
    const stored = path ? files.get(path) : undefined;
    const intro = externalPortfolioIntro();
    if (stored && path === 'content/portfolio.json' && intro) {
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

  const repoPath = `/repos/${owner}/${repository}`;
  if (requestUrl.pathname === repoPath && method === 'GET') {
    return jsonResponse({
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
  if (requestUrl.pathname.startsWith(`${repoPath}/contents`)) {
    const ref = requestUrl.searchParams.get('ref');
    if (method === 'GET' && ref !== defaultBranch) {
      return jsonResponse({ message: 'A default branch ref is required.' }, 400);
    }
    const path = decodeURIComponent(
      requestUrl.pathname.slice(`${repoPath}/contents`.length).replace(/^\//, ''),
    );
    if (method === 'GET') {
      const stored = files.get(path);
      if (stored) {
        return jsonResponse(contentsEntry(path, stored));
      }
      const directory = listDirectory(path);
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
globalThis.__cmsBrowserFixture = Object.freeze({ adminId, owner, repository, defaultBranch });
