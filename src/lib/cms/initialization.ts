import 'server-only';

import { isDeepStrictEqual } from 'node:util';
import { getCmsConfig } from './config.ts';
import { CmsError } from './errors.ts';
import { assertCmsOwner, githubJson, repoPath } from './github.ts';
import {
  createGitBlob,
  createGitCommit,
  createGitTree,
  getGitBranchState,
  updateGitBranch,
} from './git-data.ts';
import {
  getSnapshot,
  isValidProjectSlug,
  listContentDirectory,
  readContentFile,
  resolveOwner,
  type CmsSnapshot,
  type RepositoryContext,
} from './repository.ts';
import { isProjectIndexCurrent, serializeProjectIndex } from './project-index.ts';
import type { Categories, SiteDocument, Technologies } from './schemas.ts';

const seedSite: SiteDocument = {
  schemaVersion: 1,
  siteTitle: 'Developer Portfolio',
  headline: 'Selected work and engineering projects',
  introduction: 'A portfolio of projects and engineering work.',
  socialLinks: [],
};
const seedCategories: Categories = {};
const seedTechnologies: Technologies = {};
const seedReadme =
  '# Portfolio content\n\nThis public repository stores the published content and media for a portfolio website.\n\nContent is managed by Portfolio CMS.\n';
const seedFiles = {
  'README.md': seedReadme,
  'content/site.json': `${JSON.stringify(seedSite, null, 2)}\n`,
  'content/categories.json': `${JSON.stringify(seedCategories, null, 2)}\n`,
  'content/technologies.json': `${JSON.stringify(seedTechnologies, null, 2)}\n`,
};

function unsupported(message: string): CmsError {
  return new CmsError('unsupported_repository', message, 409);
}

function missingInitialCommit(): CmsError {
  return new CmsError(
    'not_found',
    'This repository has no initial branch or commit. Add an initial README commit on GitHub, then retry CMS initialization.',
    404,
  );
}

async function getRepositoryMetadata(owner: string, name: string, token: string) {
  return githubJson<{
    name: string;
    full_name: string;
    default_branch: string;
    private: boolean;
  }>(repoPath(owner, name, ''), { token, allowNotFound: true });
}

async function createRepository(owner: string, name: string, token: string) {
  try {
    const metadata = await githubJson<{
      name: string;
      full_name: string;
      default_branch: string;
      private: boolean;
    }>('/user/repos', {
      token,
      method: 'POST',
      body: {
        name,
        description: 'Published portfolio content and media.',
        private: false,
        auto_init: true,
      },
    });
    return { metadata, created: true };
  } catch (error) {
    if (!(error instanceof CmsError) || error.code !== 'conflict') {
      throw error;
    }
    return { metadata: await getRepositoryMetadata(owner, name, token), created: false };
  }
}

function repositoryContext(
  owner: string,
  name: string,
  metadata: { default_branch: string; private: boolean },
): RepositoryContext {
  if (metadata.private) {
    throw unsupported('The CMS content repository must be public.');
  }
  if (!metadata.default_branch) {
    throw missingInitialCommit();
  }
  return { owner, name, defaultBranch: metadata.default_branch };
}

async function getInitializationBranch(
  repository: RepositoryContext,
  token: string,
  created: boolean,
) {
  try {
    return await getGitBranchState(repository, token);
  } catch (error) {
    if (
      !created &&
      error instanceof CmsError &&
      (error.code === 'not_found' || error.code === 'conflict')
    ) {
      throw missingInitialCommit();
    }
    throw error;
  }
}

type DirectoryMap = Map<string, 'file' | 'dir'>;

async function directoryMap(
  repository: RepositoryContext,
  path: string,
  token: string,
  ref: string,
): Promise<DirectoryMap> {
  const entries = await listContentDirectory(repository, path, token, ref);
  const result: DirectoryMap = new Map();
  for (const entry of entries ?? []) {
    result.set(entry.name, entry.type === 'dir' ? 'dir' : 'file');
  }
  return result;
}

