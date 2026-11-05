import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { CmsEditorPage } from '../../support/cms-editor-page';
import {
  cmsBaseUrl,
  cmsCookieName,
  cmsPatUserId,
  cmsSessionCookie,
  fixturePng,
} from '../../support/cms-fixture';

async function addOwnerCookie(context: BrowserContext) {
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

async function expectProjectStep(dialog: Locator, step: number, name: string) {
  await expectWizardStatus(dialog, `Step ${step} of 3: ${name}`);
}

async function expectWizardStatus(dialog: Locator, text: string) {
  await expect(dialog.getByRole('status').filter({ hasText: /^Step \d+ of \d+:/ })).toHaveText(
    text,
  );
}

async function readBrowserDraft(page: Page) {
  return page.evaluate(async () => {
    const cache = await caches.open('portfolio-cms-draft-v1');
    const response = await cache.match('/__portfolio-cms-draft__/state');
    return response ? response.json() : null;
  });
}

test('project and taxonomy tables scroll within the dashboard on desktop', async ({ browser }) => {
  const context = await browser.newContext({
    baseURL: cmsBaseUrl,
    viewport: { width: 1280, height: 900 },
  });
  await addOwnerCookie(context);
  const page = await context.newPage();
  const editor = new CmsEditorPage(page);
  await editor.open();

  for (const section of [
    { id: 'projects', label: 'Projects', wrapper: '.cms-editor-project-overview-table-wrap' },
    { id: 'categories', label: 'Categories', wrapper: '.cms-editor-overview-table-wrap' },
    { id: 'technologies', label: 'Technologies', wrapper: '.cms-editor-overview-table-wrap' },
  ]) {
    await page.getByRole('button', { name: section.label, exact: true }).click();
    const panel = page.locator(`#cms-editor-${section.id}-panel`);
    const wrapper = panel.locator(section.wrapper);
    const scrollsIndependently = await wrapper.evaluate((element) => {
      const table = element.querySelector('table');
      const body = table?.tBodies[0];
      const originalRows = body ? Array.from(body.children) : [];
      const headerCell = table?.tHead?.querySelector('th');
      if (!body || !originalRows.length || !headerCell) {
        return false;
      }

      for (let index = 0; index < 12; index += 1) {
        body.append(originalRows[index % originalRows.length].cloneNode(true));
      }
      element.scrollTop = element.scrollHeight;
      const canScroll =
        getComputedStyle(element).overflowY === 'auto' &&
        getComputedStyle(headerCell).position === 'sticky' &&
        element.scrollHeight > element.clientHeight &&
        element.scrollTop > 0;
      body.replaceChildren(...originalRows);
      element.scrollTop = 0;
      return canScroll;
    });

    expect(scrollsIndependently, `${section.label} table should have its own scroll area`).toBe(
      true,
    );
    await expect(panel.locator('.cms-editor-panel-heading')).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Submit draft', exact: true })).toBeInViewport();
    const normalHeight = await wrapper.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).maxBlockSize),
    );
    await page.setViewportSize({ width: 1280, height: 1200 });
    const tallHeight = await wrapper.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).maxBlockSize),
    );
    expect(tallHeight).toBeGreaterThan(normalHeight);
    await page.setViewportSize({ width: 1280, height: 900 });
  }

  await context.close();
});

test('site profile body scrolls inside the desktop dashboard and flows naturally on short screens', async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: cmsBaseUrl,
    viewport: { width: 1280, height: 900 },
  });
  await addOwnerCookie(context);
  const page = await context.newPage();
  const editor = new CmsEditorPage(page);
  await editor.open();
  await page.getByRole('button', { name: 'Site Profile', exact: true }).click();

  const panel = page.locator('#cms-editor-site-panel');
  const stepBody = panel.locator('.cms-site-profile-inline-step');
  const desktopBodyScrolls = await stepBody.evaluate((element) => {
    const originalChildren = Array.from(element.children);
    if (!originalChildren.length) {
      return false;
    }
    for (let index = 0; index < 12; index += 1) {
      element.append(originalChildren[0].cloneNode(true));
    }
    element.scrollTop = element.scrollHeight;
    return (
      getComputedStyle(element).overflowY === 'auto' &&
      element.scrollHeight > element.clientHeight &&
      element.scrollTop > 0
    );
  });

  expect(desktopBodyScrolls).toBe(true);
  await expect(panel.locator('nav[aria-label="Edit site profile progress"]')).toBeInViewport();
  await expect(panel.getByRole('button', { name: 'Continue', exact: true })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Submit draft', exact: true })).toBeInViewport();

  for (const viewport of [
    { width: 390, height: 640 },
    { width: 1280, height: 640 },
  ]) {
    await page.setViewportSize(viewport);
    const naturalFlow = await stepBody.evaluate((element) => ({
      overflowY: getComputedStyle(element).overflowY,
      documentHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
    }));
    expect(naturalFlow.overflowY).toBe('visible');
    expect(naturalFlow.documentHeight).toBeGreaterThan(naturalFlow.viewportHeight);
  }

  await context.close();
});

