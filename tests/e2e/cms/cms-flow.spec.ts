import { expect, test, type BrowserContext, type Page } from '@playwright/test';
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

type CapturedCmsMutation = {
  endpoint: 'media' | 'cms';
  body: Record<string, unknown>;
};

async function captureCmsMutations(context: BrowserContext, captured: CapturedCmsMutation[]) {
  await context.route('**/api/cms/media', async (route) => {
    if (route.request().method() === 'POST') {
      captured.push({
        endpoint: 'media',
        body: route.request().postDataJSON() as Record<string, unknown>,
      });
    }
    await route.continue();
  });
  await context.route('**/api/cms', async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      captured.push({ endpoint: 'cms', body });
    }
    await route.continue();
  });
}

async function readBrowserDraft(page: Page) {
  return page.evaluate(async () => {
    const cache = await caches.open('portfolio-cms-draft-v1');
    const response = await cache.match('/__portfolio-cms-draft__/state');
    return response ? response.json() : null;
  });
}

async function submitAllChanges(page: Page) {
  await page.getByRole('button', { name: 'Submit all changes', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Submit all changes?' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Submit changes', exact: true }).click();
}

test('owner publishes content and a prior project 404 recovers without a new build', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL });
  const captured: CapturedCmsMutation[] = [];
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
      page.getByRole('status').getByText('Public content refresh requested.', { exact: true }),
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
  await captureCmsMutations(context, captured);

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
  await page.getByLabel('Add a category').selectOption('web');
  await page.getByLabel('Add a technology').selectOption('nextjs');
  const tagInput = page.getByLabel('Add a tag');
  await tagInput.fill('cms');
  await tagInput.press('Enter');
  await tagInput.fill('browser');
  await tagInput.press('Enter');
  await page.getByRole('button', { name: 'Images', exact: true }).click();
  await page.getByLabel('Choose images').setInputFiles([
    { name: 'Browser cover.png', mimeType: 'image/png', buffer: png },
    { name: 'Browser gallery keep.png', mimeType: 'image/png', buffer: png },
    { name: 'Browser gallery remove.png', mimeType: 'image/png', buffer: png },
  ]);
  await page.getByRole('button', { name: 'Stage images in browser draft' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: '3 images were saved to the browser draft.' }),
  ).toBeVisible();
  const stagedImageActions = page.getByRole('button', {
    name: /^Remove .* from browser draft$/,
  });
  await expect(stagedImageActions).toHaveCount(3);
  await stagedImageActions.nth(2).click();
  const removeImageDialog = page.getByRole('dialog');
  await expect(
    removeImageDialog.getByRole('heading', { name: 'Remove this staged image?' }),
  ).toBeVisible();
  await removeImageDialog.getByRole('button', { name: 'Remove image', exact: true }).click();
  await expect(stagedImageActions).toHaveCount(2);
  expect(captured).toHaveLength(0);

  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await editor.expectUniquePanels();
  await page.getByRole('button', { name: 'Add project to draft', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Project saved to the browser draft.' }),
  ).toBeVisible();
  const coverPath = await page.getByLabel('Cover image path').inputValue();
  const galleryPath = (await page.locator('textarea[name="media.gallery"]').inputValue()).trim();
  expect(coverPath).toMatch(
    /^media\/projects\/browser-cms-project\/[a-f0-9]{64}-browser-cover\.png$/,
  );
  expect(galleryPath).toMatch(
    /^media\/projects\/browser-cms-project\/[a-f0-9]{64}-browser-gallery-keep\.png$/,
  );

  await page.getByRole('button', { name: 'Site Profile', exact: true }).click();
  await page.getByLabel('Site title').fill('Browser CMS Portfolio');
  await page.getByLabel('Headline').fill('A headline updated from the browser');
  await page
    .getByLabel('Introduction')
    .fill('This public homepage changed after an on-demand cache invalidation.');
  await page.getByRole('button', { name: 'Save site profile draft', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Site profile saved to the browser draft.' }),
  ).toBeVisible();
  expect(captured).toHaveLength(0);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Content editor' })).toBeVisible();
  await page.getByLabel('Choose a project').selectOption(projectSlug);
  await expect(page.getByLabel('Cover image path')).toHaveValue(coverPath);
  await expect(page.locator('textarea[name="media.gallery"]')).toHaveValue(galleryPath);
  await page.getByRole('button', { name: 'Site Profile', exact: true }).click();
  await expect(page.getByLabel('Headline')).toHaveValue('A headline updated from the browser');
  await page.getByRole('button', { name: 'Images', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Remove .* from browser draft$/ })).toHaveCount(2);
  expect(captured).toHaveLength(0);

  await editor.expectUniquePanels();
  await submitAllChanges(page);
  await expect(page.getByRole('link', { name: 'View GitHub commit' })).toHaveAttribute(
    'href',
    /https:\/\/github\.com\/fixture-owner\/portfolio-content-fixture\/commit\//,
  );
  expect(captured.map(({ endpoint }) => endpoint)).toEqual(['media', 'media', 'cms']);
  expect(captured.slice(0, 2).map(({ body }) => body.filename)).toEqual([
    'Browser cover.png',
    'Browser gallery keep.png',
  ]);
  const finalizeBody = captured[2]!.body as {
    kind: string;
    projects: {
      upsert: Array<{
        slug: string;
        data: { media: { cover: string; gallery: string[] } };
      }>;
    };
    site?: { data: { headline: string } };
    media: Array<{ path: string; filename: string; blobSha: string } & Record<string, unknown>>;
  };
  expect(finalizeBody.kind).toBe('finalize');
  expect(finalizeBody.projects.upsert).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        slug: projectSlug,
        data: expect.objectContaining({
          media: { cover: coverPath, gallery: [galleryPath] },
        }),
      }),
    ]),
  );
  expect(finalizeBody.site?.data.headline).toBe('A headline updated from the browser');
  expect(finalizeBody.media.map(({ path }) => path)).toEqual([coverPath, galleryPath]);
  expect(finalizeBody.media.map(({ filename }) => filename)).toEqual([
    'Browser cover.png',
    'Browser gallery keep.png',
  ]);
  expect(finalizeBody.media.every(({ blobSha }) => /^[a-f0-9]{40}$/.test(blobSha))).toBe(true);
  expect(finalizeBody.media.every((media) => !Object.hasOwn(media, 'content'))).toBe(true);

  await waitForStatus(context, `/project/${projectSlug}`, 200);
  const publicProject = await publicPage.goto(`/project/${projectSlug}`);
  expect(publicProject?.status()).toBe(200);
  await expect(publicPage.getByRole('heading', { name: 'Browser CMS Project' })).toBeVisible();
  const noScriptProject = await noScriptPage.goto(`/project/${projectSlug}`);
  expect(noScriptProject?.status()).toBe(200);
  await expect(noScriptPage.getByRole('heading', { name: 'Browser CMS Project' })).toBeVisible();

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
  await page.getByRole('button', { name: 'Save project draft', exact: true }).click();
  await submitAllChanges(page);
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

  await page.getByRole('button', { name: 'Delete project' }).click();
  const removeDialog = page.getByRole('dialog');
  await expect(removeDialog.getByRole('heading', { name: 'Remove this project?' })).toBeVisible();
  await removeDialog.getByRole('button', { name: 'Remove project', exact: true }).click();
  await submitAllChanges(page);
  await expect(
    page.getByRole('status').filter({ hasText: 'All changes were submitted in one commit.' }),
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

test('owner stages media in the browser draft and commits it with the project', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL });
  const captured: CapturedCmsMutation[] = [];
  await captureCmsMutations(context, captured);
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
  await page.getByLabel('Choose images').setInputFiles([
    {
      name: 'Browser cover.png',
      mimeType: 'image/png',
      buffer: png,
    },
  ]);
  await page.getByRole('button', { name: 'Stage images in browser draft' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: /1 image was saved to the browser draft\./ }),
  ).toBeVisible();
  expect(captured).toHaveLength(0);
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  const gallery = page.locator('textarea[name="media.gallery"]');
  const path = (await gallery.inputValue()).trim();
  expect(path).toMatch(/^media\/projects\/fixture-project\/[a-f0-9]{64}-browser-cover\.png$/);
  await gallery.fill('');
  await page.getByRole('button', { name: 'Save project draft', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Project saved to the browser draft.' }),
  ).toBeVisible();
  const unattachedDraft = await readBrowserDraft(page);
  const unattachedProject = unattachedDraft?.projects.upsert.find(
    (project: { slug: string }) => project.slug === 'fixture-project',
  );
  expect(unattachedProject?.data.media.gallery).not.toContain(path);
  expect(unattachedDraft?.media.some((item: { path: string }) => item.path === path)).toBe(true);
  await page.getByRole('button', { name: 'Submit all changes', exact: true }).click();
  await expect(
    page
      .getByRole('alert')
      .filter({ hasText: 'Attach Browser cover.png to a project or technology' }),
  ).toBeVisible();
  expect(captured).toHaveLength(0);
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await gallery.fill(path);
  await page.getByRole('button', { name: 'Save project draft', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Project saved to the browser draft.' }),
  ).toBeVisible();
  const reattachedDraft = await readBrowserDraft(page);
  const reattachedProject = reattachedDraft?.projects.upsert.find(
    (project: { slug: string }) => project.slug === 'fixture-project',
  );
  expect(reattachedProject?.data.media.gallery).toContain(path);
  expect(reattachedDraft?.media.some((item: { path: string }) => item.path === path)).toBe(true);
  await submitAllChanges(page);
  await expect(
    page.getByRole('status').filter({ hasText: /All changes were submitted in one commit/ }),
  ).toBeVisible();
  expect(captured.map(({ endpoint }) => endpoint)).toEqual(['media', 'cms']);
  const finalizeBody = captured[1]!.body as {
    kind: string;
    media: Array<{ path: string; blobSha: string }>;
  };
  expect(finalizeBody.kind).toBe('finalize');
  expect(finalizeBody.media).toHaveLength(1);
  expect(finalizeBody.media[0]).toEqual(
    expect.objectContaining({ path, blobSha: expect.stringMatching(/^[a-f0-9]{40}$/) }),
  );
  const snapshot = await context.request.get(new URL('/api/cms', baseURL).href);
  const snapshotJson = await snapshot.json();
  expect(
    snapshotJson.projects.find((entry: { slug: string }) => entry.slug === 'fixture-project').data
      .media.gallery,
  ).toContain(path);
  await context.close();
});

