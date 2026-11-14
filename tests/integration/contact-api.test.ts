import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The HTTP contract must never use real provider credentials or send email.
const contactService = vi.hoisted(() => ({
  mailConfigured: vi.fn(() => false),
  captchaSecret: vi.fn(() => ''),
  sendContactEmail: vi.fn(async () => undefined),
  verifyCaptcha: vi.fn(async () => false),
}));

vi.mock('@/lib/contact/service', () => contactService);

import { POST } from '@/app/api/contact/route';

beforeEach(() => {
  vi.clearAllMocks();
  contactService.mailConfigured.mockReturnValue(false);
  contactService.captchaSecret.mockReturnValue('');
  contactService.verifyCaptcha.mockResolvedValue(false);
  vi.stubEnv('NEXT_PUBLIC_RECAPTCHA_KEY', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

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
  test('passes the request hostname to v3 verification before delivering a message', async () => {
    contactService.mailConfigured.mockReturnValue(true);
    contactService.captchaSecret.mockReturnValue('test-secret');
    contactService.verifyCaptcha.mockResolvedValue(true);
    vi.stubEnv('NEXT_PUBLIC_RECAPTCHA_KEY', 'test-site-key');

    const response = await post({ ...message, recaptcha_token: 'test-token' });

    expect(response.status).toBe(200);
    expect(contactService.verifyCaptcha).toHaveBeenCalledWith('test-token', 'portfolio.example');
    expect(contactService.sendContactEmail).toHaveBeenCalledWith({
      name: message.name,
      email: message.email,
      subject: message.subject,
      message: message.message,
    });
  });

  test('does not deliver when v3 verification rejects a message', async () => {
    contactService.mailConfigured.mockReturnValue(true);
    contactService.captchaSecret.mockReturnValue('test-secret');
    vi.stubEnv('NEXT_PUBLIC_RECAPTCHA_KEY', 'test-site-key');

    const response = await post({ ...message, recaptcha_token: 'test-token' });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      success: false,
      message: 'Verification failed. Please submit the form again.',
    });
    expect(contactService.verifyCaptcha).toHaveBeenCalledWith('test-token', 'portfolio.example');
    expect(contactService.sendContactEmail).not.toHaveBeenCalled();
  });

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
