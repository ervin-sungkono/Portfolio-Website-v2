import { expect, test, type Locator, type Page } from '@playwright/test';

test.use({
  hasTouch: true,
  isMobile: true,
  reducedMotion: 'no-preference',
  viewport: { width: 390, height: 844 },
});

type Box = { x: number; y: number; width: number; height: number };
type ScrollRange = { start: number; end: number; header: number; viewport: number };

const imageStub = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/nWQAAAAASUVORK5CYII=',
  'base64',
);

function hero(page: Page) {
  const root = page.locator('[data-scroll-scene]');
  const visualScene = root.locator('.scroll-hero-visual-scene');
  const firstSlide = root.locator('[data-hero-screenshot]');
  const nextSlide = root.locator('[data-hero-placeholder]');

  return {
    root,
    visualScene,
    stack: visualScene.locator('.scroll-hero-visual-stack'),
    copy: root.locator('[data-parallax="copy"]'),
    firstSlide,
    nextSlide,
    firstLink: firstSlide.locator('a.hero-visual'),
    nextLink: nextSlide.locator('a.hero-visual'),
  };
}

async function stubRemoteImages(page: Page) {
  await page.route(/https:\/\/(?:raw\.githubusercontent\.com|cdn\.dribbble\.com)\//, (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: imageStub }),
  );
}

async function box(locator: Locator): Promise<Box> {
  const bounds = await locator.boundingBox();
  if (!bounds) {
    throw new Error('Expected a visible mobile hero element with a bounding box.');
  }
  return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
}

async function scrollInstantly(page: Page, y: number) {
  await page.evaluate((top) => {
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, top);
  }, y);
}

async function scrollRange(page: Page): Promise<ScrollRange> {
  return hero(page).visualScene.evaluate((scene) => {
    const bounds = scene.getBoundingClientRect();
    const stack = scene.querySelector<HTMLElement>('.scroll-hero-visual-stack');
    const header = document.querySelector('.site-header');
    if (!stack) {
      throw new Error('Expected the mobile hero visual stack inside its scene.');
    }
    const headerHeight = header?.getBoundingClientRect().height ?? 0;
    return {
      start: bounds.top + window.scrollY - headerHeight,
      end: bounds.bottom + window.scrollY - headerHeight - stack.getBoundingClientRect().height,
      header: headerHeight,
      viewport: window.innerHeight,
    };
  });
}

async function reservedTravel(page: Page) {
  return hero(page).visualScene.evaluate((scene) => {
    const stack = scene.querySelector<HTMLElement>('.scroll-hero-visual-stack');
    if (!stack) {
      throw new Error('Expected the mobile hero visual stack inside its scene.');
    }
    return scene.getBoundingClientRect().height - stack.getBoundingClientRect().height;
  });
}

async function opacity(locator: Locator) {
  return locator.evaluate((element) => Number.parseFloat(getComputedStyle(element).opacity));
}

async function expectActiveSlide(page: Page, active: 'first' | 'next') {
  const { root, firstSlide, nextSlide, firstLink, nextLink } = hero(page);
  if (active === 'first') {
    await expect(firstSlide).not.toHaveAttribute('inert');
    await expect(firstSlide).not.toHaveAttribute('aria-hidden', 'true');
    await expect(nextSlide).toHaveAttribute('inert', '');
    await expect(nextSlide).toHaveAttribute('aria-hidden', 'true');
    await expect(root.getByRole('link', { name: /WeTrack App/ })).toHaveCount(1);
    await expect(root.getByRole('link', { name: /ChatGPT Clone/ })).toHaveCount(0);
    await expect(firstLink).toHaveCSS('pointer-events', 'auto');
    await expect(nextLink).toHaveCSS('pointer-events', 'none');
    return;
  }

  await expect(firstSlide).toHaveAttribute('inert', '');
  await expect(firstSlide).toHaveAttribute('aria-hidden', 'true');
  await expect(nextSlide).not.toHaveAttribute('inert');
  await expect(nextSlide).not.toHaveAttribute('aria-hidden', 'true');
  await expect(root.getByRole('link', { name: /WeTrack App/ })).toHaveCount(0);
  await expect(root.getByRole('link', { name: /ChatGPT Clone/ })).toHaveCount(1);
  await expect(firstLink).toHaveCSS('pointer-events', 'none');
  await expect(nextLink).toHaveCSS('pointer-events', 'auto');
}

