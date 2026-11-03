import 'server-only';

import { CmsError } from './cms/errors.ts';

const apiOrigin = 'https://api.dribbble.com';
const shotsPath = '/v2/user/shots';
const maxPages = 25;
const maxResponseBytes = 4_194_304;

export type DribbbleShot = {
  id: string;
  title: string;
  url: string;
  image: string;
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function shotId(value: unknown): string | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) {
    return String(value);
  }
  if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) {
    const number = Number(value);
    return Number.isSafeInteger(number) ? String(number) : null;
  }
  return null;
}

function httpsUrl(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

function normalizeShot(value: unknown): DribbbleShot | null {
  if (!record(value) || !record(value.images)) {
    return null;
  }
  const id = shotId(value.id);
  const title = typeof value.title === 'string' ? value.title.trim().slice(0, 200) : '';
  const url = httpsUrl(value.html_url);
  const image = httpsUrl(value.images.hidpi) ?? httpsUrl(value.images.normal);
  if (!id || !title || !url || !image) {
    return null;
  }
  const parsedUrl = new URL(url);
  if (!['dribbble.com', 'www.dribbble.com'].includes(parsedUrl.hostname)) {
    return null;
  }
  return { id, title, url, image };
}

function nextLink(header: string | null, current: URL): URL | null {
  if (!header) {
    return null;
  }

  const links = header.matchAll(/<([^>]+)>\s*((?:;[^,]*)*)/g);
  for (const [, target, parameters] of links) {
    const rel = /;\s*rel\s*=\s*(?:"([^"]+)"|([^\s;,]+))/i.exec(parameters);
    if (!rel || !(rel[1] ?? rel[2]).split(/\s+/).includes('next')) {
      continue;
    }

    let url: URL;
    try {
      url = new URL(target, current);
    } catch {
      throw new CmsError('unavailable', 'Dribbble returned an invalid pagination link.', 502);
    }
    if (
      url.origin !== apiOrigin ||
      url.pathname !== shotsPath ||
      url.username ||
      url.password ||
      url.hash ||
      url.searchParams.has('access_token')
    ) {
      throw new CmsError('unavailable', 'Dribbble returned an unsafe pagination link.', 502);
    }
    return url;
  }
  return null;
}

async function readShotsPage(
  url: URL,
  token: string,
): Promise<{ shots: unknown[]; link: string | null }> {
  let response: Response;
  try {
    response = await fetch(url, {
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    throw new CmsError('unavailable', 'Could not reach Dribbble. Try again later.', 503);
  }

  if (response.status === 429) {
    throw new CmsError(
      'rate_limited',
      'Dribbble is rate-limiting requests. Wait, then retry.',
      429,
    );
  }
  if (response.status === 401 || response.status === 403) {
    throw new CmsError(
      'configuration',
      'Dribbble rejected DRIBBBLE_TOKEN. Check the server token and its account access.',
      503,
    );
  }
  if (!response.ok) {
    throw new CmsError(
      'unavailable',
      'Dribbble could not return your shots. Try again later.',
      503,
    );
  }

  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maxResponseBytes) {
    await response.body?.cancel();
    throw new CmsError('unavailable', 'Dribbble returned an oversized shot list.', 502);
  }

  let source: string;
  try {
    source = await response.text();
  } catch {
    throw new CmsError('unavailable', 'Dribbble returned an unreadable shot list.', 502);
  }
  if (Buffer.byteLength(source, 'utf8') > maxResponseBytes) {
    throw new CmsError('unavailable', 'Dribbble returned an oversized shot list.', 502);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(source) as unknown;
  } catch {
    throw new CmsError('unavailable', 'Dribbble returned invalid shot data.', 502);
  }
  if (!Array.isArray(parsed)) {
    throw new CmsError('unavailable', 'Dribbble returned an invalid shot list.', 502);
  }
  return { shots: parsed, link: response.headers.get('link') };
}

export async function getDribbbleShots(): Promise<DribbbleShot[]> {
  const token = process.env.DRIBBBLE_TOKEN?.trim();
  if (!token) {
    throw new CmsError(
      'configuration',
      'Set DRIBBBLE_TOKEN on the server to load Dribbble shots.',
      503,
    );
  }

  const shots: DribbbleShot[] = [];
  const ids = new Set<string>();
  const visited = new Set<string>();
  let current: URL | null = new URL(`${apiOrigin}${shotsPath}?per_page=100`);

  while (current) {
    const url = current;
    if (visited.has(url.href)) {
      throw new CmsError('unavailable', 'Dribbble returned a repeated pagination link.', 502);
    }
    if (visited.size >= maxPages) {
      throw new CmsError(
        'unavailable',
        `Your Dribbble shot list exceeds the ${maxPages}-page safety limit.`,
        503,
      );
    }
    visited.add(url.href);

    const page = await readShotsPage(url, token);
    for (const item of page.shots) {
      const shot = normalizeShot(item);
      if (shot && !ids.has(shot.id)) {
        ids.add(shot.id);
        shots.push(shot);
      }
    }
    current = nextLink(page.link, url);
  }

  return shots;
}

export async function getDribbbleDesigns(ids: readonly string[]): Promise<DribbbleShot[]> {
  const selectedIds = [...new Set(ids.filter((id) => /^[1-9]\d*$/.test(id)))];
  if (!selectedIds.length) {
    return [];
  }
  const shots = await getDribbbleShots();
  const byId = new Map(shots.map((shot) => [shot.id, shot]));
  return selectedIds.flatMap((id) => {
    const shot = byId.get(id);
    return shot ? [shot] : [];
  });
}
