import 'server-only';

import { getCmsConfig } from './config.ts';
import { CmsError, type CmsErrorCode } from './errors.ts';
import {
  contentsPath,
  githubBytes,
  githubJson,
  repoPath,
  type GitHubContent,
  type GitHubDirectoryEntry,
  type GitHubRepository,
} from './github.ts';
import {
  categoriesSchema,
  projectSchema,
  siteSchema,
  technologiesSchema,
  type Categories,
  type ProjectDocument,
  type SiteDocument,
  type Technologies,
} from './schemas.ts';

const cmsIdentity = { name: 'Portfolio CMS', email: 'cms@portfolio.local' };
const projectSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const allowedMediaSize = 1_048_576;

export type RepositoryContext = {
  owner: string;
  name: string;
  defaultBranch: string;
};

export type CmsSnapshot = {
  repository: RepositoryContext;
  site: { data: SiteDocument; sha: string };
  categories: { data: Categories; sha: string };
  technologies: { data: Technologies; sha: string };
  projects: Array<{ slug: string; data: ProjectDocument; sha: string }>;
};

export type ContentFile = { text: string; sha: string; size: number };

type RegistryDocument<T> = { data: T; sha: string };

function unsupported(message: string): CmsError {
  return new CmsError('unsupported_repository', message, 409);
}

function jsonDocument<T>(
  file: ContentFile,
  schema: { safeParse: (value: unknown) => { success: boolean; data?: T } },
  path: string,
): T {
  let value: unknown;
  try {
    value = JSON.parse(file.text);
  } catch {
    throw unsupported(`The content repository contains invalid JSON at ${path}.`);
  }
  const parsed = schema.safeParse(value);
  if (!parsed.success || parsed.data === undefined) {
    throw unsupported(`The content repository does not match the CMS schema at ${path}.`);
  }
  return parsed.data;
}

export async function resolveOwner(): Promise<string> {
  const { adminId } = getCmsConfig();
  const user = await githubJson<{ id: number; login: string }>(`/user/${adminId}`, {
    next: { revalidate: 86_400, tags: ['cms-owner'] },
  });
  if (!user || user.id !== adminId || !/^[A-Za-z0-9-]+$/.test(user.login)) {
    throw new CmsError('configuration', 'GITHUB_ADMIN_ID does not identify a GitHub user.', 500);
  }
  return user.login;
}

export async function resolveRepository(token?: string): Promise<RepositoryContext> {
  const { repository } = getCmsConfig();
  const owner = await resolveOwner();
  const metadata = await githubJson<GitHubRepository>(repoPath(owner, repository, ''), { token });
  if (!metadata) {
    throw new CmsError(
      'not_found',
      'The content repository does not exist yet. Initialize it from the CMS.',
      404,
    );
  }
  if (metadata.private) {
    throw unsupported(
      'The CMS content repository must be public so visitors can read its published content.',
    );
  }
  if (!metadata.default_branch) {
    throw new CmsError(
      'not_found',
      'The repository has no default branch yet. Initialize it from the CMS.',
      404,
    );
  }
  return { owner, name: repository, defaultBranch: metadata.default_branch };
}

function rawMediaUrl(repository: RepositoryContext, path: string): string {
  const branch = encodeURIComponent(repository.defaultBranch);
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  return `https://raw.githubusercontent.com/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/${branch}/${encodedPath}`;
}

export async function readContentFile(
  repository: RepositoryContext,
  path: string,
  token?: string,
): Promise<ContentFile | null> {
  const item = await githubJson<GitHubContent>(
    `${contentsPath(repository.owner, repository.name, path)}?ref=${encodeURIComponent(repository.defaultBranch)}`,
    { token, allowNotFound: true },
  );
  if (!item) {
    return null;
  }
  if (Array.isArray(item) || item.type !== 'file' || !item.sha) {
    throw unsupported(`Expected a file at ${path} in the content repository.`);
  }
  if (item.size > allowedMediaSize) {
    throw unsupported(`The content file ${path} exceeds the CMS size limit.`);
  }

  let bytes: Uint8Array;
  if (item.encoding === 'base64' && item.content) {
    bytes = Buffer.from(item.content.replace(/\s/g, ''), 'base64');
  } else {
    bytes = await githubBytes(rawMediaUrl(repository, path), allowedMediaSize);
  }
  if (bytes.byteLength > allowedMediaSize) {
    throw unsupported(`The content file ${path} exceeds the CMS size limit.`);
  }
  return { text: Buffer.from(bytes).toString('utf8'), sha: item.sha, size: bytes.byteLength };
}

