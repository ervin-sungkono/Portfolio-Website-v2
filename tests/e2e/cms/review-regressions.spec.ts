import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { CmsEditorPage } from '../../support/cms-editor-page';
import {
  cmsBaseUrl,
  cmsCookieName,
  cmsPatUserId,
  cmsSessionCookie,
} from '../../support/cms-fixture';

async function ownerContext(context: BrowserContext) {
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
}

async function readDraft(page: Page) {
  return page.evaluate(async () => {
    const cache = await caches.open('portfolio-cms-draft-v1');
    const response = await cache.match('/__portfolio-cms-draft__/state');
    return response ? response.json() : null;
  });
}

test('the former engineering URL redirects to the home overview', async ({ page, request }) => {
  const response = await request.get(`${cmsBaseUrl}/engineering`, { maxRedirects: 0 });
  expect(response.status()).toBe(308);
  expect(response.headers().location).toContain('/#engineering');
  await page.goto('/engineering');
  await expect(page).toHaveURL(/\/#engineering$/);
  await expect(page.getByRole('heading', { name: 'Built with clear boundaries.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Explore the source' })).toHaveAttribute(
    'href',
    'https://github.com/fixture-owner/portfolio',
  );
});

test('reverting each form removes its staged change before a direct submission', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: cmsBaseUrl });
  await ownerContext(context);
  let submitted: Record<string, unknown> | undefined;
  await context.route('**/api/cms', async (route) => {
    if (route.request().method() === 'POST') {
      submitted = route.request().postDataJSON();
      await route.fulfill({ status: 400, json: { error: 'Fixture stopped before publishing.' } });
    } else {
      await route.continue();
    }
  });
  const page = await context.newPage();
  const editor = new CmsEditorPage(page);
  await editor.open();

  const project = await editor.openProjectForm('fixture-project');
  const title = project.getByLabel('Title', { exact: true });
  const originalTitle = await title.inputValue();
  await title.fill('Temporary project title');
  await expect
    .poll(
      async () =>
        (await readDraft(page))?.projects.upsert.find(
          (item: { slug: string }) => item.slug === 'fixture-project',
        )?.data.title,
    )
    .toBe('Temporary project title');
  await title.fill(originalTitle);
  await expect
    .poll(async () =>
      (await readDraft(page))?.projects.upsert.find(
        (item: { slug: string }) => item.slug === 'fixture-project',
      ),
    )
    .toBeUndefined();
  await page.keyboard.press('Escape');

  for (const [section, id] of [
    ['Categories', 'web'],
    ['Technologies', 'nextjs'],
  ] as const) {
    await page.getByRole('button', { name: section, exact: true }).click();
    await page.getByRole('button', { name: `Edit ${section.toLowerCase()}`, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: `Edit ${section.toLowerCase()}` });
    const label = dialog.locator(`input[name="${id}.label"]`);
    const original = await label.inputValue();
    await label.fill(`Temporary ${section}`);
    const key = section.toLowerCase();
    await expect
      .poll(async () => (await readDraft(page))?.[key]?.data[id]?.label)
      .toBe(`Temporary ${section}`);
    await label.fill(original);
    await expect.poll(async () => (await readDraft(page))?.[key]).toBeUndefined();
    await page.keyboard.press('Escape');
  }

  await page.getByRole('button', { name: 'Site Profile', exact: true }).click();
  const siteTitle = page.locator('#cms-editor-site-panel').getByLabel('Site title');
  const originalSite = await siteTitle.inputValue();
  await siteTitle.fill('Temporary site title');
  await expect
    .poll(async () => (await readDraft(page))?.site?.data.siteTitle)
    .toBe('Temporary site title');
  await siteTitle.fill(originalSite);
  await expect.poll(async () => (await readDraft(page))?.site).toBeUndefined();
  await siteTitle.fill('A different intended title');
  await expect
    .poll(async () => (await readDraft(page))?.site?.data.siteTitle)
    .toBe('A different intended title');
  await page.getByRole('button', { name: 'Submit draft', exact: true }).click();
  const review = page.getByRole('dialog');
  await expect(review.getByRole('heading', { name: 'Changes to publish' })).toBeVisible();
  await review.getByRole('button', { name: 'Submit changes' }).click();
  await expect.poll(() => submitted).toBeDefined();
  expect(submitted).toMatchObject({
    projects: { upsert: [], delete: [] },
    site: { data: { siteTitle: 'A different intended title' } },
  });
  expect(submitted).not.toHaveProperty('categories');
  expect(submitted).not.toHaveProperty('technologies');
  await context.close();
});

