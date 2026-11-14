import { expect, test, type Locator, type Page } from '@playwright/test';

test.use({ reducedMotion: 'no-preference', viewport: { width: 1440, height: 1000 } });

async function heroRange(scene: Locator) {
  return scene.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const stage = element.querySelector('section')!;
    const top = Number.parseFloat(getComputedStyle(stage).top) || 0;
    const start = Math.max(0, bounds.top + window.scrollY - top);
    const end = Math.max(start, bounds.bottom + window.scrollY - window.innerHeight);
    const count = element.querySelectorAll('[data-hero-slide]').length;
    return { start, end, step: (end - start) / (count - 1) };
  });
}

async function expectScrollPosition(page: Page, position: number) {
  await expect
    .poll(async () => Math.abs((await page.evaluate(() => window.scrollY)) - position))
    .toBeLessThan(3);
}

for (const width of [1024, 1440]) {
  test(`wheel gestures scroll exactly one slide in their direction at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    const scene = page.locator('[data-scroll-scene]');
    const slides = scene.locator('[data-hero-slide]');
    const first = slides.nth(0);
    const second = slides.nth(1);
    const count = await slides.count();
    await expect(scene).toHaveAttribute('data-pinned', 'true');
    expect(count).toBeGreaterThanOrEqual(2);
    await expect(first).not.toHaveAttribute('inert');
    await expect(second).toHaveAttribute('inert', '');

    const range = await heroRange(scene);
    const expectAtSlide = async (index: number) => {
      await expectScrollPosition(page, range.start + range.step * index);
      await expect(slides.nth(index)).not.toHaveAttribute('inert');
    };
    const jump = async (top: number) => {
      await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), top);
    };
    const card = first.locator('a.hero-visual');
    const bounds = await card.boundingBox();
    expect(bounds).not.toBeNull();
    await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
    const visual = scene.locator('[data-parallax="visual"]');
    const beforeTransform = await visual.evaluate((element) => getComputedStyle(element).transform);
    await page.mouse.wheel(0, 25);
    await page.mouse.wheel(0, 25);
    await expectAtSlide(1);
    await expect(first).toHaveAttribute('inert', '');
    await expect
      .poll(() => visual.evaluate((element) => getComputedStyle(element).transform))
      .not.toBe(beforeTransform);

    if (count > 2) {
      await expect(slides.nth(2)).toHaveAttribute('inert', '');
      await page.waitForTimeout(260);
      await page.mouse.move(10, 500);
      await page.mouse.wheel(0, 25);
      await expectAtSlide(2);
      await page.waitForTimeout(260);
      await page.mouse.wheel(0, -25);
      await expectAtSlide(1);
    }

    await page.waitForTimeout(260);
    await jump(range.start + range.step * 0.15);
    await expect(first).not.toHaveAttribute('inert');
    await page.mouse.wheel(0, 25);
    await expectAtSlide(1);
    await page.waitForTimeout(260);
    await jump(range.start + range.step * 0.85);
    await expect(second).not.toHaveAttribute('inert');
    await page.mouse.wheel(0, -25);
    await expectAtSlide(0);

    await page.waitForTimeout(260);
    await jump(range.end);
    await expect(slides.nth(count - 1)).not.toHaveAttribute('inert');
    await page.waitForTimeout(260);
    await page.mouse.wheel(0, 350);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(range.end + 20);
    await expect(scene).toHaveCSS('overflow-x', 'visible');
    await expect(card.locator('img')).toHaveCSS('object-fit', 'contain');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
  });
}

test('a new gesture advances from the previous scroll target', async ({ page }) => {
  await page.goto('/');
  const scene = page.locator('[data-scroll-scene]');
  const slides = scene.locator('[data-hero-slide]');
  await expect(scene).toHaveAttribute('data-pinned', 'true');
  test.skip((await slides.count()) < 3, 'This check needs at least three featured projects.');
  const range = await heroRange(scene);
  const card = slides.first().getByRole('link');
  const bounds = await card.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
  await page.mouse.wheel(0, 40);
  await page.waitForTimeout(240);
  await page.mouse.wheel(0, 40);
  await expectScrollPosition(page, range.start + range.step * 2);
  await expect(slides.nth(2)).not.toHaveAttribute('inert');
});

test('allows nested scrollable content to consume wheel input', async ({ page }) => {
  await page.goto('/');
  const scene = page.locator('[data-scroll-scene]');
  await expect(scene).toHaveAttribute('data-pinned', 'true');
  await scene.locator('section').evaluate((stage) => {
    const scroller = document.createElement('div');
    scroller.dataset.testScroller = '';
    scroller.style.cssText =
      'position:fixed;z-index:10000;top:150px;right:20px;width:140px;height:100px;overflow:auto';
    const content = document.createElement('div');
    content.style.height = '400px';
    scroller.append(content);
    stage.append(scroller);
  });
  const scroller = page.locator('[data-test-scroller]');
  const bounds = await scroller.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
  const before = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 80);
  await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(before);
  await expect(scene.locator('[data-hero-slide="0"]')).not.toHaveAttribute('inert');
});

test('featured projects remain operable by keyboard without losing focus', async ({ page }) => {
  await page.goto('/');
  const scene = page.locator('[data-scroll-scene]');
  const slides = scene.locator('[data-hero-slide]');
  const carousel = page.getByRole('group', { name: 'Featured projects' });
  await expect(scene).toHaveAttribute('data-pinned', 'true');
  const range = await heroRange(scene);
  await expect(page.getByRole('button', { name: 'Next featured project' })).toHaveCount(0);
  const firstLink = slides.nth(0).getByRole('link');
  await firstLink.focus();
  const card = await firstLink.boundingBox();
  expect(card).not.toBeNull();
  await page.mouse.move(card!.x + card!.width / 2, card!.y + card!.height / 2);
  await page.mouse.wheel(0, 25);
  await expect(firstLink).toBeFocused();
  await expect(slides.nth(0)).not.toHaveAttribute('inert');
  await carousel.focus();
  await page.keyboard.press('ArrowRight');
  await expect(carousel).toBeFocused();
  await expect(slides.nth(1)).not.toHaveAttribute('inert');
  await expectScrollPosition(page, range.start + range.step);
  await page.keyboard.press('ArrowLeft');
  await expect(carousel).toBeFocused();
  await expect(slides.nth(0)).not.toHaveAttribute('inert');
  await expectScrollPosition(page, range.start);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(scene).toHaveAttribute('data-pinned', 'false');
  await carousel.focus();
  await page.keyboard.press('ArrowRight');
  await expect(slides.nth(1)).not.toHaveAttribute('inert');
  await expect(scene.getByRole('status')).toHaveText('Project 2 of 3');
});

test('selected project imagery retains its bounded scroll parallax', async ({ page }) => {
  await page.goto('/');
  const planes = page.locator('#projects article [data-parallax="image"]');
  await expect(planes).toHaveCount(3);
  await expect(planes.first()).toHaveAttribute('data-parallax-active', 'true');
  const plane = planes.first();
  const frame = plane.locator('xpath=..');
  const position = await frame.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return { top: bounds.top + window.scrollY, height: bounds.height, viewport: innerHeight };
  });
  const start = Math.max(0, position.top - position.viewport);
  const end = position.top + position.height;
  const offset = () =>
    plane.evaluate(
      (element) =>
        element.getBoundingClientRect().top - element.parentElement!.getBoundingClientRect().top,
    );
  await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), (start + end) / 2);
  const before = await offset();
  await page.mouse.wheel(0, 140);
  await expect.poll(offset).toBeLessThan(before - 1);
  const sizes = await plane.evaluate((element) => ({
    image: element.getBoundingClientRect().height,
    frame: element.parentElement!.getBoundingClientRect().height,
  }));
  expect(sizes.image).toBeGreaterThanOrEqual(sizes.frame);
});

test('hero falls back to normal flow with reduced motion or enlarged text', async ({ page }) => {
  await page.goto('/');
  const scene = page.locator('[data-scroll-scene]');
  await expect(scene).toHaveAttribute('data-pinned', 'true');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(scene).toHaveAttribute('data-pinned', 'false');
  await expect(page.locator('#projects article [data-parallax="image"]').first()).toHaveAttribute(
    'data-parallax-active',
    'false',
  );
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addStyleTag({ content: '.hero-copy h1 { font-size: 10rem; }' });
  await expect(scene).toHaveAttribute('data-pinned', 'false');
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('retains the first project link without nonfunctional slide controls', async ({ page }) => {
    await page.goto('/');
    const scene = page.locator('[data-scroll-scene]');
    await expect(scene).toHaveAttribute('data-pinned', 'false');
    await expect(scene.locator('[data-hero-slide="0"] a')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next featured project' })).toHaveCount(0);
    const stack = scene.locator('.scroll-hero-visual-stack');
    await stack.evaluate((element) => { element.scrollLeft = element.clientWidth; });
    await expect.poll(() => stack.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
    await expect(scene.locator('[data-hero-slide="1"] a')).toBeVisible();
  });
});

test.describe('touch fallback', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  test('keeps every featured project in a native horizontal scroll area', async ({ page }) => {
    await page.goto('/');
    const scene = page.locator('[data-scroll-scene]');
    const stack = scene.locator('.scroll-hero-visual-stack');
    await expect(scene).toHaveAttribute('data-pinned', 'false');
    await expect(stack).toHaveCSS('overflow-x', 'auto');
    await stack.evaluate((element) => { element.scrollLeft = element.clientWidth; });
    await expect.poll(() => stack.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
    await expect(scene.locator('[data-hero-slide="1"] a')).toBeVisible();
  });
});
