import { expect, test, type BrowserContext } from '@playwright/test';
import { CmsEditorPage } from '../../support/cms-editor-page';
import {
  cmsBaseUrl as baseURL,
  cmsCookieName as cookieName,
  cmsPatUserId as ownerId,
  cmsSessionCookie,
} from '../../support/cms-fixture';

async function addOwnerCookie(context: BrowserContext) {
  await context.addCookies([
    {
      name: cookieName,
      value: await cmsSessionCookie(cookieName, ownerId),
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    },
  ]);
}

async function selectedDesignIds(context: BrowserContext) {
  const response = await context.request.get(new URL('/api/cms/dribbble/shots', baseURL).href);
  expect(response.status()).toBe(200);
  const body = await response.json();
  return body.selection.designs as string[];
}

test('owner shows and hides Dribbble shots, and the public design pages follow the saved IDs', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL });
  await addOwnerCookie(context);
  const page = await context.newPage();
  const editor = new CmsEditorPage(page);
  const publicPage = await context.newPage();

  await editor.open();
  await page.getByRole('button', { name: 'Designs', exact: true }).click();
  const panel = page.locator('#cms-editor-designs-panel');
  await expect(panel.getByRole('heading', { name: 'Design Selection' })).toBeVisible();
  await expect(panel.getByText('Fixture Design 1', { exact: true })).toBeVisible();

  const firstShot = panel
    .locator('.cms-editor-design-card')
    .filter({ hasText: 'Fixture Design 1' });
  const secondShot = panel
    .locator('.cms-editor-design-card')
    .filter({ hasText: 'Fixture Design 2' });
  await firstShot.getByLabel('Show on portfolio: Fixture Design 1').check();
  for (const number of [2, 3, 4]) {
    await panel.getByLabel(`Show on portfolio: Fixture Design ${number}`).uncheck();
  }
  await page.getByRole('button', { name: 'Save selection' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Design selection saved.' }),
  ).toBeVisible();
  await expect.poll(() => selectedDesignIds(context)).toEqual(['1']);

  await expect
    .poll(async () => await (await context.request.get(new URL('/design', baseURL).href)).text())
    .toContain('Fixture Design 1');
  await publicPage.goto('/design');
  await expect(publicPage.getByRole('heading', { name: 'Fixture Design 1' })).toBeVisible();
  await expect(publicPage.getByRole('heading', { name: 'Fixture Design 2' })).toHaveCount(0);

  await firstShot.getByLabel('Show on portfolio: Fixture Design 1').uncheck();
  await secondShot.getByLabel('Show on portfolio: Fixture Design 2').check();
  await page.getByRole('button', { name: 'Save selection' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Design selection saved.' }),
  ).toBeVisible();
  await expect.poll(() => selectedDesignIds(context)).toEqual(['2']);

  await expect
    .poll(async () => await (await context.request.get(new URL('/design', baseURL).href)).text())
    .toContain('Fixture Design 2');
  await publicPage.goto('/design');
  await expect(publicPage.getByRole('heading', { name: 'Fixture Design 2' })).toBeVisible();
  await expect(publicPage.getByRole('heading', { name: 'Fixture Design 1' })).toHaveCount(0);

  await publicPage.emulateMedia({ reducedMotion: 'reduce' });
  const artwork = publicPage.locator('main img').first();
  await expect(artwork).toBeVisible();
  await expect
    .poll(async () => artwork.evaluate((image) => getComputedStyle(image).transitionDuration))
    .toBe('0s');

  await expect
    .poll(async () =>
      (await (await context.request.get(baseURL)).text()).includes('Fixture Design 2'),
    )
    .toBe(true);
  await publicPage.goto('/');
  await expect(publicPage.getByRole('heading', { name: 'Fixture Design 2' })).toBeVisible();

  await secondShot.getByLabel('Show on portfolio: Fixture Design 2').uncheck();
  await page.getByRole('button', { name: 'Save selection' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Design selection saved.' }),
  ).toBeVisible();
  await expect.poll(() => selectedDesignIds(context)).toEqual([]);

  await context.close();
});

test('unavailable saved IDs can be hidden and the selector reflows with themes and enlarged text', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL });
  await addOwnerCookie(context);
  await context.route('**/api/cms/dribbble/shots', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.selection.designs = ['999999'];
    await route.fulfill({ response, body: JSON.stringify(body) });
  });
  const page = await context.newPage();
  const editor = new CmsEditorPage(page);
  await editor.open();
  await page.getByRole('button', { name: 'Designs', exact: true }).click();
  const panel = page.locator('#cms-editor-designs-panel');
  await expect(panel.getByText('Saved shot 999999')).toBeVisible();
  const unavailableCard = panel.locator('.cms-editor-design-card-unavailable');
  const showUnavailableShot = unavailableCard.getByLabel('Show on portfolio: saved shot 999999');
  await expect(showUnavailableShot).toBeChecked();

  const widths = [320, 390, 820, 1024, 1440];
  for (const theme of ['light', 'dark'] as const) {
    await editor.selectTheme(theme);
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      const layout = await panel.evaluate((element) => ({
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        panelWidth: element.scrollWidth,
        panelClientWidth: element.clientWidth,
      }));
      expect(layout.documentWidth, `${theme} ${width}px document`).toBeLessThanOrEqual(
        layout.viewportWidth,
      );
      expect(layout.panelWidth, `${theme} ${width}px panel`).toBeLessThanOrEqual(
        layout.panelClientWidth + 1,
      );
    }
  }

  for (const width of [320, 820]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    const layout = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      fontSize: getComputedStyle(document.documentElement).fontSize,
    }));
    expect(layout.fontSize).toBe('32px');
    expect(layout.documentWidth, `200% text at ${width}px`).toBeLessThanOrEqual(
      layout.viewportWidth,
    );
  }

  await page.evaluate(() => document.documentElement.style.removeProperty('font-size'));
  await showUnavailableShot.focus();
  await expect(showUnavailableShot).toBeFocused();
  await page.keyboard.press('Space');
  await expect(panel.getByText('Saved shot 999999')).toHaveCount(0);

  await context.close();
});
