import { expect, test, type Locator, type Page } from '@playwright/test';

test.use({ reducedMotion: 'no-preference', viewport: { width: 1440, height: 1000 } });

type Box = { x: number; y: number; width: number; height: number };

function hero(page: Page) {
  const scene = page.locator('[data-scroll-scene]');
  const firstState = page.locator('[data-hero-screenshot]');
  const nextState = page.locator('[data-hero-placeholder]');
  const firstLink = firstState.locator('a.hero-visual');
  const nextLink = nextState.locator('a.hero-visual');

  return {
    scene,
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
  if (!bounds) throw new Error('Expected a visible parallax element with a bounding box.');
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
    ['firstState', page.locator('[data-hero-screenshot]')],
    ['nextState', page.locator('[data-hero-placeholder]')],
    ['firstLink', hero(page).firstLink],
    ['nextLink', hero(page).nextLink],
    ['firstCaption', hero(page).firstCaption],
    ['nextCaption', hero(page).nextCaption],
    ['frame', hero(page).frame],
    ['plane', hero(page).plane],
  ];
  const entries = await Promise.all(
    elements.map(async ([name, locator]) => [name, await box(locator)] as const),
  );
  return Object.fromEntries(entries) as Record<string, Box>;
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

test('crossfades the pinned hero between featured projects without moving its geometry', async ({
  page,
}) => {
  await page.goto('/');
  await page.mouse.move(8, 8);

  const {
    scene,
    firstState,
    nextState,
    firstLink,
    nextLink,
    firstCaption,
    nextCaption,
    frame,
    plane,
  } = hero(page);
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

  const range = await sceneScrollRange(page);
  expect(range.end).toBeGreaterThan(range.start + 100);
  await scrollInstantly(page, range.start);
  await expect.poll(() => opacity(firstState)).toBeGreaterThan(0.98);
  await expect.poll(() => opacity(nextState)).toBeLessThan(0.02);
  await expect(nextState).toHaveAttribute('aria-hidden', 'true');
  await expect(firstState).not.toHaveAttribute('aria-hidden', 'true');
  const startBoxes = await readHeroBoxes(page);
  await expectPlaneCoversFrame(frame, plane);

  const midpoint = range.start + (range.end - range.start) * 0.65;
  await scrollInstantly(page, midpoint);
  await expect(nextState).not.toHaveAttribute('inert');
  await expect(firstState).toHaveAttribute('inert', '');
  await expect(firstState).toHaveAttribute('aria-hidden', 'true');
  await expect(nextState).not.toHaveAttribute('aria-hidden', 'true');
  await expect.poll(() => opacity(firstState)).toBeLessThan(0.5);
  await expect.poll(() => opacity(nextState)).toBeGreaterThan(0.5);
  const midpointBoxes = await readHeroBoxes(page);
  await expectStableBoxes(startBoxes, midpointBoxes);
  await expectPlaneCoversFrame(frame, plane);

  await scrollInstantly(page, range.end);
  await expect.poll(() => opacity(firstState)).toBeLessThan(0.02);
  await expect.poll(() => opacity(nextState)).toBeGreaterThan(0.98);
  await expect(nextLink).toHaveAttribute('href', '/project/chatgpt-clone');
  await expect(firstState).toHaveAttribute('aria-hidden', 'true');
  await expect(nextState).not.toHaveAttribute('aria-hidden', 'true');
  const endBoxes = await readHeroBoxes(page);
  await expectStableBoxes(startBoxes, endBoxes);
  await expectPlaneCoversFrame(frame, plane);

  const [startPlane, endPlane] = [startBoxes.plane, endBoxes.plane];
  expect(Math.abs(startPlane.x - endPlane.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(startPlane.y - endPlane.y)).toBeLessThanOrEqual(2);
  expect(Math.abs(startPlane.width - endPlane.width)).toBeLessThanOrEqual(2);
  expect(Math.abs(startPlane.height - endPlane.height)).toBeLessThanOrEqual(2);

  await scrollInstantly(page, range.start);
  const startScrollY = await page.evaluate(() => window.scrollY);
  const wheelDistance = Math.round((range.end - range.start) * 0.62);
  await page.mouse.wheel(0, wheelDistance);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(startScrollY + 20);
  await expect(firstState).toHaveAttribute('inert', '');
  await expect(nextState).not.toHaveAttribute('inert');
  const downOpacity = await opacity(firstState);

  await page.mouse.wheel(0, -wheelDistance);
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeLessThan(startScrollY + wheelDistance - 20);
  await expect(firstState).not.toHaveAttribute('inert');
  await expect(nextState).toHaveAttribute('inert', '');
  await expect.poll(() => opacity(firstState)).toBeGreaterThan(downOpacity + 0.2);
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

  await scrollInstantly(page, (firstEndpoint + lastEndpoint) / 2);
  const beforeScroll = await page.evaluate(() => window.scrollY);
  const beforeOffset = await plane.evaluate((element) => {
    const frameBounds = element.parentElement!.getBoundingClientRect();
    return element.getBoundingClientRect().top - frameBounds.top;
  });

  await page.mouse.wheel(0, 140);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(beforeScroll + 20);
  await expect
    .poll(() =>
      plane.evaluate((element) => {
        const frameBounds = element.parentElement!.getBoundingClientRect();
        return element.getBoundingClientRect().top - frameBounds.top;
      }),
    )
    .toBeLessThan(beforeOffset - 1);
  const downOffset = await plane.evaluate((element) => {
    const frameBounds = element.parentElement!.getBoundingClientRect();
    return element.getBoundingClientRect().top - frameBounds.top;
  });

  await page.mouse.wheel(0, -100);
  await expect
    .poll(() =>
      plane.evaluate((element) => {
        const frameBounds = element.parentElement!.getBoundingClientRect();
        return element.getBoundingClientRect().top - frameBounds.top;
      }),
    )
    .toBeGreaterThan(downOffset + 1);

  await page.goto('/project');
  const archivePlane = page.locator('[data-parallax="image"]').first();
  await expect(archivePlane).toHaveAttribute('data-parallax-active', 'true');
  await expect(archivePlane).toHaveAttribute('data-parallax-travel', '1');
});

test('resets hero selection and parallax when reduced motion is enabled live', async ({ page }) => {
  await page.goto('/');
  const { scene, firstState, nextState, firstLink, nextLink } = hero(page);
  await expect(scene).toHaveAttribute('data-pinned', 'true');

  const range = await sceneScrollRange(page);
  await scrollInstantly(page, range.end);
  await expect(nextState).not.toHaveAttribute('inert');
  await page.emulateMedia({ reducedMotion: 'reduce' });

  await expect(scene).toHaveAttribute('data-pinned', 'false');
  await expect(firstLink).toHaveAttribute('href', '/project/wetrack-app');
  await expect(nextLink).toHaveAttribute('href', '/project/chatgpt-clone');
  await expect(firstState).not.toHaveAttribute('inert');
  await expect(nextState).toHaveAttribute('inert', '');
  await expect(nextState).toHaveAttribute('aria-hidden', 'true');
  await expect.poll(() => opacity(firstState)).toBeGreaterThan(0.98);
  await expect.poll(() => opacity(nextState)).toBeLessThan(0.02);

  const selectedPlane = page.locator('#projects article [data-parallax="image"]').first();
  await expect(selectedPlane).toHaveAttribute('data-parallax-active', 'false');
});

test('keeps a keyboard-focused hero project active until focus moves', async ({ page }) => {
  await page.goto('/');
  const { scene, firstState, nextState, firstLink } = hero(page);
  await expect(scene).toHaveAttribute('data-pinned', 'true');

  for (let attempt = 0; attempt < 24; attempt += 1) {
    if (await firstLink.evaluate((element) => element === document.activeElement)) break;
    await page.keyboard.press('Tab');
  }
  await expect(firstLink).toBeFocused();

  const range = await sceneScrollRange(page);
  await scrollInstantly(page, range.start + (range.end - range.start) * 0.8);
  await expect(firstState).not.toHaveAttribute('inert');
  await expect(nextState).toHaveAttribute('inert', '');
  await expect(firstLink).toBeFocused();
  await expect.poll(() => opacity(firstState)).toBeGreaterThan(0.98);
  await expect.poll(() => opacity(nextState)).toBeLessThan(0.02);

  await page.keyboard.press('Tab');
  await expect(nextState).not.toHaveAttribute('inert');
  await expect(firstState).toHaveAttribute('inert', '');

  await page.keyboard.press('Shift+Tab');
  await expect(hero(page).nextLink).toBeFocused();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(scene).toHaveAttribute('data-pinned', 'false');
  await expect(hero(page).nextLink).toBeFocused();
  await expect.poll(() => opacity(nextState)).toBe(1);
  await page.keyboard.press('Tab');
  await expect(firstState).not.toHaveAttribute('inert');
  await expect(nextState).toHaveAttribute('inert', '');
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