export async function listContentDirectory(
  repository: RepositoryContext,
  path: string,
  token?: string,
): Promise<GitHubDirectoryEntry[] | null> {
  const value = await githubJson<GitHubDirectoryEntry | GitHubDirectoryEntry[]>(
    `${contentsPath(repository.owner, repository.name, path)}?ref=${encodeURIComponent(repository.defaultBranch)}`,
    { token, allowNotFound: true },
  );
  if (!value) {
    return null;
  }
  if (!Array.isArray(value)) {
    throw unsupported(`Expected a directory at ${path} in the content repository.`);
  }
  return value;
}

async function requiredDocument<T>(
  repository: RepositoryContext,
  path: string,
  schema: { safeParse: (value: unknown) => { success: boolean; data?: T } },
  token?: string,
): Promise<RegistryDocument<T>> {
  const file = await readContentFile(repository, path, token);
  if (!file) {
    throw new CmsError(
      'not_found',
      `The CMS content file ${path} is missing. Initialize the repository from the CMS.`,
      404,
    );
  }
  return { data: jsonDocument(file, schema, path), sha: file.sha };
}

function hasPngSignature(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)
  );
}

function hasJpegSignature(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function hasWebpSignature(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 12 &&
    Buffer.from(bytes.subarray(0, 4)).toString('ascii') === 'RIFF' &&
    Buffer.from(bytes.subarray(8, 12)).toString('ascii') === 'WEBP'
  );
}

function isSafeSvg(bytes: Uint8Array): boolean {
  const source = Buffer.from(bytes).toString('utf8');
  return (
    /<svg\b/i.test(source) &&
    !/<(?:script|foreignObject)\b/i.test(source) &&
    !/\bon[a-z]+\s*=/i.test(source) &&
    !/javascript\s*:/i.test(source)
  );
}

export function isValidImageBytes(path: string, bytes: Uint8Array): boolean {
  if (!bytes.length || bytes.byteLength > allowedMediaSize) {
    return false;
  }
  const ext = path.split('.').at(-1)?.toLowerCase();
  if (ext === 'png') {
    return hasPngSignature(bytes);
  }
  if (ext === 'jpg' || ext === 'jpeg') {
    return hasJpegSignature(bytes);
  }
  if (ext === 'webp') {
    return hasWebpSignature(bytes);
  }
  if (ext === 'svg') {
    return bytes.byteLength <= 262_144 && isSafeSvg(bytes);
  }
  return false;
}

async function verifyMedia(
  repository: RepositoryContext,
  path: string,
  errorCode: CmsErrorCode,
): Promise<void> {
  let bytes: Uint8Array;
  try {
    bytes = await githubBytes(rawMediaUrl(repository, path));
  } catch (error) {
    if (error instanceof CmsError && (error.code === 'not_found' || error.code === 'validation')) {
      const message =
        error.code === 'not_found'
          ? `The referenced media file ${path} does not exist.`
          : `The referenced media file ${path} exceeds the size limit.`;
      throw new CmsError(errorCode, message, errorCode === 'validation' ? 400 : 409);
    }
    throw error;
  }
  if (!isValidImageBytes(path, bytes)) {
    throw new CmsError(
      errorCode,
      `The referenced media file ${path} is not a supported image or exceeds the size limit.`,
      errorCode === 'validation' ? 400 : 409,
    );
  }
}

export async function validateReferences(
  repository: RepositoryContext,
  projects: Array<{ slug: string; data: ProjectDocument }>,
  categories: Categories,
  technologies: Technologies,
  errorCode: CmsErrorCode = 'unsupported_repository',
): Promise<void> {
  const paths = new Set<string>();
  for (const { slug, data } of projects) {
    if (data.categories.some((id) => !Object.hasOwn(categories, id))) {
      throw new CmsError(
        errorCode,
        `Project ${slug} refers to a category that is not in content/categories.json.`,
        errorCode === 'validation' ? 400 : 409,
      );
    }
    if (data.technologies.some((id) => !Object.hasOwn(technologies, id))) {
      throw new CmsError(
        errorCode,
        `Project ${slug} refers to a technology that is not in content/technologies.json.`,
        errorCode === 'validation' ? 400 : 409,
      );
    }
    for (const path of [data.media.cover, ...data.media.gallery]) {
      if (!path.startsWith(`media/projects/${slug}/`)) {
        throw new CmsError(
          errorCode,
          `Project ${slug} media must stay inside its own media folder.`,
          errorCode === 'validation' ? 400 : 409,
        );
      }
      paths.add(path);
    }
  }
  for (const { icon } of Object.values(technologies)) {
    if (icon) {
      paths.add(icon);
    }
  }
  await Promise.all([...paths].map((path) => verifyMedia(repository, path, errorCode)));
}

