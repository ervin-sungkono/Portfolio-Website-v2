import { handleUpload } from '@vercel/blob/client';
import { requireOwner } from '@/lib/cms/guards';
import { mediaErrorResponse, hasExactOrigin, readBoundedJson } from '@/lib/cms/media-http';
import { getUploadIntentForPath, requireBlobToken } from '@/lib/cms/media';
import { MAX_MEDIA_UPLOAD_BYTES, isMediaUuid, mediaStagingPath } from '@/lib/cms/media-validation';
import { MediaValidationError } from '@/lib/cms/media-validation';

export const runtime = 'nodejs';

type ClientUploadRequest = {
  type: 'blob.generate-client-token';
  payload: { pathname: string; multipart: boolean; clientPayload: string | null };
};

function parseClientUploadRequest(value: unknown): ClientUploadRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new MediaValidationError('The upload request is invalid.');
  }
  const body = value as Record<string, unknown>;
  if (
    body.type !== 'blob.generate-client-token' ||
    !body.payload ||
    typeof body.payload !== 'object'
  ) {
    throw new MediaValidationError('The upload request is invalid.');
  }
  const payload = body.payload as Record<string, unknown>;
  if (
    typeof payload.pathname !== 'string' ||
    typeof payload.multipart !== 'boolean' ||
    (typeof payload.clientPayload !== 'string' && payload.clientPayload !== null)
  ) {
    throw new MediaValidationError('The upload request is invalid.');
  }
  if (payload.multipart)
    throw new MediaValidationError('Multipart image uploads are not supported.');
  return {
    type: 'blob.generate-client-token',
    payload: {
      pathname: payload.pathname,
      multipart: payload.multipart,
      clientPayload: payload.clientPayload,
    },
  };
}

function parseClientPayload(value: string | null): string {
  if (!value || value.length > 256)
    throw new MediaValidationError('The upload request is invalid.');
  let payload: unknown;
  try {
    payload = JSON.parse(value);
  } catch {
    throw new MediaValidationError('The upload request is invalid.');
  }
  if (
    !payload ||
    typeof payload !== 'object' ||
    Array.isArray(payload) ||
    Object.keys(payload).length !== 1 ||
    typeof (payload as Record<string, unknown>).id !== 'string' ||
    !isMediaUuid((payload as Record<string, string>).id)
  ) {
    throw new MediaValidationError('The upload request is invalid.');
  }
  return (payload as Record<string, string>).id.toLowerCase();
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
    const parsed = parseClientUploadRequest(await readBoundedJson(request, 4096));
    const id = parseClientPayload(parsed.payload.clientPayload);
    const pathname = mediaStagingPath(id);
    if (parsed.payload.pathname !== pathname) {
      throw new MediaValidationError('The upload destination is invalid.');
    }
    const intent = await getUploadIntentForPath(pathname, owner.userId);
    if (!intent) throw new MediaValidationError('The upload request is invalid or expired.');

    const result = await handleUpload({
      token: requireBlobToken(),
      request,
      body: parsed,
      onBeforeGenerateToken: async (requestedPath, clientPayload, multipart) => {
        const currentIntent = await getUploadIntentForPath(requestedPath, owner.userId);
        if (
          requestedPath !== pathname ||
          clientPayload !== parsed.payload.clientPayload ||
          multipart ||
          !currentIntent ||
          currentIntent.id !== intent.id
        ) {
          throw new MediaValidationError('The upload request is invalid.');
        }
        return {
          allowedContentTypes: ['image/png', 'image/jpeg', 'image/webp'],
          maximumSizeInBytes: MAX_MEDIA_UPLOAD_BYTES,
          validUntil: Date.now() + 5 * 60 * 1000,
          addRandomSuffix: false,
          allowOverwrite: false,
          cacheControlMaxAge: 60,
          tokenPayload: JSON.stringify({ id: intent.id }),
        };
      },
    });
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return mediaErrorResponse(error, 'upload-token');
  }
}
