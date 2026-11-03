import { describe, expect, test, vi } from 'vitest';

// The HTTP contract must never use real provider credentials or send email.
vi.mock('@/lib/contact/service', () => ({
  mailConfigured: () => false,
  captchaSecret: () => '',
  sendContactEmail: vi.fn(),
  verifyCaptcha: vi.fn(),
}));

import { POST } from '@/app/api/contact/route';

const message = {
  name: 'Visitor',
  email: 'visitor@example.com',
  subject: 'Portfolio enquiry',
  message: 'Hello.',
  website: '',
};

function post(data: unknown, headers: HeadersInit = {}) {
  return POST(
    new Request('https://portfolio.example/api/contact', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(data),
    }),
  );
}

describe('contact HTTP boundary', () => {
  test('accepts a permitted Unicode payload larger than 16 KiB', async () => {
    const data = {
      ...message,
      name: '名'.repeat(100),
      subject: '件'.repeat(160),
      email: 'a'.repeat(242) + '@example.com',
      message: '日'.repeat(5000),
      recaptcha_token: 'x'.repeat(4096),
    };
    expect(Buffer.byteLength(JSON.stringify(data))).toBeGreaterThan(16 * 1024);
    const response = await post(data);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      success: false,
      message: 'Email delivery is temporarily unavailable. Please use LinkedIn to get in touch.',
    });
  });

  test('enforces the byte cap and request abuse checks', async () => {
    const oversized = await post({ ...message, message: 'x'.repeat(64 * 1024) });
    expect(oversized.status).toBe(400);
    expect((await oversized.json()).message).toContain('too large');
    expect((await post(message, { origin: 'https://other.example' })).status).toBe(403);
    expect((await post({ ...message, website: 'spam.example' })).status).toBe(400);
  });
});
