import assert from 'node:assert/strict';
import { test } from 'vitest';
import { finalizeCmsDraftSchema, postIndexSchema, postSchema } from '../../src/lib/cms/schemas.ts';

const post = {
  schemaVersion: 1,
  title: 'A post',
  summary: 'A short summary.',
  body: '  ## Markdown stays intact\n\n  ',
  published: false,
  publishedAt: '2026-02-28',
};

test('post documents preserve body whitespace and reject blank or invalid dates', () => {
  const parsed = postSchema.parse(post);
  assert.equal(parsed.body, post.body);
  assert.equal(postSchema.safeParse({ ...post, body: ' \n\t ' }).success, false);
  assert.equal(postSchema.safeParse({ ...post, body: 'x'.repeat(30_001) }).success, false);
  assert.equal(postSchema.safeParse({ ...post, publishedAt: '2026-02-30' }).success, false);
});

test('post index and finalization schema validate unique slugs while accepting old clients', () => {
  assert.equal(
    postIndexSchema.safeParse({ schemaVersion: 1, posts: ['first-post', 'first-post'] }).success,
    false,
  );
  const oldClient = finalizeCmsDraftSchema.safeParse({
    kind: 'finalize',
    repositoryKey: 'owner/content@main',
    projects: { upsert: [], delete: [] },
    media: [],
  });
  assert.equal(oldClient.success, true);
  const duplicatePosts = finalizeCmsDraftSchema.safeParse({
    kind: 'finalize',
    repositoryKey: 'owner/content@main',
    projects: { upsert: [], delete: [] },
    posts: {
      upsert: [
        { slug: 'first-post', expectedSha: null, data: post },
        { slug: 'first-post', expectedSha: null, data: post },
      ],
      delete: [],
    },
    media: [],
  });
  assert.equal(duplicatePosts.success, false);
});
