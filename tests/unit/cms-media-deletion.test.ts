import { describe, expect, it } from 'vitest';
import { emptyDraft } from '@/components/admin/CmsDraftProvider/type';
import { stageMediaDeletion } from '@/components/admin/CmsEditor/ImagesPanel/media-deletion';
import type { CmsSnapshot, ProjectDocument } from '@/lib/cms/schemas';

const cover = 'media/projects/example/cover.png';
const gallery = 'media/projects/example/gallery.png';
const icon = 'media/technologies/shared.png';
const project: ProjectDocument = {
  schemaVersion: 2,
  githubRepositoryId: null,
  title: 'Example project',
  summary: 'Summary',
  description: 'Description',
  published: true,
  featured: false,
  sortOrder: 0,
  year: 2026,
  categories: ['web'],
  technologies: [],
  tags: [],
  links: {},
  media: { cover, gallery: [gallery] },
};
const snapshot: CmsSnapshot = {
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
  categories: { sha: 'b'.repeat(40), data: { web: { label: 'Web', sortOrder: 0 } } },
  technologies: {
    sha: 'c'.repeat(40),
    data: { one: { label: 'One', icon }, two: { label: 'Two', icon } },
  },
  projects: [{ slug: 'example', sha: 'd'.repeat(40), data: project }],
  posts: [],
};
const current = {
  selectedSlug: 'example',
  newSlug: '',
  project: { ...project, title: 'Edited title' },
  technologies: snapshot.technologies.data,
};

describe('staging a committed image deletion', () => {
  it('promotes the first gallery image and preserves other current edits', () => {
    const result = stageMediaDeletion(
      emptyDraft('owner/repo@master'),
      snapshot,
      { path: cover, sha: 'e'.repeat(40) },
      current,
    );
    expect(result.draft.deleteMedia).toEqual([{ path: cover, expectedSha: 'e'.repeat(40) }]);
    expect(result.draft.projects.upsert[0]).toMatchObject({
      slug: 'example',
      expectedSha: 'd'.repeat(40),
      data: { title: 'Edited title', media: { cover: gallery, gallery: [] } },
    });
    expect(result.selectedProject?.media).toEqual({ cover: gallery, gallery: [] });
  });

  it('requires a replacement before removing the only project cover', () => {
    expect(() =>
      stageMediaDeletion(
        emptyDraft('owner/repo@master'),
        snapshot,
        { path: cover, sha: 'e'.repeat(40) },
        {
          ...current,
          project: { ...project, media: { cover, gallery: [] } },
        },
      ),
    ).toThrow('Replace the cover');
  });

  it('removes an icon from every technology sharing it', () => {
    const result = stageMediaDeletion(
      emptyDraft('owner/repo@master'),
      snapshot,
      { path: icon, sha: 'f'.repeat(40) },
      current,
    );
    expect(result.draft.technologies?.data).toEqual({
      one: { label: 'One' },
      two: { label: 'Two' },
    });
    expect(result.draft.technologies?.expectedSha).toBe('c'.repeat(40));
  });

  it('updates a retained new-project draft even while another project is selected', () => {
    const first = 'media/projects/fresh/cover.png';
    const replacement = 'media/projects/fresh/replacement.png';
    const draft = emptyDraft('owner/repo@master');
    draft.newProject = {
      slug: 'fresh',
      data: { ...project, title: 'Fresh', media: { cover: first, gallery: [replacement] } },
    };
    const result = stageMediaDeletion(
      draft,
      snapshot,
      { path: first, sha: 'e'.repeat(40) },
      current,
    );
    expect(result.draft.newProject?.data.media).toEqual({ cover: replacement, gallery: [] });
    expect(result.selectedProject).toBeUndefined();
    expect(result.affected).toContain('New project: Fresh');
  });
});