function assertAllowedEntries(
  entries: DirectoryMap,
  allowed: Record<string, 'file' | 'dir'>,
  location: string,
) {
  for (const [name, type] of entries) {
    if (!Object.hasOwn(allowed, name) || allowed[name] !== type) {
      throw unsupported(
        `The ${location} directory contains unsupported content (${name}). Migrate it explicitly before using the CMS.`,
      );
    }
  }
}

async function inspectStorage(
  repository: RepositoryContext,
  token: string,
  ref: string,
): Promise<{
  seedFilesPresent: Set<string>;
  onlySeedPaths: boolean;
}> {
  const root = await listContentDirectory(repository, '', token, ref);
  if (!root || root.length === 0) {
    return { seedFilesPresent: new Set(), onlySeedPaths: true };
  }
  const rootEntries: DirectoryMap = new Map();
  for (const entry of root) {
    rootEntries.set(entry.name, entry.type === 'dir' ? 'dir' : 'file');
  }
  assertAllowedEntries(
    rootEntries,
    { 'README.md': 'file', content: 'dir', media: 'dir', images: 'dir', icons: 'dir' },
    'repository root',
  );

  const seedFilesPresent = new Set<string>();
  // Preserve compatibility asset URLs during cutover; never bootstrap over an asset-only repository.
  let onlySeedPaths = !rootEntries.has('images') && !rootEntries.has('icons');
  if (rootEntries.has('README.md')) {
    seedFilesPresent.add('README.md');
  }

  if (rootEntries.has('content')) {
    const content = await directoryMap(repository, 'content', token, ref);
    assertAllowedEntries(
      content,
      {
        'site.json': 'file',
        'categories.json': 'file',
        'technologies.json': 'file',
        'portfolio.json': 'file',
        'project-index.json': 'file',
        projects: 'dir',
      },
      'content',
    );
    if (content.has('portfolio.json') || content.has('project-index.json')) {
      onlySeedPaths = false;
    }
    for (const path of ['site.json', 'categories.json', 'technologies.json']) {
      if (content.has(path)) {
        seedFilesPresent.add(`content/${path}`);
      }
    }
    if (content.has('projects')) {
      onlySeedPaths = false;
      const projects = await directoryMap(repository, 'content/projects', token, ref);
      for (const [name, type] of projects) {
        if (type !== 'file' || !/^[a-z0-9]+(?:-[a-z0-9]+)*\.json$/.test(name)) {
          throw unsupported('The project directory contains an unsupported file.');
        }
      }
    }
  }

  if (rootEntries.has('media')) {
    onlySeedPaths = false;
    const media = await directoryMap(repository, 'media', token, ref);
    assertAllowedEntries(media, { projects: 'dir', technologies: 'dir' }, 'media');
    if (media.has('projects')) {
      const projectFolders = await directoryMap(repository, 'media/projects', token, ref);
      for (const [slug, type] of projectFolders) {
        if (type !== 'dir' || !isValidProjectSlug(slug)) {
          throw unsupported('The media/projects directory contains an unsupported entry.');
        }
        const files = await directoryMap(repository, `media/projects/${slug}`, token, ref);
        for (const [filename, fileType] of files) {
          if (
            fileType !== 'file' ||
            !/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.(?:png|jpe?g|webp)$/i.test(filename)
          ) {
            throw unsupported(`The media folder for ${slug} contains an unsupported file.`);
          }
        }
      }
    }
    if (media.has('technologies')) {
      const icons = await directoryMap(repository, 'media/technologies', token, ref);
      for (const [filename, fileType] of icons) {
        if (
          fileType !== 'file' ||
          !/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.(?:png|jpe?g|webp|svg)$/i.test(filename)
        ) {
          throw unsupported('The media/technologies directory contains an unsupported file.');
        }
      }
    }
  }

  const top = new Set(root.map(({ name }) => name));
  if (top.has('media')) {
    onlySeedPaths = false;
  }
  return { seedFilesPresent, onlySeedPaths };
}

