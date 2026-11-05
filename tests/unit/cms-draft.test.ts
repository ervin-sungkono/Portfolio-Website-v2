import { describe, expect, it, vi } from 'vitest';
import { emptyDraft } from '@/components/admin/CmsDraftProvider/type';
import {
  bindDraftRepository,
  hasDraftChanges,
  stageProject,
  synchronizeDocument,
  synchronizeProject,
} from '@/components/admin/CmsEditor/draft';
import { loadConflictReview, rebaseReviewedVersions } from '@/components/admin/CmsEditor/conflicts';
import type { ProjectDocument } from '@/lib/cms/schemas';

const project: ProjectDocument = {
  schemaVersion: 2,
  githubRepositoryId: null,
  title: 'Draft project',
  summary: 'A summary',
  description: 'A description',
  published: false,
  featured: false,
  sortOrder: 0,
  year: 2026,
  categories: ['web'],
  technologies: [],
  tags: [],
  links: {},
  media: { cover: 'media/projects/example/cover.png', gallery: [] },
};

describe('browser draft conflict handling', () => {
  it('removes only the reverted project while preserving other staged edits', () => {
    const baseline = { slug: 'example', sha: 'a'.repeat(40), data: project };
    let draft = synchronizeProject(emptyDraft('owner/repo@master'), 'example', baseline, {
      ...project,
      title: 'Temporary',
    });
    draft = stageProject(draft, 'another', 'b'.repeat(40), { ...project, title: 'Keep' });
    draft = synchronizeProject(draft, 'example', baseline, project);
    expect(draft.projects.upsert.map((item) => item.slug)).toEqual(['another']);
  });

  it('synchronizes document values against the repository rather than stale form defaults', () => {
    const baseline = { sha: 'a'.repeat(40), data: { web: { label: 'Web', sortOrder: 0 } } };
    const edited = { web: { label: 'Temporary', sortOrder: 0 } };
    let draft = synchronizeDocument(
      emptyDraft('owner/repo@master'),
      'categories',
      baseline,
      edited,
    );
    expect(draft.categories?.data).toEqual(edited);
    draft = synchronizeDocument(draft, 'categories', baseline, baseline.data);
    expect(draft.categories).toBeUndefined();
  });

  it('rebinds only empty drafts and retains edits and pending refreshes on a different repository', () => {
    const empty = emptyDraft('owner/repo@old');
    expect(bindDraftRepository(empty, 'owner/repo@new')?.repository).toBe('owner/repo@new');
    const edited = stageProject(empty, 'example', 'a'.repeat(40), project);
    expect(bindDraftRepository(edited, 'owner/repo@new')).toBeNull();
    expect(bindDraftRepository({ ...empty, pendingRefresh: {} }, 'owner/repo@new')).toBeNull();
    expect(bindDraftRepository({ ...edited, repository: '' }, 'owner/repo@new')).toBeNull();
  });
  it('keeps the original file version through repeated local edits', () => {
    const first = stageProject(emptyDraft('owner/repo@master'), 'example', 'a'.repeat(40), project);
    const second = stageProject(first, 'example', 'b'.repeat(40), { ...project, title: 'Edited' });
    expect(second.projects.upsert).toHaveLength(1);
    expect(second.projects.upsert[0]).toEqual({
      slug: 'example',
      expectedSha: 'a'.repeat(40),
      data: { ...project, title: 'Edited' },
    });
  });

  it('updates only reviewed baselines and preserves the draft values', () => {
    const initial = stageProject(
      emptyDraft('owner/repo@master'),
      'example',
      'a'.repeat(40),
      project,
    );
    initial.projects.delete.push({ slug: 'removed', expectedSha: 'c'.repeat(40) });
    initial.designs = { expectedSha: 'd'.repeat(40), designs: ['12'] };
    const reviewed = rebaseReviewedVersions(initial, [
      {
        path: 'content/projects/example.json',
        currentSha: 'b'.repeat(40),
        latest: {},
        draft: project,
        canRebase: true,
      },
      {
        path: 'content/projects/removed.json',
        currentSha: null,
        latest: null,
        draft: null,
        canRebase: true,
      },
      {
        path: 'content/portfolio.json',
        currentSha: 'e'.repeat(40),
        latest: ['99'],
        draft: ['12'],
        canRebase: true,
      },
    ]);
    expect(reviewed.projects.upsert[0]).toEqual({
      slug: 'example',
      expectedSha: 'b'.repeat(40),
      data: project,
    });
    expect(reviewed.projects.delete).toEqual([]);
    expect(reviewed.designs).toEqual({ expectedSha: 'e'.repeat(40), designs: ['12'] });
    expect(initial.projects.upsert[0].expectedSha).toBe('a'.repeat(40));
    expect(initial.projects.delete).toHaveLength(1);
  });

  it('loads the current media SHA and rebases a reviewed deletion without losing other edits', async () => {
    const path = project.media.cover;
    const draft = stageProject(emptyDraft('owner/repo@master'), 'example', 'd'.repeat(40), {
      ...project,
      title: 'Keep this title',
    });
    draft.deleteMedia = [{ path, expectedSha: 'e'.repeat(40) }];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input) === '/api/cms/media') {
          return Response.json({
            repository: { owner: 'owner', name: 'repo', defaultBranch: 'master' },
            media: [{ path, sha: 'f'.repeat(40) }],
          });
        }
        return Response.json({
          repository: { owner: 'owner', name: 'repo', defaultBranch: 'master' },
          site: {
            sha: 'a'.repeat(40),
            data: {
              schemaVersion: 1,
              siteTitle: 'Site',
              headline: 'Headline',
              introduction: 'Intro',
              socialLinks: [],
            },
          },
          categories: {
            sha: 'b'.repeat(40),
            data: { web: { label: 'Web', sortOrder: 0 } },
          },
          technologies: { sha: 'c'.repeat(40), data: {} },
          projects: [{ slug: 'example', sha: 'd'.repeat(40), data: project }],
        });
      }),
    );
    try {
      const review = await loadConflictReview({ conflicts: [{ path }] }, draft);
      expect(review[0]).toMatchObject({
        path,
        currentSha: 'f'.repeat(40),
        latest: { sha: 'f'.repeat(40) },
        draft: { expectedSha: 'e'.repeat(40), action: 'delete' },
        canRebase: true,
      });
      const rebased = rebaseReviewedVersions(draft, review);
      expect(rebased.deleteMedia).toEqual([{ path, expectedSha: 'f'.repeat(40) }]);
      expect(rebased.projects.upsert[0]?.data.title).toBe('Keep this title');
      expect(draft.deleteMedia?.[0]?.expectedSha).toBe('e'.repeat(40));
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('drops a reviewed deletion when the media file is already absent', () => {
    const path = project.media.cover;
    const draft = emptyDraft('owner/repo@master');
    draft.deleteMedia = [{ path, expectedSha: 'e'.repeat(40) }];
    const rebased = rebaseReviewedVersions(draft, [
      {
        path,
        currentSha: null,
        latest: '(media file no longer exists)',
        draft: { path, expectedSha: 'e'.repeat(40), action: 'delete' },
        canRebase: true,
      },
    ]);
    expect(rebased.deleteMedia).toEqual([]);
    expect(draft.deleteMedia).toEqual([{ path, expectedSha: 'e'.repeat(40) }]);
  });

  it('treats a staged media deletion as a draft change', () => {
    const draft = emptyDraft('owner/repo@master');
    expect(hasDraftChanges(draft)).toBe(false);
    draft.deleteMedia = [{ path: project.media.cover, expectedSha: 'e'.repeat(40) }];
    expect(hasDraftChanges(draft)).toBe(true);
  });
});
