import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getBlogPosts: vi.fn(),
  findBlogPost: vi.fn(),
  getPortfolio: vi.fn(),
  pageMetadata: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('@/lib/content', () => mocks);
vi.mock('@/lib/metadata', () => ({ pageMetadata: mocks.pageMetadata }));
vi.mock('next/navigation', () => ({ notFound: mocks.notFound }));

import BlogArticlePage, { generateMetadata, generateStaticParams } from '@/app/blog/[slug]/page';

afterEach(() => vi.resetAllMocks());

describe('blog article static params', () => {
  it('returns a private not-found build parameter for an empty archive', async () => {
    mocks.getBlogPosts.mockResolvedValue([]);

    const params = await generateStaticParams();

    expect(params).toEqual([{ slug: '__empty-blog-build__' }]);
    await expect(
      BlogArticlePage({ params: Promise.resolve({ slug: params[0].slug }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('keeps published slugs as the only generated article parameters', async () => {
    mocks.getBlogPosts.mockResolvedValue([{ slug: 'first-article' }, { slug: 'second-article' }]);

    await expect(generateStaticParams()).resolves.toEqual([
      { slug: 'first-article' },
      { slug: 'second-article' },
    ]);
  });

  it('can resolve a slug added after an empty build', async () => {
    mocks.getBlogPosts.mockResolvedValue([]);
    await generateStaticParams();
    mocks.findBlogPost.mockResolvedValue({
      slug: 'first-article',
      title: 'First Article',
      summary: 'A short summary.',
      body: 'Article body.',
      publishedAt: '2026-11-14',
    });
    mocks.getPortfolio.mockResolvedValue({ profile: { name: 'Ervin Cahyadinata Sungkono' } });

    const page = await BlogArticlePage({
      params: Promise.resolve({ slug: 'first-article' }),
    });

    expect(page).toBeTruthy();
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it('awaits canonical article metadata and uses the portfolio author', async () => {
    mocks.findBlogPost.mockResolvedValue({
      slug: 'first-article',
      title: 'First Article',
      summary: 'A short summary.',
      body: 'Article body.',
      publishedAt: '2026-11-14',
    });
    mocks.getPortfolio.mockResolvedValue({ profile: { name: 'Ervin Cahyadinata Sungkono' } });
    mocks.pageMetadata.mockResolvedValue({
      alternates: { canonical: '/blog/first-article' },
      openGraph: { type: 'website', url: '/blog/first-article' },
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'first-article' }),
    });

    expect(mocks.pageMetadata).toHaveBeenCalledWith({
      title: 'First Article',
      description: 'A short summary.',
      path: '/blog/first-article',
    });
    expect(metadata.alternates?.canonical).toBe('/blog/first-article');
    expect(metadata.authors).toEqual([{ name: 'Ervin Cahyadinata Sungkono' }]);
    expect(metadata.openGraph).toMatchObject({
      type: 'article',
      url: '/blog/first-article',
      publishedTime: '2026-11-14',
      authors: ['Ervin Cahyadinata Sungkono'],
    });
  });
});