test('project editing uses a modal wizard with accessible focus, step validation, and a browser-only draft', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: cmsBaseUrl });
  await addOwnerCookie(context);
  const postedKinds: string[] = [];
  await context.route('**/api/cms', async (route) => {
    if (route.request().method() === 'POST') {
      postedKinds.push(route.request().postDataJSON().kind);
    }
    await route.continue();
  });

  const page = await context.newPage();
  const editor = new CmsEditorPage(page);
  await editor.open();
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  const projectTable = page.getByRole('table', { name: 'Current projects' });
  await expect(projectTable.getByRole('row', { name: /Fixture Portfolio Project/ })).toBeVisible();
  const addProject = page.getByRole('button', { name: 'Add project', exact: true });
  await addProject.click();
  let dialog = page.getByRole('dialog', { name: 'Add project' });
  await expect(dialog).toBeVisible();
  expect(
    await dialog.evaluate(
      (element) =>
        element instanceof HTMLDialogElement && element.open && element.matches(':modal'),
    ),
  ).toBe(true);
  await expect
    .poll(() => dialog.evaluate((element) => element.contains(document.activeElement)))
    .toBe(true);
  await expectProjectStep(dialog, 1, 'Details');

  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(addProject).toBeFocused();

  await addProject.click();
  dialog = page.getByRole('dialog', { name: 'Add project' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Project URL slug').fill('wizard-draft-project');
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await expectProjectStep(dialog, 1, 'Details');
  const titleField = dialog.getByRole('textbox', { name: /^Title\b/ });
  await expect(titleField).toHaveAccessibleName(/^Title\b/);
  await expect(titleField).toBeFocused();
  await expect(dialog.locator('#cms-project-title-error')).toBeVisible();

  await titleField.fill('Wizard Draft Project');
  await dialog
    .getByRole('textbox', { name: /^Summary\b/ })
    .fill('A project drafted through the wizard.');
  await dialog
    .getByRole('textbox', { name: /^Description\b/ })
    .fill('The project form keeps values while moving between overlay steps.');
  await dialog.getByLabel('Year', { exact: true }).fill('2026');
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await expectProjectStep(dialog, 2, 'Organization');
  await dialog.getByLabel('Add a category').click();
  await dialog.getByRole('option', { name: 'Website', exact: true }).click();
  await dialog.getByLabel('Add a technology').click();
  await dialog.getByRole('option', { name: 'Next.js', exact: true }).click();

  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await expectProjectStep(dialog, 3, 'Links and media');
  const coverPath = 'media/projects/wizard-draft-project/cover.png';
  await dialog.getByLabel('Cover image path').fill(coverPath);
  await dialog.getByRole('button', { name: 'Back', exact: true }).click();
  await expectProjectStep(dialog, 2, 'Organization');
  await expect(dialog.getByLabel('Add a category')).toContainText('Choose a category…');
  await expect(dialog.getByRole('list', { name: 'Selected categories' })).toContainText('Web');
  await dialog.getByRole('button', { name: 'Back', exact: true }).click();
  await expectProjectStep(dialog, 1, 'Details');
  await expect(dialog.getByLabel('Title', { exact: true })).toHaveValue('Wizard Draft Project');
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await expectProjectStep(dialog, 2, 'Organization');
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await expectProjectStep(dialog, 3, 'Links and media');
  await expect(dialog.getByLabel('Cover image path')).toHaveValue(coverPath);

  await dialog.getByRole('button', { name: 'Add project to draft', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Project saved to the browser draft.' }),
  ).toBeVisible();
  expect(postedKinds).toEqual([]);

  const draft = await readBrowserDraft(page);
  const saved = draft?.projects.upsert.find(
    (project: { slug: string }) => project.slug === 'wizard-draft-project',
  );
  expect(saved?.data.title).toBe('Wizard Draft Project');
  expect(saved?.data.media.cover).toBe(coverPath);

  await page.reload();
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await page.getByRole('button', { name: 'Edit project Wizard Draft Project' }).click();
  dialog = page.getByRole('dialog', { name: 'Edit project' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Title', { exact: true })).toHaveValue('Wizard Draft Project');
  await expect(dialog.getByLabel('Cover image path')).toHaveValue(coverPath);
  expect(postedKinds).toEqual([]);

  await context.close();
});

test('site profile wizard preserves values across steps and saves only to the browser draft', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: cmsBaseUrl });
  await addOwnerCookie(context);
  const postedKinds: string[] = [];
  await context.route('**/api/cms', async (route) => {
    if (route.request().method() === 'POST') {
      postedKinds.push(route.request().postDataJSON().kind);
    }
    await route.continue();
  });

  const page = await context.newPage();
  const editor = new CmsEditorPage(page);
  await editor.open();
  await page.getByRole('button', { name: 'Site Profile', exact: true }).click();

  const dialog = page.locator('.cms-site-profile-inline-wizard');
  await expect(dialog).toBeVisible();
  await expectWizardStatus(dialog, 'Step 1 of 3: Site details');
  await expect(page.getByRole('button', { name: 'Site Profile', exact: true })).toBeFocused();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await dialog.getByLabel('Site title').fill('');
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await expectWizardStatus(dialog, 'Step 1 of 3: Site details');
  await expect(dialog.getByLabel('Site title')).toBeFocused();
  await expect(dialog.locator('#cms-site-title-error')).toBeVisible();

  await dialog.getByLabel('Site title').fill('Wizard Portfolio');
  await dialog.getByLabel('Headline').fill('A headline retained through the wizard.');
  await dialog
    .getByLabel('Introduction')
    .fill('The site profile draft is saved locally until final submission.');
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await expectWizardStatus(dialog, 'Step 2 of 3: Social links');
  await dialog.getByRole('button', { name: 'Add social link', exact: true }).click();
  await dialog.getByLabel('Link label', { exact: true }).last().fill('Portfolio');
  await dialog.getByLabel('HTTPS URL', { exact: true }).last().fill('https://example.com/profile');
  await dialog.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(dialog.getByLabel('Site title')).toHaveValue('Wizard Portfolio');
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(dialog.getByLabel('Link label', { exact: true }).last()).toHaveValue('Portfolio');
  await expect(dialog.getByLabel('HTTPS URL', { exact: true }).last()).toHaveValue(
    'https://example.com/profile',
  );
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await expectWizardStatus(dialog, 'Step 3 of 3: Hero highlights');
  const fixtureHeroProject = dialog.getByRole('checkbox', {
    name: /Fixture Portfolio Project/,
  });
  await expect(fixtureHeroProject).toBeChecked();
  await expect(
    dialog.getByRole('button', { name: 'Move earlier: Fixture Portfolio Project' }),
  ).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'Move later: Fixture Portfolio Project' }),
  ).toBeVisible();
  await fixtureHeroProject.uncheck();
  await fixtureHeroProject.check();
  await dialog.getByRole('button', { name: 'Save site profile draft', exact: true }).click();
  await expect(
    dialog.getByRole('status').filter({ hasText: 'Site profile saved to the browser draft.' }),
  ).toBeVisible();
  expect(postedKinds).toEqual([]);

  const draft = await readBrowserDraft(page);
  expect(draft?.site.data.siteTitle).toBe('Wizard Portfolio');
  expect(draft?.site.data.socialLinks).toContainEqual({
    label: 'Portfolio',
    url: 'https://example.com/profile',
  });
  expect(draft?.site.data.heroProjectSlugs).toEqual(['fixture-project']);
  await context.close();
});

