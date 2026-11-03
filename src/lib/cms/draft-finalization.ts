import 'server-only';

import { isDeepStrictEqual } from 'node:util';
import { getDribbbleShots } from '../dribbble.ts';
import { CmsError, validationError } from './errors.ts';
import {
  getGitBranchState,
  createGitBlob,
  createGitCommit,
  createGitTree,
  updateGitBranch,
} from './git-data.ts';
import { assertCmsOwner } from './github.ts';
import { getOwnerRepository } from './github-repositories.ts';
import { readAndVerifyStagedMedia, type StagedMediaBlob } from './media.ts';
import { isProjectIndexCurrent, serializeProjectIndex } from './project-index.ts';
import {
  getSnapshot,
  readContentFile,
  readPortfolio,
  resolveRepository,
  validateReferences,
  type CmsSnapshot,
  type RepositoryContext,
} from './repository.ts';
import {
  categoriesSchema,
  finalizeCmsDraftSchema,
  portfolioSchema,
  projectSchema,
  siteSchema,
  technologiesSchema,
  type Categories,
  type FinalizeCmsDraft,
  type ProjectDocument,
  type Technologies,
} from './schemas.ts';

type DraftConflict = { path: string; expectedSha: string | null; currentSha: string | null };
type PendingFile = { bytes: Uint8Array };

function serialize(value: unknown): Uint8Array {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function conflictError(
  conflicts: DraftConflict[],
  message = 'Some content changed after you opened it. Reload the latest content and review your draft before retrying.',
): CmsError {
  return new CmsError('conflict', message, 409, { conflicts });
}

function projectPath(slug: string): string {
  return `content/projects/${slug}.json`;
}

function changedProjectMap(snapshot: CmsSnapshot, draft: FinalizeCmsDraft) {
  const projects = new Map(snapshot.projects.map(({ slug, data }) => [slug, data]));
  for (const item of draft.projects.delete) {
    projects.delete(item.slug);
  }
  for (const item of draft.projects.upsert) {
    projects.set(item.slug, item.data);
  }
  return projects;
}

function validateDraftShape(input: unknown): FinalizeCmsDraft {
  const parsed = finalizeCmsDraftSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw validationError(
      `${issue?.path.length ? `${issue.path.join('.')}: ` : ''}${issue?.message ?? 'Check the submitted draft.'}`,
    );
  }
  return parsed.data;
}

function assertHasChanges(draft: FinalizeCmsDraft) {
  if (
    !draft.projects.upsert.length &&
    !draft.projects.delete.length &&
    !draft.site &&
    !draft.categories &&
    !draft.technologies &&
    !draft.designs &&
    !draft.media.length
  ) {
    throw validationError('There are no draft changes to submit.');
  }
}

function checkExpectedShas(snapshot: CmsSnapshot, draft: FinalizeCmsDraft, portfolioSha?: string) {
  const conflicts: DraftConflict[] = [];
  const projects = new Map(snapshot.projects.map(({ slug, sha }) => [slug, sha]));
  for (const item of draft.projects.upsert) {
    const currentSha = projects.get(item.slug) ?? null;
    if (currentSha !== item.expectedSha) {
      conflicts.push({
        path: projectPath(item.slug),
        expectedSha: item.expectedSha,
        currentSha,
      });
    }
  }
  for (const item of draft.projects.delete) {
    const currentSha = projects.get(item.slug) ?? null;
    if (currentSha !== item.expectedSha) {
      conflicts.push({
        path: projectPath(item.slug),
        expectedSha: item.expectedSha,
        currentSha,
      });
    }
  }
  for (const [key, path] of [
    ['site', 'content/site.json'],
    ['categories', 'content/categories.json'],
    ['technologies', 'content/technologies.json'],
  ] as const) {
    const item = draft[key];
    if (item && item.expectedSha !== snapshot[key].sha) {
      conflicts.push({ path, expectedSha: item.expectedSha, currentSha: snapshot[key].sha });
    }
  }
  if (draft.designs && portfolioSha && draft.designs.expectedSha !== portfolioSha) {
    conflicts.push({
      path: 'content/portfolio.json',
      expectedSha: draft.designs.expectedSha,
      currentSha: portfolioSha,
    });
  }
  if (conflicts.length) {
    throw conflictError(conflicts);
  }
}

