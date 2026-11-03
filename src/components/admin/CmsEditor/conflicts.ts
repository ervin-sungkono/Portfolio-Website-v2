import type { CmsDraft } from '../CmsDraftProvider/type';
import { errorFrom, parseSnapshot, readJson } from './response';

export type ConflictReview = {
  path: string;
  currentSha: string | null;
  latest: unknown;
  draft: unknown;
  canRebase: boolean;
};

export async function loadConflictReview(body: Record<string, unknown>, draft: CmsDraft) {
  const paths = Array.isArray(body.conflicts)
    ? body.conflicts.flatMap((item: unknown) =>
        item && typeof item === 'object' && 'path' in item && typeof item.path === 'string'
          ? [item.path]
          : [],
      )
    : [];
  if (!paths.length) {
    throw new Error('The repository changed. Your draft has been kept; try submitting again.');
  }

  const response = await fetch('/api/cms', { cache: 'no-store' });
  const snapshotBody = await readJson(response);
  if (!response.ok || errorFrom(snapshotBody)) {
    throw new Error(errorFrom(snapshotBody) || 'Could not load the latest repository content.');
  }
  const snapshot = parseSnapshot(snapshotBody);

  let designs: { sha: string; designs: string[] } | undefined;
  if (paths.includes('content/portfolio.json')) {
    const selectionResponse = await fetch('/api/cms/dribbble/shots', { cache: 'no-store' });
    const selectionBody = await readJson(selectionResponse);
    const selection = selectionBody.selection;
    if (
      !selectionResponse.ok ||
      !selection ||
      typeof selection !== 'object' ||
      !('sha' in selection) ||
      typeof selection.sha !== 'string' ||
      !('designs' in selection) ||
      !Array.isArray(selection.designs) ||
      !selection.designs.every((id: unknown) => typeof id === 'string')
    ) {
      throw new Error('Could not load the latest design selection for review.');
    }
    designs = { sha: selection.sha, designs: selection.designs as string[] };
  }

  return paths.map((path): ConflictReview => {
    if (path === '@branch') {
      return {
        path,
        currentSha: null,
        latest: 'The branch moved during submission.',
        draft: 'Your draft is unchanged.',
        canRebase: true,
      };
    }
    if (path === '@repository') {
      return {
        path,
        currentSha: null,
        latest: `${snapshot.repository.owner}/${snapshot.repository.name}@${snapshot.repository.defaultBranch}`,
        draft: draft.repository,
        canRebase: false,
      };
    }
    const match = /^content\/projects\/([a-z0-9]+(?:-[a-z0-9]+)*)\.json$/.exec(path);
    if (match) {
      const slug = match[1];
      const latest = snapshot.projects.find((project) => project.slug === slug);
      const changed = draft.projects.upsert.find((project) => project.slug === slug);
      const removed = draft.projects.delete.some((project) => project.slug === slug);
      return {
        path,
        currentSha: latest?.sha ?? null,
        latest: latest?.data ?? '(project no longer exists)',
        draft: changed?.data ?? (removed ? '(remove this project)' : '(no draft change)'),
        canRebase: Boolean(changed || removed),
      };
    }
    for (const key of ['site', 'categories', 'technologies'] as const) {
      if (path === `content/${key}.json`) {
        return {
          path,
          currentSha: snapshot[key].sha,
          latest: snapshot[key].data,
          draft: draft[key]?.data,
          canRebase: Boolean(draft[key]),
        };
      }
    }
    if (path === 'content/portfolio.json' && designs && draft.designs) {
      return {
        path,
        currentSha: designs.sha,
        latest: designs.designs,
        draft: draft.designs.designs,
        canRebase: true,
      };
    }
    return {
      path,
      currentSha: null,
      latest: 'The repository already contains different data at this path.',
      draft: 'Remove or replace the staged image before trying again.',
      canRebase: false,
    };
  });
}

export function rebaseReviewedVersions(draft: CmsDraft, conflicts: ConflictReview[]): CmsDraft {
  const next = structuredClone(draft);
  for (const conflict of conflicts) {
    const match = /^content\/projects\/([a-z0-9]+(?:-[a-z0-9]+)*)\.json$/.exec(conflict.path);
    if (match) {
      const project = next.projects.upsert.find((item) => item.slug === match[1]);
      if (project) {
        project.expectedSha = conflict.currentSha;
      }
      const deleted = next.projects.delete.find((item) => item.slug === match[1]);
      if (deleted && conflict.currentSha) {
        deleted.expectedSha = conflict.currentSha;
      } else if (deleted) {
        next.projects.delete = next.projects.delete.filter((item) => item !== deleted);
      }
    }
    for (const key of ['site', 'categories', 'technologies'] as const) {
      if (conflict.path === `content/${key}.json` && conflict.currentSha && next[key]) {
        next[key].expectedSha = conflict.currentSha;
      }
    }
    if (conflict.path === 'content/portfolio.json' && conflict.currentSha && next.designs) {
      next.designs.expectedSha = conflict.currentSha;
    }
  }
  return next;
}
