import type { CmsSnapshot, ProjectDocument } from '@/lib/cms/schemas';
import type { CmsDraft } from '../CmsDraftProvider/type';
import { emptyProject, stageProject, synchronizeProject } from '../CmsEditor/draft';
import type { ImportRepository } from './type';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseRepository(value: unknown): ImportRepository | null {
  if (
    !isRecord(value) ||
    !Number.isSafeInteger(value.id) ||
    !Number.isSafeInteger(value.ownerId) ||
    typeof value.owner !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.fullName !== 'string' ||
    typeof value.private !== 'boolean' ||
    typeof value.htmlUrl !== 'string' ||
    !(typeof value.description === 'string' || value.description === null) ||
    !(typeof value.homepage === 'string' || value.homepage === null) ||
    !Array.isArray(value.topics) ||
    value.topics.some((topic) => typeof topic !== 'string') ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string' ||
    typeof value.defaultBranch !== 'string' ||
    !(typeof value.language === 'string' || value.language === null) ||
    typeof value.archived !== 'boolean' ||
    typeof value.fork !== 'boolean' ||
    typeof value.ownedByPatOwner !== 'boolean'
  ) {
    return null;
  }
  return value as ImportRepository;
}

export function parseRepositories(value: unknown): ImportRepository[] {
  if (!Array.isArray(value)) {
    throw new Error('The repository list response is incomplete.');
  }
  const repositories = value.map(parseRepository);
  if (repositories.some((repository) => !repository)) {
    throw new Error('GitHub returned repository data the importer could not read.');
  }
  return repositories as ImportRepository[];
}

export function slugFromRepository(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
  return slug || 'new-project';
}

export function isHttpsUrl(value: string | null): value is string {
  if (!value) {
    return false;
  }
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function suggestionsFromRepository(repository: ImportRepository): ProjectDocument {
  const description = repository.description?.trim() ?? '';
  const topics = repository.topics
    .filter((topic) => topic.trim().length > 0 && topic.trim().length <= 40)
    .slice(0, 30);
  return {
    ...emptyProject(repository.id),
    title: repository.name,
    summary: description.length <= 240 ? description : '',
    description,
    tags: topics,
    links: {
      source: repository.htmlUrl,
      demo: isHttpsUrl(repository.homepage) ? repository.homepage : undefined,
    },
  };
}

export function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function withDraftNewProject(snapshot: CmsSnapshot, draft: CmsDraft) {
  if (
    !draft.newProject ||
    snapshot.projects.some((project) => project.slug === draft.newProject?.slug)
  ) {
    return snapshot;
  }
  return {
    ...snapshot,
    projects: [
      ...snapshot.projects,
      { slug: draft.newProject.slug, data: draft.newProject.data, sha: '' },
    ],
  };
}

export function projectSlugIsTaken(
  snapshot: CmsSnapshot | null,
  draft: CmsDraft,
  slug: string,
  repositoryId: number,
) {
  return Boolean(
    snapshot?.projects.some((project) => project.slug === slug) ||
      draft.projects.upsert.some((project) => project.slug === slug) ||
      (draft.newProject?.slug === slug &&
        draft.newProject.data.githubRepositoryId !== repositoryId),
  );
}

export function stageImportedProject(
  draft: CmsDraft,
  slug: string,
  expectedSha: string | null,
  data: ProjectDocument,
  isNewProject: boolean,
  baseline?: CmsSnapshot['projects'][number],
): CmsDraft {
  if (!isNewProject) {
    const next = baseline
      ? synchronizeProject(draft, slug, baseline, data)
      : stageProject(draft, slug, expectedSha, data);
    return draft.newProject?.slug === slug ? { ...next, newProject: undefined } : next;
  }

  const imported = { slug, data };
  if (draft.newProject && JSON.stringify(draft.newProject) === JSON.stringify(imported)) {
    return draft;
  }

  let next = draft;
  if (
    draft.newProject &&
    draft.newProject.slug !== slug &&
    draft.newProject.data.githubRepositoryId !== data.githubRepositoryId
  ) {
    next = stageProject(next, draft.newProject.slug, null, draft.newProject.data);
  }
  if (
    draft.newProject?.slug === slug &&
    draft.newProject.data.githubRepositoryId !== data.githubRepositoryId
  ) {
    return draft;
  }
  return { ...next, newProject: imported };
}
