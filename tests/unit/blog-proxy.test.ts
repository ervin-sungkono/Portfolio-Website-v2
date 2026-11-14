import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('published blog article proxy', () => {
  it('checks the blog API and allows an existing article', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('VERCEL_URL', 'portfolio-preview.vercel.app');
    vi.stubEnv('VERCEL_AUTOMATION_BYPASS_SECRET', 'test-bypass');
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ exists: true }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await proxy(new NextRequest('https://attacker.example/blog/first-article'));

    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      'https://portfolio-preview.vercel.app/api/content/blog?slug=first-article',
    );
    expect(fetchMock.mock.calls[0][1].redirect).toBe('error');
    expect(fetchMock.mock.calls[0][1].headers.get('x-vercel-protection-bypass')).toBe(
      'test-bypass',
    );
  });

  it('returns complete no-store, noindex 404 HTML for an unknown article', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ exists: false }))
      .mockResolvedValueOnce(new Response('<html><body>Recovery</body></html>'));
    vi.stubGlobal('fetch', fetchMock);

    const response = await proxy(new NextRequest('http://localhost:3000/blog/missing'));

    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-robots-tag')).toBe('noindex');
    expect(await response.text()).toContain('<html>');
    expect(fetchMock.mock.calls[1][1].redirect).toBe('error');
  });

  it('returns a no-store, noindex 503 when the published content check fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 503 })));

    const response = await proxy(new NextRequest('http://localhost:3000/blog/first-article'));

    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-robots-tag')).toBe('noindex');
  });
});
