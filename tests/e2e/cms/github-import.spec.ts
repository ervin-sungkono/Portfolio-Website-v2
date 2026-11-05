import { expect, test, type Page } from '@playwright/test';
import { CmsEditorPage } from '../../support/cms-editor-page';
import {
  cmsBaseUrl,
  cmsCookieName,
  cmsPatUserId,
  cmsSessionCookie,
} from '../../support/cms-fixture';

async function submitAllChanges(page: Page) {
  await page.getByRole('button', { name: 'Submit draft', exact: true }).click();
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
  const editor = new CmsEditorPage(page);
  await page.goto('/admin/import');
  const repositoryPicker = page
    .getByRole('region', { name: 'Choose a repository' })
    .getByRole('combobox', { name: 'Accessible GitHub repositories' });
  await expect(repositoryPicker).toBeEnabled();
  await repositoryPicker.focus();
  await repositoryPicker.press('ArrowDown');
  await expect(page.getByRole('option', { name: /Public.*sample-app/ })).toBeVisible();
  await repositoryPicker.press('ArrowDown');
  await expect(page.getByRole('option', { name: /Private.*private-app/ })).toBeVisible();
  await repositoryPicker.press('Enter');
  await expect(page.getByText('Private repository metadata will be public.')).toBeVisible();
  const privateAcknowledgement = page.getByLabel(/I reviewed this warning/);
  await expect(privateAcknowledgement).not.toBeChecked();
  const reviewProject = page.getByRole('button', {
    name: 'Review project details',
    exact: true,
  });
  await expect(reviewProject).toBeDisabled();
  expect(finalizations).toBe(0);
  expect(mediaWrites).toBe(0);
  expect(operations).toEqual([]);
  await privateAcknowledgement.check();
  await editor.chooseProject('fixture-project');
  await expect(reviewProject).toBeEnabled();
  await reviewProject.click();
  let projectDialog = page.getByRole('dialog', { name: 'Edit project' });
  await expect(projectDialog).toBeVisible();
  await projectDialog.getByLabel('Title', { exact: true }).fill('Reviewed private project');
  await projectDialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(projectDialog.getByRole('status')).toContainText('Step 2 of 3: Organization');
  await projectDialog.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(projectDialog.getByLabel('Title', { exact: true })).toHaveValue(
    'Reviewed private project',
  );
  await page.keyboard.press('Escape');
  await expect(projectDialog).not.toBeVisible();
  await expect(reviewProject).toBeFocused();
  await page.getByRole('button', { name: 'Refresh repository metadata' }).click();
  await reviewProject.click();
  projectDialog = page.getByRole('dialog', { name: 'Edit project' });
  await expect(projectDialog.getByLabel('Title', { exact: true })).toHaveValue(
    'Reviewed private project',
  );
  await projectDialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await projectDialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await projectDialog.getByRole('button', { name: 'Save project draft', exact: true }).click();
  await expect(
    projectDialog.getByRole('status').filter({ hasText: 'Project saved to the browser draft.' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(projectDialog).not.toBeVisible();

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

  await expect(page.getByText(/Return to the portfolio editor and submit the draft/)).toBeVisible();
  expect(finalizations).toBe(0);
  expect(mediaWrites).toBe(0);
  expect(operations).toEqual([]);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Content editor' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry public refresh' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Refresh public content' })).toHaveCount(0);
  expect(finalizations).toBe(0);
  expect(mediaWrites).toBe(0);
  expect(operations).toEqual([]);
  await submitAllChanges(page);
  await expect(page.getByText(/Public refresh is pending/)).toBeVisible();
  expect(finalizations).toBe(1);
  expect(mediaWrites).toBe(0);
  expect(operations).toEqual(['finalize']);
  await page.getByRole('button', { name: 'Retry public refresh' }).click();
  await expect(page.getByRole('button', { name: 'Retry public refresh' })).toHaveCount(0);
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

test('project row actions stay closed when an unsaved project cannot persist during switching', async ({
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
  const page = await context.newPage();
  await page.addInitScript(() => {
    const guardedWindow = window as Window & { __failDraftWrites?: boolean };
    guardedWindow.__failDraftWrites = false;
    const originalPut = Cache.prototype.put;
    Cache.prototype.put = async function (requestInfo, response) {
      const requestUrl =
        typeof requestInfo === 'string' || requestInfo instanceof URL
          ? String(requestInfo)
          : requestInfo.url;
      if (
        guardedWindow.__failDraftWrites &&
        new URL(requestUrl, window.location.href).pathname === '/__portfolio-cms-draft__/state'
      ) {
        throw new DOMException('Storage is full.', 'QuotaExceededError');
      }
      return originalPut.call(this, requestInfo, response);
    };
  });

  const editor = new CmsEditorPage(page);
  await editor.open();
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  const projectTable = page.getByRole('table', { name: 'Current projects' });
  const existingProject = projectTable.getByRole('row', { name: /fixture-project/ });
  await expect(existingProject).toBeVisible();
  await page.evaluate(() => {
    (window as Window & { __failDraftWrites?: boolean }).__failDraftWrites = true;
  });

  const newProjectDialog = await editor.openProjectForm();
  await newProjectDialog.getByLabel('Project URL slug').fill('blocked-draft-project');
  await newProjectDialog.getByLabel('Title', { exact: true }).fill('Unsaved project draft');
  await page.keyboard.press('Escape');
  await expect(newProjectDialog).not.toBeVisible();
  await expect(
    page.getByRole('alert').filter({ hasText: 'The browser could not save this draft.' }),
  ).toBeVisible();

  await existingProject.getByRole('button', { name: /^Edit project / }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page
      .getByRole('alert')
      .filter({ hasText: 'The project draft could not be saved in this browser.' }),
  ).toBeVisible();
  await expect(page.getByLabel('Choose a project')).toHaveCount(0);
  await expect(page.getByText('Current URL: /project/blocked-draft-project')).toBeVisible();

  await existingProject.getByRole('button', { name: /^Delete project / }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Current URL: /project/blocked-draft-project')).toBeVisible();
  await context.close();
});
