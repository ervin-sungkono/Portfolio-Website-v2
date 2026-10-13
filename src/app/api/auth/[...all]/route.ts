import { toNextJsHandler } from 'better-auth/next-js';
import { getAuth, getCmsSetupStatus } from '@/lib/cms/auth';
import { CmsSetupError } from '@/lib/cms/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_AUTH_BODY_BYTES = 16 * 1024;
const AUTH_PATH_PREFIX = '/api/auth';

function withNoStore(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'private, no-store, max-age=0');
  headers.set('Pragma', 'no-cache');
  headers.set('Expires', '0');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function jsonError(status: number, error: string, missing?: string[]): Response {
  return withNoStore(Response.json(missing ? { error, missing } : { error }, { status }));
}

async function boundedRequest(request: Request): Promise<Request | null> {
  if (!request.body) return request;

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > MAX_AUTH_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body,
    signal: request.signal,
  });
}

async function readBodyFields(request: Request): Promise<Record<string, unknown> | null> {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (contentType === 'application/json') {
    try {
      const value: unknown = await request.clone().json();
      return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  if (contentType === 'application/x-www-form-urlencoded') {
    const values = new URLSearchParams(await request.clone().text());
    return Object.fromEntries(values.entries());
  }
  return null;
}

async function restrictedEndpointResponse(request: Request): Promise<Response | null> {
  if (request.method !== 'POST') return null;

  const pathname = new URL(request.url).pathname;
  if (!pathname.startsWith(`${AUTH_PATH_PREFIX}/`)) return null;
  const authPath = pathname.slice(AUTH_PATH_PREFIX.length);

  if (authPath === '/two-factor/disable') {
    return jsonError(403, 'two_factor_required');
  }

  if (authPath === '/two-factor/enable') {
    const body = await readBodyFields(request);
    if (body && body.method !== undefined && body.method !== 'totp') {
      return jsonError(403, 'totp_only');
    }
  }

  if (authPath === '/two-factor/verify-totp' || authPath === '/two-factor/verify-backup-code') {
    const body = await readBodyFields(request);
    if (body?.trustDevice === true || body?.trustDevice === 'true') {
      return jsonError(400, 'trusted_devices_disabled');
    }
  }

  return null;
}

async function handleAuth(request: Request, method: 'GET' | 'POST'): Promise<Response> {
  const setup = await getCmsSetupStatus();
  if (!setup.ready) return jsonError(503, 'auth_not_configured', setup.missing);

  const bounded = await boundedRequest(request);
  if (!bounded) return jsonError(413, 'request_too_large');

  const restrictedResponse = await restrictedEndpointResponse(bounded);
  if (restrictedResponse) return restrictedResponse;

  try {
    const auth = getAuth();
    const handler = toNextJsHandler(auth)[method];
    const response = await handler(bounded);
    if (response.status >= 500) return jsonError(503, 'temporarily_unavailable');
    return withNoStore(response);
  } catch (error) {
    if (error instanceof CmsSetupError) {
      return jsonError(503, 'auth_not_configured', error.missing);
    }
    return jsonError(503, 'temporarily_unavailable');
  }
}

export function GET(request: Request) {
  return handleAuth(request, 'GET');
}

export function POST(request: Request) {
  return handleAuth(request, 'POST');
}