async function expectNoMobileReserve(page: Page) {
  await expect(hero(page).root).toHaveAttribute('data-mobile-pinned', 'false');
  await expect.poll(() => reservedTravel(page)).toBeLessThanOrEqual(2);
  await expect(hero(page).stack).not.toHaveCSS('position', 'sticky');
}

test('crossfades mobile previews over native scroll while copy stays in flow', async ({ page }) => {
  await stubRemoteImages(page);
  await page.goto('/');

  const { root, visualScene, stack, copy, firstSlide, nextSlide } = hero(page);
  await expect(root).toHaveAttribute('data-pinned', 'false');
  await expect(root).toHaveAttribute('data-mobile-pinned', 'true');
  await expect(stack).toHaveCSS('position', 'sticky');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(copy).toHaveCSS('opacity', '1');
  await expectActiveSlide(page, 'first');

  const range = await scrollRange(page);
  const travel = range.end - range.start;
  expect(travel).toBeGreaterThan(range.viewport * 0.4);
  expect(travel).toBeLessThan(range.viewport * 0.6);
  expect(await reservedTravel(page)).toBeGreaterThan(range.viewport * 0.4);

  await scrollInstantly(page, range.start);
  await expect.poll(() => opacity(firstSlide)).toBeGreaterThan(0.98);
  await expect.poll(() => opacity(nextSlide)).toBeLessThan(0.02);
  const startStack = await box(stack);
  const startCopy = await box(page.getByRole('heading', { level: 1 }));
  expect(Math.abs(startStack.y - range.header)).toBeLessThanOrEqual(2);

  await scrollInstantly(page, range.start + travel * 0.25);
  await expect.poll(() => opacity(firstSlide)).toBeGreaterThan(0.5);
  await expect.poll(() => opacity(nextSlide)).toBeLessThan(0.5);
  await expectActiveSlide(page, 'first');

  await scrollInstantly(page, range.start + travel * 0.55);
  await expect.poll(() => opacity(firstSlide)).toBeLessThan(0.5);
  await expect.poll(() => opacity(nextSlide)).toBeGreaterThan(0.5);
  await expectActiveSlide(page, 'next');
  const middleStack = await box(stack);
  const middleCopy = await box(page.getByRole('heading', { level: 1 }));
  expect(Math.abs(middleStack.y - startStack.y)).toBeLessThanOrEqual(2);
  expect(Math.abs(middleCopy.y - startCopy.y)).toBeGreaterThan(travel * 0.3);

  await scrollInstantly(page, range.start + travel * 0.9);
  await expect.poll(() => opacity(firstSlide)).toBeLessThan(0.02);
  await expect.poll(() => opacity(nextSlide)).toBeGreaterThan(0.98);
  await expectActiveSlide(page, 'next');
  const lateStack = await box(stack);
  expect(Math.abs(lateStack.y - startStack.y)).toBeLessThanOrEqual(2);

  await scrollInstantly(page, range.start + travel * 0.25);
  await expect.poll(() => opacity(firstSlide)).toBeGreaterThan(0.5);
  await expect.poll(() => opacity(nextSlide)).toBeLessThan(0.5);
  await expectActiveSlide(page, 'first');

  await page.getByRole('heading', { name: 'Selected Projects.' }).scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(range.start + travel * 0.25);
  await expect(page.getByRole('heading', { name: 'Selected Projects.' })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => window.innerWidth),
  );
  await expect(visualScene).toBeVisible();
});

