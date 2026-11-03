import { describe, expect, it } from 'vitest';
import { emptyDraft } from '@/components/admin/CmsDraftProvider/type';
import { stageProject } from '@/components/admin/CmsEditor/draft';
import { rebaseReviewedVersions } from '@/components/admin/CmsEditor/conflicts';
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
});
