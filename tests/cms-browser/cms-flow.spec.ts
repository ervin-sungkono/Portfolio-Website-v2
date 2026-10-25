import { encode } from 'next-auth/jwt';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

const baseURL = 'http://localhost:3104';
const cookieName = '__Secure-authjs.session-token';
const adminId = '42424242';
const ownerToken = 'fixture-owner-token';
const authSecret = 'cms-browser-fixture-secret-with-at-least-thirty-two-characters';
const projectSlug = 'browser-cms-project';
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/L8kAAAAASUVORK5CYII=',
  'base64',
);

async function expectUniqueEditorPanels(page: Page) {
  await expect(page.locator('.cms-editor')).toHaveCount(1);
  for (const id of ['projects', 'site', 'categories', 'technologies', 'images']) {
    await expect(page.locator(`#cms-editor-${id}-panel`)).toHaveCount(1);
  }
}

async function sessionCookie(githubId = adminId, accessToken = ownerToken) {
  return encode({
    secret: authSecret,
    salt: cookieName,
    maxAge: 60 * 60,
    token: {
      sub: githubId,
      githubId,
      githubAccessToken: accessToken,
      githubExpiresAt: Math.floor(Date.now() / 1000) + 60 * 60,
      name: 'Fixture Owner',
    },
  });
}

