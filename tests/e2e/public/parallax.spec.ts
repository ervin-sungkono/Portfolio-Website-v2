import { expect, test, type Locator, type Page } from '@playwright/test';

test.use({ reducedMotion: 'no-preference', viewport: { width: 1440, height: 1000 } });

type Box = { x: number; y: number; width: number; height: number };

function hero(page: Page) {
  const scene = page.locator('[data-scroll-scene]');
  const slides = scene.locator('[data-hero-slide]');
  const firstState = slides.nth(0);
  const nextState = slides.nth(1);
  const firstLink = firstState.locator('a.hero-visual');
  const nextLink = nextState.locator('a.hero-visual');

  return {
    scene,
    slides,
    firstState,
    nextState,
    firstLink,
    nextLink,
    firstCaption: firstLink.locator('.hero-image-caption'),
    nextCaption: nextLink.locator('.hero-image-caption'),
    frame: firstLink.locator('.hero-image'),
    plane: firstLink.locator('[data-parallax="hero-image"]'),
  };
}

async function box(locator: Locator): Promise<Box> {
  const bounds = await locator.boundingBox();
  if (!bounds) {
    throw new Error('Expected a visible parallax element with a bounding box.');
  }
  return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
}

async function expectStableBoxes(reference: Record<string, Box>, current: Record<string, Box>) {
  for (const key of Object.keys(reference)) {
    for (const dimension of ['x', 'y', 'width', 'height'] as const) {
      expect(
        Math.abs(reference[key][dimension] - current[key][dimension]),
        `${key} ${dimension} should stay fixed while the hero scene is pinned`,
      ).toBeLessThanOrEqual(2);
    }
  }
}

async function readHeroBoxes(page: Page) {
  const elements: Array<[string, Locator]> = [
    ['copy', page.locator('[data-scroll-scene] [data-parallax="copy"]')],
    ['visualStack', page.locator('[data-scroll-scene] [data-parallax="visual"]')],
  ];
  const entries = await Promise.all(
    elements.map(async ([name, locator]) => [name, await box(locator)] as const),
  );
  return Object.fromEntries(entries) as Record<string, Box>;
}

