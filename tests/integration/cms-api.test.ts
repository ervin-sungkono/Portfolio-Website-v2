import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { revalidateTag } from 'next/cache';

vi.mock('next-auth', () => ({
  default: () => ({ auth: vi.fn(), handlers: {}, signIn: vi.fn(), signOut: vi.fn() }),
  AuthError: class AuthError extends Error {
    type = 'fixture';
  },
}));
vi.mock('next-auth/providers/github', () => ({ default: vi.fn() }));
vi.mock('next/cache', () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));
import {
  cmsAuthSecret,
  cmsBaseUrl,
  cmsPat,
  cmsPatUserId,
  cmsSessionCookie,
  fixturePng,
} from '../support/cms-fixture';
import { getGitBranchState } from '../../src/lib/cms/git-data.ts';
import { getSnapshot, readContentFile, readPortfolio } from '../../src/lib/cms/repository.ts';

let cms: typeof import('@/app/api/cms/route');
let media: typeof import('@/app/api/cms/media/route');
let cookieName: string;
const originalFetch = globalThis.fetch;

function fixtureGitStats() {
  const fixture = (
    globalThis as unknown as {
      __cmsBrowserFixture?: {
        gitStats: {
          blobCreations: number;
          treeCreations: number;
          commitsCreated: number;
          refUpdates: number;
        };
      };
    }
  ).__cmsBrowserFixture;
  if (!fixture) {
    throw new Error('The CMS GitHub fixture did not initialize.');
  }
  return { ...fixture.gitStats };
}

function repositoryKey(repository: { owner: string; name: string; defaultBranch: string }) {
  return `${repository.owner}/${repository.name}@${repository.defaultBranch}`;
}

beforeAll(async () => {
  vi.stubEnv('GITHUB_PAT', cmsPat);
  vi.stubEnv('GITHUB_REPO', 'portfolio-content-fixture');
  vi.stubEnv('AUTH_SECRET', cmsAuthSecret);
  vi.stubEnv('AUTH_GITHUB_ID', 'fixture-github-client-id');
  vi.stubEnv('AUTH_GITHUB_SECRET', 'fixture-github-client-secret');
  vi.stubEnv('CMS_FIXTURE_WITH_BLOG', '1');
  await import('../support/fixtures/cms-runtime.mjs');
  cookieName = (await import('@/lib/cms/auth')).sessionCookieName;
  cms = await import('@/app/api/cms/route');
  media = await import('@/app/api/cms/media/route');
});

afterAll(() => {
  globalThis.fetch = originalFetch;
  vi.unstubAllEnvs();
});

async function request(
  path: string,
  options: {
    githubId?: string;
    origin?: string;
    data?: unknown;
  } = {},
) {
  const headers = new Headers();
  if (options.githubId) {
    const encrypted = await cmsSessionCookie(cookieName, options.githubId);
    headers.set('cookie', `${cookieName}=${encrypted}`);
  }
  if (options.origin) {
    headers.set('origin', options.origin);
  }
  if (options.data !== undefined) {
    headers.set('content-type', 'application/json');
  }
  return new Request(new URL(path, cmsBaseUrl), {
    method: options.data === undefined ? 'GET' : 'POST',
    headers,
    body: options.data === undefined ? undefined : JSON.stringify(options.data),
  });
}

