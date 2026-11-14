import { describe, expect, test } from 'vitest';
import type {
  Categories,
  CmsSnapshot,
  ProjectDocument,
  SiteDocument,
  Technologies,
} from '@/lib/cms/schemas';
import { emptyDraft } from '@/components/admin/CmsDraftProvider/type';
import { summarizePublishDraft } from '@/components/admin/CmsEditor/publish-summary';

function project(title: string, summary = 'Project summary'): ProjectDocument {
  return {
    schemaVersion: 2,
    githubRepositoryId: null,
    title,
    summary,
    description: 'Project description',
    published: true,
    featured: false,
    sortOrder: 1,
    year: 2026,
    categories: ['web'],
    technologies: ['react'],
    tags: [],
    links: {},
    media: { cover: 'media/projects/sample/cover.png', gallery: [] },
  };
}

function snapshot(): CmsSnapshot {
  const site: SiteDocument = {
    schemaVersion: 1,
    siteTitle: 'Portfolio',
    headline: 'Engineer',
    introduction: 'Current introduction',
    socialLinks: [],
  };
  const categories: Categories = {
    web: { label: 'Web', sortOrder: 0 },
    mobile: { label: 'Mobile', sortOrder: 1 },
  };
  const technologies: Technologies = {
    react: { label: 'React' },
    nextjs: { label: 'Next.js' },
  };
  return {
    repository: { owner: 'owner', name: 'content', defaultBranch: 'main' },
    site: { data: site, sha: '1'.repeat(40) },
    categories: { data: categories, sha: '2'.repeat(40) },
    technologies: { data: technologies, sha: '3'.repeat(40) },
    posts: [],
    projects: [
      { slug: 'alpha', data: project('Alpha'), sha: '4'.repeat(40) },
      { slug: 'remove-me', data: project('Remove Me'), sha: '5'.repeat(40) },
    ],
  };
}

describe('summarizePublishDraft', () => {
  test('summarizes validated changes against the remote snapshot', () => {
    const baseline = snapshot();
    const draft = emptyDraft('owner/content@main');
    draft.projects.upsert = [
      { slug: 'alpha', expectedSha: '4'.repeat(40), data: project('Alpha', 'Updated summary') },
      { slug: 'new-project', expectedSha: null, data: project('New Project') },
    ];
    draft.projects.delete = [{ slug: 'remove-me', expectedSha: '5'.repeat(40) }];
    draft.categories = {
      expectedSha: baseline.categories.sha,
      data: {
        web: { label: 'Web & Apps', sortOrder: 0 },
        design: { label: 'Design', sortOrder: 2 },
      },
    };
    draft.technologies = {
      expectedSha: baseline.technologies.sha,
      data: {
        react: { label: 'React', icon: 'media/technologies/react.svg' },
      },
    };
    draft.site = {
      expectedSha: baseline.site.sha,
      data: { ...baseline.site.data, siteTitle: 'Updated Portfolio' },
    };
    draft.designs = { expectedSha: '6'.repeat(40), designs: ['42', '17'] };
    draft.media = [
      {
        scope: 'project',
        slug: 'new-project',
        filename: 'new-cover.webp',
        mime: 'image/webp',
        path: 'media/projects/new-project/new-cover.webp',
      },
    ];

    expect(summarizePublishDraft(baseline, draft)).toEqual({
      posts: { added: [], updated: [], deleted: [] },
      projects: {
        added: ['New Project (new-project)'],
        updated: ['Alpha (alpha) — Summary'],
        deleted: ['Remove Me (remove-me)'],
      },
      categories: {
        added: ['Design (design)'],
        updated: ['Web → Web & Apps (web) — Label'],
        deleted: ['Mobile (mobile)'],
      },
      technologies: {
        added: [],
        updated: ['React (react) — Icon'],
        deleted: ['Next.js (nextjs)'],
      },
      siteFields: ['Site title'],
      designIds: ['42', '17'],
      imageFilenames: ['new-cover.webp'],
      mediaDeletions: [],
    });
  });

  test('does not report an unchanged project upsert as an update', () => {
    const baseline = snapshot();
    const draft = emptyDraft('owner/content@main');
    draft.projects.upsert.push({
      slug: 'alpha',
      expectedSha: '4'.repeat(40),
      data: project('Alpha'),
    });

    expect(summarizePublishDraft(baseline, draft).projects.updated).toEqual([]);
  });
});