async function isExactSeedSubset(
  repository: RepositoryContext,
  token: string,
  present: Set<string>,
  ref: string,
): Promise<boolean> {
  for (const path of present) {
    if (path === 'README.md') {
      continue;
    }
    const file = await readContentFile(repository, path, token, ref);
    if (!file) {
      return false;
    }
    try {
      const value = JSON.parse(file.text) as unknown;
      const expected = JSON.parse(seedFiles[path as keyof typeof seedFiles]) as unknown;
      if (!isDeepStrictEqual(value, expected)) {
        return false;
      }
    } catch {
      return false;
    }
  }
  return true;
}

async function commitInitialization(
  repository: RepositoryContext,
  parent: { commitSha: string; treeSha: string },
  changes: Record<string, string>,
  token: string,
): Promise<{ sha: string; commitUrl: string }> {
  const treeChanges = await Promise.all(
    Object.entries(changes).map(async ([path, content]) => ({
      path,
      sha: await createGitBlob(repository, Buffer.from(content, 'utf8'), token),
    })),
  );
  const treeSha = await createGitTree(repository, parent.treeSha, treeChanges, token);
  const commit = await createGitCommit(
    repository,
    treeSha,
    parent.commitSha,
    token,
    'cms: initialize portfolio content',
  );
  return updateGitBranch(repository, parent.commitSha, commit, token);
}

export async function initializeRepository(token: string): Promise<CmsSnapshot> {
  await assertCmsOwner(token);
  const { repository: name } = getCmsConfig();
  const owner = await resolveOwner(token);
  let metadata = await getRepositoryMetadata(owner, name, token);
  let created = false;
  if (!metadata) {
    const result = await createRepository(owner, name, token);
    metadata = result.metadata;
    created = result.created;
  }
  if (!metadata) {
    throw new CmsError('github', 'GitHub did not return the content repository.', 502);
  }
  const repository = repositoryContext(owner, name, metadata);
  const branch = await getInitializationBranch(repository, token, created);
  const storage = await inspectStorage(repository, token, branch.commitSha);
  const seedDocs = ['content/site.json', 'content/categories.json', 'content/technologies.json'];

  if (seedDocs.every((path) => storage.seedFilesPresent.has(path))) {
    let snapshot: CmsSnapshot | undefined;
    try {
      snapshot = await getSnapshot(token, branch.commitSha);
    } catch (error) {
      if (!(error instanceof CmsError) || error.code !== 'not_found') {
        throw error;
      }
    }
    if (snapshot) {
      const index = await readContentFile(
        repository,
        'content/project-index.json',
        token,
        branch.commitSha,
      );
      const projectSlugs = snapshot.projects.map(({ slug }) => slug);
      if (isProjectIndexCurrent(index?.text ?? null, projectSlugs)) {
        return snapshot;
      }
      const commit = await commitInitialization(
        repository,
        branch,
        { 'content/project-index.json': serializeProjectIndex(projectSlugs) },
        token,
      );
      return getSnapshot(token, commit.sha);
    }
  }

  if (
    !storage.onlySeedPaths ||
    !(await isExactSeedSubset(repository, token, storage.seedFilesPresent, branch.commitSha))
  ) {
    throw unsupported(
      'This repository is not an empty CMS repository or a compatible portfolio content repository. Migrate existing files explicitly before initializing it.',
    );
  }

  const changes = Object.fromEntries(
    Object.entries(seedFiles).filter(([path]) => !storage.seedFilesPresent.has(path)),
  );
  changes['content/project-index.json'] = serializeProjectIndex([]);
  const commit = await commitInitialization(repository, branch, changes, token);
  return getSnapshot(token, commit.sha);
}
