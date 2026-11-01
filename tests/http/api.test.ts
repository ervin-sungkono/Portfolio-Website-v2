import { expect, test } from 'vitest';
import {
  cmsAdminId,
  cmsBaseUrl,
  cmsCookieName,
  cmsOwnerToken,
  cmsSessionCookie,
  fixturePng,
} from '../support/cms-fixture';

// The fixture runner binds this isolated server and clears all email credentials.
const base = cmsBaseUrl;
const message = {
  name: 'Visitor',
  email: 'visitor@example.com',
  subject: 'Portfolio enquiry',
  message: 'Hello.',
  website: '',
};

async function request(
  path: string,
  options: {
    githubId?: string;
    token?: string;
    origin?: string;
    data?: unknown;
  } = {},
) {
  const headers = new Headers();
  if (options.githubId) {
    headers.set(
      'cookie',
      `${cmsCookieName}=${await cmsSessionCookie(cmsCookieName, options.githubId, options.token)}`,
    );
  }
  if (options.origin) {
    headers.set('origin', options.origin);
  }
  if (options.data !== undefined) {
    headers.set('content-type', 'application/json');
  }
  return fetch(new URL(path, base), {
    method: options.data === undefined ? 'GET' : 'POST',
    headers,
    body: options.data === undefined ? undefined : JSON.stringify(options.data),
  });
}

test('contact route accepts a large valid Unicode body and rejects abuse', async () => {
  const large = {
    ...message,
    name: '名'.repeat(100),
    subject: '件'.repeat(160),
    email: 'a'.repeat(242) + '@example.com',
    message: '日'.repeat(5000),
    recaptcha_token: 'x'.repeat(4096),
  };
  expect(Buffer.byteLength(JSON.stringify(large))).toBeGreaterThan(16 * 1024);
  const fallback = await request('/api/contact', { data: large });
  expect(fallback.status).toBe(503);
  expect(await fallback.json()).toMatchObject({
    success: false,
    message: 'Email delivery is temporarily unavailable. Please use LinkedIn to get in touch.',
  });

  const oversized = await request('/api/contact', {
    data: { ...message, message: 'x'.repeat(64 * 1024) },
  });
  expect(oversized.status).toBe(400);
  expect((await oversized.json()).message).toContain('too large');
  expect(
    (await request('/api/contact', { origin: 'https://attacker.example', data: message })).status,
  ).toBe(403);
  expect(
    (await request('/api/contact', { data: { ...message, website: 'spam.example' } })).status,
  ).toBe(400);
});

test('CMS routes enforce owner sessions, origin and media validation over HTTP', async () => {
  expect((await request('/api/cms')).status).toBe(401);
  expect((await request('/api/cms', { githubId: '99999999' })).status).toBe(403);
  const badToken = await request('/api/cms', { githubId: cmsAdminId, token: 'fixture-bad-token' });
  expect(badToken.status).toBe(401);
  expect(await badToken.text()).not.toContain('fixture-bad-token');

  const session = await request('/api/auth/session', { githubId: cmsAdminId });
  expect(session.status).toBe(200);
  expect(await session.text()).not.toContain(cmsOwnerToken);
  expect(
    (
      await request('/api/cms', {
        githubId: cmsAdminId,
        origin: 'https://attacker.example',
        data: { kind: 'initialize' },
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await request('/api/cms', {
        githubId: cmsAdminId,
        origin: base,
        data: { kind: 'project', slug: '../escape', expectedSha: null, data: {} },
      })
    ).status,
  ).toBe(400);

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
    const response = await request('/api/cms/media', { githubId: cmsAdminId, origin: base, data });
    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain(cmsOwnerToken);
  }
});
