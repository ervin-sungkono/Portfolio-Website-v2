import { afterEach, describe, expect, it, vi } from 'vitest';
import { CmsError } from '../../src/lib/cms/errors';
import { getDribbbleDesigns, getDribbbleShots } from '../../src/lib/dribbble';

function shot(
  id: number,
  options: { title?: string; hidpi?: string | null; normal?: string } = {},
) {
  return {
    id,
    title: options.title ?? `Shot ${id}`,
    html_url: `https://dribbble.com/shots/${id}-shot-${id}`,
    images: {
      hidpi:
        options.hidpi === undefined
          ? `https://cdn.dribbble.com/images/${id}@2x.png`
          : options.hidpi,
      normal: options.normal ?? `https://cdn.dribbble.com/images/${id}.png`,
    },
    description: '<p>This unneeded provider field is not retained.</p>',
  };
}

function jsonResponse(value: unknown, link?: string, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...(link ? { Link: link } : {}),
    },
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Dribbble shot reader', () => {
  it('follows only Dribbble Link pagination and normalizes the useful shot fields', async () => {
    vi.stubEnv('DRIBBBLE_TOKEN', 'test-dribbble-token');
    const secondPage = 'https://api.dribbble.com/v2/user/shots?page=2&per_page=100';
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse(
          [shot(2, { hidpi: null }), shot(1, { title: '  First shot  ' })],
          `<${secondPage}>; rel="next"`,
        ),
      )
      .mockResolvedValueOnce(jsonResponse([shot(3)], `<${secondPage}>; rel="prev"`));
    vi.stubGlobal('fetch', fetchMock);

    const shots = await getDribbbleShots();

    expect(shots).toEqual([
      {
        id: '2',
        title: 'Shot 2',
        url: 'https://dribbble.com/shots/2-shot-2',
        image: 'https://cdn.dribbble.com/images/2.png',
      },
      {
        id: '1',
        title: 'First shot',
        url: 'https://dribbble.com/shots/1-shot-1',
        image: 'https://cdn.dribbble.com/images/1@2x.png',
      },
      {
        id: '3',
        title: 'Shot 3',
        url: 'https://dribbble.com/shots/3-shot-3',
        image: 'https://cdn.dribbble.com/images/3@2x.png',
      },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const call of fetchMock.mock.calls) {
      const [url, init] = call;
      expect(String(url)).toContain('https://api.dribbble.com/v2/user/shots');
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer test-dribbble-token');
      expect(init?.cache).toBe('no-store');
      expect(init?.redirect).toBe('error');
    }
    expect(JSON.stringify(shots)).not.toContain('description');
  });

  it('returns selected shots in portfolio order and omits unavailable IDs', async () => {
    vi.stubEnv('DRIBBBLE_TOKEN', 'test-dribbble-token');
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse([shot(8), shot(5)]));
    vi.stubGlobal('fetch', fetchMock);

    const designs = await getDribbbleDesigns(['5', '404', '8']);

    expect(designs.map(({ id }) => id)).toEqual(['5', '8']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns an empty selection without contacting Dribbble', async () => {
    vi.stubEnv('DRIBBBLE_TOKEN', '');
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);

    await expect(getDribbbleDesigns([])).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed on a pagination link outside the API host', async () => {
    vi.stubEnv('DRIBBBLE_TOKEN', 'test-dribbble-token');
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse([shot(1)], '<https://attacker.example/collect>; rel="next"'),
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(getDribbbleShots()).rejects.toMatchObject({
      code: 'unavailable',
      message: 'Dribbble returned an unsafe pagination link.',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports a missing server token without making a request', async () => {
    vi.stubEnv('DRIBBBLE_TOKEN', '');
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);

    await expect(getDribbbleShots()).rejects.toMatchObject({
      code: 'configuration',
      status: 503,
    } satisfies Partial<CmsError>);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces rate limiting as a retryable provider error', async () => {
    vi.stubEnv('DRIBBBLE_TOKEN', 'test-dribbble-token');
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse({}, undefined, 429));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getDribbbleShots()).rejects.toMatchObject({
      code: 'rate_limited',
      status: 429,
    });
  });
});