test('category and technology wizards retain edits and save new records to the browser draft', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: cmsBaseUrl });
  await addOwnerCookie(context);
  const postedKinds: string[] = [];
  await context.route('**/api/cms', async (route) => {
    if (route.request().method() === 'POST') {
      postedKinds.push(route.request().postDataJSON().kind);
    }
    await route.continue();
  });

  const page = await context.newPage();
  const editor = new CmsEditorPage(page);
  await editor.open();

  await page.getByRole('button', { name: 'Categories', exact: true }).click();
  const categoryTable = page.getByRole('table', { name: 'Current categories' });
  await expect(categoryTable.getByRole('row', { name: /web Website 10/ })).toBeVisible();
  const categoryTrigger = page.getByRole('button', { name: 'Edit categories', exact: true });
  await categoryTrigger.click();
  let dialog = page.getByRole('dialog', { name: 'Edit categories' });
  await expectWizardStatus(dialog, 'Step 1 of 2: Edit categories');
  await dialog.getByLabel('Choose a category').click();
  await dialog.getByRole('option', { name: 'Website', exact: true }).click();
  await dialog.locator('input[name="web.label"]').fill('Web work');
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await expectWizardStatus(dialog, 'Step 2 of 2: Add category');
  await dialog.getByLabel('New category ID').fill('wizard-category');
  await dialog.getByRole('button', { name: 'Save categories draft', exact: true }).click();
  await expect(dialog.getByLabel('New category ID')).toBeFocused();
  await expect(dialog.locator('#cms-new-category-error')).toBeVisible();
  expect(postedKinds).toEqual([]);
  await dialog.getByRole('button', { name: 'Add category', exact: true }).click();
  await expectWizardStatus(dialog, 'Step 1 of 2: Edit categories');
  await expect(dialog.locator('input[name="wizard-category.label"]')).toBeFocused();
  await dialog.locator('input[name="wizard-category.label"]').fill('Wizard category');
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await expectWizardStatus(dialog, 'Step 2 of 2: Add category');
  await expect(dialog.getByLabel('New category ID')).toHaveValue('');
  await dialog.getByRole('button', { name: 'Save categories draft', exact: true }).click();
  await expect(
    dialog.getByRole('status').filter({ hasText: 'Categories saved to the browser draft.' }),
  ).toBeVisible();
  await expect(
    categoryTable.getByRole('row', { name: /wizard-category Wizard category/ }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(categoryTrigger).toBeFocused();

  await page.getByRole('button', { name: 'Technologies', exact: true }).click();
  const technologyTable = page.getByRole('table', { name: 'Current technologies' });
  await expect(technologyTable.getByRole('row', { name: /nextjs Next\.js/ })).toBeVisible();
  const technologyTrigger = page.getByRole('button', { name: 'Edit technologies', exact: true });
  await technologyTrigger.click();
  dialog = page.getByRole('dialog', { name: 'Edit technologies' });
  await expectWizardStatus(dialog, 'Step 1 of 2: Edit technologies');
  await dialog.getByLabel('Choose a technology').click();
  await dialog.getByRole('option', { name: 'Next.js', exact: true }).click();
  await dialog.locator('input[name="nextjs.label"]').fill('Next.js framework');
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await expectWizardStatus(dialog, 'Step 2 of 2: Add technology');
  await dialog.getByLabel('New technology ID').fill('wizard-technology');
  await dialog.getByRole('button', { name: 'Add technology', exact: true }).click();
  await expectWizardStatus(dialog, 'Step 1 of 2: Edit technologies');
  await expect(dialog.locator('input[name="wizard-technology.label"]')).toBeFocused();
  await dialog.locator('input[name="wizard-technology.label"]').fill('Wizard technology');
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await expectWizardStatus(dialog, 'Step 2 of 2: Add technology');
  await dialog.getByRole('button', { name: 'Save technologies draft', exact: true }).click();
  await expect(
    dialog.getByRole('status').filter({ hasText: 'Technologies saved to the browser draft.' }),
  ).toBeVisible();
  await expect(
    technologyTable.getByRole('row', { name: /wizard-technology Wizard technology/ }),
  ).toBeVisible();
  expect(postedKinds).toEqual([]);

  const draft = await readBrowserDraft(page);
  expect(draft?.categories.data['web'].label).toBe('Web work');
  expect(draft?.categories.data['wizard-category'].label).toBe('Wizard category');
  expect(draft?.technologies.data['nextjs'].label).toBe('Next.js framework');
  expect(draft?.technologies.data['wizard-technology'].label).toBe('Wizard technology');
  await context.close();
});