function addFile(files: Map<string, PendingFile>, path: string, bytes: Uint8Array) {
  if (files.has(path)) {
    throw validationError(`The draft contains more than one change for ${path}.`);
  }
  files.set(path, { bytes });
}

async function addProjectIndexIfNeeded(
  repository: RepositoryContext,
  token: string,
  ref: string,
  projects: Map<string, ProjectDocument>,
  files: Map<string, PendingFile>,
) {
  const path = 'content/project-index.json';
  const existing = await readContentFile(repository, path, token, ref);
  const slugs = [...projects.keys()];
  if (!isProjectIndexCurrent(existing?.text ?? null, slugs)) {
    addFile(files, path, Buffer.from(serializeProjectIndex(slugs), 'utf8'));
  }
}

function setUpdatedDocuments(
  snapshot: CmsSnapshot,
  draft: FinalizeCmsDraft,
  nextProjects: Map<string, ProjectDocument>,
  files: Map<string, PendingFile>,
  deletedPaths: Set<string>,
) {
  for (const item of draft.projects.upsert) {
    const current = snapshot.projects.find(({ slug }) => slug === item.slug);
    const data = projectSchema.parse(nextProjects.get(item.slug));
    if (!current || !isDeepStrictEqual(current.data, data)) {
      addFile(files, projectPath(item.slug), serialize(data));
    }
  }
  for (const item of draft.projects.delete) {
    deletedPaths.add(projectPath(item.slug));
  }
  if (draft.site && !isDeepStrictEqual(snapshot.site.data, draft.site.data)) {
    addFile(files, 'content/site.json', serialize(siteSchema.parse(draft.site.data)));
  }
  if (draft.categories && !isDeepStrictEqual(snapshot.categories.data, draft.categories.data)) {
    addFile(
      files,
      'content/categories.json',
      serialize(categoriesSchema.parse(draft.categories.data)),
    );
  }
  if (
    draft.technologies &&
    !isDeepStrictEqual(snapshot.technologies.data, draft.technologies.data)
  ) {
    addFile(
      files,
      'content/technologies.json',
      serialize(technologiesSchema.parse(draft.technologies.data)),
    );
  }
}

