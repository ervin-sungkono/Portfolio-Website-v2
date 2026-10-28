import { NextResponse, type NextRequest } from 'next/server';
import projects from './content/projects.json';

export async function proxy(request: NextRequest) {
  const isPost = request.nextUrl.pathname.startsWith('/blog/');
  const slug = request.nextUrl.pathname.slice(isPost ? '/blog/'.length : '/project/'.length);
  // Use platform configuration, never an untrusted Host header, for internal requests.
  const origin = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : `http://127.0.0.1:${process.env.PORT || '3000'}`;
  const headers = { cookie: request.headers.get('cookie') ?? '' };
  let exists = false;
  if (!process.env.GITHUB_ADMIN_ID && !process.env.GITHUB_REPO) {
    exists = !isPost && projects.some((project) => project.slug === slug);
  } else if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 100) {
    const url = new URL(isPost ? '/api/content/post' : '/api/content/project', origin);
    url.searchParams.set('slug', slug);
    try {
      const response = await fetch(url, {
        cache: 'no-store',
        signal: AbortSignal.timeout(15_000),
        headers,
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
    const recovery = await fetch(
      new URL(isPost ? '/blog-not-found' : '/project-not-found', origin),
      {
        headers,
        cache: 'no-store',
        signal: AbortSignal.timeout(15_000),
      },
    );
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
      isPost
        ? 'This post was not found. Visit /blog to read published posts.'
        : 'This project was not found. Visit /project to explore published work.',
      {
        status: 404,
        headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
      },
    );
  }
}

export const config = { matcher: ['/project/:slug', '/blog/:slug'] };
