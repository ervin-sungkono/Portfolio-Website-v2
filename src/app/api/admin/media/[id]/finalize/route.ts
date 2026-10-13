import { requireOwner } from '@/lib/cms/guards';
import { mediaErrorResponse, hasExactOrigin, readBoundedJson } from '@/lib/cms/media-http';
import { finalizeMediaUpload } from '@/lib/cms/media';
import { isMediaUuid } from '@/lib/cms/media-validation';
import { MediaValidationError } from '@/lib/cms/media-validation';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  if (!hasExactOrigin(request)) {
    return Response.json(
      { error: 'Submit this request from the CMS website.' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  try {
    const owner = await requireOwner();
    const { id } = await context.params;
    if (!isMediaUuid(id)) throw new MediaValidationError('The image ID is invalid.');
    const body = await readBoundedJson(request, 128);
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).length !== 0
    ) {
      throw new MediaValidationError('The finalize request is invalid.');
    }
    const media = await finalizeMediaUpload(id.toLowerCase(), owner.userId);
    return Response.json({ media }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return mediaErrorResponse(error, 'finalize');
  }
}
