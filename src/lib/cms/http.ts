import { CmsError } from './errors.ts';

export function requireSameOrigin(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    throw new CmsError('forbidden', 'Submit CMS changes from this site.', 403);
  }
}

export async function readCmsJson(request: Request, limit = 65_536): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
    throw new CmsError('validation', 'Send a JSON request.', 415);
  }
  const reader = request.body?.getReader();
  if (!reader) {
    throw new CmsError('validation', 'The request body is required.', 400);
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new CmsError('validation', 'This CMS request is too large.', 413);
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch (error) {
    if (error instanceof CmsError) {
      throw error;
    }
    throw new CmsError('validation', 'The request must contain valid JSON.', 400);
  } finally {
    reader.releaseLock();
  }
}

export function cmsResponse(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}

export function cmsErrorResponse(error: unknown) {
  if (error instanceof CmsError) {
    return cmsResponse({ error: error.message, code: error.code }, error.status);
  }
  return cmsResponse(
    { error: 'The CMS request could not be completed. Your unsaved draft is unchanged.' },
    500,
  );
}