test('conflict review keeps the browser draft across reload and requires an explicit baseline choice', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL });
  await addOwnerCookie(context);
  let finalizations = 0;
  const postedKinds: string[] = [];
  await context.route('**/api/cms', async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      postedKinds.push(body.kind);
      if (body.kind === 'finalize') {
        finalizations += 1;
        if (finalizations === 1) {
          await route.fulfill({
            status: 409,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Some content changed after you opened it.',
              code: 'conflict',
              conflicts: [{ path: 'content/projects/fixture-project.json' }],
            }),
          });
          return;
        }
      }
    }
    await route.continue();
  });

  const page = await context.newPage();
  const editor = new CmsEditorPage(page);
  await editor.open();
  await page.getByLabel('Choose a project').selectOption('fixture-project');
  await page
    .getByLabel('Summary', { exact: true })
    .fill('A summary retained through conflict review.');
  await page.getByRole('button', { name: 'Save project draft', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Project saved to the browser draft.' }),
  ).toBeVisible();
  expect(postedKinds).toEqual([]);
  await submitAllChanges(page);
  expect(finalizations).toBe(1);
  expect(postedKinds).toEqual(['finalize']);
  await expect(page.getByRole('heading', { name: 'Review conflicting changes' })).toBeVisible();
  const conflictDetails = page.locator('.cms-editor-conflicts details');
  await conflictDetails.locator('summary').click();
  await expect(
    conflictDetails.getByText('A summary retained through conflict review.'),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Use reviewed versions as baseline' }).click();
  const baselineDialog = page.getByRole('dialog');
  await expect(
    baselineDialog.getByRole('heading', { name: 'Use reviewed versions as baseline?' }),
  ).toBeVisible();
  await baselineDialog.getByRole('button', { name: 'Use reviewed versions', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Reviewed versions are the new baseline.' }),
  ).toBeVisible();

  const unchangedSnapshot = await context.request.get(new URL('/api/cms', baseURL).href);
  const unchangedSnapshotJson = await unchangedSnapshot.json();
  expect(
    unchangedSnapshotJson.projects.find(
      (entry: { slug: string }) => entry.slug === 'fixture-project',
    ).data.summary,
  ).toBe('A project served by the isolated CMS browser fixture.');

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Content editor' })).toBeVisible();
  await page.getByLabel('Choose a project').selectOption('fixture-project');
  await expect(page.getByLabel('Summary', { exact: true })).toHaveValue(
    'A summary retained through conflict review.',
  );
  expect(finalizations).toBe(1);
  expect(postedKinds).toEqual(['finalize']);
  await submitAllChanges(page);
  expect(finalizations).toBe(2);
  expect(postedKinds).toEqual(['finalize', 'finalize']);
  await expect(page.getByRole('link', { name: 'View GitHub commit' })).toBeVisible();

  const snapshot = await context.request.get(new URL('/api/cms', baseURL).href);
  const snapshotJson = await snapshot.json();
  expect(
    snapshotJson.projects.find((entry: { slug: string }) => entry.slug === 'fixture-project').data
      .summary,
  ).toBe('A summary retained through conflict review.');
  await context.close();
});

test('a new project conflict adopts the remote SHA and submits one project entry', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL });
  await addOwnerCookie(context);
  const slug = 'conflicted-new-project';
  const remoteSha = 'a'.repeat(40);
  const commitSha = 'b'.repeat(40);
  let remoteProject: Record<string, unknown> | null = null;
  let committedProject: Record<string, unknown> | null = null;
  let remoteProjectVisible = false;
  let finalizations = 0;
  const postedKinds: string[] = [];
  const finalizationBodies: Array<Record<string, unknown>> = [];

  await context.route('**/api/cms', async (route) => {
    if (route.request().method() === 'GET') {
      const response = await route.fetch();
      const snapshot = await response.json();
      const fixtureProject = snapshot.projects.find(
        (entry: { slug: string }) => entry.slug === 'fixture-project',
      );
      if (!remoteProject && fixtureProject) {
        remoteProject = {
          ...fixtureProject.data,
          title: 'Remote project appeared before submit',
          summary: 'Remote server version for the new slug.',
        };
      }
      if (remoteProjectVisible && remoteProject) {
        const data = committedProject ?? remoteProject;
        const projects = snapshot.projects.filter((entry: { slug: string }) => entry.slug !== slug);
        projects.push({ slug, sha: committedProject ? commitSha : remoteSha, data });
        await route.fulfill({ response, body: JSON.stringify({ ...snapshot, projects }) });
        return;
      }
      await route.fulfill({ response });
      return;
    }

    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      postedKinds.push(String(body.kind));
      if (body.kind === 'finalize') {
        finalizations += 1;
        finalizationBodies.push(body);
        if (finalizations === 1) {
          remoteProjectVisible = true;
          await route.fulfill({
            status: 409,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Some content changed after you opened it.',
              code: 'conflict',
              conflicts: [{ path: `content/projects/${slug}.json` }],
            }),
          });
          return;
        }

        const projects = body.projects as {
          upsert: Array<{
            slug: string;
            data: Record<string, unknown>;
            expectedSha: string | null;
          }>;
        };
        committedProject = projects.upsert.find((project) => project.slug === slug)?.data ?? null;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            commitUrl: `https://github.com/fixture-owner/portfolio-content-fixture/commit/${commitSha}`,
            commitSha,
            changedPaths: [`content/projects/${slug}.json`],
            cache: 'refreshed',
          }),
        });
        return;
      }
    }
    await route.continue();
  });

  const page = await context.newPage();
  const editor = new CmsEditorPage(page);
  await editor.open();
  await page.getByLabel('Choose a project').selectOption('');
  await page.getByLabel('Project URL slug').fill(slug);
  await page.getByLabel('Title', { exact: true }).fill('Locally drafted project');
  await page
    .getByLabel('Summary', { exact: true })
    .fill('A local version kept through conflict review.');
  await page
    .getByLabel('Description', { exact: true })
    .fill('Created locally before the remote slug appeared.');
  await page.getByLabel('Year', { exact: true }).fill('2026');
  await page.getByLabel('Add a category').selectOption('web');
  await page.getByLabel('Cover image path').fill(`media/projects/${slug}/cover.png`);
  await page.getByRole('button', { name: 'Add project to draft', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Project saved to the browser draft.' }),
  ).toBeVisible();
  expect(postedKinds).toEqual([]);

  await page.getByRole('button', { name: 'Submit all changes', exact: true }).click();
  const firstSubmitDialog = page.getByRole('dialog');
  await expect(
    firstSubmitDialog.getByRole('heading', { name: 'Submit all changes?' }),
  ).toBeVisible();
  await firstSubmitDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(finalizations).toBe(0);
  expect(postedKinds).toEqual([]);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Content editor' })).toBeVisible();
  await page.getByLabel('Choose a project').selectOption(slug);
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Locally drafted project');

  await submitAllChanges(page);
  expect(finalizations).toBe(1);
  const firstSubmission = finalizationBodies[0] as {
    projects: {
      upsert: Array<{ slug: string; expectedSha: string | null }>;
    };
  };
  const initialProjects = firstSubmission.projects.upsert.filter(
    (project) => project.slug === slug,
  );
  expect(initialProjects).toHaveLength(1);
  expect(initialProjects[0]?.expectedSha).toBeNull();
  await expect(page.getByRole('heading', { name: 'Review conflicting changes' })).toBeVisible();
  const conflictDetails = page
    .locator('.cms-editor-conflicts details')
    .filter({ hasText: `content/projects/${slug}.json` });
  await conflictDetails.locator('summary').click();
  await expect(conflictDetails.locator('pre').nth(0)).toContainText(
    'Remote server version for the new slug.',
  );
  await expect(conflictDetails.locator('pre').nth(1)).toContainText(
    'A local version kept through conflict review.',
  );

  await page.getByRole('button', { name: 'Use reviewed versions as baseline' }).click();
  const baselineDialog = page.getByRole('dialog');
  await expect(
    baselineDialog.getByRole('heading', { name: 'Use reviewed versions as baseline?' }),
  ).toBeVisible();
  await baselineDialog.getByRole('button', { name: 'Use reviewed versions', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Reviewed versions are the new baseline.' }),
  ).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Content editor' })).toBeVisible();
  await page.getByLabel('Choose a project').selectOption(slug);
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Locally drafted project');
  await expect(page.getByLabel('Summary', { exact: true })).toHaveValue(
    'A local version kept through conflict review.',
  );
  expect(finalizations).toBe(1);
  await submitAllChanges(page);
  expect(finalizations).toBe(2);
  expect(postedKinds).toEqual(['finalize', 'finalize']);

  const retry = finalizationBodies[1] as {
    projects: {
      upsert: Array<{ slug: string; expectedSha: string | null; data: { title: string } }>;
    };
  };
  const matchingProjects = retry.projects.upsert.filter((project) => project.slug === slug);
  expect(matchingProjects).toHaveLength(1);
  expect(matchingProjects[0]?.expectedSha).toBe(remoteSha);
  expect(matchingProjects[0]?.data.title).toBe('Locally drafted project');

  const submittedSnapshot = await page.evaluate(async () => {
    const response = await fetch('/api/cms');
    return response.json();
  });
  expect(
    submittedSnapshot.projects.filter((project: { slug: string }) => project.slug === slug),
  ).toHaveLength(1);
  expect(
    submittedSnapshot.projects.find((project: { slug: string }) => project.slug === slug).data
      .title,
  ).toBe('Locally drafted project');
  await context.close();
});

