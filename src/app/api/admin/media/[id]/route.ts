import { requireOwner } from '@/lib/cms/guards';
import { mediaErrorResponse } from '@/lib/cms/media-http';
import { openOwnerPreview } from '@/lib/cms/media';
import { isMediaUuid } from '@/lib/cms/media-validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const owner = await requireOwner();
    const { id } = await context.params;
    if (!isMediaUuid(id))
      return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    const opened = await openOwnerPreview(id.toLowerCase(), owner.userId);
    const headers = new Headers({
      'Cache-Control': 'private, no-store, max-age=0',
      Pragma: 'no-cache',
      Vary: 'Cookie',
      'X-Robots-Tag': 'noindex, nofollow',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Referrer-Policy': 'no-referrer',
      'Content-Type': opened.mime,
    });
    if (opened.byteSize) headers.set('Content-Length', String(opened.byteSize));
    if (opened.width && opened.height) {
      headers.set('X-Media-Width', String(opened.width));
      headers.set('X-Media-Height', String(opened.height));
    }
    return new Response(opened.body as BodyInit, { headers });
  } catch (error) {
    return mediaErrorResponse(error, 'owner-preview');
  }
}
