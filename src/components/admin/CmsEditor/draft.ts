import type { ProjectDocument } from '@/lib/cms/schemas';
import type { CmsDraft } from '../CmsDraftProvider/type';
import type { CmsSnapshot } from './type';

export function repositoryKey(snapshot: CmsSnapshot) {
  const { owner, name, defaultBranch } = snapshot.repository;
  return `${owner}/${name}@${defaultBranch}`;
}

export function applyDraft(snapshot: CmsSnapshot, draft: CmsDraft): CmsSnapshot {
  if (draft.repository !== repositoryKey(snapshot)) {
    return snapshot;
  }
  const deleted = new Set(draft.projects.delete.map((project) => project.slug));
  const projects = snapshot.projects.filter((project) => !deleted.has(project.slug));
  for (const project of draft.projects.upsert) {
    const entry = { slug: project.slug, data: project.data, sha: project.expectedSha ?? '' };
    const index = projects.findIndex((item) => item.slug === project.slug);
    if (index < 0) {
      projects.push(entry);
    } else {
      projects[index] = entry;
    }
  }
  return {
    ...snapshot,
    projects,
    site: draft.site ? { data: draft.site.data, sha: draft.site.expectedSha } : snapshot.site,
    categories: draft.categories
      ? { data: draft.categories.data, sha: draft.categories.expectedSha }
      : snapshot.categories,
    technologies: draft.technologies
      ? { data: draft.technologies.data, sha: draft.technologies.expectedSha }
      : snapshot.technologies,
  };
}

export function stageProject(
  draft: CmsDraft,
  slug: string,
  expectedSha: string | null,
  data: ProjectDocument,
): CmsDraft {
  const current = draft.projects.upsert.find((project) => project.slug === slug);
  const next = { slug, expectedSha: current ? current.expectedSha : expectedSha, data };
  if (current && JSON.stringify(current) === JSON.stringify(next)) {
    return draft;
  }
  return {
    ...draft,
    projects: {
      upsert: [...draft.projects.upsert.filter((project) => project.slug !== slug), next],
      delete: draft.projects.delete.filter((project) => project.slug !== slug),
    },
  };
}

export function hasDraftChanges(draft: CmsDraft) {
  return Boolean(
    draft.projects.upsert.length ||
      draft.projects.delete.length ||
      draft.site ||
      draft.categories ||
      draft.technologies ||
      draft.designs ||
      draft.media.length ||
      draft.newProject,
  );
}
