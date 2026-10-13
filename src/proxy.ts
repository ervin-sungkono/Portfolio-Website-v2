import { NextResponse, type NextRequest } from 'next/server';
import { createHash, randomBytes } from 'node:crypto';
import { themeScript } from '@/lib/theme-script';
import projects from '@/content/projects.json';
import { getPool } from '@/lib/cms/db';

const staticProjectSlugs = new Set(projects.map(({ slug }) => slug));

async function projectExists(slug: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return false;
  const source = process.env.CMS_CONTENT_SOURCE || 'static';
  if (source === 'static') return staticProjectSlugs.has(slug);
  if (source !== 'database') throw new Error('Invalid public content source.');
  const result = await getPool('public').query(
    "SELECT 1 FROM cms.published_content WHERE kind = 'project' AND slug = $1 LIMIT 1",
    [slug],
  );
  return result.rowCount === 1;
}

// Authorization is checked by server guards at each operation. This boundary
// supplies a per-request nonce and private response headers for admin/auth only.
export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === '/project-not-found') {
    return NextResponse.rewrite(new URL(request.url), {
      status: 404,
      headers: { 'X-Robots-Tag': 'noindex', 'Cache-Control': 'no-store' },
    });
  }
  if (request.nextUrl.pathname.startsWith('/project/')) {
    try {
      const slug = decodeURIComponent(request.nextUrl.pathname.slice('/project/'.length));
      if (await projectExists(slug)) return NextResponse.next();
      // Next's dynamically thrown notFound currently serializes recovery only
      // into Flight. Render complete, uncached recovery before rendering begins
      // so missing and subsequently published CMS slugs work without JavaScript.
      return NextResponse.rewrite(new URL('/project-not-found', request.url), {
        status: 404,
        headers: { 'X-Robots-Tag': 'noindex', 'Cache-Control': 'no-store' },
      });
    } catch {
      // Database mode never falls back to the static snapshot on a failed read.
      return new NextResponse('Project information is temporarily unavailable. Please try again.', {
        status: 503,
        headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
      });
    }
  }
  const nonce = randomBytes(24).toString('base64');
  const themeHash = createHash('sha256').update(themeScript).digest('base64');
  const development = process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : '';
  const policy = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'sha256-${themeHash}' 'strict-dynamic'${development}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://raw.githubusercontent.com https://cdn.dribbble.com",
    "font-src 'self'",
    "connect-src 'self' https://*.blob.vercel-storage.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', policy);
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'same-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  return response;
}

export const config = {
  matcher: [
    '/project/:slug',
    '/project-not-found',
    '/admin/:path*',
    '/api/admin/:path*',
    '/api/auth/:path*',
  ],
};
