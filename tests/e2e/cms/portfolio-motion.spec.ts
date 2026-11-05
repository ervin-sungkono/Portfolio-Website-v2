import { expect, test } from '@playwright/test';
import {
  cmsBaseUrl,
  cmsCookieName,
  cmsPatUserId,
  cmsSessionCookie,
} from '../../support/cms-fixture';

test.use({ reducedMotion: 'no-preference', viewport: { width: 1440, height: 1000 } });

test('renders the About artwork and respects live reduced-motion changes', async ({ page }) => {
  await page.goto('/about');
  const artwork = page.locator('[data-scene]');
  await expect(artwork).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Engineering, With');
  const fontSize = await page
    .getByRole('heading', { level: 1 })
    .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  expect(fontSize).toBeLessThanOrEqual(60);

  const webglAvailable = await page.evaluate(() => {
    const context = document.createElement('canvas').getContext('webgl2');
    context?.getExtension('WEBGL_lose_context')?.loseContext();
    return Boolean(context);
  });
  if (webglAvailable) {
    await expect(artwork).toHaveAttribute('data-scene', 'ready', { timeout: 15000 });
    const canvas = artwork.locator('canvas');
    await expect(canvas).toBeVisible();
    const before = await canvas.screenshot();
    await page.waitForTimeout(750);
    expect(before.equals(await canvas.screenshot())).toBe(false);
    const control = artwork.locator('[data-rotation]');
    await expect(artwork).toHaveAttribute('aria-hidden', 'true');
    await expect(control).not.toHaveAttribute('tabindex');
    await expect(control).toHaveCSS('touch-action', 'pan-y');
    const box = await control.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width / 2 + 100, box!.y + box!.height / 2, { steps: 5 });
    const dragged = Number(await control.getAttribute('data-rotation'));
    expect(dragged).toBeCloseTo(70, 0);
    await page.mouse.up();
    await expect
      .poll(async () => Number(await control.getAttribute('data-rotation')))
      .toBeGreaterThan(dragged + 1);
    await page.waitForTimeout(2000);
    const settled = Number(await control.getAttribute('data-rotation'));
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(350);
    expect(Math.abs(Number(await control.getAttribute('data-rotation')) - settled)).toBeLessThan(1);
  } else {
    await expect(artwork.locator('img')).toBeVisible();
  }

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(artwork).toHaveAttribute('data-scene', 'fallback');
  await expect(artwork.locator('img')).toBeVisible();
});

test('keeps the artwork image when WebGL cannot start', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      value: () => {
        (window as Window & { webglAttempted?: boolean }).webglAttempted = true;
        return null;
      },
    });
  });
  await page.goto('/about');
  await expect
    .poll(() =>
      page.evaluate(() => (window as Window & { webglAttempted?: boolean }).webglAttempted),
    )
    .toBe(true);
  const artwork = page.locator('[data-scene]');
  await expect(artwork).toHaveAttribute('data-scene', 'fallback');
  await expect(artwork.locator('img')).toBeVisible();
});

test('batches pointer rendering and pauses the artwork outside the viewport', async ({ page }) => {
  await page.addInitScript(() => {
    const state = window as Window & { aboutFrames?: number };
    state.aboutFrames = 0;
    if (!window.WebGL2RenderingContext) {
      return;
    }
    const clear = WebGL2RenderingContext.prototype.clear;
    WebGL2RenderingContext.prototype.clear = function (mask) {
      state.aboutFrames = (state.aboutFrames ?? 0) + 1;
      return clear.call(this, mask);
    };
  });
  await page.goto('/about');
  const webglAvailable = await page.evaluate(() => {
    const context = document.createElement('canvas').getContext('webgl2');
    context?.getExtension('WEBGL_lose_context')?.loseContext();
    return Boolean(context);
  });
  test.skip(!webglAvailable, 'WebGL is unavailable in this browser.');
  const artwork = page.locator('[data-scene]');
  await expect(artwork).toHaveAttribute('data-scene', 'ready', { timeout: 15000 });
  const control = artwork.locator('[data-rotation]');
  const box = await control.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  const synchronousFrames = await control.evaluate((element) => {
    const state = window as Window & { aboutFrames?: number };
    const before = state.aboutFrames ?? 0;
    const bounds = element.getBoundingClientRect();
    for (let index = 0; index < 30; index += 1) {
      element.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          pointerId: 1,
          isPrimary: true,
          clientX: bounds.left + bounds.width / 2 + index,
          clientY: bounds.top + bounds.height / 2,
        }),
      );
    }
    return (state.aboutFrames ?? 0) - before;
  });
  expect(synchronousFrames).toBe(0);
  await page.mouse.up();

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(250);
  const framesOffscreen = await page.evaluate(
    () => (window as Window & { aboutFrames?: number }).aboutFrames ?? 0,
  );
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => (window as Window & { aboutFrames?: number }).aboutFrames)).toBe(
    framesOffscreen,
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect
    .poll(() => page.evaluate(() => (window as Window & { aboutFrames?: number }).aboutFrames ?? 0))
    .toBeGreaterThan(framesOffscreen);
});

test('keeps the About artwork and heading readable without JavaScript on narrow screens', async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: cmsBaseUrl,
    javaScriptEnabled: false,
    viewport: { width: 320, height: 800 },
  });
  const page = await context.newPage();
  await page.goto('/about');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('[data-scene] img')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await context.close();
});

test('types the hero label once and immediately restores it for reduced motion', async ({
  page,
}) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const text = page.locator('[data-typewriter]');
  await expect(text).toHaveText('Software Engineering & Interface Design');
  await expect.poll(() => text.evaluate((element) => element.style.clipPath)).toContain('inset');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => text.evaluate((element) => element.style.clipPath)).toBe('');
});

test('places draft actions beside red sign-out and import in Projects', async ({
  page,
  context,
}) => {
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
  await page.goto('/admin');
  const signOut = page.getByRole('button', { name: 'Sign out' });
  const submitDraft = page.getByRole('button', { name: 'Submit draft' });
  const deleteDraft = page.getByRole('button', { name: 'Delete draft' });
  await expect(signOut).toHaveCSS('background-color', 'rgb(180, 35, 24)');
  await expect(signOut).toHaveCSS('color', 'rgb(255, 255, 255)');
  const signOutBox = await signOut.boundingBox();
  await expect(submitDraft).toBeVisible();
  await expect(deleteDraft).toBeVisible();
  await expect(
    page.locator('#cms-editor-projects-panel').getByRole('link', { name: 'Import repository' }),
  ).toBeVisible();
  const submitBox = await submitDraft.boundingBox();
  const deleteBox = await deleteDraft.boundingBox();
  expect(signOutBox).not.toBeNull();
  expect(submitBox).not.toBeNull();
  expect(deleteBox).not.toBeNull();
  expect(Math.abs(signOutBox!.y - deleteBox!.y)).toBeLessThanOrEqual(1);
  expect(submitBox!.x).toBeLessThan(deleteBox!.x);
  expect(deleteBox!.x).toBeLessThan(signOutBox!.x);
});
