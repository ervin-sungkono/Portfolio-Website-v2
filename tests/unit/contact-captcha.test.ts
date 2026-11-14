import { afterEach, describe, expect, test, vi } from 'vitest';
import { verifyCaptcha } from '@/lib/contact/service';

const validVerification = {
  success: true,
  action: 'contact',
  hostname: 'Portfolio.Example.',
  score: 0.5,
};

function mockSiteverify(result: unknown) {
  const request = vi
    .fn<(url: string, options: RequestInit) => Promise<Response>>()
    .mockResolvedValue(Response.json(result));
  vi.stubGlobal('fetch', request);
  return request;
}

describe('reCAPTCHA v3 verification', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  test('requires success, the contact action, the expected hostname, and a score of at least 0.5', async () => {
    vi.stubEnv('RECAPTCHA_SECRET', 'test-secret');
    const request = mockSiteverify(validVerification);

    expect(await verifyCaptcha('test-token', 'portfolio.example')).toBe(true);
    expect(request).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledWith(
      'https://www.google.com/recaptcha/api/siteverify',
      expect.objectContaining({ method: 'POST' }),
    );
    const body = new URLSearchParams(String(request.mock.calls[0][1].body));
    expect(body.get('secret')).toBe('test-secret');
    expect(body.get('response')).toBe('test-token');
  });

  test.each([
    ['Google rejected the token', { ...validVerification, success: false }],
    ['the action does not match', { ...validVerification, action: 'login' }],
    ['the hostname does not match', { ...validVerification, hostname: 'attacker.example' }],
    ['the score is below the threshold', { ...validVerification, score: 0.49 }],
    ['the score is above the documented range', { ...validVerification, score: 1.01 }],
  ])('rejects when %s', async (_reason, result) => {
    vi.stubEnv('RECAPTCHA_SECRET', 'test-secret');
    mockSiteverify(result);

    expect(await verifyCaptcha('test-token', 'portfolio.example')).toBe(false);
  });

  test('does not call Google when the token, secret, or expected hostname is missing or oversized', async () => {
    vi.stubEnv('RECAPTCHA_SECRET', '');
    const request = mockSiteverify(validVerification);

    expect(await verifyCaptcha('test-token', 'portfolio.example')).toBe(false);
    vi.stubEnv('RECAPTCHA_SECRET', 'test-secret');
    expect(await verifyCaptcha('', 'portfolio.example')).toBe(false);
    expect(await verifyCaptcha('test-token', '')).toBe(false);
    expect(await verifyCaptcha('x'.repeat(4097), 'portfolio.example')).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });
});
