import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { revalidateTag } from 'next/cache';
import { encode } from 'next-auth/jwt';

vi.mock('next-auth', () => ({
  default: () => ({ auth: vi.fn(), handlers: {}, signIn: vi.fn(), signOut: vi.fn() }),
  AuthError: class AuthError extends Error {
    type = 'fixture';
  },
}));
vi.mock('next-auth/providers/github', () => ({ default: vi.fn() }));
vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
import {
  cmsAuthSecret,
  cmsBaseUrl,
  cmsPat,
  cmsPatUserId,
  cmsSessionCookie,
  fixturePng,
} from '../support/cms-fixture';

let cms: typeof import('@/app/api/cms/route');
let media: typeof import('@/app/api/cms/media/route');
let cookieName: string;
const originalFetch = globalThis.fetch;

beforeAll(async () => {
  vi.stubEnv('GITHUB_PAT', cmsPat);
  vi.stubEnv('GITHUB_REPO', 'portfolio-content-fixture');
  vi.stubEnv('AUTH_SECRET', cmsAuthSecret);
  vi.stubEnv('AUTH_GITHUB_ID', 'fixture-github-client-id');
  vi.stubEnv('AUTH_GITHUB_SECRET', 'fixture-github-client-secret');
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

  test('rejects legacy session cookies that retained an OAuth access token', async () => {
    const legacyCredential = 'fixture-legacy-oauth-token';
    const encrypted = await encode({
      secret: cmsAuthSecret,
      salt: cookieName,
      maxAge: 60 * 60,
      token: { githubId: cmsPatUserId, githubAccessToken: legacyCredential },
    });
    const response = await cms.GET(
      new Request(new URL('/api/cms', cmsBaseUrl), {
        headers: { cookie: `${cookieName}=${encrypted}` },
      }),
    );
    expect(response.status).toBe(401);
    expect(await response.text()).not.toContain(legacyCredential);
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
