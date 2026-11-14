import { describe, expect, it } from 'vitest';
import type { CmsSnapshot, PostDocument } from '@/lib/cms/schemas';
import { emptyDraft } from '@/components/admin/CmsDraftProvider/type';
import {
  applyDraft,
  bindDraftRepository,
  hasDraftChanges,
  stagePost,
  synchronizePost,
} from '@/components/admin/CmsEditor/draft';
import { rebaseReviewedVersions } from '@/components/admin/CmsEditor/conflicts';
import { summarizePublishDraft } from '@/components/admin/CmsEditor/publish-summary';

const post: PostDocument = {
  schemaVersion: 1,
  title: 'Article',
  summary: 'Summary',
  body: '    code\n\n- [x] Done\n',
  published: false,
  publishedAt: '2026-11-14',
};
const baseline: CmsSnapshot = {
  repository: { owner: 'owner', name: 'content', defaultBranch: 'main' },
  site: {
    sha: 'a'.repeat(40),
    data: {
      schemaVersion: 1,
      siteTitle: 'Site',
      headline: 'Title',
      introduction: 'Intro',
      socialLinks: [],
    },
  },
  categories: { sha: 'b'.repeat(40), data: {} },
  technologies: { sha: 'c'.repeat(40), data: {} },
  projects: [],
  posts: [{ slug: 'article', sha: 'd'.repeat(40), data: post }],
};

describe('CMS post drafts', () => {
  it('reads older drafts without a posts property and preserves the remote post', () => {
    const draft = emptyDraft('owner/content@main');
    expect(applyDraft(baseline, draft).posts).toEqual(baseline.posts);
    expect(hasDraftChanges(draft)).toBe(false);
  });

  it('preserves the original SHA and Markdown whitespace through repeated edits', () => {
    let draft = stagePost(emptyDraft('owner/content@main'), 'article', 'd'.repeat(40), {
      ...post,
      title: 'First',
    });
    draft = stagePost(draft, 'article', 'e'.repeat(40), { ...post, title: 'Second' });
    expect(draft.posts?.upsert).toHaveLength(1);
    expect(draft.posts?.upsert[0]).toEqual({
      slug: 'article',
      expectedSha: 'd'.repeat(40),
      data: { ...post, title: 'Second' },
    });
    expect(applyDraft(baseline, draft).posts?.[0].data.body).toBe(post.body);
    expect(bindDraftRepository(draft, 'owner/content@other')).toBeNull();
  });

  it('keeps a new post unversioned and avoids another save for identical values', () => {
    const draft = emptyDraft('owner/content@main');
    draft.posts = { upsert: [], delete: [{ slug: 'article', expectedSha: 'a'.repeat(40) }] };
    const staged = stagePost(draft, 'article', null, post);
    expect(staged.posts?.delete).toEqual([]);
    expect(draft.posts.delete).toHaveLength(1);
    expect(stagePost(staged, 'article', 'b'.repeat(40), post)).toBe(staged);
    const edited = stagePost(staged, 'article', 'b'.repeat(40), { ...post, title: 'Edited' });
    expect(edited.posts?.upsert[0].expectedSha).toBeNull();
  });

  it('removes reverted post changes while retaining other drafts', () => {
    let draft = stagePost(emptyDraft('owner/content@main'), 'article', 'd'.repeat(40), {
      ...post,
      title: 'Temporary',
    });
    draft = stagePost(draft, 'new-post', null, post);
    draft = synchronizePost(draft, 'article', baseline.posts[0], post);
    expect(draft.posts?.upsert.map((item) => item.slug)).toEqual(['new-post']);
  });

  it('updates only explicitly reviewed post versions without altering the body', () => {
    const draft = stagePost(emptyDraft('owner/content@main'), 'article', 'd'.repeat(40), post);
    const next = rebaseReviewedVersions(draft, [
      {
        path: 'content/posts/article.json',
        currentSha: 'e'.repeat(40),
        latest: {},
        draft: post,
        canRebase: true,
      },
    ]);
    expect(next.posts?.upsert[0]).toMatchObject({ expectedSha: 'e'.repeat(40), data: post });
    expect(draft.posts?.upsert[0].expectedSha).toBe('d'.repeat(40));
  });

  it('cancels a staged deletion when the original post is restored', () => {
    const draft = {
      ...emptyDraft('owner/content@main'),
      posts: { upsert: [], delete: [{ slug: 'article', expectedSha: 'd'.repeat(40) }] },
    };
    const restored = synchronizePost(draft, 'article', baseline.posts[0], post);
    expect(hasDraftChanges(restored)).toBe(false);
    const replaced = synchronizePost(draft, 'article', baseline.posts[0], {
      ...post,
      body: 'Replaced',
    });
    expect(replaced.posts?.delete).toEqual([]);
    expect(replaced.posts?.upsert[0].expectedSha).toBe('d'.repeat(40));
  });

  it('includes title, Markdown, and visibility changes in the submission review', () => {
    const draft = stagePost(emptyDraft('owner/content@main'), 'article', 'd'.repeat(40), {
      ...post,
      published: true,
      body: 'Revised',
    });
    const summary = summarizePublishDraft(baseline, draft);
    expect(summary.posts.updated).toEqual(['Article (article) — Markdown body, Visibility']);
    expect(summary.posts.added).toEqual([]);
  });
});
