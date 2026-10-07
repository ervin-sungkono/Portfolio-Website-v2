import { expect, test } from '@playwright/test';

test.use({ javaScriptEnabled: false });

test('unknown project slugs return a useful server-rendered 404', async ({ page }) => {
  const response = await page.goto('/project/unknown-review');

  expect(response?.status()).toBe(404);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'This Page Isn’t Here.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Explore Projects' })).toHaveAttribute(
    'href',
    '/project',
  );
});

test('known project slugs render their server-rendered project page', async ({ page }) => {
  const response = await page.goto('/project/wetrack-app');

  expect(response?.status()).toBe(200);
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'WeTrack App', level: 1 })).toBeVisible();
});
