import type { PostDocument, ProjectDocument } from '@/lib/cms/schemas';
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
    posts: [
      ...(snapshot.posts ?? []).filter(
        (post) =>
          !draft.posts?.delete.some((item) => item.slug === post.slug) &&
          !draft.posts?.upsert.some((item) => item.slug === post.slug),
      ),
      ...(draft.posts?.upsert ?? []).map(({ slug, expectedSha, data }) => ({
        slug,
        sha: expectedSha ?? '',
        data,
      })),
    ].sort((left, right) => left.slug.localeCompare(right.slug)),
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
      draft.posts?.upsert.length ||
      draft.posts?.delete.length ||
      draft.newPost ||
      draft.site ||
      draft.categories ||
      draft.technologies ||
      draft.designs ||
      draft.media.length ||
      draft.deleteMedia?.length ||
      draft.newProject,
  );
}

export function stagePost(
  draft: CmsDraft,
  slug: string,
  expectedSha: string | null,
  data: PostDocument,
): CmsDraft {
  const posts = draft.posts ?? { upsert: [], delete: [] };
  const current = posts.upsert.find((post) => post.slug === slug);
  const next = { slug, expectedSha: current ? current.expectedSha : expectedSha, data };
  if (current && JSON.stringify(current) === JSON.stringify(next)) {
    return draft;
  }
  return {
    ...draft,
    posts: {
      upsert: [...posts.upsert.filter((post) => post.slug !== slug), next],
      delete: posts.delete.filter((post) => post.slug !== slug),
    },
  };
}

export function synchronizePost(
  draft: CmsDraft,
  slug: string,
  baseline: { data: PostDocument; sha: string } | undefined,
  data: PostDocument,
): CmsDraft {
  if (baseline && JSON.stringify(baseline.data) === JSON.stringify(data)) {
    if (
      !draft.posts?.upsert.some((post) => post.slug === slug) &&
      !draft.posts?.delete.some((post) => post.slug === slug)
    ) {
      return draft;
    }
    return {
      ...draft,
      posts: {
        upsert: draft.posts?.upsert.filter((post) => post.slug !== slug) ?? [],
        delete: draft.posts?.delete.filter((post) => post.slug !== slug) ?? [],
      },
    };
  }
  return stagePost(draft, slug, baseline?.sha || null, data);
}

export function bindDraftRepository(draft: CmsDraft, repository: string): CmsDraft | null {
  if (draft.repository === repository) {
    return draft;
  }
  if (hasDraftChanges(draft) || draft.pendingRefresh) {
    return null;
  }
  return { ...draft, repository };
}

export function synchronizeProject(
  draft: CmsDraft,
  slug: string,
  baseline: CmsSnapshot['projects'][number] | undefined,
  data: ProjectDocument,
): CmsDraft {
  if (baseline && JSON.stringify(data) === JSON.stringify(baseline.data)) {
    if (!draft.projects.upsert.some((project) => project.slug === slug)) {
      return draft;
    }
    return {
      ...draft,
      projects: {
        ...draft.projects,
        upsert: draft.projects.upsert.filter((project) => project.slug !== slug),
      },
    };
  }
  return stageProject(draft, slug, baseline?.sha || null, data);
}

export function synchronizeDocument<K extends 'site' | 'categories' | 'technologies'>(
  draft: CmsDraft,
  key: K,
  baseline: CmsSnapshot[K],
  data: CmsSnapshot[K]['data'],
): CmsDraft {
  const current = draft[key];
  if (JSON.stringify(data) === JSON.stringify(baseline.data)) {
    return current ? { ...draft, [key]: undefined } : draft;
  }
  const next = { expectedSha: current?.expectedSha ?? baseline.sha, data };
  return JSON.stringify(current) === JSON.stringify(next) ? draft : { ...draft, [key]: next };
}