test('repository drift keeps the draft and prevents rebasing it onto another target', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL });
  await addOwnerCookie(context);
  let finalizations = 0;
  await context.route('**/api/cms', async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      if (body.kind === 'finalize') {
        finalizations += 1;
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'The content repository or default branch changed after you opened this draft.',
            code: 'conflict',
            conflicts: [{ path: '@repository' }],
          }),
        });
        return;
      }
    }
    await route.continue();
  });

  const page = await context.newPage();
  const editor = new CmsEditorPage(page);
  await editor.open();
  await page.getByLabel('Choose a project').selectOption('fixture-project');
  await page.getByLabel('Summary', { exact: true }).fill('Kept while repository settings drift.');
  await page.getByRole('button', { name: 'Save project draft', exact: true }).click();
  await submitAllChanges(page);

  const conflicts = page.locator('.cms-editor-conflicts');
  await expect(
    conflicts.getByRole('heading', { name: 'Review conflicting changes' }),
  ).toBeVisible();
  await expect(
    conflicts.getByText(
      'Return to the repository and branch where this draft was created, or discard the draft before editing the new target.',
    ),
  ).toBeVisible();
  await expect(
    conflicts.getByRole('button', { name: 'Use reviewed versions as baseline' }),
  ).toBeDisabled();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Content editor' })).toBeVisible();
  await page.getByLabel('Choose a project').selectOption('fixture-project');
  await expect(page.getByLabel('Summary', { exact: true })).toHaveValue(
    'Kept while repository settings drift.',
  );
  expect(finalizations).toBe(1);
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
    { button: 'Images', heading: 'Images', id: 'images', control: 'Choose images' },
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
    await projectsPanel.getByRole('button', { name: 'Add project to draft' }).click();
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
