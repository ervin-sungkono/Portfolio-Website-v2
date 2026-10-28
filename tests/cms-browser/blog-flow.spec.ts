import { expect, test } from '@playwright/test';
import { addOwnerCookie, baseURL, selectTheme, waitForStatus } from './helpers';

test('owner drafts, publishes, unpublishes, and deletes Markdown posts without rebuilding', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL });
  const noScript = await browser.newContext({ baseURL, javaScriptEnabled: false });
  await addOwnerCookie(context);
  const page = await context.newPage();
  const publicPage = await noScript.newPage();
  const slug = 'browser-blog-post';
  const missing = await publicPage.goto(`/blog/${slug}`);
  expect(missing?.status()).toBe(404);
  await expect(publicPage.getByRole('link', { name: 'Read the Blog' })).toBeVisible();
  const hidden = await publicPage.goto('/blog/fixture-draft-post');
  expect(hidden?.status()).toBe(404);

  await page.goto('/admin');
  await page.getByRole('button', { name: 'Blog Posts', exact: true }).click();
  const panel = page.locator('#cms-editor-posts-panel');
  await panel.getByLabel('Choose a blog post').selectOption('');
  await panel.getByRole('textbox', { name: /^Blog post URL slug/ }).fill(slug);
  await panel.getByRole('button', { name: 'Create blog post' }).click();
  await expect(panel.locator('#cms-post-title-error')).toBeVisible();
  await expect(panel.getByRole('textbox', { name: /^Title/ })).toBeFocused();
  await panel.getByRole('textbox', { name: /^Title/ }).fill('Browser Blog Post');
  await panel
    .getByRole('textbox', { name: /^Summary/ })
    .fill('A post published through the existing CMS.');
  await panel.getByLabel('Publication date').fill('2026-10-28');
  await panel
    .getByRole('textbox', { name: /^Body/ })
    .fill(
      [
        '# Markdown introduction',
        '',
        'Paragraph with **strong text**, `inline code`, and [a safe link](https://example.com).',
        '',
        '- First item',
        '- Second item',
        '',
        '```js',
        'const example = true;',
        '```',
        '',
        '<script>window.blogInjected = true</script>',
        '',
        '[Unsafe link](javascript:alert%281%29)',
      ].join('\n'),
    );
  await panel.getByRole('button', { name: 'Create blog post' }).click();
  await expect(panel.getByRole('status')).toContainText('Blog post created.');
  await waitForStatus(context, `/blog/${slug}`, 404);
  await panel.getByLabel('Published on the public site').check();
  await panel.getByRole('button', { name: 'Save blog post' }).click();
  await expect(panel.getByRole('status')).toContainText('Blog post saved.');
  await expect(panel.getByRole('link', { name: 'View GitHub commit' })).toHaveAttribute(
    'href',
    /github\.com\/fixture-owner\/portfolio-content-fixture\/commit\//,
  );
  await waitForStatus(context, `/blog/${slug}`, 200);

  const published = await publicPage.goto(`/blog/${slug}`);
  expect(published?.status()).toBe(200);
  await expect(
    publicPage.getByRole('heading', { name: 'Browser Blog Post', level: 1 }),
  ).toBeVisible();
  await expect(
    publicPage.getByRole('heading', { name: 'Markdown introduction', level: 2 }),
  ).toBeVisible();
  await expect(publicPage.locator('main h1')).toHaveCount(1);
  await expect(publicPage.locator('.blog-body strong')).toHaveText('strong text');
  await expect(publicPage.locator('.blog-body pre code')).toContainText('const example = true;');
  await expect(publicPage.locator('.blog-body li')).toHaveCount(2);
  await expect(publicPage.locator('.blog-body script')).toHaveCount(0);
  await expect(publicPage.locator('.blog-body a[href^="javascript:"]')).toHaveCount(0);
  await expect(publicPage.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    `https://ervincs.com/blog/${slug}`,
  );
  await expect(publicPage.locator('meta[property="og:type"]')).toHaveAttribute(
    'content',
    'article',
  );
  await expect(publicPage.locator('main time')).toHaveAttribute('datetime', '2026-10-28');

  await publicPage.goto('/blog');
  await expect(publicPage.locator('.blog-post-card h2 a')).toHaveText([
    'Browser Blog Post',
    'First Fixture Post',
    'Last Fixture Post',
  ]);
  await expect(publicPage.getByText('Unpublished Fixture Post')).toHaveCount(0);
  const sitemap = await context.request.get('/sitemap.xml');
  expect(await sitemap.text()).toContain(`https://ervincs.com/blog/${slug}`);
  expect(await sitemap.text()).not.toContain('/blog/fixture-draft-post');

  await panel.getByLabel('Published on the public site').uncheck();
  await panel.getByRole('button', { name: 'Save blog post' }).click();
  await expect(panel.getByRole('status')).toContainText('Blog post saved.');
  await waitForStatus(context, `/blog/${slug}`, 404);
  const unpublished = await publicPage.goto(`/blog/${slug}`);
  expect(unpublished?.headers()['x-robots-tag']).toContain('noindex');
  await expect(publicPage.getByRole('heading', { name: 'This Page Isn’t Here.' })).toBeVisible();
  await expect
    .poll(async () =>
      (await (await context.request.get('/sitemap.xml')).text()).includes(`/blog/${slug}`),
    )
    .toBe(false);
  page.once('dialog', (dialog) => dialog.accept());
  await panel.getByRole('button', { name: 'Delete blog post' }).click();
  await expect(panel.getByRole('status')).toContainText(`Blog post “${slug}” was deleted.`);
  const snapshot = await (await context.request.get('/api/cms')).json();
  expect(snapshot.posts.some((post: { slug: string }) => post.slug === slug)).toBe(false);
  await context.close();
  await noScript.close();
});

