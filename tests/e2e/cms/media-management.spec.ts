import { expect, test } from '@playwright/test';
import { cmsCookieName, cmsPatUserId, cmsSessionCookie } from '../../support/cms-fixture';

test('reviews a committed image deletion before publishing it once', async ({ page, context }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
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
  const path = 'media/technologies/unreferenced.svg';
  const finalizations: unknown[] = [];
  page.on('request', (request) => {
    if (request.method() !== 'POST' || !request.url().endsWith('/api/cms')) {
      return;
    }
    const body = request.postDataJSON() as { kind?: string };
    if (body.kind === 'finalize') {
      finalizations.push(body);
    }
  });

  await page.goto('/admin');
  await page.getByRole('button', { name: 'Images', exact: true }).click();
  const card = page
    .getByRole('list', { name: 'Repository images' })
    .locator('li')
    .filter({ hasText: path });
  await expect(card).toBeVisible();
  const imageGrid = page.getByRole('list', { name: 'Repository images' });
  const imageLayout = await imageGrid.evaluate((grid) => {
    const workspace = grid.closest<HTMLElement>('.cms-editor-workspace');
    const originalCards = Array.from(grid.children);
    if (!workspace || !originalCards.length) {
      return false;
    }
    for (let index = 0; index < 12; index += 1) {
      grid.append(originalCards[index % originalCards.length].cloneNode(true));
    }
    workspace.scrollTop = workspace.scrollHeight;
    const unspanned = Array.from(grid.children).every((item) => {
      const style = getComputedStyle(item);
      return style.gridColumnStart === 'auto' && style.gridColumnEnd === 'auto';
    });
    const expandsAndScrolls =
      getComputedStyle(grid).gridAutoRows === 'auto' &&
      getComputedStyle(grid).maxHeight === 'none' &&
      getComputedStyle(workspace).overflowY === 'auto' &&
      workspace.scrollHeight > workspace.clientHeight &&
      workspace.scrollTop > 0;
    grid.replaceChildren(...originalCards);
    workspace.scrollTop = 0;
    return unspanned && expandsAndScrolls;
  });
  expect(imageLayout).toBe(true);
  await card.getByRole('button', { name: 'Delete unreferenced.svg' }).click();
  const deletion = page.getByRole('dialog', { name: 'Delete this repository image?' });
  await deletion.getByRole('button', { name: 'Stage image deletion' }).click();
  await expect(card.getByText('Pending deletion')).toBeVisible();
  expect(finalizations).toHaveLength(0);

  await page.getByRole('button', { name: 'Submit draft' }).click();
  let review = page.getByRole('dialog', { name: 'Submit all changes?' });
  await expect(review).toContainText(path);
  await review.getByRole('button', { name: 'Cancel' }).click();
  expect(finalizations).toHaveLength(0);
  await expect(card.getByText('Pending deletion')).toBeVisible();

  await page.getByRole('button', { name: 'Submit draft' }).click();
  review = page.getByRole('dialog', { name: 'Submit all changes?' });
  await review.getByRole('button', { name: 'Submit changes' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'All changes were submitted in one commit.' }),
  ).toBeVisible();
  expect(finalizations).toHaveLength(1);
  expect(finalizations[0]).toMatchObject({ deleteMedia: [{ path }] });
  const response = await page.request.get('/api/cms/media');
  expect(response.ok()).toBeTruthy();
  const result = (await response.json()) as { media: Array<{ path: string }> };
  expect(result.media.some((image) => image.path === path)).toBe(false);
});
