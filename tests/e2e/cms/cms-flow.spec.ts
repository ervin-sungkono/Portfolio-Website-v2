import { expect, test, type BrowserContext } from '@playwright/test';
import { unlink, writeFile } from 'node:fs/promises';
import { CmsEditorPage } from '../../support/cms-editor-page';
import {
  cmsBaseUrl as baseURL,
  cmsCookieName as cookieName,
  cmsPat as pat,
  cmsPatUserId as ownerId,
  cmsSessionCookie,
  fixturePng as png,
} from '../../support/cms-fixture';

const projectSlug = 'browser-cms-project';

async function addOwnerCookie(context: BrowserContext, githubId = ownerId) {
  await context.addCookies([
    {
      name: cookieName,
      value: await cmsSessionCookie(cookieName, githubId),
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    },
  ]);
}

async function waitForStatus(context: BrowserContext, path: string, status: number) {
  await expect
    .poll(async () => (await context.request.get(new URL(path, baseURL).href)).status(), {
      timeout: 30_000,
      intervals: [250, 500, 1_000, 2_000],
    })
    .toBe(status);
}

test('owner publishes content and a prior project 404 recovers without a new build', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL });
  const noScriptContext = await browser.newContext({ baseURL, javaScriptEnabled: false });
  await addOwnerCookie(context);
  await context.route('https://raw.githubusercontent.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: png }),
  );
  const page = await context.newPage();
  const editor = new CmsEditorPage(page);
  const publicPage = await context.newPage();
  const noScriptPage = await noScriptContext.newPage();

  const missing = await publicPage.goto(`/project/${projectSlug}`);
  expect(missing?.status()).toBe(404);
  const noScriptMissing = await noScriptPage.goto(`/project/${projectSlug}`);
  expect(noScriptMissing?.status()).toBe(404);
  await expect(noScriptPage.locator('[data-not-found]')).toBeVisible();
  await expect(noScriptPage.getByRole('heading', { name: 'This Page Isn’t Here.' })).toBeVisible();

  await editor.open();
  await expect(page.getByRole('heading', { name: 'Portfolio CMS' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Content editor' })).toBeVisible();
  const browserSession = await context.request.get(new URL('/api/auth/session', baseURL).href);
  expect(browserSession.status()).toBe(200);
  expect(await browserSession.text()).not.toContain(pat);
  await expect(page.getByLabel('Choose a project')).toBeVisible();
  await editor.expectUniquePanels();
  const overridePath = process.env.CMS_FIXTURE_PORTFOLIO_OVERRIDE;
  if (!overridePath) {
    throw new Error('Missing fixture override path.');
  }
  const externalIntro = 'A profile edited directly in the external content repository.';
  await context.request.get(new URL('/about', baseURL).href);
  try {
    await writeFile(overridePath, JSON.stringify({ intro: externalIntro }));
    expect(await (await context.request.get(new URL('/about', baseURL).href)).text()).not.toContain(
      externalIntro,
    );
    await page.getByRole('button', { name: 'Refresh public content' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Public content refresh requested.' }),
    ).toBeVisible();
    await expect
      .poll(
        async () =>
          (await (await context.request.get(new URL('/about', baseURL).href)).text()).includes(
            externalIntro,
          ),
        {
          timeout: 30_000,
        },
      )
      .toBe(true);
  } finally {
    await unlink(overridePath).catch(() => undefined);
    await page
      .getByRole('button', { name: 'Refresh public content' })
      .click()
      .catch(() => undefined);
  }

  await page.getByLabel('Choose a project').selectOption('');
  await page.getByLabel('Project URL slug').fill(projectSlug);
  await page.getByLabel('Title', { exact: true }).fill('Browser CMS Project');
  await page.getByLabel('Summary', { exact: true }).fill('Created through the owner editor.');
  await page
    .getByLabel('Description', { exact: true })
    .fill('This page appeared after a GitHub content commit, with no application rebuild.');
  await page.getByLabel('Year', { exact: true }).fill('2026');
  await page.locator('input[name="sortOrder"]').fill('20');
  await page.getByLabel('Published on the public site').check();
  await page.getByLabel('Featured project').check();
  await page.getByLabel('Website', { exact: true }).check();
  await page.getByLabel('Next.js', { exact: true }).check();
  await page.locator('textarea[name="tags"]').fill('cms\nbrowser');
  await page.getByLabel('Cover image path').fill(`media/projects/${projectSlug}/cover.png`);
  await editor.expectUniquePanels();
  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Project created.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'View GitHub commit' })).toHaveAttribute(
    'href',
    /https:\/\/github\.com\/fixture-owner\/portfolio-content-fixture\/commit\//,
  );

  await waitForStatus(context, `/project/${projectSlug}`, 200);
  const publicProject = await publicPage.goto(`/project/${projectSlug}`);
  expect(publicProject?.status()).toBe(200);
  await expect(publicPage.getByRole('heading', { name: 'Browser CMS Project' })).toBeVisible();
  const noScriptProject = await noScriptPage.goto(`/project/${projectSlug}`);
  expect(noScriptProject?.status()).toBe(200);
  await expect(noScriptPage.getByRole('heading', { name: 'Browser CMS Project' })).toBeVisible();

  await page.getByRole('button', { name: 'Site Profile' }).click();
  await editor.expectUniquePanels();
  await page.getByLabel('Site title').fill('Browser CMS Portfolio');
  await page.getByLabel('Headline').fill('A headline updated from the browser');
  await page
    .getByLabel('Introduction')
    .fill('This public homepage changed after an on-demand cache invalidation.');
  await editor.expectUniquePanels();
  await page.getByRole('button', { name: 'Save site profile' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Site profile saved.' })).toBeVisible();
  await expect
    .poll(
      async () => {
        const response = await context.request.get(baseURL);
        return response.text();
      },
      {
        timeout: 30_000,
        intervals: [250, 500, 1_000, 2_000],
      },
    )
    .toContain('A headline updated from the browser');
  await publicPage.goto('/');
  await expect(publicPage.getByRole('heading', { level: 1 })).toContainText(
    'A headline updated from the browser',
  );

  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await editor.expectUniquePanels();
  await page.getByLabel('Choose a project').selectOption(projectSlug);
  await page.getByLabel('Published on the public site').uncheck();
  await page.getByRole('button', { name: 'Save project' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Project saved.' })).toBeVisible();
  await waitForStatus(context, `/project/${projectSlug}`, 404);
  await expect
    .poll(
      async () =>
        (await (await context.request.get(new URL('/sitemap.xml', baseURL).href)).text()).includes(
          `/project/${projectSlug}`,
        ),
      { timeout: 30_000, intervals: [250, 500, 1_000, 2_000] },
    )
    .toBe(false);

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete project' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: `Project “${projectSlug}” was deleted.` }),
  ).toBeVisible();
  const snapshot = await context.request.get(new URL('/api/cms', baseURL).href);
  expect(snapshot.status()).toBe(200);
  const snapshotJson = await snapshot.json();
  expect(snapshotJson.projects.some((entry: { slug: string }) => entry.slug === projectSlug)).toBe(
    false,
  );

  await context.close();
  await noScriptContext.close();
});

test('owner image upload validates bytes and stores media in the project folder', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL });
  await addOwnerCookie(context);
  await context.route('https://raw.githubusercontent.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: png }),
  );
  const page = await context.newPage();
  const editor = new CmsEditorPage(page);
  await editor.open();
  await expect(page.getByRole('heading', { name: 'Content editor' })).toBeVisible();
  await page.getByLabel('Choose a project').selectOption('fixture-project');
  await editor.expectUniquePanels();
  await page.getByRole('button', { name: 'Images' }).click();
  await editor.expectUniquePanels();
  await page.getByLabel('Choose image').setInputFiles({
    name: 'Browser cover.png',
    mimeType: 'image/png',
    buffer: png,
  });
  await page.getByRole('button', { name: 'Upload image' }).click();
  await expect(page.getByRole('heading', { name: 'Image uploaded' })).toBeVisible();
  const path = await page.getByLabel('Repository path').inputValue();
  expect(path).toMatch(/^media\/projects\/fixture-project\/[a-f0-9]{64}-browser-cover\.png$/);
  await page.getByRole('button', { name: 'Use as cover' }).click();
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await editor.expectUniquePanels();
  await expect(page.getByLabel('Cover image path')).toHaveValue(path);
  await page.getByRole('button', { name: 'Save project' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Project saved.' })).toBeVisible();
  await context.close();
});

test('owner editor panels reflow across viewport, theme, enlarged text, and keyboard validation', async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({ baseURL });
  await addOwnerCookie(context);
  const page = await context.newPage();
  const editor = new CmsEditorPage(page);
  await editor.open();
  await expect(page.getByRole('heading', { name: 'Content editor' })).toBeVisible();

  const widths = [320, 390, 820, 1024, 1440];
  const sections = [
    { button: 'Projects', heading: 'Projects', id: 'projects', control: 'Title' },
    { button: 'Site Profile', heading: 'Site Profile', id: 'site', control: 'Site title' },
    { button: 'Categories', heading: 'Categories', id: 'categories', control: 'New category ID' },
    {
      button: 'Technologies',
      heading: 'Technologies',
      id: 'technologies',
      control: 'New technology ID',
    },
    { button: 'Images', heading: 'Images', id: 'images', control: 'Choose image' },
  ];

  for (const theme of ['light', 'dark'] as const) {
    await editor.selectTheme(theme);
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => document.documentElement.style.removeProperty('font-size'));
      for (const section of sections) {
        await page.getByRole('button', { name: section.button, exact: true }).click();
        await editor.expectUniquePanels();
        const panel = page.locator(`#cms-editor-${section.id}-panel`);
        await expect(
          panel.getByRole('heading', { name: section.heading, exact: true }),
        ).toBeVisible();
        await expect(panel).toBeVisible();
        await expect(panel.getByLabel(section.control)).toBeVisible();
        const layout = await page.evaluate(() => {
          const editor = Array.from(document.querySelectorAll<HTMLElement>('.cms-editor')).find(
            (candidate) => candidate.getClientRects().length > 0,
          );
          return {
            documentWidth: document.documentElement.scrollWidth,
            viewportWidth: window.innerWidth,
            editorWidth: editor?.scrollWidth ?? 0,
            editorClientWidth: editor?.clientWidth ?? 0,
          };
        });
        expect(
          layout.documentWidth,
          `${theme} ${width}px ${section.id} document overflow`,
        ).toBeLessThanOrEqual(layout.viewportWidth);
        expect(
          layout.editorWidth,
          `${theme} ${width}px ${section.id} editor overflow`,
        ).toBeLessThanOrEqual(layout.editorClientWidth + 1);

        if (theme === 'light' && width === 320 && section.id === 'projects') {
          await page.screenshot({ path: testInfo.outputPath('editor-320-light.png') });
        }
        if (theme === 'light' && width === 1440 && section.id === 'projects') {
          await page.screenshot({ path: testInfo.outputPath('editor-1440-light.png') });
        }
      }
    }
  }

  await editor.selectTheme('light');
  for (const width of [320, 820]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    await expect(page.getByRole('button', { name: 'Projects', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Projects', exact: true }).click();
    await page.getByLabel('Choose a project').selectOption('');
    await editor.expectUniquePanels();
    const projectsPanel = page.locator('#cms-editor-projects-panel');
    const layout = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      rootFontSize: getComputedStyle(document.documentElement).fontSize,
    }));
    expect(layout.rootFontSize).toBe('32px');
    expect(layout.documentWidth, `200% text at ${width}px should reflow`).toBeLessThanOrEqual(
      layout.viewportWidth,
    );

    await projectsPanel.getByLabel('Project URL slug').fill(`responsive-errors-${width}`);
    await projectsPanel.getByRole('button', { name: 'Create project' }).click();
    await expect(projectsPanel.locator('#cms-project-title-error')).toBeVisible();
    await expect(projectsPanel.getByRole('textbox', { name: /^Title/ })).toBeFocused();
  }

  await page.setViewportSize({ width: 390, height: 900 });
  await page.evaluate(() => document.documentElement.style.removeProperty('font-size'));
  const projectsTab = page.getByRole('button', { name: 'Projects', exact: true });
  const siteTab = page.getByRole('button', { name: 'Site Profile', exact: true });
  await projectsTab.focus();
  await page.keyboard.press('Tab');
  await expect(siteTab).toBeFocused();
  const focusStyle = await siteTab.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      visible: element.matches(':focus-visible'),
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
    };
  });
  expect(focusStyle.visible).toBe(true);
  expect(focusStyle.outlineStyle).toBe('solid');
  expect(Number.parseFloat(focusStyle.outlineWidth)).toBeGreaterThan(0);

  await context.close();
});