test('image staging uses destination and file steps without writing to GitHub', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: cmsBaseUrl });
  await addOwnerCookie(context);
  const postedKinds: string[] = [];
  await context.route('**/api/cms', async (route) => {
    if (route.request().method() === 'POST') {
      postedKinds.push(route.request().postDataJSON().kind);
    }
    await route.continue();
  });

  const page = await context.newPage();
  const editor = new CmsEditorPage(page);
  await editor.open();
  await page.getByRole('button', { name: 'Images', exact: true }).click();
  const imageTrigger = page.getByRole('button', { name: 'Add images', exact: true });
  await imageTrigger.click();
  const dialog = page.getByRole('dialog', { name: 'Stage images in browser draft' });
  await expect(dialog).toBeVisible();
  await expectWizardStatus(dialog, 'Step 1 of 2: Destination');
  await expect
    .poll(() => dialog.evaluate((element) => element.contains(document.activeElement)))
    .toBe(true);
  await expect(dialog.getByLabel('Project slug')).toHaveValue('fixture-project');
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await expectWizardStatus(dialog, 'Step 2 of 2: Choose files');
  await dialog.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(dialog.getByLabel('Project slug')).toHaveValue('fixture-project');
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await dialog.getByLabel('Choose images').setInputFiles({
    name: 'Wizard image.png',
    mimeType: 'image/png',
    buffer: fixturePng,
  });
  await dialog.getByRole('button', { name: 'Stage images in browser draft', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole('status').filter({ hasText: '1 image was saved to the browser draft.' }),
  ).toBeVisible();
  expect(postedKinds).toEqual([]);

  const draft = await readBrowserDraft(page);
  expect(draft?.media).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        filename: 'Wizard image.png',
        scope: 'project',
        slug: 'fixture-project',
      }),
    ]),
  );
  await context.close();
});
