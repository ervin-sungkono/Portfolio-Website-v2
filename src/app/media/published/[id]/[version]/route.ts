import { mediaErrorResponse } from '@/lib/cms/media-http';
import { getPublishedMedia, openPublishedMedia } from '@/lib/cms/media';
import { isMediaUuid, isMediaVersion } from '@/lib/cms/media-validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string; version: string }> };

function notFound() {
  return new Response(null, {
    status: 404,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

export async function GET(request: Request, context: RouteContext) {
  try {
    if (new URL(request.url).search) return notFound();
    const { id: rawId, version } = await context.params;
    if (!isMediaUuid(rawId) || !isMediaVersion(version) || rawId !== rawId.toLowerCase())
      return notFound();
    const id = rawId.toLowerCase();
    const asset = await getPublishedMedia(id, version);
    if (!asset) return notFound();
    const opened = await openPublishedMedia(asset);
    if (!opened) return notFound();
    return new Response(opened.stream, {
      headers: {
        'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
        'Content-Type': asset.mime,
        'Content-Length': String(opened.byteSize),
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Referrer-Policy': 'no-referrer',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  } catch (error) {
    return mediaErrorResponse(error, 'published-delivery');
  }
}
