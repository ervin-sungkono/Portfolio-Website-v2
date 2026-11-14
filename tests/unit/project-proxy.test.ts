import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('published project proxy', () => {
  it('uses the trusted production domain instead of a protected deployment URL', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('VERCEL_URL', 'project-git-main.vercel.app');
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'portfolio.example.com');
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ exists: true }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await proxy(
      new NextRequest('https://attacker.example/project/example', {
        headers: { host: 'attacker.example', cookie: 'theme=dark' },
      }),
    );
    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      'https://portfolio.example.com/api/content/project?slug=example',
    );
    expect(fetchMock.mock.calls[0][1].redirect).toBe('error');
    expect(fetchMock.mock.calls[0][1].headers.get('cookie')).toBe('theme=dark');
  });

  it('authenticates protected preview checks without trusting or following redirects', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('VERCEL_URL', 'project-preview.vercel.app');
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'portfolio.example.com');
    vi.stubEnv('VERCEL_AUTOMATION_BYPASS_SECRET', 'test-bypass');
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ exists: false }));
    fetchMock.mockResolvedValueOnce(Response.json({ exists: false }));
    fetchMock.mockResolvedValueOnce(new Response('<h1>Not found</h1>'));
    vi.stubGlobal('fetch', fetchMock);
    const response = await proxy(new NextRequest('https://attacker.example/project/missing'));
    expect(response.status).toBe(404);
    expect(String(fetchMock.mock.calls[0][0])).toContain('https://project-preview.vercel.app/');
    for (const [, options] of fetchMock.mock.calls) {
      expect(options.redirect).toBe('error');
      expect(options.headers.get('x-vercel-protection-bypass')).toBe('test-bypass');
    }
  });

  it('rejects malformed platform hosts before forwarding cookies or secrets', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('VERCEL_URL', 'trusted.example@attacker.example');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await proxy(new NextRequest('https://attacker.example/project/example'));
    expect(response.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