export async function finalizeCmsDraft(
  token: string,
  input: FinalizeCmsDraft | unknown,
): Promise<{ commitUrl: string; commitSha: string; changedPaths: string[] }> {
  await assertCmsOwner(token);
  const draft = validateDraftShape(input);
  assertHasChanges(draft);

  const repository = await resolveRepository(token);
  const currentRepositoryKey = `${repository.owner}/${repository.name}@${repository.defaultBranch}`;
  if (draft.repositoryKey !== currentRepositoryKey) {
    throw conflictError(
      [
        {
          path: '@repository',
          expectedSha: draft.repositoryKey,
          currentSha: currentRepositoryKey,
        },
      ],
      'The content repository or default branch changed after you opened this draft. Reload the CMS and review the draft before submitting again.',
    );
  }
  const branch = await getGitBranchState(repository, token);
  const snapshot = await getSnapshot(token, branch.commitSha, false);
  const portfolio = draft.designs ? await readPortfolio(token, branch.commitSha) : undefined;
  checkExpectedShas(snapshot, draft, portfolio?.sha);

  const nextProjects = changedProjectMap(snapshot, draft);
  const nextCategories: Categories = draft.categories?.data ?? snapshot.categories.data;
  const nextTechnologies: Technologies = draft.technologies?.data ?? snapshot.technologies.data;
  const currentProjects = new Map(snapshot.projects.map(({ slug, data }) => [slug, data]));

  for (const item of draft.projects.upsert) {
    const before = currentProjects.get(item.slug);
    if (
      item.data.githubRepositoryId !== null &&
      before?.githubRepositoryId !== item.data.githubRepositoryId
    ) {
      await getOwnerRepository(token, item.data.githubRepositoryId);
    }
  }

  let nextPortfolio = portfolio?.data;
  if (draft.designs && portfolio) {
    const available = new Set([
      ...portfolio.data.designs,
      ...(await getDribbbleShots()).map((shot) => shot.id),
    ]);
    if (draft.designs.designs.some((id) => !available.has(id))) {
      throw validationError('Select only shots from the connected Dribbble account.');
    }
    nextPortfolio = portfolioSchema.parse({ ...portfolio.data, designs: draft.designs.designs });
  }

  const stagedMedia = new Map<string, Uint8Array>();
  const mediaBlobs = new Map<string, string>();
  const newMedia = new Map<string, string>();
  for (const media of draft.media) {
    const previousBlobSha = mediaBlobs.get(media.path);
    if (previousBlobSha && previousBlobSha !== media.blobSha) {
      throw validationError(`The staged image path ${media.path} refers to different image data.`);
    }
    mediaBlobs.set(media.path, media.blobSha);
    const bytes = await readAndVerifyStagedMedia(token, repository, media as StagedMediaBlob);
    const existing = await readContentFile(repository, media.path, token, branch.commitSha);
    if (existing && existing.sha !== media.blobSha) {
      throw conflictError([{ path: media.path, expectedSha: null, currentSha: existing.sha }]);
    }
    if (!existing) {
      newMedia.set(media.path, media.blobSha);
    }
    stagedMedia.set(media.path, bytes);
  }

  const referencedMedia = new Set<string>();
  for (const project of nextProjects.values()) {
    referencedMedia.add(project.media.cover);
    for (const path of project.media.gallery) {
      referencedMedia.add(path);
    }
  }
  for (const technology of Object.values(nextTechnologies)) {
    if (technology.icon) {
      referencedMedia.add(technology.icon);
    }
  }
  const unreferencedMedia = [...mediaBlobs.keys()].filter((path) => !referencedMedia.has(path));
  if (unreferencedMedia.length) {
    throw validationError(
      `The staged image${unreferencedMedia.length === 1 ? '' : 's'} ${unreferencedMedia.join(', ')} ${unreferencedMedia.length === 1 ? 'is' : 'are'} not referenced by a resulting project or technology icon.`,
    );
  }

  await validateReferences(
    repository,
    [...nextProjects].map(([slug, data]) => ({ slug, data })),
    nextCategories,
    nextTechnologies,
    'validation',
    { ref: branch.commitSha, stagedMedia },
  );

  const files = new Map<string, PendingFile>();
  const deletedPaths = new Set<string>();
  setUpdatedDocuments(snapshot, draft, nextProjects, files, deletedPaths);
  if (
    draft.designs &&
    nextPortfolio &&
    portfolio &&
    !isDeepStrictEqual(portfolio.data, nextPortfolio)
  ) {
    addFile(files, 'content/portfolio.json', serialize(nextPortfolio));
  }
  if (draft.projects.upsert.length || draft.projects.delete.length) {
    await addProjectIndexIfNeeded(repository, token, branch.commitSha, nextProjects, files);
  }

  const treeChanges: Array<{ path: string; sha: string | null }> = [];
  for (const [path, file] of files) {
    const blobSha = await createGitBlob(repository, file.bytes, token);
    treeChanges.push({ path, sha: blobSha });
  }
  for (const [path, blobSha] of newMedia) {
    treeChanges.push({ path, sha: blobSha });
  }
  for (const path of deletedPaths) {
    treeChanges.push({ path, sha: null });
  }

  if (!treeChanges.length) {
    throw validationError('There are no new content changes to publish.');
  }

  const treeSha = await createGitTree(repository, branch.treeSha, treeChanges, token);
  const commit = await createGitCommit(repository, treeSha, branch.commitSha, token);
  const published = await updateGitBranch(repository, branch.commitSha, commit, token);
  return {
    commitUrl: published.commitUrl,
    commitSha: published.sha,
    changedPaths: treeChanges.map(({ path }) => path),
  };
}
