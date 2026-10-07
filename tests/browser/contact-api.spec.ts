import { expect, test } from '@playwright/test';

const message = {
  name: 'Visitor',
  email: 'visitor@example.com',
  subject: 'Portfolio enquiry',
  message: 'Hello.',
  website: '',
};

test('accepts a permitted Unicode payload larger than the former 16 KiB cap', async ({
  request,
}) => {
  const data = {
    ...message,
    name: '名'.repeat(100),
    subject: '件'.repeat(160),
    email: 'a'.repeat(242) + '@example.com',
    message: '日'.repeat(5000),
    recaptcha_token: 'x'.repeat(4096),
  };
  expect(Buffer.byteLength(JSON.stringify(data))).toBeGreaterThan(16 * 1024);
  const response = await request.post('/api/contact', { data });

  // The test server clears provider credentials: validation reaches the safe fallback.
  expect(response.status()).toBe(503);
  expect(await response.json()).toMatchObject({
    success: false,
    message: 'Email delivery is temporarily unavailable. Please use LinkedIn to get in touch.',
  });
});

test('keeps the byte cap and request abuse checks', async ({ request }) => {
  const oversized = await request.post('/api/contact', {
    data: { ...message, message: 'x'.repeat(64 * 1024) },
  });
  expect(oversized.status()).toBe(400);
  expect((await oversized.json()).message).toContain('too large');

  const foreignOrigin = await request.post('/api/contact', {
    headers: { Origin: 'https://other.example' },
    data: message,
  });
  expect(foreignOrigin.status()).toBe(403);

  const honeypot = await request.post('/api/contact', {
    data: { ...message, website: 'spam.example' },
  });
  expect(honeypot.status()).toBe(400);
});
