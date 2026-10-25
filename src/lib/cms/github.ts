import 'server-only';

import { getCmsConfig } from './config.ts';
import { CmsError } from './errors.ts';

const apiBase = 'https://api.github.com';
const apiVersion = '2022-11-28';

export type GitHubUser = { id: number; login: string };
export type GitHubRepository = {
  name: string;
  full_name: string;
  default_branch: string;
  private: boolean;
};
export type GitHubContent = {
  type: 'file' | 'dir' | 'symlink' | 'submodule';
  name: string;
  path: string;
  sha: string;
  size: number;
  content?: string;
  encoding?: string;
  download_url?: string | null;
};
export type GitHubDirectoryEntry = Omit<GitHubContent, 'content' | 'encoding'>;
export type GitHubWriteResult = {
  content: GitHubContent | null;
  commit: { sha: string; html_url: string };
};

export async function assertCmsOwner(token: string): Promise<GitHubUser> {
  if (!token) {
    throw new CmsError('unauthorized', 'Sign in with the configured GitHub owner account.', 401);
  }
  const config = getCmsConfig();
  const user = await githubJson<GitHubUser>('/user', { token });
  if (!user || user.id !== config.adminId) {
    throw new CmsError(
      'unauthorized',
      'Only the configured GitHub account can change CMS content.',
      403,
    );
  }
  return user;
}

function headers(token?: string): HeadersInit {
  return {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': apiVersion,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function parseError(response: Response): Promise<CmsError> {
  if (response.status === 401) {
    return new CmsError('unauthorized', 'GitHub rejected the CMS credentials. Sign in again.', 401);
  }
  if (response.status === 403 || response.status === 429) {
    const remaining = response.headers.get('x-ratelimit-remaining');
    const limited = response.status === 429 || remaining === '0';
    return new CmsError(
      limited ? 'rate_limited' : 'forbidden',
      limited
        ? 'GitHub is rate-limiting CMS requests. Wait a while, then retry.'
        : 'GitHub denied this CMS operation. Check that the account has repository access and the repo OAuth permission.',
      limited ? 429 : 403,
    );
  }
  if (response.status === 404) {
    return new CmsError('not_found', 'The configured GitHub resource was not found.', 404);
  }
  if (response.status === 409 || response.status === 422) {
    return new CmsError(
      'conflict',
      'GitHub rejected a concurrent or incompatible content change. Reload the CMS and retry.',
      409,
    );
  }
  if (response.status >= 500) {
    return new CmsError('unavailable', 'GitHub is temporarily unavailable. Try again later.', 503);
  }
  return new CmsError('github', 'GitHub could not complete this CMS request.', 502);
}

export async function githubJson<T>(
  path: string,
  options: {
    token?: string;
    method?: string;
    body?: unknown;
    allowNotFound?: boolean;
    next?: { revalidate: number; tags: string[] };
  } = {},
): Promise<T | null> {
  let response: Response;
  try {
    const requestInit: RequestInit & { next?: { revalidate: number; tags: string[] } } = {
      method: options.method ?? 'GET',
      headers: {
        ...headers(options.token),
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      ...(options.token ? { cache: 'no-store' as const } : {}),
      ...(options.next ? { next: options.next } : {}),
    };
    response = await fetch(`${apiBase}${path}`, requestInit);
  } catch {
    throw new CmsError(
      'unavailable',
      'Could not reach GitHub. Check the connection and retry.',
      503,
    );
  }

  if (options.allowNotFound && response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw await parseError(response);
  }
  if (response.status === 204) {
    return null;
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new CmsError('github', 'GitHub returned an unreadable CMS response.', 502);
  }
}

export async function githubBytes(url: string, maxBytes = 1_048_576): Promise<Uint8Array> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new CmsError('github', 'GitHub returned an invalid media URL.', 502);
  }
  if (parsedUrl.protocol !== 'https:' || parsedUrl.hostname !== 'raw.githubusercontent.com') {
    throw new CmsError('github', 'GitHub returned an unsupported media host.', 502);
  }

  let response: Response;
  try {
    response = await fetch(parsedUrl, {
      cache: 'no-store',
      headers: { Accept: 'application/octet-stream' },
    });
  } catch {
    throw new CmsError('unavailable', 'Could not load a referenced media file from GitHub.', 503);
  }
  if (!response.ok) {
    throw await parseError(response);
  }
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    await response.body?.cancel();
    throw new CmsError('validation', 'A referenced media file exceeds the size limit.', 400);
  }
  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > maxBytes) {
      throw new CmsError('validation', 'A referenced media file exceeds the size limit.', 400);
    }
    return bytes;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new CmsError('validation', 'A referenced media file exceeds the size limit.', 400);
    }
    chunks.push(value);
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

export function repoPath(owner: string, repository: string, suffix: string): string {
  const repo = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`;
  return `${repo}${suffix}`;
}

export function contentsPath(owner: string, repository: string, path = ''): string {
  const tail = path ? `/${path.split('/').map(encodeURIComponent).join('/')}` : '';
  return repoPath(owner, repository, `/contents${tail}`);
}