async function addOwnerCookie(
  context: BrowserContext,
  githubId = adminId,
  accessToken = ownerToken,
) {
  await context.addCookies([
    {
      name: cookieName,
      value: await sessionCookie(githubId, accessToken),
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

async function selectTheme(page: import('@playwright/test').Page, theme: 'light' | 'dark') {
  const root = page.locator('html');
  if ((await root.getAttribute('data-theme')) === theme) {
    return;
  }
  const current = await root.getAttribute('data-theme');
  await page
    .getByRole('button', {
      name: current === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
    })
    .click();
  await expect(root).toHaveAttribute('data-theme', theme);
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
  const publicPage = await context.newPage();
  const noScriptPage = await noScriptContext.newPage();

  const missing = await publicPage.goto(`/project/${projectSlug}`);
  expect(missing?.status()).toBe(404);
  const noScriptMissing = await noScriptPage.goto(`/project/${projectSlug}`);
  expect(noScriptMissing?.status()).toBe(404);
  await expect(noScriptPage.locator('[data-not-found]')).toBeVisible();
  await expect(noScriptPage.getByRole('heading', { name: 'This Page Isn’t Here.' })).toBeVisible();

  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Portfolio CMS' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Content editor' })).toBeVisible();
  await expect(page.getByLabel('Choose a project')).toBeVisible();
  await expectUniqueEditorPanels(page);

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
  await expectUniqueEditorPanels(page);
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
  await expectUniqueEditorPanels(page);
  await page.getByLabel('Site title').fill('Browser CMS Portfolio');
  await page.getByLabel('Headline').fill('A headline updated from the browser');
  await page
    .getByLabel('Introduction')
    .fill('This public homepage changed after an on-demand cache invalidation.');
  await expectUniqueEditorPanels(page);
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
  await expectUniqueEditorPanels(page);
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

test('explicit upload destinations preserve drafts and publish a project named technologies', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL });
  await addOwnerCookie(context);
  await context.route('https://raw.githubusercontent.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: png }),
  );
  const page = await context.newPage();
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Content editor' })).toBeVisible();
  await page.getByLabel('Choose a project').selectOption('');
  await page.getByLabel('Project URL slug').fill('technologies');
  await page.getByLabel('Title', { exact: true }).fill('Technologies Project');
  await page
    .getByLabel('Summary', { exact: true })
    .fill('A valid project slug, not an icon destination.');
  await page
    .getByLabel('Description', { exact: true })
    .fill('Published using its uploaded project cover.');
  await page.getByLabel('Year', { exact: true }).fill('2026');
  await page.getByLabel('Published on the public site').check();
  await page.getByLabel('Website', { exact: true }).check();
  await page.getByLabel('Next.js', { exact: true }).check();
  await expectUniqueEditorPanels(page);
  await page.getByRole('button', { name: 'Images' }).click();
  await expectUniqueEditorPanels(page);
  await page.getByLabel('Choose image').setInputFiles({
    name: 'Browser cover.png',
    mimeType: 'image/png',
    buffer: png,
  });
  // Simulate an editor tab opened before scope became required.
  await page.route(
    '**/api/cms/media',
    async (route) => {
      const { scope: _scope, ...oldRequest } = route.request().postDataJSON();
      void _scope;
      await route.continue({ postData: JSON.stringify(oldRequest) });
    },
    { times: 1 },
  );
  const rejectedUpload = page.waitForResponse('**/api/cms/media');
  await page.getByRole('button', { name: 'Upload image' }).click();
  expect((await rejectedUpload).status()).toBe(400);
  await expect(page.locator('#cms-editor-images-panel').getByRole('alert')).toContainText('scope');
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Technologies Project');
  await expect(page.getByLabel('Project URL slug')).toHaveValue('technologies');
  await page.getByRole('button', { name: 'Images', exact: true }).click();
  await page.getByRole('button', { name: 'Upload image' }).click();
  await expect(page.getByRole('heading', { name: 'Image uploaded' })).toBeVisible();
  const path = await page.getByLabel('Repository path').inputValue();
  expect(path).toMatch(/^media\/projects\/technologies\/[a-f0-9]{64}-browser-cover\.png$/);
  await page.getByRole('button', { name: 'Use as cover' }).click();
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await expectUniqueEditorPanels(page);
  await expect(page.getByLabel('Cover image path')).toHaveValue(path);
  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Project created.' })).toBeVisible();
  await waitForStatus(context, '/project/technologies', 200);
  const publicPage = await context.newPage();
  await publicPage.goto('/project/technologies');
  await expect(publicPage.getByRole('heading', { name: 'Technologies Project' })).toBeVisible();
  await expect(publicPage.locator(`img[src$="${path}"]`).first()).toBeVisible();

  await page.getByRole('button', { name: 'Images', exact: true }).click();
  await page.getByLabel('Image destination').selectOption('technology');
  await page.getByRole('button', { name: 'Upload image' }).click();
  await expect(page.getByLabel('Repository path')).toHaveValue(
    /^media\/technologies\/[a-f0-9]{64}-browser-cover\.png$/,
  );
  await page.getByRole('combobox', { name: 'Technology', exact: true }).selectOption('nextjs');
  await page.getByRole('button', { name: 'Use as technology icon' }).click();
  await page.getByRole('button', { name: 'Technologies', exact: true }).click();
  await page.getByRole('button', { name: 'Save technologies' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Technologies saved.' })).toBeVisible();
  await context.close();
});

test('saved category order updates public filters without rebuilding and preserves search URLs', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL });
  await addOwnerCookie(context);
  const page = await context.newPage();
  const publicPage = await context.newPage();
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Categories', exact: true }).click();
  await page.getByLabel('New category ID').fill('mobile');
  await page.getByRole('button', { name: 'Add category', exact: true }).click();
  await page.locator('input[name="mobile.label"]').fill('Mobile');
  await page.getByRole('button', { name: 'Save categories' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Categories saved.' })).toBeVisible();
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await page.getByLabel('Choose a project').selectOption('fixture-project');
  await page.getByLabel('Mobile', { exact: true }).check();
  await page.getByRole('button', { name: 'Save project' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Project saved.' })).toBeVisible();

  const filterLinks = publicPage
    .getByRole('navigation', { name: 'Project categories' })
    .getByRole('link');
  await expect
    .poll(
      async () => {
        await publicPage.goto('/project?q=fixture');
        return filterLinks.allTextContents();
      },
      { timeout: 30_000 },
    )
    .toEqual(['All Projects', 'Website', 'Mobile']);

  await page.getByRole('button', { name: 'Categories', exact: true }).click();
  await page.locator('input[name="mobile.sortOrder"]').fill('0');
  await page.getByRole('button', { name: 'Save categories' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Categories saved.' })).toBeVisible();
  await expect
    .poll(
      async () => {
        await publicPage.goto('/project?q=fixture');
        return filterLinks.allTextContents();
      },
      { timeout: 30_000 },
    )
    .toEqual(['All Projects', 'Mobile', 'Website']);
  await expect(filterLinks.filter({ hasText: 'All Projects' })).toHaveAttribute(
    'href',
    '/project?q=fixture',
  );
  await expect(filterLinks.filter({ hasText: 'Mobile' })).toHaveAttribute(
    'href',
    '/project?q=fixture&category=Mobile',
  );
  await filterLinks.filter({ hasText: 'Mobile' }).click();
  await expect(
    publicPage.getByRole('heading', { name: 'Fixture Portfolio Project' }),
  ).toBeVisible();
  await expect(publicPage.getByRole('searchbox')).toHaveValue('fixture');
  await context.close();
});

test('private CMS APIs reject missing/wrong-owner sessions, bad tokens, cross-origin writes, and invalid media', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL });
  const endpoint = new URL('/api/cms', baseURL).href;

  const anonymous = await context.request.get(endpoint);
  expect(anonymous.status()).toBe(401);

  await addOwnerCookie(context, '99999999', 'fixture-other-token');
  const wrongOwner = await context.request.get(endpoint);
  expect(wrongOwner.status()).toBe(403);

  await context.clearCookies();
  await addOwnerCookie(context, adminId, 'fixture-bad-token');
  const badToken = await context.request.get(endpoint);
  expect(badToken.status()).toBe(401);
  expect(await badToken.text()).not.toContain('fixture-bad-token');

  await context.clearCookies();
  await addOwnerCookie(context);
  const browserSession = await context.request.get(new URL('/api/auth/session', baseURL).href);
  expect(browserSession.status()).toBe(200);
  expect(await browserSession.text()).not.toContain(ownerToken);

  const crossOrigin = await context.request.post(endpoint, {
    headers: { Origin: 'https://attacker.example' },
    data: { kind: 'initialize' },
  });
  expect(crossOrigin.status()).toBe(403);

  const invalidMutation = await context.request.post(endpoint, {
    headers: { Origin: baseURL },
    data: { kind: 'project', slug: '../escape', expectedSha: null, data: {} },
  });
  expect(invalidMutation.status()).toBe(400);

  const invalidMedia = await context.request.post(new URL('/api/cms/media', baseURL).href, {
    headers: { Origin: baseURL },
    data: {
      scope: 'project',
      slug: 'fixture-project',
      filename: 'spoof.jpg',
      mime: 'image/jpeg',
      content: png.toString('base64'),
      unexpected: 'field',
    },
  });
  expect(invalidMedia.status()).toBe(400);
  expect(await invalidMedia.text()).not.toContain('fixture-owner-token');

  const invalidImageBytes = await context.request.post(new URL('/api/cms/media', baseURL).href, {
    headers: { Origin: baseURL },
    data: {
      scope: 'project',
      slug: 'fixture-project',
      filename: 'spoof.png',
      mime: 'image/png',
      content: Buffer.from('not an image').toString('base64'),
    },
  });
  expect(invalidImageBytes.status()).toBe(400);

  const unavailable = await context.request.get('/project/fixture-upstream-unavailable');
  expect(unavailable.status()).toBe(503);
  expect(unavailable.headers()['cache-control']).toBe('no-store');
  expect(await unavailable.text()).toContain('temporarily unavailable');
  expect(await unavailable.text()).not.toContain('This Page Isn’t Here.');

  await context.close();
});

test('owner editor panels reflow across viewport, theme, enlarged text, and keyboard validation', async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({ baseURL });
  await addOwnerCookie(context);
  const page = await context.newPage();
  await page.goto('/admin');
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
    await selectTheme(page, theme);
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => document.documentElement.style.removeProperty('font-size'));
      for (const section of sections) {
        await page.getByRole('button', { name: section.button, exact: true }).click();
        await expectUniqueEditorPanels(page);
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

  await selectTheme(page, 'light');
  for (const width of [320, 820]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    await expect(page.getByRole('button', { name: 'Projects', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Projects', exact: true }).click();
    await page.getByLabel('Choose a project').selectOption('');
    await expectUniqueEditorPanels(page);
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
