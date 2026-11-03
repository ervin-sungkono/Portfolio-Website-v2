import { expect, test } from '@playwright/test';

test.describe('project screenshots without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('keeps every project image visible in the server-rendered page', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 760 });
    await page.goto('/project/wetrack-app');

    const images = page.getByRole('img', { name: /WeTrack App/ });
    const imageCount = await images.count();
    expect(imageCount).toBeGreaterThan(0);
    for (let index = 0; index < imageCount; index += 1) {
      await expect(images.nth(index)).toBeVisible();
    }

    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
});

test.describe('project screenshot carousel', () => {
  test.use({ javaScriptEnabled: true });

  test('supports labeled buttons and keyboard navigation when a project has multiple images', async ({
    page,
  }) => {
    await page.goto('/project/wetrack-app');

    const images = page.getByRole('img', { name: /WeTrack App/ });
    const imageCount = await images.count();
    test.skip(imageCount < 2, 'The project needs at least one gallery image for carousel controls.');

    const gallery = page.getByRole('region', {
      name: 'WeTrack App project screenshots',
      exact: true,
    });
    await expect(gallery).toHaveAttribute('aria-roledescription', 'carousel');

    const previous = gallery.getByRole('button', { name: 'Previous screenshot for WeTrack App' });
    const next = gallery.getByRole('button', { name: 'Next screenshot for WeTrack App' });
    const status = gallery.getByRole('status');
    const viewport = gallery.locator('[tabindex="0"]');
    await expect(viewport).toHaveCSS('scroll-behavior', 'auto');
    await expect(previous).toBeDisabled();
    await expect(next).toBeEnabled();
    await expect(status).toHaveText(`Image 1 of ${imageCount}`);

    await next.focus();
    await page.keyboard.press('Enter');
    await expect(status).toHaveText(`Image 2 of ${imageCount}`);
    await expect(previous).toBeEnabled();

    await viewport.focus();
    await page.keyboard.press('End');
    await expect(status).toHaveText(`Image ${imageCount} of ${imageCount}`);
    await expect(next).toBeDisabled();

    await page.keyboard.press('Home');
    await expect(status).toHaveText(`Image 1 of ${imageCount}`);
    await expect(previous).toBeDisabled();

    await page.setViewportSize({ width: 320, height: 760 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.setViewportSize({ width: 1440, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
});
