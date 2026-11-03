import { expect, test } from '@playwright/test';
import {
  cmsBaseUrl,
  cmsCookieName,
  cmsPatUserId,
  cmsSessionCookie,
} from '../../support/cms-fixture';

test('CMS routes use the native cursor and public pages restore the desktop effect', async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: cmsBaseUrl,
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'no-preference',
  });
  await context.addCookies([
    {
      name: cmsCookieName,
      value: await cmsSessionCookie(cmsCookieName, cmsPatUserId),
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    },
  ]);
  const page = await context.newPage();
  await page.goto('/admin');
  await page.mouse.move(250, 250);
  await expect(page.locator('[data-desktop-cursor]')).toHaveCount(0);
  await expect(page.locator('html')).not.toHaveAttribute('data-custom-cursor', 'active');

  await page.goto('/admin/import');
  await page.mouse.move(280, 280);
  await expect(page.locator('[data-desktop-cursor]')).toHaveCount(0);
  await expect(page.locator('html')).not.toHaveAttribute('data-custom-cursor', 'active');

  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await expect(page.locator('[data-desktop-cursor]')).toBeAttached();
  await page.mouse.move(300, 300);
  await expect(page.locator('html')).toHaveAttribute('data-custom-cursor', 'active');
  await context.close();
});