test('responds to a native touch swipe without intercepting page scrolling', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Touch input is dispatched through the Chromium protocol.');
  await stubRemoteImages(page);
  await page.goto('/');
  await expect(hero(page).root).toHaveAttribute('data-mobile-pinned', 'true');
  const range = await scrollRange(page);
  await scrollInstantly(page, range.start);
  await expect.poll(() => opacity(hero(page).firstSlide)).toBeGreaterThan(0.98);
  const session = await context.newCDPSession(page);
  const x = 195;
  const startY = range.viewport * 0.85;
  const endY = range.viewport * 0.2;
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y: startY }],
  });
  for (let step = 1; step <= 12; step++) {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: startY + ((endY - startY) * step) / 12 }],
    });
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect
    .poll(() => page.evaluate(() => scrollY))
    .toBeGreaterThan(range.start + (range.end - range.start) * 0.8);
  await expect.poll(() => opacity(hero(page).nextSlide)).toBeGreaterThan(0.98);
  await expectActiveSlide(page, 'next');
  await session.detach();
});

test('keeps the mobile preview fitted across narrow widths and both themes', async ({ page }) => {
  await stubRemoteImages(page);
  await page.goto('/');

  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    await expect(page.locator('html')).toHaveAttribute('data-theme', colorScheme);

    for (const width of [320, 390, 430, 820]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(hero(page).root).toHaveAttribute('data-mobile-pinned', 'true');
      await expect(hero(page).stack).toHaveCSS('position', 'sticky');
      const stackBox = await box(hero(page).stack);
      expect(stackBox.x).toBeGreaterThanOrEqual(0);
      expect(stackBox.x + stackBox.width).toBeLessThanOrEqual(width + 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
    }
  }
});

test('releases mobile preview travel when the viewport or preview cannot fit', async ({ page }) => {
  await stubRemoteImages(page);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/');
  await expectNoMobileReserve(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(hero(page).root).toHaveAttribute('data-mobile-pinned', 'true');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expectNoMobileReserve(page);

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(hero(page).root).toHaveAttribute('data-mobile-pinned', 'true');
  await page.addStyleTag({ content: 'html { font-size: 500% !important; }' });
  await expectNoMobileReserve(page);
});

test('holds a focused mobile project preview until focus leaves', async ({ page }) => {
  await stubRemoteImages(page);
  await page.goto('/');

  const { firstLink, firstSlide, nextSlide } = hero(page);
  await expect(hero(page).root).toHaveAttribute('data-mobile-pinned', 'true');
  await firstLink.focus();
  await expect(firstLink).toBeFocused();

  const range = await scrollRange(page);
  await scrollInstantly(page, range.start + (range.end - range.start) * 0.85);
  await expect(firstSlide).not.toHaveAttribute('inert');
  await expect(nextSlide).toHaveAttribute('inert', '');
  await expect(firstLink).toBeFocused();
  await expect.poll(() => opacity(firstSlide)).toBeGreaterThan(0.98);
  await expect.poll(() => opacity(nextSlide)).toBeLessThan(0.02);

  await firstLink.evaluate((link) => link.blur());
  await expect(nextSlide).not.toHaveAttribute('inert');
  await expect(firstSlide).toHaveAttribute('inert', '');
  await expect.poll(() => opacity(nextSlide)).toBeGreaterThan(0.98);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('keeps the first preview usable without reserving mobile scroll travel', async ({
    page,
  }) => {
    await stubRemoteImages(page);
    await page.goto('/');

    const { root, firstSlide, nextSlide, firstLink } = hero(page);
    await expect(root).toHaveAttribute('data-pinned', 'false');
    await expect(root).toHaveAttribute('data-mobile-pinned', 'false');
    await expect(firstLink).toHaveAttribute('href', '/project/wetrack-app');
    await expect(firstLink).toBeVisible();
    await expect(firstSlide).not.toHaveAttribute('inert');
    await expect(nextSlide).toHaveAttribute('inert', '');
    await expectNoMobileReserve(page);
    await expect(
      firstLink.getByAltText('WeTrack Kanban board with tasks organised into sprints'),
    ).toBeVisible();
  });
});
