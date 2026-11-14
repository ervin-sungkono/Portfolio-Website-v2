import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { CmsEditorPage } from '../../support/cms-editor-page';
import {
  cmsBaseUrl,
  cmsCookieName,
  cmsPatUserId,
  cmsSessionCookie,
} from '../../support/cms-fixture';

const markdown =
  '# GFM article\n\n| Feature | Status |\n| --- | --- |\n| Tables | Ready |\n\n- [x] Complete\n- [ ] Pending\n\n~~Old text~~\n\n```ts\nconst ready = true;\n```\n';

async function owner(context: BrowserContext) {
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

async function writePost(page: Page, slug: string, saveToDraft = true) {
  await page.getByRole('button', { name: 'Blog Posts', exact: true }).click();
  await page.getByRole('button', { name: 'Add post', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Add blog post' });
  await dialog.getByLabel('Blog post URL slug').fill(slug);
  await dialog.getByLabel('Title', { exact: true }).fill('Browser GFM Article');
  await dialog
    .getByLabel('Summary', { exact: true })
    .fill('Markdown content managed through the existing CMS draft.');
  await dialog.getByLabel('Published on the public site').check();
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await dialog.getByRole('textbox', { name: 'Markdown body' }).fill(markdown);
  await expect(dialog.getByRole('table')).toHaveCount(1);
  await expect(dialog.getByRole('checkbox')).toHaveCount(2);
  await expect(dialog.locator('del')).toHaveText('Old text');
  await expect(dialog.locator('pre')).toContainText('const ready = true;');
  if (saveToDraft) {
    await dialog.getByRole('button', { name: 'Save post draft' }).click();
    await expect(
      page.getByRole('dialog').getByText('Blog post saved to the browser draft.'),
    ).toBeVisible();
  }
  await page.keyboard.press('Escape');
}

async function submit(page: Page) {
  await page.getByRole('button', { name: 'Submit draft', exact: true }).click();
  const review = page.getByRole('dialog');
  await expect(review.getByRole('heading', { name: 'Changes to publish' })).toBeVisible();
  await review.getByRole('button', { name: 'Submit changes', exact: true }).click();
}

test('GFM posts share the reviewed atomic draft and retry only public refresh', async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const context = await browser.newContext({ baseURL: cmsBaseUrl });
  await owner(context);
  let finalizations = 0;
  let refreshes = 0;
  const bodies: Array<Record<string, unknown>> = [];
  await context.route('**/api/cms', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    const body = route.request().postDataJSON();
    if (body.kind === 'finalize') {
      finalizations += 1;
      bodies.push(body);
      const response = await route.fetch();
      await route.fulfill({ response, json: { ...(await response.json()), cache: 'pending' } });
      return;
    }
    if (body.kind === 'revalidate') {
      refreshes += 1;
    }
    await route.continue();
  });
  const page = await context.newPage();
  const editor = new CmsEditorPage(page);
  const slug = 'browser-gfm-post';
  const before = await context.request.get(`${cmsBaseUrl}/blog/${slug}`);
  expect(before.status()).toBe(404);
  await editor.open();
  await writePost(page, slug);
  const project = await editor.openProjectForm('fixture-project');
  const originalSummary = await project.getByLabel('Summary', { exact: true }).inputValue();
  await project
    .getByLabel('Summary', { exact: true })
    .fill('Project and blog changes in the same submission.');
  await page.keyboard.press('Escape');
  expect(finalizations).toBe(0);
  await page.getByRole('button', { name: 'Submit draft', exact: true }).click();
  const review = page.getByRole('dialog');
  await expect(review.getByRole('heading', { name: 'Blog posts', exact: true })).toBeVisible();
  await expect(review.getByText(`Add: Browser GFM Article (${slug})`)).toBeVisible();
  await review.getByRole('button', { name: 'Submit changes', exact: true }).click();
  await expect(page.getByText(/Public refresh is pending/)).toBeVisible();
  expect(finalizations).toBe(1);
  const expectedPost = expect.objectContaining({
    slug,
    data: expect.objectContaining({ body: markdown }),
  });
  expect(bodies[0]).toMatchObject({
    projects: { upsert: [expect.objectContaining({ slug: 'fixture-project' })] },
    posts: {
      upsert: [expectedPost],
    },
  });
  await page.getByRole('button', { name: 'Retry public refresh' }).click();
  await expect(page.getByRole('button', { name: 'Retry public refresh' })).toHaveCount(0);
  expect(finalizations).toBe(1);
  expect(refreshes).toBe(1);

  const noScript = await browser.newContext({ baseURL: cmsBaseUrl, javaScriptEnabled: false });
  const article = await noScript.newPage();
  await expect.poll(async () => (await article.goto(`/blog/${slug}`))?.status()).toBe(200);
  await expect(article.locator('main h1')).toHaveText('Browser GFM Article');
  await expect(article.getByRole('table')).toHaveCount(1);
  await expect(article.getByRole('checkbox')).toHaveCount(2);
  await expect(article.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article');
  await expect(article.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    `https://ervincs.com/blog/${slug}`,
  );
  await article.screenshot({
    path: test.info().outputPath('published-article.png'),
    fullPage: true,
  });
  await article.goto('/blog');
  await expect(
    article.getByRole('link', { name: 'Browser GFM Article', exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () => (await context.request.get(`${cmsBaseUrl}/sitemap.xml`)).text(), {
      timeout: 30_000,
      intervals: [250, 500, 1_000, 2_000],
    })
    .toContain(`/blog/${slug}`);

  await page.getByRole('button', { name: 'Blog Posts', exact: true }).click();
  await page.getByRole('button', { name: 'Edit post Browser GFM Article', exact: true }).click();
  const edit = page.getByRole('dialog', { name: 'Edit blog post' });
  await edit.getByLabel('Published on the public site').uncheck();
  await page.keyboard.press('Escape');
  await submit(page);
  await expect
    .poll(async () => (await context.request.get(`${cmsBaseUrl}/blog/${slug}`)).status())
    .toBe(404);
  await page.getByRole('button', { name: 'Retry public refresh' }).click();
  await expect(page.getByRole('button', { name: 'Retry public refresh' })).toHaveCount(0);
  await expect
    .poll(async () => (await context.request.get(`${cmsBaseUrl}/sitemap.xml`)).text())
    .not.toContain(`/blog/${slug}`);
  const restore = await editor.openProjectForm('fixture-project');
  await restore.getByLabel('Summary', { exact: true }).fill(originalSummary);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Blog Posts', exact: true }).click();
  await page.getByRole('button', { name: 'Delete post Browser GFM Article', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remove post', exact: true }).click();
  await submit(page);
  await expect.poll(() => finalizations).toBe(3);
  await expect(page.getByText(/Public refresh is pending/)).toBeVisible();
  const snapshot = await (await context.request.get(`${cmsBaseUrl}/api/cms`)).json();
  expect(snapshot.posts.some((post: { slug: string }) => post.slug === slug)).toBe(false);
  await noScript.close();
  await context.close();
});

test('blog drafts survive reload with GFM source and keyboard navigation', async ({ browser }) => {
  const context = await browser.newContext({ baseURL: cmsBaseUrl });
  await owner(context);
  const page = await context.newPage();
  const editor = new CmsEditorPage(page);
  await editor.open();
  await writePost(page, 'reload-gfm-post');
  await page.reload();
  await page.getByRole('button', { name: 'Blog Posts', exact: true }).click();
  const postRow = page.getByRole('row').filter({ hasText: 'reload-gfm-post' });
  await postRow.getByRole('button', { name: 'Edit post Browser GFM Article', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit blog post' });
  const title = dialog.getByLabel('Title', { exact: true });
  await title.fill('Temporary title');
  await title.fill('Browser GFM Article');
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  const body = dialog.getByRole('textbox', { name: 'Markdown body' });
  await expect(body).toHaveValue(markdown);
  await body.focus();
  await page.keyboard.press('Tab');
  await expect(body).not.toBeFocused();
  for (const theme of ['light', 'dark'] as const) {
    await page.keyboard.press('Escape');
    await editor.selectTheme(theme);
    await postRow
      .getByRole('button', { name: 'Edit post Browser GFM Article', exact: true })
      .click();
    const opened = page.getByRole('dialog', { name: 'Edit blog post' });
    await opened.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: test.info().outputPath(`markdown-${theme}-mobile.png`) });
  }
  await context.close();
});

test('a new post conflict retains Markdown and requires an explicit reviewed SHA', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: cmsBaseUrl });
  await owner(context);
  const slug = 'conflicted-blog-post';
  const remoteSha = 'a'.repeat(40);
  const remote = {
    schemaVersion: 1,
    title: 'A remote article',
    summary: 'A post appeared after the editor loaded.',
    body: 'Remote Markdown content.',
    published: false,
    publishedAt: '2026-11-14',
  };
  let remoteVisible = false;
  const submissions: Array<{
    posts: { upsert: Array<{ slug: string; expectedSha: string | null; data: { body: string } }> };
  }> = [];
  await context.route('**/api/cms', async (route) => {
    if (route.request().method() === 'GET') {
      const response = await route.fetch();
      const snapshot = await response.json();
      const posts = remoteVisible
        ? [...snapshot.posts, { slug, sha: remoteSha, data: remote }]
        : snapshot.posts;
      await route.fulfill({ response, json: { ...snapshot, posts } });
      return;
    }
    const body = route.request().postDataJSON();
    if (body.kind === 'finalize') {
      submissions.push(body);
      remoteVisible = true;
      await route.fulfill({
        status: submissions.length === 1 ? 409 : 503,
        json:
          submissions.length === 1
            ? {
                error: 'The post changed after the editor loaded.',
                conflicts: [{ path: `content/posts/${slug}.json` }],
              }
            : { error: 'Fixture stopped before writing.' },
      });
      return;
    }
    await route.continue();
  });
  const page = await context.newPage();
  const editor = new CmsEditorPage(page);
  await editor.open();
  await writePost(page, slug);
  await submit(page);
  await expect(page.getByRole('heading', { name: 'Review conflicting changes' })).toBeVisible();
  const detail = page
    .locator('.cms-editor-conflicts details')
    .filter({ hasText: `content/posts/${slug}.json` });
  await detail.locator('summary').click();
  await expect(detail.locator('pre').nth(0)).toContainText(remote.body);
  await expect(detail.locator('pre').nth(1)).toContainText('GFM article');
  expect(submissions).toHaveLength(1);
  expect(submissions[0].posts.upsert[0].expectedSha).toBeNull();
  await page.getByRole('button', { name: 'Use reviewed versions as baseline' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Use reviewed versions', exact: true })
    .click();
  await expect(
    page.getByText('Reviewed versions are the new baseline. Submit again when ready.'),
  ).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Blog Posts', exact: true }).click();
  await page
    .getByRole('row')
    .filter({ hasText: slug })
    .getByRole('button', { name: /^Edit post/ })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Edit blog post' });
  await expect(dialog.getByLabel('Title', { exact: true })).toHaveValue('Browser GFM Article');
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(dialog.getByRole('textbox', { name: 'Markdown body' })).toHaveValue(markdown);
  await page.keyboard.press('Escape');
  expect(submissions).toHaveLength(1);
  await submit(page);
  await expect(page.getByText('Fixture stopped before writing.')).toBeVisible();
  expect(submissions).toHaveLength(2);
  expect(submissions[1].posts.upsert).toHaveLength(1);
  expect(submissions[1].posts.upsert[0]).toMatchObject({
    slug,
    expectedSha: remoteSha,
    data: { body: markdown },
  });
  await context.close();
});

test('clearing a restored new-post slug cannot submit its previous URL', async ({ browser }) => {
  const context = await browser.newContext({ baseURL: cmsBaseUrl });
  await owner(context);
  const page = await context.newPage();
  const editor = new CmsEditorPage(page);
  let finalizations = 0;
  page.on('request', (request) => {
    if (
      request.url().endsWith('/api/cms') &&
      request.method() === 'POST' &&
      request.postDataJSON().kind === 'finalize'
    ) {
      finalizations += 1;
    }
  });
  await editor.open();
  await writePost(page, 'cleared-new-post-slug', false);
  await page.reload();
  await page.getByRole('button', { name: 'Blog Posts', exact: true }).click();
  await page.getByRole('button', { name: 'Add post', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Add blog post' });
  await expect(dialog.getByLabel('Blog post URL slug')).toHaveValue('cleared-new-post-slug');
  await dialog.getByLabel('Blog post URL slug').fill('');
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const response = await (
          await caches.open('portfolio-cms-draft-v1')
        ).match('/__portfolio-cms-draft__/state');
        return (await response?.json())?.newPost?.slug;
      }),
    )
    .toBe('');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Submit draft', exact: true }).click();
  await expect(page.getByText('Enter a valid blog post URL slug before submitting.')).toBeVisible();
  expect(finalizations).toBe(0);
  await page.reload();
  await page.getByRole('button', { name: 'Blog Posts', exact: true }).click();
  await page.getByRole('button', { name: 'Add post', exact: true }).click();
  await expect(page.getByRole('dialog').getByLabel('Blog post URL slug')).toHaveValue('');
  await expect(page.getByRole('dialog').getByLabel('Title', { exact: true })).toHaveValue(
    'Browser GFM Article',
  );
  await context.close();
});

test('global submission replaces a staged post deletion using its original SHA', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: cmsBaseUrl });
  await owner(context);
  const before = await (await context.request.get('/api/cms')).json();
  const repositoryKey = `${before.repository.owner}/${before.repository.name}@${before.repository.defaultBranch}`;
  const slug = 'reused-post-slug';
  const seeded = await context.request.post('/api/cms', {
    headers: { Origin: cmsBaseUrl },
    data: {
      kind: 'finalize',
      repositoryKey,
      projects: { upsert: [], delete: [] },
      posts: {
        upsert: [
          {
            slug,
            expectedSha: null,
            data: {
              schemaVersion: 1,
              title: 'Reusable article',
              summary: 'Original summary.',
              body: 'Original Markdown.',
              published: false,
              publishedAt: '2026-11-14',
            },
          },
        ],
        delete: [],
      },
      media: [],
    },
  });
  expect(seeded.status()).toBe(200);
  const baseline = await (await context.request.get('/api/cms')).json();
  const originalSha = baseline.posts.find((post: { slug: string }) => post.slug === slug).sha;
  const page = await context.newPage();
  const editor = new CmsEditorPage(page);
  await editor.open();
  await page.getByRole('button', { name: 'Blog Posts', exact: true }).click();
  await page
    .getByRole('row')
    .filter({ hasText: slug })
    .getByRole('button', { name: /^Delete post/ })
    .click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remove post', exact: true }).click();
  await writePost(page, slug, false);
  await page.getByRole('button', { name: 'Add post', exact: true }).click();
  const restore = page.getByRole('dialog', { name: 'Add blog post' });
  await restore.getByLabel('Title', { exact: true }).fill('Reusable article');
  await restore.getByLabel('Summary', { exact: true }).fill('Original summary.');
  await restore.getByLabel('Publication date').fill('2026-11-14');
  await restore.getByLabel('Published on the public site').uncheck();
  await restore.getByRole('button', { name: 'Continue', exact: true }).click();
  await restore.getByRole('textbox', { name: 'Markdown body' }).fill('Original Markdown.');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Submit draft', exact: true }).click();
  await expect(page.getByText('There are no changes to submit.')).toBeVisible();
  const restoredRow = page.getByRole('row').filter({ hasText: slug });
  await expect(
    restoredRow.getByRole('button', { name: 'Edit post Reusable article' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit draft', exact: true })).toBeDisabled();
  await restoredRow.getByRole('button', { name: /^Delete post/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remove post', exact: true }).click();
  await writePost(page, slug, false);
  const submitted = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/cms') &&
      response.request().method() === 'POST' &&
      response.request().postDataJSON().kind === 'finalize',
  );
  await submit(page);
  const response = await submitted;
  expect(response.status()).toBe(200);
  const changes = response.request().postDataJSON().posts;
  expect(changes.delete).toEqual([]);
  expect(changes.upsert).toHaveLength(1);
  expect(changes.upsert[0]).toMatchObject({
    slug,
    expectedSha: originalSha,
    data: { body: markdown },
  });
  await expect(page.getByText(/All changes were submitted in one commit/)).toBeVisible();
  const current = await (await context.request.get('/api/cms')).json();
  const cleanup = await context.request.post('/api/cms', {
    headers: { Origin: cmsBaseUrl },
    data: {
      kind: 'finalize',
      repositoryKey,
      projects: { upsert: [], delete: [] },
      posts: {
        upsert: [],
        delete: [
          {
            slug,
            expectedSha: current.posts.find((post: { slug: string }) => post.slug === slug).sha,
          },
        ],
      },
      media: [],
    },
  });
  expect(cleanup.status()).toBe(200);
  await context.close();
});
