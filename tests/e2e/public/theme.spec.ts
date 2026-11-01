import { expect, test } from '@playwright/test';

test('theme control keeps its destination label and selection across navigation', async ({
  page,
}) => {
  await page.goto('/');
  const toggle = page.getByRole('button', { name: /Switch to (light|dark) theme/ });
  await expect(toggle).toBeVisible();
  const initialTheme = await page.locator('html').getAttribute('data-theme');
  await toggle.click();
  const selectedTheme = initialTheme === 'dark' ? 'light' : 'dark';
  await expect(page.locator('html')).toHaveAttribute('data-theme', selectedTheme);
  await expect(toggle).toHaveAttribute('aria-label', `Switch to ${initialTheme} theme`);
  expect(await page.evaluate(() => localStorage.getItem('portfolio-theme'))).toBe(selectedTheme);

  await page.getByRole('link', { name: 'About', exact: true }).first().click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', selectedTheme);
  await expect(page.getByRole('button', { name: `Switch to ${initialTheme} theme` })).toBeVisible();
});
