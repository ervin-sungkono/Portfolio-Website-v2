import { expect, test } from '@playwright/test';

test.use({ javaScriptEnabled: false });

test('unknown project slugs return a useful server-rendered 404', async ({ page }) => {
  const response = await page.goto('/project/unknown-review');

  expect(response?.status()).toBe(404);
  expect(response?.headers()['x-robots-tag']).toContain('noindex');
  expect(response?.headers()['cache-control']).toContain('no-store');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'This Page Isn’t Here.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Explore Projects' })).toHaveAttribute(
    'href',
    '/project',
  );
});

test('the shared recovery page is noindexed when directly accessed', async ({ page }) => {
  const response = await page.goto('/not-found');

  expect(response?.status()).toBe(200);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.getByRole('heading', { name: 'This Page Isn’t Here.' })).toBeVisible();
});

test('unknown site routes use the same server-rendered 404', async ({ page }) => {
  const response = await page.goto('/unknown-review-page');

  expect(response?.status()).toBe(404);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.getByRole('heading', { name: 'This Page Isn’t Here.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to Home' })).toHaveAttribute('href', '/');
});

test('known project slugs render their server-rendered project page', async ({ page }) => {
  const response = await page.goto('/project/wetrack-app');

  expect(response?.status()).toBe(200);
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'WeTrack App', level: 1 })).toBeVisible();
});

test.describe('project recovery with JavaScript', () => {
  test.use({ javaScriptEnabled: true });

  test('hydrates the project 404 without a route mismatch', async ({ page }) => {
    const hydrationErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error' && /hydrat|server rendered html/i.test(message.text())) {
        hydrationErrors.push(message.text());
      }
    });
    page.on('pageerror', (error) => {
      if (/hydrat|server rendered html|react error #418/i.test(error.message)) {
        hydrationErrors.push(error.message);
      }
    });

    const response = await page.goto('/project/unknown-review');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'This Page Isn’t Here.' })).toBeVisible();
    await page.waitForTimeout(500);
    expect(hydrationErrors).toEqual([]);
  });
});
