import { expect, test } from '@playwright/test';

test('project cards have one destination and the floating search follows scroll direction', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/project');

  const card = page.locator('.project-card').first();
  await expect(card).toBeVisible();
  await expect(card.getByRole('link')).toHaveCount(1);
  await expect(card.getByRole('link')).toHaveAttribute('href', /^\/project\//);
  await expect(card.locator('.project-card-category')).toContainText(/\b\d{4}\b/);
  await expect(card.getByText('Read Walkthrough')).toHaveCount(0);

  const search = page.getByRole('searchbox', { name: 'Search projects and technologies' });
  const floating = search.locator('xpath=../..');
  await page.evaluate(() => window.scrollTo(0, 500));
  await expect(floating).toHaveAttribute('data-hidden', 'true');
  await search.focus();
  await expect(floating).toHaveCSS('opacity', '1');
  await search.blur();
  await page.evaluate(() => window.scrollBy(0, -100));
  await expect(floating).not.toHaveAttribute('data-hidden');
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('search and project links remain usable', async ({ page }) => {
    await page.goto('/project');
    await expect(page.getByRole('searchbox', { name: 'Search projects and technologies' })).toBeVisible();
    await expect(page.locator('.project-card').first().getByRole('link')).toHaveAttribute('href', /^\/project\//);
  });
});
