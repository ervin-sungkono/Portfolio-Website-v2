import { expect, test } from '@playwright/test';

test.use({ javaScriptEnabled: false });

test('the empty blog and sitemap are usable without CMS configuration or JavaScript', async ({
  page,
}) => {
  const response = await page.goto('/blog');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Writing', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'No posts yet' })).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://ervincs.com/blog',
  );
  const sitemap = await page.request.get('/sitemap.xml');
  expect(await sitemap.text()).toContain('<loc>https://ervincs.com/blog</loc>');
  expect(await sitemap.text()).not.toContain('/blog/fixture-');
});

test('unknown blog posts return complete 404 recovery without JavaScript', async ({ page }) => {
  const response = await page.goto('/blog/unknown-post');
  expect(response?.status()).toBe(404);
  expect(response?.headers()['cache-control']).toContain('no-store');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.getByRole('heading', { name: 'This Page Isn’t Here.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Read the Blog' })).toHaveAttribute('href', '/blog');
});
