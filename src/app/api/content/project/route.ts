import { findProject } from '@/lib/content';

// Proxy cannot use Cache Components. This server route shares the public catalog cache.
export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get('slug') ?? '';
  try {
    const exists =
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) &&
      slug.length <= 100 &&
      Boolean(await findProject(slug));
    return Response.json({ exists }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json(
      { error: 'Published content is temporarily unavailable.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
