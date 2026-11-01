import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/cms/auth', () => ({ requireOwner: vi.fn() }));
vi.mock('@/lib/cms/repository', () => ({ readPortfolio: vi.fn() }));
vi.mock('@/lib/dribbble', () => ({ getDribbbleShots: vi.fn() }));

import { GET } from '../../src/app/api/cms/dribbble/shots/route';
import { requireOwner } from '../../src/lib/cms/auth';
import { readPortfolio } from '../../src/lib/cms/repository';
import { getDribbbleShots } from '../../src/lib/dribbble';
import { CmsError } from '../../src/lib/cms/errors';

const sha = 'a'.repeat(40);

afterEach(() => {
  vi.resetAllMocks();
});

describe('CMS Dribbble shots endpoint', () => {
  it('requires the owner and returns only normalized shots plus selection IDs and SHA', async () => {
    vi.mocked(requireOwner).mockResolvedValue('github-session-token');
    vi.mocked(readPortfolio).mockResolvedValue({
      repository: { owner: 'owner', name: 'portfolio-content', defaultBranch: 'master' },
      data: { designs: ['17'] } as never,
      sha,
    });
    vi.mocked(getDribbbleShots).mockResolvedValue([
      {
        id: '17',
        title: 'Shot seventeen',
        url: 'https://dribbble.com/shots/17-shot-seventeen',
        image: 'https://cdn.dribbble.com/images/17.png',
      },
    ]);

    const response = await GET(new Request('https://portfolio.example/api/cms/dribbble/shots'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(body).toEqual({
      shots: [
        {
          id: '17',
          title: 'Shot seventeen',
          url: 'https://dribbble.com/shots/17-shot-seventeen',
          image: 'https://cdn.dribbble.com/images/17.png',
        },
      ],
      selection: { designs: ['17'], sha },
    });
    expect(JSON.stringify(body)).not.toContain('github-session-token');
    expect(readPortfolio).toHaveBeenCalledWith('github-session-token');
  });

  it('returns the owner authorization error without calling Dribbble', async () => {
    vi.mocked(requireOwner).mockRejectedValue(
      new CmsError('unauthorized', 'Sign in with GitHub to continue.', 401),
    );

    const response = await GET(new Request('https://portfolio.example/api/cms/dribbble/shots'));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Sign in with GitHub to continue.');
    expect(getDribbbleShots).not.toHaveBeenCalled();
    expect(readPortfolio).not.toHaveBeenCalled();
  });
});
