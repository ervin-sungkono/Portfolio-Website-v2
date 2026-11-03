import { expect, test, type Page } from '@playwright/test';
import { CmsEditorPage } from '../../support/cms-editor-page';
import {
  cmsBaseUrl,
  cmsCookieName,
  cmsPatUserId,
  cmsSessionCookie,
} from '../../support/cms-fixture';

async function submitAllChanges(page: Page) {
  await page.getByRole('button', { name: 'Submit all changes', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Submit all changes?' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Submit changes', exact: true }).click();
}

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
  let finalizations = 0;
  let mediaWrites = 0;
  let retries = 0;
  const operations: string[] = [];
  await context.route('**/api/cms/media', async (route) => {
    if (route.request().method() === 'POST') {
      mediaWrites += 1;
    }
    await route.continue();
  });
  await context.route('**/api/cms', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    const operation = route.request().postDataJSON();
    operations.push(operation.kind);
    const response = await route.fetch();
    if (operation.kind === 'finalize' && response.ok()) {
      finalizations += 1;
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
  const repositoryPicker = page
    .getByRole('region', { name: 'Choose a repository' })
    .getByLabel('Accessible GitHub repositories');
  await expect(repositoryPicker).toBeEnabled();
  await repositoryPicker.selectOption('310002');
  await expect(page.getByText('Private repository metadata will be public.')).toBeVisible();
  const privateAcknowledgement = page.getByLabel(/I reviewed this warning/);
  await expect(privateAcknowledgement).not.toBeChecked();
  await expect(page.getByLabel('Title', { exact: true })).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Add project to draft', exact: true }),
  ).toBeDisabled();
  expect(finalizations).toBe(0);
  expect(mediaWrites).toBe(0);
  expect(operations).toEqual([]);
  await privateAcknowledgement.check();
  await expect(page.getByLabel('Title', { exact: true })).toBeEnabled();
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

  await page.getByRole('button', { name: 'Save project draft', exact: true }).click();
  await expect(page.getByText(/Return to the portfolio editor and submit the draft/)).toBeVisible();
  expect(finalizations).toBe(0);
  expect(mediaWrites).toBe(0);
  expect(operations).toEqual([]);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Content editor' })).toBeVisible();
  expect(finalizations).toBe(0);
  expect(mediaWrites).toBe(0);
  expect(operations).toEqual([]);
  await submitAllChanges(page);
  await expect(page.getByText(/Public refresh is pending/)).toBeVisible();
  expect(finalizations).toBe(1);
  expect(mediaWrites).toBe(0);
  expect(operations).toEqual(['finalize']);
  await page.getByRole('button', { name: 'Retry public refresh' }).click();
  await expect(
    page.getByRole('status').getByText('Public content refresh requested.', { exact: true }),
  ).toBeVisible();
  expect(finalizations).toBe(1);
  expect(mediaWrites).toBe(0);
  expect(retries).toBe(1);
  expect(operations).toEqual(['finalize', 'revalidate']);

  const snapshot = await (await context.request.get(new URL('/api/cms', cmsBaseUrl).href)).json();
  expect(
    snapshot.projects.find((entry: { slug: string }) => entry.slug === 'fixture-project').data
      .githubRepositoryId,
  ).toBe(310002);
  await context.close();
});