describe('private CMS HTTP handlers', () => {
  test('reject anonymous and wrong-owner sessions, and reject an invalid server PAT safely', async () => {
    expect((await cms.GET(await request('/api/cms'))).status).toBe(401);
    expect((await cms.GET(await request('/api/cms', { githubId: '99999999' }))).status).toBe(403);
    const beforeWrite = fixtureGitStats();
    const wrongOwnerWrite = await cms.POST(
      await request('/api/cms', {
        githubId: '99999999',
        origin: cmsBaseUrl,
        data: { kind: 'finalize', projects: { upsert: [], delete: [] }, media: [] },
      }),
    );
    expect(wrongOwnerWrite.status).toBe(403);
    expect(fixtureGitStats()).toEqual(beforeWrite);
    const badPat = 'fixture-bad-token';
    vi.stubEnv('GITHUB_PAT', badPat);
    try {
      const response = await cms.GET(await request('/api/cms', { githubId: cmsPatUserId }));
      expect(response.status).toBe(401);
      expect(await response.text()).not.toContain(badPat);
    } finally {
      vi.stubEnv('GITHUB_PAT', cmsPat);
    }
  });

  test('reject cross-origin writes and malformed content', async () => {
    const crossOrigin = await cms.POST(
      await request('/api/cms', {
        githubId: cmsPatUserId,
        origin: 'https://attacker.example',
        data: { kind: 'initialize' },
      }),
    );
    expect(crossOrigin.status).toBe(403);
    const invalid = await cms.POST(
      await request('/api/cms', {
        githubId: cmsPatUserId,
        origin: cmsBaseUrl,
        data: { kind: 'project', slug: '../escape', expectedSha: null, data: {} },
      }),
    );
    expect(invalid.status).toBe(400);
  });

  test('owner can refresh all remote content, including portfolio documents', async () => {
    const response = await cms.POST(
      await request('/api/cms', {
        githubId: cmsPatUserId,
        origin: cmsBaseUrl,
        data: { kind: 'revalidate', target: 'all' },
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ cache: 'refreshed' });
    expect(revalidateTag).toHaveBeenCalledWith('portfolio', 'max');
  });

  test('finalizes posts and their index atomically, with revision-pinned reads and SHA conflicts', async () => {
    const snapshotResponse = await cms.GET(await request('/api/cms', { githubId: cmsPatUserId }));
    expect(snapshotResponse.status).toBe(200);
    const snapshot = await snapshotResponse.json();
    const branch = await getGitBranchState(snapshot.repository, cmsPat);
    const draftPost = snapshot.posts.find(
      (post: { slug: string }) => post.slug === 'fixture-draft-post',
    );
    const unindexedPost = snapshot.posts.find(
      (post: { slug: string }) => post.slug === 'unindexed-post',
    );
    expect(draftPost).toBeDefined();
    expect(unindexedPost).toBeDefined();
    const before = fixtureGitStats();
    const newPost = {
      schemaVersion: 1,
      title: 'Atomic blog post',
      summary: 'A post created in the same Git tree as its index.',
      body: '  ## Untrimmed Markdown\n\nA published article.  ',
      published: true,
      publishedAt: '2026-11-14',
    };
    const unindexedOverwrite = await cms.POST(
      await request('/api/cms', {
        githubId: cmsPatUserId,
        origin: cmsBaseUrl,
        data: {
          kind: 'finalize',
          repositoryKey: repositoryKey(snapshot.repository),
          projects: { upsert: [], delete: [] },
          posts: {
            upsert: [{ slug: 'unindexed-post', expectedSha: null, data: newPost }],
            delete: [],
          },
          media: [],
        },
      }),
    );
    expect(unindexedOverwrite.status).toBe(409);
    expect(fixtureGitStats()).toEqual(before);

    const finalized = await cms.POST(
      await request('/api/cms', {
        githubId: cmsPatUserId,
        origin: cmsBaseUrl,
        data: {
          kind: 'finalize',
          repositoryKey: repositoryKey(snapshot.repository),
          projects: { upsert: [], delete: [] },
          posts: {
            upsert: [{ slug: 'atomic-blog-post', expectedSha: null, data: newPost }],
            delete: [{ slug: 'fixture-draft-post', expectedSha: draftPost.sha }],
          },
          media: [],
        },
      }),
    );
    expect(finalized.status, await finalized.clone().text()).toBe(200);
    const result = await finalized.json();
    expect(result.changedPaths).toEqual(
      expect.arrayContaining([
        'content/posts/atomic-blog-post.json',
        'content/posts/fixture-draft-post.json',
        'content/post-index.json',
      ]),
    );
    expect(fixtureGitStats()).toEqual({
      blobCreations: before.blobCreations + 2,
      treeCreations: before.treeCreations + 1,
      commitsCreated: before.commitsCreated + 1,
      refUpdates: before.refUpdates + 1,
    });
    expect(revalidateTag).toHaveBeenCalledWith('posts', 'max');
    expect(revalidateTag).toHaveBeenCalledWith('post:atomic-blog-post', 'max');

    const current = await getSnapshot(cmsPat);
    expect(current.posts.map(({ slug }) => slug)).toEqual([
      'atomic-blog-post',
      'fixture-post',
      'tie-a-post',
      'tie-z-post',
      'unindexed-post',
    ]);
    expect(current.posts.find(({ slug }) => slug === 'atomic-blog-post')?.data.body).toBe(
      newPost.body,
    );
    const index = await readContentFile(current.repository, 'content/post-index.json', cmsPat);
    expect(JSON.parse(index?.text ?? 'null').posts).toEqual([
      'atomic-blog-post',
      'fixture-post',
      'tie-a-post',
      'tie-z-post',
      'unindexed-post',
    ]);
    const { getPublicContent } = await import('../../src/lib/cms/public.ts');
    const publicContent = await getPublicContent();
    expect(publicContent?.posts.map(({ slug }) => slug)).toEqual([
      'atomic-blog-post',
      'fixture-post',
      'tie-a-post',
      'tie-z-post',
    ]);
    expect(publicContent?.posts[0].body).toBe(newPost.body);
    const historical = await getSnapshot(cmsPat, branch.commitSha, false);
    expect(historical.posts.map(({ slug }) => slug)).toEqual([
      'fixture-draft-post',
      'fixture-post',
      'tie-a-post',
      'tie-z-post',
      'unindexed-post',
    ]);

    const after = fixtureGitStats();
    const stalePost = await cms.POST(
      await request('/api/cms', {
        githubId: cmsPatUserId,
        origin: cmsBaseUrl,
        data: {
          kind: 'finalize',
          repositoryKey: repositoryKey(current.repository),
          projects: { upsert: [], delete: [] },
          posts: {
            upsert: [{ slug: 'fixture-draft-post', expectedSha: draftPost.sha, data: newPost }],
            delete: [],
          },
          media: [],
        },
      }),
    );
    expect(stalePost.status).toBe(409);
    expect(fixtureGitStats()).toEqual(after);
  });

  test('media staging does not move the ref and final submit writes one atomic commit', async () => {
    const snapshotResponse = await cms.GET(await request('/api/cms', { githubId: cmsPatUserId }));
    expect(snapshotResponse.status).toBe(200);
    const snapshot = await snapshotResponse.json();
    const binding = repositoryKey(snapshot.repository);
    const before = fixtureGitStats();
    const stagedResponse = await media.POST(
      await request('/api/cms/media', {
        githubId: cmsPatUserId,
        origin: cmsBaseUrl,
        data: {
          scope: 'project',
          slug: 'atomic-project',
          filename: 'cover.png',
          mime: 'image/png',
          content: fixturePng.toString('base64'),
        },
      }),
    );
    expect(stagedResponse.status).toBe(200);
    const staged = await stagedResponse.json();
    expect(staged).toMatchObject({
      scope: 'project',
      slug: 'atomic-project',
      filename: 'cover.png',
      mime: 'image/png',
    });
    expect(staged.path).toMatch(/^media\/projects\/atomic-project\/[a-f0-9]{64}-cover\.png$/);
    expect(staged.blobSha).toMatch(/^[a-f0-9]{40}$/);
    expect(fixtureGitStats()).toEqual({
      ...before,
      blobCreations: before.blobCreations + 1,
    });

    vi.mocked(revalidateTag).mockImplementationOnce(() => {
      throw new Error('fixture cache failure');
    });
    const project = {
      schemaVersion: 2,
      githubRepositoryId: null,
      title: 'Atomic project',
      summary: 'A project created in one Git commit.',
      description: 'The finalization fixture verifies project, index, and media writes together.',
      published: true,
      featured: false,
      sortOrder: 20,
      year: 2026,
      categories: ['web'],
      technologies: ['nextjs'],
      tags: ['atomic'],
      links: { source: 'https://github.com/fixture-owner/atomic-project' },
      media: { cover: staged.path, gallery: [] },
    };
    const finalized = await cms.POST(
      await request('/api/cms', {
        githubId: cmsPatUserId,
        origin: cmsBaseUrl,
        data: {
          kind: 'finalize',
          repositoryKey: binding,
          projects: {
            upsert: [{ slug: 'atomic-project', expectedSha: null, data: project }],
            delete: [],
          },
          site: {
            expectedSha: snapshot.site.sha,
            data: { ...snapshot.site.data, heroProjectSlugs: ['atomic-project'] },
          },
          media: [staged],
        },
      }),
    );
    expect(finalized.status, await finalized.clone().text()).toBe(200);
    const result = await finalized.json();
    expect(result).toMatchObject({ cache: 'pending' });
    expect(result.commitUrl).toContain('/commit/');
    expect(result.commitSha).toMatch(/^[a-f0-9]{40}$/);
    expect(result.changedPaths).toEqual(
      expect.arrayContaining([
        'content/projects/atomic-project.json',
        'content/project-index.json',
        'content/site.json',
        staged.path,
      ]),
    );
    const committed = fixtureGitStats();
    expect(committed).toEqual({
      blobCreations: before.blobCreations + 4,
      treeCreations: before.treeCreations + 1,
      commitsCreated: before.commitsCreated + 1,
      refUpdates: before.refUpdates + 1,
    });

    const retried = await cms.POST(
      await request('/api/cms', {
        githubId: cmsPatUserId,
        origin: cmsBaseUrl,
        data: { kind: 'revalidate', target: 'project', slug: 'atomic-project' },
      }),
    );
    expect(retried.status).toBe(200);
    expect(await retried.json()).toEqual({ cache: 'refreshed' });
    expect(fixtureGitStats()).toEqual(committed);
  });

  test('owner can list existing media and stale or missing deletion SHAs conflict without writes', async () => {
    expect((await media.GET(await request('/api/cms/media'))).status).toBe(401);
    expect(
      (await media.GET(await request('/api/cms/media', { githubId: '99999999' }))).status,
    ).toBe(403);

    const response = await media.GET(await request('/api/cms/media', { githubId: cmsPatUserId }));
    expect(response.status).toBe(200);
    const listing = await response.json();
    expect(listing.repository).toEqual({
      owner: 'fixture-owner',
      name: 'portfolio-content-fixture',
      defaultBranch: 'published',
    });
    expect(listing.media).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'media/projects/fixture-project/cover.png' }),
        expect.objectContaining({ path: 'media/projects/browser-cms-project/cover.png' }),
        expect.objectContaining({ path: 'media/technologies/unreferenced.svg' }),
      ]),
    );
    expect(listing.media.every((item: { sha: string }) => /^[a-f0-9]{40}$/i.test(item.sha))).toBe(
      true,
    );

    const snapshot = await (
      await cms.GET(await request('/api/cms', { githubId: cmsPatUserId }))
    ).json();
    const fixtureMedia = listing.media.find(
      (item: { path: string }) => item.path === snapshot.projects[0].data.media.cover,
    );
    expect(fixtureMedia).toBeDefined();
    const before = fixtureGitStats();
    const invalidDeletes = [
      [{ path: 'media/projects/fixture-project/../escape.png', expectedSha: 'a'.repeat(40) }],
      [
        { path: fixtureMedia.path, expectedSha: fixtureMedia.sha },
        { path: fixtureMedia.path, expectedSha: fixtureMedia.sha },
      ],
    ];
    for (const deleteMedia of invalidDeletes) {
      const invalid = await cms.POST(
        await request('/api/cms', {
          githubId: cmsPatUserId,
          origin: cmsBaseUrl,
          data: {
            kind: 'finalize',
            repositoryKey: repositoryKey(snapshot.repository),
            projects: { upsert: [], delete: [] },
            media: [],
            deleteMedia,
          },
        }),
      );
      expect(invalid.status).toBe(400);
    }
    expect(fixtureGitStats()).toEqual(before);
    const conflict = await cms.POST(
      await request('/api/cms', {
        githubId: cmsPatUserId,
        origin: cmsBaseUrl,
        data: {
          kind: 'finalize',
          repositoryKey: repositoryKey(snapshot.repository),
          projects: { upsert: [], delete: [] },
          media: [],
          deleteMedia: [
            { path: fixtureMedia.path, expectedSha: 'f'.repeat(40) },
            {
              path: 'media/projects/missing-project/missing.png',
              expectedSha: 'e'.repeat(40),
            },
          ],
        },
      }),
    );
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toMatchObject({
      conflicts: expect.arrayContaining([
        expect.objectContaining({ path: fixtureMedia.path, expectedSha: 'f'.repeat(40) }),
        expect.objectContaining({
          path: 'media/projects/missing-project/missing.png',
          currentSha: null,
        }),
      ]),
    });
    expect(fixtureGitStats()).toEqual(before);
  });

  test('media deletion rejects referenced files and publishes replacement plus reference update atomically', async () => {
    const initialResponse = await cms.GET(await request('/api/cms', { githubId: cmsPatUserId }));
    const initial = await initialResponse.json();
    const mediaResponse = await media.GET(
      await request('/api/cms/media', { githubId: cmsPatUserId }),
    );
    const listing = await mediaResponse.json();
    const referenced = listing.media.find(
      (item: { path: string }) => item.path === initial.projects[0].data.media.cover,
    );
    const beforeRejectedDelete = fixtureGitStats();
    const rejected = await cms.POST(
      await request('/api/cms', {
        githubId: cmsPatUserId,
        origin: cmsBaseUrl,
        data: {
          kind: 'finalize',
          repositoryKey: repositoryKey(initial.repository),
          projects: { upsert: [], delete: [] },
          media: [],
          deleteMedia: [{ path: referenced.path, expectedSha: referenced.sha }],
        },
      }),
    );
    expect(rejected.status).toBe(400);
    expect(await rejected.json()).toMatchObject({ code: 'validation' });
    expect(fixtureGitStats()).toEqual(beforeRejectedDelete);

    const oldPath = 'media/projects/browser-cms-project/cover.png';
    const browserProject = {
      ...initial.projects[0].data,
      title: 'Browser CMS media cleanup project',
      media: { cover: oldPath, gallery: [] },
    };
    const prepared = await cms.POST(
      await request('/api/cms', {
        githubId: cmsPatUserId,
        origin: cmsBaseUrl,
        data: {
          kind: 'finalize',
          repositoryKey: repositoryKey(initial.repository),
          projects: {
            upsert: [{ slug: 'browser-cms-project', expectedSha: null, data: browserProject }],
            delete: [],
          },
          media: [],
        },
      }),
    );
    expect(prepared.status, await prepared.clone().text()).toBe(200);

    const updatedSnapshot = await (
      await cms.GET(await request('/api/cms', { githubId: cmsPatUserId }))
    ).json();
    const updatedProject = updatedSnapshot.projects.find(
      (item: { slug: string }) => item.slug === 'browser-cms-project',
    );
    const afterPreparationMedia = await (
      await media.GET(await request('/api/cms/media', { githubId: cmsPatUserId }))
    ).json();
    const oldMedia = afterPreparationMedia.media.find(
      (item: { path: string }) => item.path === oldPath,
    );
    const stagedResponse = await media.POST(
      await request('/api/cms/media', {
        githubId: cmsPatUserId,
        origin: cmsBaseUrl,
        data: {
          scope: 'project',
          slug: 'browser-cms-project',
          filename: 'replacement.png',
          mime: 'image/png',
          content: fixturePng.toString('base64'),
        },
      }),
    );
    expect(stagedResponse.status).toBe(200);
    const staged = await stagedResponse.json();
    const beforeDelete = fixtureGitStats();
    const finalized = await cms.POST(
      await request('/api/cms', {
        githubId: cmsPatUserId,
        origin: cmsBaseUrl,
        data: {
          kind: 'finalize',
          repositoryKey: repositoryKey(updatedSnapshot.repository),
          projects: {
            upsert: [
              {
                slug: 'browser-cms-project',
                expectedSha: updatedProject.sha,
                data: { ...updatedProject.data, media: { cover: staged.path, gallery: [] } },
              },
            ],
            delete: [],
          },
          media: [staged],
          deleteMedia: [{ path: oldPath, expectedSha: oldMedia.sha }],
        },
      }),
    );
    expect(finalized.status, await finalized.clone().text()).toBe(200);
    const result = await finalized.json();
    expect(result.changedPaths).toEqual(
      expect.arrayContaining(['content/projects/browser-cms-project.json', staged.path, oldPath]),
    );
    expect(fixtureGitStats()).toEqual({
      ...beforeDelete,
      blobCreations: beforeDelete.blobCreations + 1,
      treeCreations: beforeDelete.treeCreations + 1,
      commitsCreated: beforeDelete.commitsCreated + 1,
      refUpdates: beforeDelete.refUpdates + 1,
    });
    const finalSnapshot = await (
      await cms.GET(await request('/api/cms', { githubId: cmsPatUserId }))
    ).json();
    expect(
      finalSnapshot.projects.find((item: { slug: string }) => item.slug === 'browser-cms-project')
        .data.media.cover,
    ).toBe(staged.path);
    const finalMedia = await (
      await media.GET(await request('/api/cms/media', { githubId: cmsPatUserId }))
    ).json();
    expect(finalMedia.media.some((item: { path: string }) => item.path === oldPath)).toBe(false);
    expect(finalMedia.media.some((item: { path: string }) => item.path === staged.path)).toBe(true);

    const stale = await cms.POST(
      await request('/api/cms', {
        githubId: cmsPatUserId,
        origin: cmsBaseUrl,
        data: {
          kind: 'finalize',
          repositoryKey: repositoryKey(finalSnapshot.repository),
          projects: { upsert: [], delete: [] },
          media: [],
          deleteMedia: [{ path: oldPath, expectedSha: oldMedia.sha }],
        },
      }),
    );
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({
      conflicts: [expect.objectContaining({ path: oldPath, currentSha: null })],
    });
  });

  test('deletion-only commits invalidate public content', async () => {
    const snapshot = await (
      await cms.GET(await request('/api/cms', { githubId: cmsPatUserId }))
    ).json();
    const listing = await (
      await media.GET(await request('/api/cms/media', { githubId: cmsPatUserId }))
    ).json();
    const item = listing.media.find(
      (entry: { path: string }) => entry.path === 'media/technologies/unreferenced.svg',
    );
    expect(item).toBeDefined();
    vi.mocked(revalidateTag).mockClear();
    const before = fixtureGitStats();
    const response = await cms.POST(
      await request('/api/cms', {
        githubId: cmsPatUserId,
        origin: cmsBaseUrl,
        data: {
          kind: 'finalize',
          repositoryKey: repositoryKey(snapshot.repository),
          projects: { upsert: [], delete: [] },
          media: [],
          deleteMedia: [{ path: item.path, expectedSha: item.sha }],
        },
      }),
    );
    expect(response.status, await response.clone().text()).toBe(200);
    expect((await response.json()).changedPaths).toEqual([item.path]);
    expect(revalidateTag).toHaveBeenCalledWith('content-source', 'max');
    expect(fixtureGitStats()).toEqual({
      ...before,
      treeCreations: before.treeCreations + 1,
      commitsCreated: before.commitsCreated + 1,
      refUpdates: before.refUpdates + 1,
    });
  });

  test('a stale expected SHA returns a conflict without creating a commit or moving the ref', async () => {
    const snapshotResponse = await cms.GET(await request('/api/cms', { githubId: cmsPatUserId }));
    expect(snapshotResponse.status).toBe(200);
    const snapshot = await snapshotResponse.json();
    const before = fixtureGitStats();
    const expectedSha = 'f'.repeat(40);
    const response = await cms.POST(
      await request('/api/cms', {
        githubId: cmsPatUserId,
        origin: cmsBaseUrl,
        data: {
          kind: 'finalize',
          repositoryKey: repositoryKey(snapshot.repository),
          projects: { upsert: [], delete: [] },
          site: {
            expectedSha,
            data: { ...snapshot.site.data, headline: 'Retained local draft' },
          },
          media: [],
        },
      }),
    );
    expect(response.status).toBe(409);
    const result = await response.json();
    expect(result).toMatchObject({ code: 'conflict' });
    expect(result.conflicts).toContainEqual({
      path: 'content/site.json',
      expectedSha,
      currentSha: snapshot.site.sha,
    });
    expect(fixtureGitStats()).toEqual(before);
  });

  test('hero highlights reject missing, deleted, and unpublished projects before writing', async () => {
    const snapshotResponse = await cms.GET(await request('/api/cms', { githubId: cmsPatUserId }));
    expect(snapshotResponse.status).toBe(200);
    const snapshot = await snapshotResponse.json();
    const project = snapshot.projects.find(
      (entry: { slug: string }) => entry.slug === 'fixture-project',
    );
    expect(project).toBeDefined();
    const before = fixtureGitStats();
    const invalidDrafts = [
      {
        heroProjectSlugs: ['missing-project'],
        projects: { upsert: [], delete: [] },
      },
      {
        heroProjectSlugs: ['fixture-project'],
        projects: {
          upsert: [],
          delete: [{ slug: project.slug, expectedSha: project.sha }],
        },
      },
      {
        heroProjectSlugs: ['fixture-project'],
        projects: {
          upsert: [
            {
              slug: project.slug,
              expectedSha: project.sha,
              data: { ...project.data, published: false },
            },
          ],
          delete: [],
        },
      },
    ];

    for (const invalidDraft of invalidDrafts) {
      const response = await cms.POST(
        await request('/api/cms', {
          githubId: cmsPatUserId,
          origin: cmsBaseUrl,
          data: {
            kind: 'finalize',
            repositoryKey: repositoryKey(snapshot.repository),
            projects: invalidDraft.projects,
            site: {
              expectedSha: snapshot.site.sha,
              data: { ...snapshot.site.data, heroProjectSlugs: invalidDraft.heroProjectSlugs },
            },
            media: [],
          },
        }),
      );
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: 'validation' });
      expect(fixtureGitStats()).toEqual(before);
    }
  });

  test('a staged technology icon can be finalized when the resulting registry references it', async () => {
    const snapshotResponse = await cms.GET(await request('/api/cms', { githubId: cmsPatUserId }));
    expect(snapshotResponse.status).toBe(200);
    const snapshot = await snapshotResponse.json();
    const before = fixtureGitStats();
    const stagedResponse = await media.POST(
      await request('/api/cms/media', {
        githubId: cmsPatUserId,
        origin: cmsBaseUrl,
        data: {
          scope: 'technology',
          slug: 'technologies',
          filename: 'Next.js.png',
          mime: 'image/png',
          content: fixturePng.toString('base64'),
        },
      }),
    );
    expect(stagedResponse.status).toBe(200);
    const staged = await stagedResponse.json();
    const stagedStats = fixtureGitStats();
    expect(stagedStats).toEqual({
      ...before,
      blobCreations: before.blobCreations + 1,
    });
    const technologies = {
      ...snapshot.technologies.data,
      nextjs: { ...snapshot.technologies.data.nextjs, icon: staged.path },
    };

    const finalized = await cms.POST(
      await request('/api/cms', {
        githubId: cmsPatUserId,
        origin: cmsBaseUrl,
        data: {
          kind: 'finalize',
          repositoryKey: repositoryKey(snapshot.repository),
          projects: { upsert: [], delete: [] },
          technologies: { expectedSha: snapshot.technologies.sha, data: technologies },
          media: [staged],
        },
      }),
    );
    expect(finalized.status, await finalized.clone().text()).toBe(200);
    const result = await finalized.json();
    expect(result.changedPaths).toEqual(
      expect.arrayContaining(['content/technologies.json', staged.path]),
    );
    expect(fixtureGitStats()).toEqual({
      ...stagedStats,
      blobCreations: stagedStats.blobCreations + 1,
      treeCreations: stagedStats.treeCreations + 1,
      commitsCreated: stagedStats.commitsCreated + 1,
      refUpdates: stagedStats.refUpdates + 1,
    });
  });

  test('finalization rejects staged media that no resulting document references', async () => {
    const snapshotResponse = await cms.GET(await request('/api/cms', { githubId: cmsPatUserId }));
    expect(snapshotResponse.status).toBe(200);
    const snapshot = await snapshotResponse.json();
    const before = fixtureGitStats();
    const stagedResponse = await media.POST(
      await request('/api/cms/media', {
        githubId: cmsPatUserId,
        origin: cmsBaseUrl,
        data: {
          scope: 'project',
          slug: 'fixture-project',
          filename: 'orphan.png',
          mime: 'image/png',
          content: fixturePng.toString('base64'),
        },
      }),
    );
    expect(stagedResponse.status).toBe(200);
    const staged = await stagedResponse.json();
    const stagedStats = fixtureGitStats();
    expect(stagedStats).toEqual({
      ...before,
      blobCreations: before.blobCreations + 1,
    });

    const response = await cms.POST(
      await request('/api/cms', {
        githubId: cmsPatUserId,
        origin: cmsBaseUrl,
        data: {
          kind: 'finalize',
          repositoryKey: repositoryKey(snapshot.repository),
          projects: { upsert: [], delete: [] },
          media: [staged],
        },
      }),
    );
    expect(response.status).toBe(400);
    const result = await response.json();
    expect(result).toMatchObject({ code: 'validation' });
    expect(result.error).toMatch(/not referenced by a resulting project or technology icon/i);
    expect(fixtureGitStats()).toEqual(stagedStats);
  });

  test('a changed default branch returns a repository-binding conflict before writes', async () => {
    const snapshotResponse = await cms.GET(await request('/api/cms', { githubId: cmsPatUserId }));
    expect(snapshotResponse.status).toBe(200);
    const snapshot = await snapshotResponse.json();
    const before = fixtureGitStats();
    const fixtureFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = new URL(
        typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
      );
      if (
        url.hostname === 'api.github.com' &&
        url.pathname === '/repos/fixture-owner/portfolio-content-fixture' &&
        (init.method ?? 'GET') === 'GET'
      ) {
        const response = await fixtureFetch(input, init);
        const metadata = (await response.json()) as Record<string, unknown>;
        return new Response(JSON.stringify({ ...metadata, default_branch: 'changed-branch' }), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return fixtureFetch(input, init);
    }) as typeof fetch;

    let response: Response;
    try {
      response = await cms.POST(
        await request('/api/cms', {
          githubId: cmsPatUserId,
          origin: cmsBaseUrl,
          data: {
            kind: 'finalize',
            repositoryKey: repositoryKey(snapshot.repository),
            projects: { upsert: [], delete: [] },
            site: {
              expectedSha: snapshot.site.sha,
              data: { ...snapshot.site.data, headline: 'Must not publish to a different branch' },
            },
            media: [],
          },
        }),
      );
    } finally {
      globalThis.fetch = fixtureFetch;
    }

    expect(response.status).toBe(409);
    const result = await response.json();
    expect(result).toMatchObject({ code: 'conflict' });
    expect(result.error).toMatch(/repository or default branch changed/i);
    expect(result.conflicts).toContainEqual({
      path: '@repository',
      expectedSha: repositoryKey(snapshot.repository),
      currentSha: 'fixture-owner/portfolio-content-fixture@changed-branch',
    });
    expect(fixtureGitStats()).toEqual(before);
  });

  test('finalization rejects category, technology, and media references that would be orphaned', async () => {
    const snapshotResponse = await cms.GET(await request('/api/cms', { githubId: cmsPatUserId }));
    expect(snapshotResponse.status).toBe(200);
    const snapshot = await snapshotResponse.json();
    const current = snapshot.projects.find(
      (project: { slug: string }) => project.slug === 'fixture-project',
    );
    expect(current).toBeTruthy();
    const before = fixtureGitStats();
    const candidates = [
      {
        operation: {
          categories: { expectedSha: snapshot.categories.sha, data: {} },
        },
        expectedMessage: /category/,
      },
      {
        operation: {
          technologies: { expectedSha: snapshot.technologies.sha, data: {} },
        },
        expectedMessage: /technology/,
      },
      {
        operation: {
          projects: {
            upsert: [
              {
                slug: current.slug,
                expectedSha: current.sha,
                data: {
                  ...current.data,
                  media: { cover: 'media/projects/another-project/cover.png', gallery: [] },
                },
              },
            ],
            delete: [],
          },
        },
        expectedMessage: /own media folder/,
      },
    ];
    for (const candidate of candidates) {
      const response = await cms.POST(
        await request('/api/cms', {
          githubId: cmsPatUserId,
          origin: cmsBaseUrl,
          data: {
            kind: 'finalize',
            repositoryKey: repositoryKey(snapshot.repository),
            projects: { upsert: [], delete: [] },
            media: [],
            ...candidate.operation,
          },
        }),
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body).toMatchObject({ code: 'validation' });
      expect(body.error).toMatch(candidate.expectedMessage);
      expect(fixtureGitStats()).toEqual(before);
    }
  });

  test('project mappings must be owner-accessible and cannot be assigned twice', async () => {
    const snapshotResponse = await cms.GET(await request('/api/cms', { githubId: cmsPatUserId }));
    expect(snapshotResponse.status).toBe(200);
    const snapshot = await snapshotResponse.json();
    const current = snapshot.projects.find(
      (project: { slug: string }) => project.slug === 'fixture-project',
    );
    expect(current).toBeTruthy();
    const before = fixtureGitStats();
    let repositoryListRequests = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = new URL(
        typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
      );
      if (url.hostname === 'api.github.com' && url.pathname === '/user/repos') {
        repositoryListRequests += 1;
      }
      return originalFetch(input, init);
    }) as typeof fetch;
    let inaccessible: Response;
    try {
      inaccessible = await cms.POST(
        await request('/api/cms', {
          githubId: cmsPatUserId,
          origin: cmsBaseUrl,
          data: {
            kind: 'finalize',
            repositoryKey: repositoryKey(snapshot.repository),
            projects: {
              upsert: [
                {
                  slug: current.slug,
                  expectedSha: current.sha,
                  data: { ...current.data, githubRepositoryId: 310001 },
                },
                {
                  slug: 'inaccessible-project',
                  expectedSha: null,
                  data: {
                    ...current.data,
                    githubRepositoryId: 999999,
                    media: { cover: 'media/projects/inaccessible-project/cover.png', gallery: [] },
                  },
                },
              ],
              delete: [],
            },
            media: [],
          },
        }),
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
    expect(inaccessible.status).toBe(403);
    expect(await inaccessible.json()).toMatchObject({ code: 'forbidden' });
    expect(repositoryListRequests).toBe(1);
    expect(fixtureGitStats()).toEqual(before);

    const duplicate = await cms.POST(
      await request('/api/cms', {
        githubId: cmsPatUserId,
        origin: cmsBaseUrl,
        data: {
          kind: 'finalize',
          repositoryKey: repositoryKey(snapshot.repository),
          projects: {
            upsert: [
              {
                slug: current.slug,
                expectedSha: current.sha,
                data: { ...current.data, githubRepositoryId: 310001 },
              },
              {
                slug: 'duplicate-project',
                expectedSha: null,
                data: {
                  ...current.data,
                  githubRepositoryId: 310001,
                  media: { cover: 'media/projects/duplicate-project/cover.png', gallery: [] },
                },
              },
            ],
            delete: [],
          },
          media: [],
        },
      }),
    );
    expect(duplicate.status).toBe(400);
    expect(await duplicate.json()).toMatchObject({ code: 'validation' });
    expect(fixtureGitStats()).toEqual(before);
  });

  test('design finalization preserves portfolio facts and rejects unknown Dribbble IDs', async () => {
    const original = await readPortfolio(cmsPat);
    const before = fixtureGitStats();
    const response = await cms.POST(
      await request('/api/cms', {
        githubId: cmsPatUserId,
        origin: cmsBaseUrl,
        data: {
          kind: 'finalize',
          repositoryKey: repositoryKey(original.repository),
          projects: { upsert: [], delete: [] },
          designs: { expectedSha: original.sha, designs: ['2', '3'] },
          media: [],
        },
      }),
    );
    expect(response.status, await response.clone().text()).toBe(200);
    expect(fixtureGitStats()).toEqual({
      ...before,
      blobCreations: before.blobCreations + 1,
      treeCreations: before.treeCreations + 1,
      commitsCreated: before.commitsCreated + 1,
      refUpdates: before.refUpdates + 1,
    });
    const saved = await readPortfolio(cmsPat);
    expect(saved.data).toEqual({ ...original.data, designs: ['2', '3'] });

    const afterSave = fixtureGitStats();
    const unknown = await cms.POST(
      await request('/api/cms', {
        githubId: cmsPatUserId,
        origin: cmsBaseUrl,
        data: {
          kind: 'finalize',
          repositoryKey: repositoryKey(saved.repository),
          projects: { upsert: [], delete: [] },
          designs: { expectedSha: saved.sha, designs: ['99'] },
          media: [],
        },
      }),
    );
    expect(unknown.status).toBe(400);
    expect(await unknown.json()).toMatchObject({ code: 'validation' });
    expect(fixtureGitStats()).toEqual(afterSave);
  });

  test('CMS request limits stay below Vercel’s 4.5 MB function payload cap', async () => {
    const oversizedFinalize = await cms.POST(
      await request('/api/cms', {
        githubId: cmsPatUserId,
        origin: cmsBaseUrl,
        data: 'x'.repeat(4_400_001),
      }),
    );
    expect(oversizedFinalize.status).toBe(413);

    const oversizedMedia = await media.POST(
      await request('/api/cms/media', {
        githubId: cmsPatUserId,
        origin: cmsBaseUrl,
        data: {
          scope: 'project',
          slug: 'atomic-project',
          filename: 'cover.png',
          mime: 'image/png',
          content: 'A'.repeat(1_450_000),
        },
      }),
    );
    expect(oversizedMedia.status).toBe(413);
  });

  test('reject invalid image metadata and bytes without leaking the credential', async () => {
    for (const data of [
      {
        slug: 'fixture-project',
        filename: 'spoof.jpg',
        mime: 'image/jpeg',
        content: fixturePng.toString('base64'),
        unexpected: 'field',
      },
      {
        slug: 'fixture-project',
        filename: 'spoof.png',
        mime: 'image/png',
        content: Buffer.from('not an image').toString('base64'),
      },
    ]) {
      const response = await media.POST(
        await request('/api/cms/media', {
          githubId: cmsPatUserId,
          origin: cmsBaseUrl,
          data,
        }),
      );
      expect(response.status).toBe(400);
      expect(await response.text()).not.toContain(cmsPat);
    }
  });
});
