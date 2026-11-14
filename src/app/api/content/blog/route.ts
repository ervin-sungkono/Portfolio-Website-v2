import { findBlogPost } from '@/lib/content';

// The proxy uses this read-only response to preserve article 404 HTML and status without JavaScript.
export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get('slug') ?? '';
  try {
    const exists =
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) &&
      slug.length <= 100 &&
      Boolean(await findBlogPost(slug));
    return Response.json(
      { exists },
      { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
    );
  } catch {
    return Response.json(
      { error: 'Published content is temporarily unavailable.' },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
      },
    );
  }
}