test('post refresh retry avoids republishing and conflicts preserve section drafts and SHAs', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL });
  await addOwnerCookie(context);
  const page = await context.newPage();
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Blog Posts', exact: true }).click();
  const panel = page.locator('#cms-editor-posts-panel');
  await panel.getByLabel('Choose a blog post').selectOption('a-fixture-post');

  let writes = 0;
  let refreshTarget: unknown;
  await page.route('**/api/cms', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    const request = route.request().postDataJSON();
    if (request.kind === 'post') {
      writes++;
      const response = await route.fetch();
      await route.fulfill({ response, json: { ...(await response.json()), cache: 'pending' } });
      return;
    }
    if (request.kind === 'revalidate') {
      refreshTarget = request;
    }
    await route.continue();
  });
  await panel
    .getByRole('textbox', { name: /^Summary/ })
    .fill('Updated with a pending public refresh.');
  await panel.getByRole('button', { name: 'Save blog post' }).click();
  await expect(panel.getByRole('button', { name: 'Retry public refresh' })).toBeVisible();
  await panel.getByRole('button', { name: 'Retry public refresh' }).click();
  await expect(panel.getByRole('status')).toContainText('Public cache invalidation was accepted.');
  expect(writes).toBe(1);
  expect(refreshTarget).toEqual({ kind: 'revalidate', target: 'post', slug: 'a-fixture-post' });
  await page.unroute('**/api/cms');

  const stalePage = await context.newPage();
  await stalePage.goto('/admin');
  await stalePage.getByRole('button', { name: 'Blog Posts', exact: true }).click();
  const stalePanel = stalePage.locator('#cms-editor-posts-panel');
  await stalePanel.getByLabel('Choose a blog post').selectOption('a-fixture-post');
  await stalePanel.getByLabel('Title', { exact: true }).fill('Local unsaved post title');

  await panel.getByRole('textbox', { name: /^Summary/ }).fill('New remote revision.');
  await panel.getByRole('button', { name: 'Save blog post' }).click();
  await expect(panel.getByRole('status')).toContainText('Blog post saved.');

  await stalePage.getByRole('button', { name: 'Site Profile' }).click();
  await stalePage.getByLabel('Headline').fill('Unrelated profile update while a post draft exists');
  await stalePage.getByRole('button', { name: 'Save site profile' }).click();
  await expect(
    stalePage.getByRole('status').filter({ hasText: 'Site profile saved.' }),
  ).toBeVisible();
  await stalePage.getByRole('button', { name: 'Blog Posts', exact: true }).click();
  await expect(stalePanel.getByLabel('Title', { exact: true })).toHaveValue(
    'Local unsaved post title',
  );
  await stalePanel.getByRole('button', { name: 'Save blog post' }).click();
  await expect(stalePanel.getByRole('alert')).toContainText('Your draft is still here.');
  await expect(stalePanel.getByLabel('Title', { exact: true })).toHaveValue(
    'Local unsaved post title',
  );

  await stalePage.getByRole('button', { name: 'Projects', exact: true }).click();
  const projectPanel = stalePage.locator('#cms-editor-projects-panel');
  await projectPanel.getByLabel('Title', { exact: true }).fill('Keep this project draft');
  await stalePage.getByRole('button', { name: 'Blog Posts', exact: true }).click();
  await stalePanel
    .getByRole('button', { name: 'Reload repository version and discard this draft' })
    .click();
  await expect(stalePanel.getByLabel('Title', { exact: true })).toHaveValue('First Fixture Post');
  await expect(stalePanel.getByLabel('Summary', { exact: true })).toHaveValue(
    'New remote revision.',
  );
  await stalePage.getByRole('button', { name: 'Projects', exact: true }).click();
  await expect(projectPanel.getByLabel('Title', { exact: true })).toHaveValue(
    'Keep this project draft',
  );
  await context.close();
});

test('blog archive and Markdown detail reflow in both themes and support keyboard navigation', async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const theme of ['light', 'dark'] as const) {
    for (const width of [320, 390, 820, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of ['/blog', '/blog/a-fixture-post']) {
        await page.goto(path);
        await selectTheme(page, theme);
        await expect(page.locator('main h1')).toBeVisible();
        const sizes = await page.evaluate(() => ({
          width: innerWidth,
          content: document.documentElement.scrollWidth,
        }));
        expect(sizes.content, `${theme} ${width}px ${path}`).toBeLessThanOrEqual(sizes.width);
      }
      if (width === 320 || width === 1440) {
        await page.screenshot({
          path: testInfo.outputPath(`post-${width}-${theme}.png`),
          fullPage: true,
        });
      }
    }
  }
  await page.setViewportSize({ width: 390, height: 900 });
  const menu = page.getByRole('button', { name: 'Open menu' });
  await menu.focus();
  await page.keyboard.press('Enter');
  await expect(
    page
      .getByRole('navigation', { name: 'Primary' })
      .getByRole('link', { name: 'Blog', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Open menu' })).toBeFocused();
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  const enlarged = await page.evaluate(() => ({
    width: innerWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(enlarged.content).toBeLessThanOrEqual(enlarged.width);
  expect(errors).toEqual([]);
  await context.close();
});
