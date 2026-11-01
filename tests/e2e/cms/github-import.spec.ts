import { expect, test } from '@playwright/test';
import { CmsEditorPage } from '../../support/cms-editor-page';
import {
  cmsBaseUrl,
  cmsCookieName,
  cmsPatUserId,
  cmsSessionCookie,
} from '../../support/cms-fixture';

test('owner reviews a private repository mapping and retries a pending refresh without another write', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: cmsBaseUrl });
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
  let writes = 0;
  let retries = 0;
  await context.route('**/api/cms', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    const operation = route.request().postDataJSON();
    const response = await route.fetch();
    if (operation.kind === 'project' && response.ok()) {
      writes += 1;
      const body = await response.json();
      await route.fulfill({ response, body: JSON.stringify({ ...body, cache: 'pending' }) });
    } else {
      if (operation.kind === 'revalidate') {
        retries += 1;
      }
      await route.fulfill({ response });
    }
  });

  const page = await context.newPage();
  await page.goto('/admin/import');
  const repositoryPicker = page.getByLabel('Accessible GitHub repositories');
  await expect(repositoryPicker).toBeEnabled();
  await repositoryPicker.selectOption('310002');
  await expect(page.getByText('Private repository metadata will be public.')).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByLabel('Choose a project').selectOption('fixture-project');
  await page.getByLabel('Title', { exact: true }).fill('Reviewed private project');
  await page.getByRole('button', { name: 'Refresh repository metadata' }).click();
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Reviewed private project');

  const editor = new CmsEditorPage(page);
  for (const theme of ['light', 'dark'] as const) {
    await editor.selectTheme(theme);
    for (const width of [320, 390, 820, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
    }
  }
  await page.setViewportSize({ width: 320, height: 900 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.evaluate(() => document.documentElement.style.removeProperty('font-size'));

  await page.getByRole('button', { name: 'Save project' }).click();
  const acknowledgement = page.getByLabel(/I reviewed this warning/);
  await expect(acknowledgement).toBeFocused();
  expect(writes).toBe(0);
  await page.keyboard.press('Space');
  await expect(acknowledgement).toBeChecked();
  await page.getByRole('button', { name: 'Save project' }).click();
  await expect(page.getByText(/Public refresh is pending/)).toBeVisible();
  expect(writes).toBe(1);
  await page.getByRole('button', { name: 'Retry public refresh' }).click();
  await expect(page.getByText(/without rewriting the project/)).toBeVisible();
  expect(writes).toBe(1);
  expect(retries).toBe(1);

  const snapshot = await (await context.request.get(new URL('/api/cms', cmsBaseUrl).href)).json();
  expect(
    snapshot.projects.find((entry: { slug: string }) => entry.slug === 'fixture-project').data
      .githubRepositoryId,
  ).toBe(310002);
  await context.close();
});
