import { describe, expect, test, vi } from 'vitest';

vi.mock('@/lib/cms/public', () => ({ getPublicContent: vi.fn() }));
vi.mock('next/cache', () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock('@/lib/dribbble', () => ({ getDribbbleDesigns: vi.fn() }));

import { getPublicContent } from '@/lib/cms/public';
import { getDribbbleDesigns } from '@/lib/dribbble';
import {
  filterProjects,
  getDesigns,
  relatedProjects,
  selectFeaturedProjects,
  type Project,
} from '@/lib/content';

function project(slug: string, overrides: Partial<Project> = {}): Project {
  return {
    id: slug,
    slug,
    name: slug,
    description: 'A project description',
    image: 'https://example.com/image.png',
    topics: [],
    category: 'Web',
    source: null,
    demo: null,
    ...overrides,
  };
}

describe('project selection', () => {
  test('honors explicit CMS featured flags and permits an empty result', () => {
    const projects = [project('one', { featured: false }), project('two', { featured: true })];
    expect(selectFeaturedProjects(projects)).toEqual([projects[1]]);
    expect(selectFeaturedProjects([projects[0]])).toEqual([]);
    expect(selectFeaturedProjects([])).toEqual([]);
  });

  test('snapshot projects without flags use the first three', () => {
    const projects = ['one', 'two', 'three', 'four'].map((slug) => project(slug));
    expect(selectFeaturedProjects(projects).map(({ slug }) => slug)).toEqual([
      'one',
      'two',
      'three',
    ]);
  });

  test('filters by category and case-insensitive name, topic, and tag', () => {
    const projects = [
      project('first', {
        name: 'Dashboard',
        categories: ['Website'],
        topics: ['React'],
        tags: ['Analytics'],
      }),
      project('second', { name: 'Notes', categories: ['Mobile'], topics: ['Swift'] }),
    ];
    expect(filterProjects(projects, ' ANALYTICS ', 'Website')).toEqual([projects[0]]);
    expect(filterProjects(projects, 'react', 'Mobile')).toEqual([]);
    expect(filterProjects(projects, 'swift', '')).toEqual([projects[1]]);
  });

  test('related projects prioritize shared technologies over category', () => {
    const current = project('current', { topics: ['React'], category: 'Web' });
    const categoryMatch = project('category', { category: 'Web' });
    const technologyMatch = project('technology', { topics: ['React'], category: 'Mobile' });
    const unrelated = project('unrelated', { category: 'Desktop' });
    expect(
      relatedProjects([current, categoryMatch, technologyMatch, unrelated], current).map(
        ({ slug }) => slug,
      ),
    ).toEqual(['technology', 'category']);
  });
});

describe('public design selection', () => {
  test('loads selected shot details in the public content order', async () => {
    const portfolio = { designs: ['8', '5'] };
    const designs = [
      {
        id: '8',
        title: 'Eight',
        url: 'https://dribbble.com/shots/8',
        image: 'https://cdn.example/8.png',
      },
      {
        id: '5',
        title: 'Five',
        url: 'https://dribbble.com/shots/5',
        image: 'https://cdn.example/5.png',
      },
    ];
    vi.mocked(getPublicContent).mockResolvedValue({ portfolio } as unknown as Awaited<
      ReturnType<typeof getPublicContent>
    >);
    vi.mocked(getDribbbleDesigns).mockResolvedValue(designs);

    await expect(getDesigns()).resolves.toEqual(designs);
    expect(getDribbbleDesigns).toHaveBeenCalledWith(portfolio.designs);
  });

  test('does not cache an empty collection when Dribbble is unavailable', async () => {
    vi.mocked(getPublicContent).mockResolvedValue({
      portfolio: { designs: ['8'] },
    } as unknown as Awaited<ReturnType<typeof getPublicContent>>);
    vi.mocked(getDribbbleDesigns).mockRejectedValue(new Error('provider unavailable'));

    await expect(getDesigns()).rejects.toThrow('provider unavailable');
  });
});
