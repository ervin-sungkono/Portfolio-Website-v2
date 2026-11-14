import { NextResponse, type NextRequest } from 'next/server';

function internalOrigin() {
  const deployment = process.env.VERCEL_URL;
  const host =
    process.env.VERCEL_ENV === 'production'
      ? process.env.VERCEL_PROJECT_PRODUCTION_URL || deployment
      : deployment;
  if (host) {
    // These values come from Vercel, never the request's Host header.
    if (
      !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(
        host,
      ) ||
      /^\d+(?:\.\d+){3}$/.test(host)
    ) {
      throw new Error('Invalid deployment hostname.');
    }
    return `https://${host}`;
  }
  if (process.env.VERCEL_ENV || deployment) {
    throw new Error('Missing deployment hostname.');
  }
  const port = process.env.PORT || '3000';
  if (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error('Invalid local port.');
  }
  return `http://127.0.0.1:${port}`;
}

export async function proxy(request: NextRequest) {
  const slug = request.nextUrl.pathname.slice('/project/'.length);
  let origin: string;
  try {
    origin = internalOrigin();
  } catch {
    return new NextResponse('Published content is temporarily unavailable. Please try again.', {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
  const headers = new Headers({ cookie: request.headers.get('cookie') ?? '' });
  if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET && origin.startsWith('https://')) {
    headers.set('x-vercel-protection-bypass', process.env.VERCEL_AUTOMATION_BYPASS_SECRET);
  }
  let exists = false;
  if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 100) {
    const url = new URL('/api/content/project', origin);
    url.searchParams.set('slug', slug);
    try {
      const response = await fetch(url, {
        cache: 'no-store',
        signal: AbortSignal.timeout(15_000),
        headers,
        redirect: 'error',
      });
      if (!response.ok) {
        throw new Error('Public content check failed.');
      }
      const value: unknown = await response.json();
      exists =
        typeof value === 'object' && value !== null && 'exists' in value && value.exists === true;
    } catch {
      return new NextResponse('Published content is temporarily unavailable. Please try again.', {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      });
    }
  }
  if (exists) {
    return NextResponse.next();
  }
  try {
    // Buffer the static recovery document: PPR rewrites can replace a supplied 404 with 200.
    const recovery = await fetch(new URL('/not-found', origin), {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
      redirect: 'error',
    });
    if (!recovery.ok) {
      throw new Error('Recovery page unavailable.');
    }
    return new NextResponse(request.method === 'HEAD' ? null : await recovery.text(), {
      status: 404,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex',
      },
    });
  } catch {
    return new NextResponse(
      'This project was not found. Visit /project to explore published work.',
      {
        status: 404,
        headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
      },
    );
  }
}

export const config = { matcher: '/project/:slug' };
