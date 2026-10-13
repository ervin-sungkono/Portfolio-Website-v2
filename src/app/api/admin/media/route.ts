import { requireOwner } from '@/lib/cms/guards';
import { mediaErrorResponse, hasExactOrigin, readBoundedJson } from '@/lib/cms/media-http';
import { createMediaUploadIntent, listMediaAssets } from '@/lib/cms/media';
import { MediaValidationError } from '@/lib/cms/media-validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function GET() {
  try {
    const owner = await requireOwner();
    return Response.json(
      { media: await listMediaAssets(owner.userId) },
      {
        headers: {
          'Cache-Control': 'private, no-store, max-age=0',
          Vary: 'Cookie',
          'X-Robots-Tag': 'noindex, nofollow',
        },
      },
    );
  } catch (error) {
    return mediaErrorResponse(error, 'list');
  }
}

export async function POST(request: Request) {
  if (!hasExactOrigin(request)) {
    return Response.json(
      { error: 'Submit this request from the CMS website.' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  try {
    const owner = await requireOwner();
    const body = await readBoundedJson(request, 2048);
    if (!isRecord(body) || Object.keys(body).length !== 1 || typeof body.alt !== 'string') {
      throw new MediaValidationError('Enter image alternative text.');
    }
    const media = await createMediaUploadIntent(owner.userId, body.alt);
    return Response.json({ media }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return mediaErrorResponse(error, 'create-upload');
  }
}