test('gallery paths accept Enter and expose an associated item error', async ({ browser }) => {
  const context = await browser.newContext({ baseURL: cmsBaseUrl });
  await ownerContext(context);
  const page = await context.newPage();
  const editor = new CmsEditorPage(page);
  await editor.open();
  const dialog = await editor.openProjectForm('fixture-project');
  await editor.advanceProjectWizardToSave(dialog);
  const gallery = dialog.getByLabel('Gallery image paths');
  const first = 'media/projects/fixture-project/first.png';
  const second = 'media/projects/fixture-project/second.png';
  await gallery.fill(first);
  await gallery.press('End');
  await gallery.press('Enter');
  await gallery.pressSequentially(second);
  await expect(gallery).toHaveValue(`${first}\n${second}`);
  await gallery.fill('invalid-path');
  await dialog.getByRole('button', { name: 'Save project draft', exact: true }).click();
  await expect(gallery).toHaveAttribute('aria-invalid', 'true');
  await expect(gallery).toHaveAttribute('aria-describedby', 'cms-project-gallery-error');
  await expect(dialog.locator('#cms-project-gallery-error')).toBeVisible();
  await context.close();
});

test('a saved project reverted to the repository value stays reverted after switching projects', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: cmsBaseUrl });
  await ownerContext(context);
  const page = await context.newPage();
  const editor = new CmsEditorPage(page);
  await editor.open();
  let dialog = await editor.openProjectForm('fixture-project');
  const title = dialog.getByLabel('Title', { exact: true });
  const original = await title.inputValue();
  await title.fill('A temporary saved title');
  await editor.advanceProjectWizardToSave(dialog);
  await dialog.getByRole('button', { name: 'Save project draft' }).click();
  await expect(dialog.getByText('Project saved to the browser draft.')).toBeVisible();
  await editor.returnProjectWizardToDetails(dialog);
  await title.fill(original);
  await expect
    .poll(async () =>
      (await readDraft(page))?.projects.upsert.find(
        (item: { slug: string }) => item.slug === 'fixture-project',
      ),
    )
    .toBeUndefined();
  await page.keyboard.press('Escape');
  dialog = await editor.openProjectForm();
  await page.keyboard.press('Escape');
  dialog = await editor.openProjectForm('fixture-project');
  await expect(dialog.getByLabel('Title', { exact: true })).toHaveValue(original);
  await context.close();
});

test('the importer keeps the selected repository while an undone edit returns to its visible value', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: cmsBaseUrl });
  await ownerContext(context);
  const page = await context.newPage();
  const editor = new CmsEditorPage(page);
  const snapshot = await (await context.request.get(`${cmsBaseUrl}/api/cms`)).json();
  const existingMapping = snapshot.projects.find(
    (entry: { slug: string }) => entry.slug === 'fixture-project',
  ).data.githubRepositoryId;
  await page.goto('/admin/import');
  const picker = page.getByRole('combobox', { name: 'Accessible GitHub repositories' });
  await expect(picker).toBeEnabled();
  await picker.click();
  await page.getByRole('option', { name: /Public.*sample-app/ }).click();
  await editor.chooseProject('fixture-project');
  if (existingMapping !== null && existingMapping !== 310001) {
    const confirm = page.getByRole('dialog', { name: 'Replace this project mapping?' });
    await confirm.getByRole('button', { name: 'Replace mapping' }).click();
  }
  await page.getByRole('button', { name: 'Review project details' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit project' });
  const title = dialog.getByLabel('Title', { exact: true });
  const original = await title.inputValue();
  await title.fill('Temporary imported title');
  const stagedProject = async () =>
    (await readDraft(page))?.projects.upsert.find(
      (item: { slug: string }) => item.slug === 'fixture-project',
    );
  await expect
    .poll(async () => (await stagedProject())?.data.title)
    .toBe('Temporary imported title');
  await title.fill(original);
  await expect.poll(async () => (await stagedProject())?.data.title).toBe(original);
  expect((await stagedProject())?.data.githubRepositoryId).toBe(310001);
  await context.close();
});

test('an empty draft can rebind after the repository branch changes in both entry points', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: cmsBaseUrl });
  await ownerContext(context);
  const page = await context.newPage();
  await new CmsEditorPage(page).open();
  async function seedOldEmptyDraft() {
    await page.evaluate(async () => {
      const cache = await caches.open('portfolio-cms-draft-v1');
      await cache.put(
        '/__portfolio-cms-draft__/state',
        new Response(
          JSON.stringify({
            repository: 'fixture-owner/portfolio-content-fixture@previous-branch',
            projects: { upsert: [], delete: [] },
            media: [],
          }),
        ),
      );
    });
  }
  await seedOldEmptyDraft();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Content editor' })).toBeVisible();
  await expect
    .poll(async () => (await readDraft(page))?.repository)
    .toBe('fixture-owner/portfolio-content-fixture@published');
  await seedOldEmptyDraft();
  await page.goto('/admin/import');
  await expect(page.getByLabel('Accessible GitHub repositories')).toBeEnabled();
  await expect
    .poll(async () => (await readDraft(page))?.repository)
    .toBe('fixture-owner/portfolio-content-fixture@published');
  await context.close();
});
