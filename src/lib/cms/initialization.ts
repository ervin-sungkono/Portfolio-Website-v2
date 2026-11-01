import 'server-only';

import { isDeepStrictEqual } from 'node:util';
import { getCmsConfig } from './config.ts';
import { CmsError } from './errors.ts';
import { assertCmsOwner, githubJson, repoPath } from './github.ts';
import {
  getSnapshot,
  isValidProjectSlug,
  listContentDirectory,
  readContentFile,
  resolveOwner,
  type CmsSnapshot,
  type RepositoryContext,
  writeContentFile,
} from './repository.ts';
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
    return await githubJson<{
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
        auto_init: false,
      },
    });
  } catch (error) {
    if (!(error instanceof CmsError) || error.code !== 'conflict') {
      throw error;
    }
    return getRepositoryMetadata(owner, name, token);
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
    throw new CmsError(
      'not_found',
      'GitHub has not assigned a default branch to this repository yet.',
      404,
    );
  }
  return { owner, name, defaultBranch: metadata.default_branch };
}

type DirectoryMap = Map<string, 'file' | 'dir'>;

async function directoryMap(
  repository: RepositoryContext,
  path: string,
  token: string,
): Promise<DirectoryMap> {
  const entries = await listContentDirectory(repository, path, token);
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
): Promise<{
  empty: boolean;
  seedFilesPresent: Set<string>;
  onlySeedPaths: boolean;
}> {
  const root = await listContentDirectory(repository, '', token);
  if (!root || root.length === 0) {
    return { empty: true, seedFilesPresent: new Set(), onlySeedPaths: true };
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
    const content = await directoryMap(repository, 'content', token);
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
      const projects = await directoryMap(repository, 'content/projects', token);
      for (const [name, type] of projects) {
        if (type !== 'file' || !/^[a-z0-9]+(?:-[a-z0-9]+)*\.json$/.test(name)) {
          throw unsupported('The project directory contains an unsupported file.');
        }
      }
    }
  }

  if (rootEntries.has('media')) {
    onlySeedPaths = false;
    const media = await directoryMap(repository, 'media', token);
    assertAllowedEntries(media, { projects: 'dir', technologies: 'dir' }, 'media');
    if (media.has('projects')) {
      const projectFolders = await directoryMap(repository, 'media/projects', token);
      for (const [slug, type] of projectFolders) {
        if (type !== 'dir' || !isValidProjectSlug(slug)) {
          throw unsupported('The media/projects directory contains an unsupported entry.');
        }
        const files = await directoryMap(repository, `media/projects/${slug}`, token);
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
      const icons = await directoryMap(repository, 'media/technologies', token);
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
  return { empty: false, seedFilesPresent, onlySeedPaths };
}

async function isExactSeedSubset(
  repository: RepositoryContext,
  token: string,
  present: Set<string>,
): Promise<boolean> {
  for (const path of present) {
    const file = await readContentFile(repository, path, token);
    if (!file) {
      return false;
    }
    if (path === 'README.md') {
      if (file.text !== seedReadme) {
        return false;
      }
    } else {
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
  }
  return true;
}

export async function initializeRepository(token: string): Promise<CmsSnapshot> {
  await assertCmsOwner(token);
  const { repository: name } = getCmsConfig();
  const owner = await resolveOwner(token);
  let metadata = await getRepositoryMetadata(owner, name, token);
  if (!metadata) {
    metadata = await createRepository(owner, name, token);
  }
  if (!metadata) {
    throw new CmsError('github', 'GitHub did not return the content repository.', 502);
  }
  const repository = repositoryContext(owner, name, metadata);
  let storage = await inspectStorage(repository, token);

  if (storage.empty) {
    try {
      await writeContentFile(
        repository,
        'README.md',
        seedReadme,
        null,
        'cms: initialize portfolio content',
        token,
      );
    } catch (error) {
      if (!(error instanceof CmsError) || error.code !== 'conflict') {
        throw error;
      }
      storage = await inspectStorage(repository, token);
      if (storage.empty) {
        throw error;
      }
    }
    if (storage.empty) {
      storage = await inspectStorage(repository, token);
    }
  }

  const seedDocs = ['content/site.json', 'content/categories.json', 'content/technologies.json'];
  if (seedDocs.every((path) => storage.seedFilesPresent.has(path))) {
    try {
      return await getSnapshot(token);
    } catch (error) {
      if (error instanceof CmsError && error.code !== 'not_found') {
        throw error;
      }
    }
  }

  if (
    !storage.onlySeedPaths ||
    !(await isExactSeedSubset(repository, token, storage.seedFilesPresent))
  ) {
    throw unsupported(
      'This repository is not an empty CMS repository or a compatible portfolio content repository. Migrate existing files explicitly before initializing it.',
    );
  }

  for (const [path, content] of Object.entries(seedFiles)) {
    if (!storage.seedFilesPresent.has(path)) {
      await writeContentFile(
        repository,
        path,
        content,
        null,
        'cms: initialize portfolio content',
        token,
      );
    }
  }
  return getSnapshot(token);
}
