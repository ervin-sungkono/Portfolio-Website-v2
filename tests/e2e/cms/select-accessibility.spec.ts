import { expect, test } from '@playwright/test';
import { cmsCookieName, cmsPatUserId, cmsSessionCookie } from '../../support/cms-fixture';

test('custom selects work with a keyboard inside an image dialog', async ({ page, context }) => {
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
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Images', exact: true }).click();
  await page.getByRole('button', { name: 'Add images' }).click();
  const dialog = page.getByRole('dialog', { name: 'Stage images in browser draft' });
  const select = dialog.getByRole('combobox', { name: 'Image destination' });
  await select.focus();
  await select.press('Enter');
  await expect(dialog.getByRole('listbox', { name: 'Image destination' })).toBeVisible();
  await select.press('ArrowDown');
  await select.press('Enter');
  await expect(select).toContainText('Technology icon');
  await select.press('Enter');
  await select.press('Escape');
  await expect(select).toHaveAttribute('aria-expanded', 'false');
  await expect(select).toContainText('Technology icon');
  await expect(dialog).toBeVisible();
});