export async function getSnapshot(token?: string): Promise<CmsSnapshot> {
  const repository = await resolveRepository(token);
  const [site, categories, technologies] = await Promise.all([
    requiredDocument(repository, 'content/site.json', siteSchema, token),
    requiredDocument(repository, 'content/categories.json', categoriesSchema, token),
    requiredDocument(repository, 'content/technologies.json', technologiesSchema, token),
  ]);
  const projectFiles = await listContentDirectory(repository, 'content/projects', token);
  const projects = await Promise.all(
    (projectFiles ?? []).map(async (entry) => {
      const match = /^([a-z0-9]+(?:-[a-z0-9]+)*)\.json$/.exec(entry.name);
      if (entry.type !== 'file' || !match || entry.path !== `content/projects/${entry.name}`) {
        throw unsupported(
          'The project directory contains a file with an unsupported name or type.',
        );
      }
      const slug = match[1];
      const file = await readContentFile(repository, entry.path, token);
      if (!file) {
        throw new CmsError('not_found', `Project ${slug} changed while the CMS was loading.`, 404);
      }
      return { slug, data: jsonDocument(file, projectSchema, entry.path), sha: file.sha };
    }),
  );
  projects.sort((a, b) => a.slug.localeCompare(b.slug));
  await validateReferences(repository, projects, categories.data, technologies.data);
  return { repository, site, categories, technologies, projects };
}

export async function readProjectMedia(
  repository: RepositoryContext,
  path: string,
): Promise<Uint8Array> {
  const bytes = await githubBytes(rawMediaUrl(repository, path));
  if (!isValidImageBytes(path, bytes)) {
    throw unsupported(`The media file ${path} is invalid or too large.`);
  }
  return bytes;
}

export async function writeContentFile(
  repository: RepositoryContext,
  path: string,
  serializedContent: string,
  expectedSha: string | null,
  message: string,
  token: string,
): Promise<{ commitUrl: string; sha: string; contentSha: string }> {
  return writeContentBytes(
    repository,
    path,
    Buffer.from(serializedContent, 'utf8'),
    expectedSha,
    message,
    token,
  );
}

export async function writeContentBytes(
  repository: RepositoryContext,
  path: string,
  bytes: Uint8Array,
  expectedSha: string | null,
  message: string,
  token: string,
): Promise<{ commitUrl: string; sha: string; contentSha: string }> {
  const result = await githubJson<{
    content: { sha: string };
    commit: { sha: string; html_url: string };
  }>(contentsPath(repository.owner, repository.name, path), {
    token,
    method: 'PUT',
    body: {
      message,
      content: Buffer.from(bytes).toString('base64'),
      branch: repository.defaultBranch,
      ...(expectedSha ? { sha: expectedSha } : {}),
      author: cmsIdentity,
      committer: cmsIdentity,
    },
  });
  if (!result?.commit?.sha || !result.commit.html_url || !result.content?.sha) {
    throw new CmsError(
      'github',
      'GitHub accepted the write but returned incomplete commit details.',
      502,
    );
  }
  return {
    commitUrl: result.commit.html_url,
    sha: result.commit.sha,
    contentSha: result.content.sha,
  };
}

export async function deleteContentFile(
  repository: RepositoryContext,
  path: string,
  expectedSha: string,
  message: string,
  token: string,
): Promise<{ commitUrl: string; sha: string }> {
  const result = await githubJson<{ commit: { sha: string; html_url: string } }>(
    contentsPath(repository.owner, repository.name, path),
    {
      token,
      method: 'DELETE',
      body: {
        message,
        sha: expectedSha,
        branch: repository.defaultBranch,
        author: cmsIdentity,
        committer: cmsIdentity,
      },
    },
  );
  if (!result?.commit?.sha || !result.commit.html_url) {
    throw new CmsError(
      'github',
      'GitHub accepted the delete but returned incomplete commit details.',
      502,
    );
  }
  return { commitUrl: result.commit.html_url, sha: result.commit.sha };
}

export function isValidProjectSlug(value: string): boolean {
  return projectSlugPattern.test(value);
}

export function repositoryPath(repository: RepositoryContext, suffix: string): string {
  return repoPath(repository.owner, repository.name, suffix);
}
