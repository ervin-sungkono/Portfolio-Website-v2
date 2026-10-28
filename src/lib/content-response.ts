export async function contentExistsResponse(
  request: Request,
  lookup: (slug: string) => Promise<unknown>,
) {
  const slug = new URL(request.url).searchParams.get('slug') ?? '';
  const headers = { 'Cache-Control': 'no-store' };
  try {
    const exists =
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 100 && Boolean(await lookup(slug));
    return Response.json({ exists }, { headers });
  } catch {
    return Response.json(
      { error: 'Published content is temporarily unavailable.' },
      { status: 503, headers },
    );
  }
}