async function cardMotion(locator: Locator) {
  return locator.evaluate((element) => {
    const card = element as HTMLElement;
    const style = getComputedStyle(card);
    const matrix = new DOMMatrixReadOnly(style.transform);
    const bounds = card.getBoundingClientRect();
    const [originX, originY] = style.transformOrigin.split(' ').map(Number.parseFloat);
    return {
      opacity: Number.parseFloat(style.opacity),
      translateX: matrix.m41,
      translateY: matrix.m42,
      rotation: (Math.atan2(matrix.m12, matrix.m11) * 180) / Math.PI,
      originX,
      originY,
      width: card.offsetWidth,
      height: card.offsetHeight,
      left: bounds.left,
      right: bounds.right,
    };
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
}

async function scrollInstantly(page: Page, y: number) {
  await page.evaluate((top) => {
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, top);
  }, y);
}

async function sceneScrollRange(page: Page) {
  return hero(page).scene.evaluate((scene) => {
    const bounds = scene.getBoundingClientRect();
    return {
      start: bounds.top + window.scrollY,
      end: bounds.bottom + window.scrollY - window.innerHeight,
    };
  });
}

async function opacity(locator: Locator) {
  return locator.evaluate((element) => Number.parseFloat(getComputedStyle(element).opacity));
}

async function expectPlaneCoversFrame(frame: Locator, plane: Locator) {
  const [frameBox, planeBox] = await Promise.all([box(frame), box(plane)]);
  expect(planeBox.x).toBeLessThanOrEqual(frameBox.x + 2);
  expect(planeBox.x + planeBox.width).toBeGreaterThanOrEqual(frameBox.x + frameBox.width - 2);
  expect(planeBox.y).toBeLessThanOrEqual(frameBox.y + 2);
  expect(planeBox.y + planeBox.height).toBeGreaterThanOrEqual(frameBox.y + frameBox.height - 2);
}

async function expectFlowFallback(page: Page) {
  const scene = hero(page).scene;
  await expect(scene).toHaveAttribute('data-pinned', 'false');
  await expect(hero(page).firstLink).toHaveAttribute('href', '/project/wetrack-app');
  await expect(hero(page).firstLink).toBeVisible();
  await expect(hero(page).firstState).not.toHaveAttribute('inert');
  await expect(hero(page).nextState).toHaveAttribute('inert', '');
  await expect(hero(page).nextState).toHaveAttribute('aria-hidden', 'true');
  await expect.poll(() => opacity(hero(page).firstState)).toBeGreaterThan(0.98);
  await expect.poll(() => opacity(hero(page).nextState)).toBeLessThan(0.02);

  const selectedPlanes = page.locator('#projects article [data-parallax="image"]');
  await expect(selectedPlanes).toHaveCount(3);
  for (const plane of await selectedPlanes.all()) {
    await expect(plane).toHaveAttribute('data-parallax-active', 'false');
  }

  const sceneBox = await box(scene);
  const stageBox = await box(scene.locator(':scope > section'));
  expect(Math.abs(sceneBox.height - stageBox.height)).toBeLessThanOrEqual(2);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

test('throws the outgoing hero card and floats the next card through reversible scroll', async ({
  page,
}) => {
  await page.goto('/');
  await page.mouse.move(8, 8);

  const { scene, slides, firstState, nextState, firstLink, nextLink, firstCaption, nextCaption, frame, plane } =
    hero(page);
  const slideCount = await slides.count();
  const lastState = slides.nth(slideCount - 1);
  expect(slideCount).toBeGreaterThanOrEqual(2);
  await expect(scene).toHaveAttribute('data-pinned', 'true');
  await expect(firstLink).toHaveAttribute('href', '/project/wetrack-app');
  await expect(nextLink).toHaveAttribute('href', '/project/chatgpt-clone');
  await expect(firstState).not.toHaveAttribute('inert');
  await expect(nextState).toHaveAttribute('inert', '');
  await expect(firstCaption.locator('strong')).toHaveText('WeTrack App');
  await expect(nextCaption.locator('strong')).toHaveText('ChatGPT Clone');
  await expect
    .poll(() =>
      page
        .locator('[data-scroll-scene] [data-parallax="copy"]')
        .evaluate((element) => Number.parseFloat(getComputedStyle(element).opacity)),
    )
    .toBe(1);

  for (let index = 1; index < slideCount; index += 1) {
    await expect(slides.nth(index)).toHaveAttribute('inert', '');
  }

  const range = await sceneScrollRange(page);
  expect(range.end).toBeGreaterThan(range.start + 100);
  await scrollInstantly(page, range.start);
  await expect.poll(() => opacity(firstState)).toBeGreaterThan(0.98);
  await expect.poll(() => opacity(nextState)).toBeLessThan(0.02);
  await expect(nextState).toHaveAttribute('aria-hidden', 'true');
  await expect(firstState).not.toHaveAttribute('aria-hidden', 'true');
  const startBoxes = await readHeroBoxes(page);
  const startMotion = await cardMotion(firstState);
  const enteringMotion = await cardMotion(nextState);
  expect(startMotion.rotation).toBeCloseTo(0);
  expect(Math.abs(startMotion.originX - startMotion.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(startMotion.originY - startMotion.height)).toBeLessThanOrEqual(1);
  expect(enteringMotion.translateY).toBeGreaterThan(0);
  await expectPlaneCoversFrame(frame, plane);
  await expectNoHorizontalOverflow(page);

  const firstTransitionMidpoint = 0.2 + (0.6 / (slideCount - 1)) * 0.52;
  const midpoint = range.start + (range.end - range.start) * firstTransitionMidpoint;
  await scrollInstantly(page, midpoint);
  await expect(nextState).not.toHaveAttribute('inert');
  await expect(firstState).toHaveAttribute('inert', '');
  await expect(firstState).toHaveAttribute('aria-hidden', 'true');
  await expect(nextState).not.toHaveAttribute('aria-hidden', 'true');
  await expect.poll(() => opacity(firstState)).toBeLessThan(0.5);
  await expect.poll(() => opacity(nextState)).toBeGreaterThan(0.5);
  const outgoingMotion = await cardMotion(firstState);
  const incomingMotion = await cardMotion(nextState);
  expect(outgoingMotion.translateX).toBeGreaterThan(outgoingMotion.width);
  expect(outgoingMotion.rotation).toBeCloseTo(6.24, 1);
  expect(incomingMotion.translateY).toBeGreaterThan(0);
  expect(incomingMotion.translateY).toBeLessThan(16);
  expect(incomingMotion.rotation).toBeCloseTo(0);
  const midpointBoxes = await readHeroBoxes(page);
  await expectStableBoxes(startBoxes, midpointBoxes);
  await expectPlaneCoversFrame(frame, plane);
  await expectNoHorizontalOverflow(page);

  await scrollInstantly(page, range.end);
  await expect.poll(() => opacity(firstState)).toBeLessThan(0.02);
  await expect.poll(() => opacity(lastState)).toBeGreaterThan(0.98);
  await expect(firstState).toHaveAttribute('aria-hidden', 'true');
  await expect(lastState).not.toHaveAttribute('aria-hidden', 'true');
  await expect(firstState).toHaveAttribute('inert', '');
  await expect(lastState).not.toHaveAttribute('inert');
  const endBoxes = await readHeroBoxes(page);
  await expectStableBoxes(startBoxes, endBoxes);
  const endMotion = await cardMotion(firstState);
  const sceneBounds = await box(scene);
  expect(endMotion.translateX).toBeGreaterThan(endMotion.width * 2);
  expect(endMotion.rotation).toBeCloseTo(12, 1);
  expect(endMotion.left).toBeGreaterThan(sceneBounds.x + sceneBounds.width - 1);
  await expectPlaneCoversFrame(frame, plane);
  await expectNoHorizontalOverflow(page);

  await scrollInstantly(page, range.start);
  const startScrollY = await page.evaluate(() => window.scrollY);
  const wheelDistance = Math.round((range.end - range.start) * 0.62);
  await page.mouse.wheel(0, wheelDistance);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(startScrollY + 20);
  await expect(firstState).toHaveAttribute('inert', '');
  await expect(nextState).not.toHaveAttribute('inert');
  const downMotion = await cardMotion(firstState);

  await page.mouse.wheel(0, -wheelDistance);
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeLessThan(startScrollY + wheelDistance - 20);
  await expect(firstState).not.toHaveAttribute('inert');
  await expect(nextState).toHaveAttribute('inert', '');
  await expect.poll(() => cardMotion(firstState).then(({ translateX }) => translateX)).toBeLessThan(
    downMotion.translateX - 100,
  );
  await expectNoHorizontalOverflow(page);
});

test('settles to the nearest card after wheel idle and lets the page leave the hero', async ({ page }) => {
  await page.goto('/');
  await page.mouse.move(8, 8);

  const { scene, slides } = hero(page);
  await expect(scene).toHaveAttribute('data-pinned', 'true');
  const slideCount = await slides.count();
  const range = await sceneScrollRange(page);
  const travel = range.end - range.start;
  const targetIndex = slideCount > 2 ? 1 : 0;
  const targetProgress = 0.2 + (0.6 * targetIndex) / (slideCount - 1);
  const expectedPosition = range.start + targetProgress * travel;

  await scrollInstantly(page, range.start + (targetProgress + 0.03) * travel);
  await page.mouse.wheel(0, 1);
  await expect
    .poll(async () => Math.abs((await page.evaluate(() => window.scrollY)) - expectedPosition))
    .toBeLessThan(3);

  const escapeStart = range.end - Math.max(10, travel * 0.02);
  await scrollInstantly(page, escapeStart);
  await page.mouse.wheel(0, 100);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(range.end + 20);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(range.end);
});

test('limits stronger image travel to selected projects and keeps their frames covered', async ({
  page,
}) => {
  await page.goto('/');
  await expect(hero(page).scene).toHaveAttribute('data-pinned', 'true');

  const selectedPlanes = page.locator('#projects article [data-parallax="image"]');
  await expect(selectedPlanes).toHaveCount(3);
  const travels: string[] = [];
  for (const plane of await selectedPlanes.all()) {
    await expect(plane).toHaveAttribute('data-parallax-active', 'true');
    travels.push((await plane.getAttribute('data-parallax-travel')) ?? '');
  }
  expect(travels).toEqual(['1.5', '1', '1']);

  const plane = selectedPlanes.first();
  const frame = plane.locator('xpath=..');
  const position = await frame.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return {
      top: bounds.top + window.scrollY,
      height: bounds.height,
      viewportHeight: window.innerHeight,
    };
  });
  const firstEndpoint = Math.max(0, position.top - position.viewportHeight);
  const lastEndpoint = position.top + position.height;

  await scrollInstantly(page, firstEndpoint);
  await expectPlaneCoversFrame(frame, plane);
  await scrollInstantly(page, lastEndpoint);
  await expectPlaneCoversFrame(frame, plane);

  const imageOffset = () => plane.evaluate((element) => {
    const frameBounds = element.parentElement!.getBoundingClientRect();
    return element.getBoundingClientRect().top - frameBounds.top;
  });
  const middleOffset = await plane.evaluate(
    (element) => -(element.getBoundingClientRect().height - element.parentElement!.getBoundingClientRect().height) / 2,
  );
  await scrollInstantly(page, (firstEndpoint + lastEndpoint) / 2);
  // Native scroll animations can paint after scrollY has already changed.
  await expect.poll(imageOffset).toBeCloseTo(middleOffset, 0);
  const beforeScroll = await page.evaluate(() => window.scrollY);
  const beforeOffset = await imageOffset();

  await page.mouse.wheel(0, 140);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(beforeScroll + 20);
  await expect.poll(imageOffset).toBeLessThan(beforeOffset - 1);
  const downOffset = await imageOffset();

  await page.mouse.wheel(0, -100);
  await expect.poll(imageOffset).toBeGreaterThan(downOffset + 1);

  await page.goto('/project');
  const archivePlane = page.locator('[data-parallax="image"]').first();
  await expect(archivePlane).toHaveAttribute('data-parallax-active', 'true');
  await expect(archivePlane).toHaveAttribute('data-parallax-travel', '1');
});

test('resets hero selection and parallax when reduced motion is enabled live', async ({ page }) => {
  await page.goto('/');
  const { scene, slides, firstState, firstLink } = hero(page);
  const lastState = slides.nth((await slides.count()) - 1);
  await expect(scene).toHaveAttribute('data-pinned', 'true');

  const range = await sceneScrollRange(page);
  await scrollInstantly(page, range.end);
  await expect(lastState).not.toHaveAttribute('inert');
  await page.emulateMedia({ reducedMotion: 'reduce' });

  await expect(scene).toHaveAttribute('data-pinned', 'false');
  await expect(firstLink).toHaveAttribute('href', '/project/wetrack-app');
  await expect(firstState).not.toHaveAttribute('inert');
  await expect(lastState).toHaveAttribute('inert', '');
  await expect(lastState).toHaveAttribute('aria-hidden', 'true');
  await expect.poll(() => opacity(firstState)).toBeGreaterThan(0.98);
  await expect.poll(() => opacity(lastState)).toBeLessThan(0.02);

  const selectedPlane = page.locator('#projects article [data-parallax="image"]').first();
  await expect(selectedPlane).toHaveAttribute('data-parallax-active', 'false');
});

test('keeps a keyboard-focused hero project active until focus moves', async ({ page }) => {
  await page.goto('/');
  const { scene, slides, firstState, firstLink } = hero(page);
  const lastState = slides.nth((await slides.count()) - 1);
  const lastLink = lastState.locator('a.hero-visual');
  await expect(scene).toHaveAttribute('data-pinned', 'true');

  for (let attempt = 0; attempt < 24; attempt += 1) {
    if (await firstLink.evaluate((element) => element === document.activeElement)) {
      break;
    }
    await page.keyboard.press('Tab');
  }
  await expect(firstLink).toBeFocused();

  const range = await sceneScrollRange(page);
  await scrollInstantly(page, range.start + (range.end - range.start) * 0.8);
  await expect(firstState).not.toHaveAttribute('inert');
  await expect(lastState).toHaveAttribute('inert', '');
  await expect(firstLink).toBeFocused();
  await expect.poll(() => opacity(firstState)).toBeGreaterThan(0.98);
  await expect.poll(() => opacity(lastState)).toBeLessThan(0.02);

  await page.keyboard.press('Tab');
  await expect(firstState).toHaveAttribute('inert', '');
  await expect(lastState).not.toHaveAttribute('inert');

  await page.keyboard.press('Shift+Tab');
  await expect(lastLink).toBeFocused();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(scene).toHaveAttribute('data-pinned', 'false');
  await expect(lastLink).toBeFocused();
  await expect.poll(() => opacity(lastState)).toBe(1);
  await page.keyboard.press('Tab');
  await expect(firstState).not.toHaveAttribute('inert');
  await expect(lastState).toHaveAttribute('inert', '');
});

test.describe('parallax eligibility fallbacks', () => {
  test.describe('with a coarse pointer', () => {
    test.use({ hasTouch: true, isMobile: true });

    test('keeps normal flow even at desktop dimensions', async ({ page }) => {
      await page.goto('/');
      await expectFlowFallback(page);
    });
  });

  test('releases an oversized hero when text is enlarged', async ({ page }) => {
    await page.goto('/');
    await expect(hero(page).scene).toHaveAttribute('data-pinned', 'true');
    await page.addStyleTag({
      content: '.hero-copy { font-size: 2rem; } .hero-copy h1 { font-size: 10rem; }',
    });
    await expect(hero(page).scene).toHaveAttribute('data-pinned', 'false');
    await expect.poll(() => opacity(hero(page).firstState)).toBe(1);
    await expect(hero(page).nextState).toHaveAttribute('inert', '');
  });

  test('uses normal flow below the desktop width threshold', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1000 });
    await page.goto('/');
    await expectFlowFallback(page);
  });

  test('uses normal flow below the minimum viewport height', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 700 });
    await page.goto('/');
    await expectFlowFallback(page);
  });

  test.describe('with JavaScript disabled', () => {
    test.use({ javaScriptEnabled: false });

    test('keeps the first hero link and selected work visible in server HTML', async ({ page }) => {
      await page.goto('/');
      await expectFlowFallback(page);
      await expect(
        hero(page).frame.getByAltText('WeTrack Kanban board with tasks organised into sprints'),
      ).toBeVisible();
    });
  });
});
