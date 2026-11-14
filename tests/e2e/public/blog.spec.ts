import { expect, test } from '@playwright/test';

test.use({ javaScriptEnabled: false });

test('the blog archive renders without JavaScript and reflows at narrow widths', async ({
  page,
}) => {
  for (const width of [320, 820, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const response = await page.goto('/blog');
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'Writing', level: 1 })).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://ervincs.com/blog',
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
});

test('unknown articles return complete 404 recovery HTML without JavaScript', async ({ page }) => {
  for (const slug of ['unknown-blog-review', '__empty-blog-build__']) {
    const response = await page.goto(`/blog/${slug}`);
    expect(response?.status()).toBe(404);
    expect(response?.headers()['x-robots-tag']).toContain('noindex');
    expect(response?.headers()['cache-control']).toContain('no-store');
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Explore Articles', exact: true })).toHaveAttribute(
      'href',
      '/blog',
    );
  }
});

test.describe('article recovery with JavaScript', () => {
  test.use({ javaScriptEnabled: true });

  test('hydrates the article 404 without an active-navigation mismatch', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error' && /hydrat|server rendered html/i.test(message.text())) {
        errors.push(message.text());
      }
    });
    page.on('pageerror', (error) => {
      if (/hydrat|server rendered html|react error #418/i.test(error.message)) {
        errors.push(error.message);
      }
    });
    const response = await page.goto('/blog/unknown-blog-review');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('link', { name: 'Explore Articles' })).toBeVisible();
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
  });
});
