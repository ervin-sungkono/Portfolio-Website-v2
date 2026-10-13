import {
  CmsConflictError,
  CmsForbiddenError,
  CmsInvariantError,
  CmsNotFoundError,
  CmsSetupError,
  CmsUnauthorizedError,
} from './errors';
import { MediaUploadNotReadyError } from './media';
import { MediaValidationError } from './media-validation';

export function hasExactOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    if (parsed.origin !== origin || parsed.origin !== new URL(request.url).origin) return false;
  } catch {
    return false;
  }
  const fetchSite = request.headers.get('sec-fetch-site');
  return fetchSite === null || fetchSite === 'same-origin';
}

export async function readBoundedJson(request: Request, maxBytes: number): Promise<unknown> {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
  if (contentType !== 'application/json') {
    throw new MediaValidationError('Send a JSON request.');
  }
  const declaredLength = request.headers.get('content-length');
  if (declaredLength && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > maxBytes)) {
    throw new MediaValidationError('The request is too large.');
  }
  if (!request.body) throw new MediaValidationError('Send a valid JSON request.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          // Preserve the request-size error.
        }
        throw new MediaValidationError('The request is too large.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(
      Buffer.concat(
        chunks.map((chunk) => Buffer.from(chunk)),
        size,
      ).toString('utf8'),
    );
  } catch (error) {
    if (error instanceof MediaValidationError) throw error;
    throw new MediaValidationError('Send a valid JSON request.');
  }
}

export function mediaErrorResponse(error: unknown, action: string): Response {
  if (error instanceof CmsSetupError) {
    return Response.json(
      { error: 'Media services are not configured.', missing: error.missing },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  if (error instanceof CmsUnauthorizedError) {
    return Response.json(
      { error: 'Authentication is required.' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  if (error instanceof CmsForbiddenError) {
    return Response.json(
      { error: 'This account cannot manage media.' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  if (error instanceof CmsNotFoundError) {
    return Response.json(
      { error: 'The image was not found.' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  if (error instanceof CmsConflictError || error instanceof MediaUploadNotReadyError) {
    return Response.json(
      { error: error.message },
      { status: 409, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  if (error instanceof MediaValidationError) {
    return Response.json(
      { error: error.message },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  if (error instanceof CmsInvariantError) {
    console.error('CMS media integrity check failed', { action });
    return Response.json(
      { error: 'Media could not be served safely.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  console.error('CMS media operation failed', { action });
  return Response.json(
    { error: 'Media services are temporarily unavailable.' },
    { status: 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
