import { expect, test, type Locator, type Page } from '@playwright/test';

test.use({ reducedMotion: 'no-preference', viewport: { width: 1440, height: 1000 } });

type Point = { x: number; y: number };

const cursor = (page: Page) => page.locator('[data-desktop-cursor]');
const frame = (page: Page) => page.locator('[data-cursor-frame]');
const dot = (page: Page) => page.locator('[data-cursor-dot]');

async function moveToFraction(page: Page, target: Locator, xRatio = 0.5, yRatio = 0.5) {
  const box = await target.boundingBox();
  if (!box) {
    throw new Error('Expected the cursor target to have a visible bounding box.');
  }

  const point = {
    x: Math.round(box.x + box.width * xRatio),
    y: Math.round(box.y + box.height * yRatio),
  };
  await page.mouse.move(point.x, point.y);
  return point;
}

async function expectFrameToMatch(page: Page, target: Locator) {
  await expect
    .poll(async () => {
      const [frameBox, targetBox] = await Promise.all([
        frame(page).boundingBox(),
        target.boundingBox(),
      ]);
      if (!frameBox || !targetBox) {
        return false;
      }

      return (
        Math.abs(frameBox.x - (targetBox.x - 8)) <= 2 &&
        Math.abs(frameBox.y - (targetBox.y - 8)) <= 2 &&
        Math.abs(frameBox.width - (targetBox.width + 16)) <= 2 &&
        Math.abs(frameBox.height - (targetBox.height + 16)) <= 2
      );
    })
    .toBe(true);
}

async function expectDotAt(page: Page, point: Point) {
  await expect
    .poll(async () => {
      const position = await dot(page).evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return { x: rect.left, y: rect.top };
      });

      return Math.abs(position.x - point.x) <= 0.5 && Math.abs(position.y - point.y) <= 0.5;
    })
    .toBe(true);
}

async function expectIdleCursorAt(page: Page, point: Point) {
  await expectDotAt(page, point);
  await expect(cursor(page)).toHaveAttribute('data-cursor-hovered', 'false');
  await expect
    .poll(() =>
      dot(page).evaluate((element) => {
        const vertical = getComputedStyle(element, '::before');
        const horizontal = getComputedStyle(element, '::after');
        return [vertical.width, vertical.height, horizontal.width, horizontal.height];
      }),
    )
    .toEqual(['2px', '8px', '8px', '2px']);
  for (const corner of await frame(page).locator('span').all()) {
    await expect(corner).toHaveCSS('opacity', '1');
  }
  await expect
    .poll(async () => {
      const bounds = await frame(page).boundingBox();
      return Boolean(
        bounds &&
          Math.abs(bounds.width - 32) < 0.5 &&
          Math.abs(bounds.height - 32) < 0.5 &&
          Math.abs(bounds.x + bounds.width / 2 - point.x) < 0.5 &&
          Math.abs(bounds.y + bounds.height / 2 - point.y) < 0.5,
      );
    })
    .toBe(true);
}

async function expectCursorAvailable(page: Page) {
  const supported = await page.evaluate(
    () =>
      matchMedia('(min-width: 64rem)').matches &&
      matchMedia('(hover: hover)').matches &&
      matchMedia('(pointer: fine)').matches &&
      matchMedia('(prefers-reduced-motion: no-preference)').matches,
  );
  expect(supported).toBe(true);

  await page.goto('/');
  await expect(cursor(page)).toBeAttached();
  await expect(cursor(page)).toHaveAttribute('aria-hidden', 'true');
  await expect(cursor(page)).toHaveCSS('pointer-events', 'none');
  await expect(page.locator('html')).not.toHaveAttribute('data-custom-cursor', 'active');
}

test('frames controls with clearance, switches to a focus ring, and returns to the tiny plus', async ({
  page,
}) => {
  await expectCursorAvailable(page);

  const controls = [
    page.getByRole('banner').getByRole('button', { name: /theme/i }),
    page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'About' }),
  ];

  for (const target of controls) {
    await expect(target).toBeVisible();

    const firstPoint = await moveToFraction(page, target, 0.3, 0.35);
    await expect(page.locator('html')).toHaveAttribute('data-custom-cursor', 'active');
    await expectFrameToMatch(page, target);
    await expectDotAt(page, firstPoint);
    await expect(cursor(page)).toHaveAttribute('data-cursor-hovered', 'true');
    await expect
      .poll(() =>
        dot(page).evaluate((element) => {
          const ring = getComputedStyle(element, '::before');
          return [ring.width, ring.height, ring.borderRadius];
        }),
      )
      .toEqual(['12px', '12px', '50%']);
    for (const corner of await frame(page).locator('span').all()) {
      await expect(corner).toHaveCSS('opacity', '1');
    }

    const secondPoint = await moveToFraction(page, target, 0.7, 0.65);
    await expectFrameToMatch(page, target);
    await expectDotAt(page, secondPoint);
  }

  await page.evaluate(() => {
    const blank = document.createElement('div');
    blank.dataset.cursorBlank = '';
    blank.style.cssText = 'position:fixed;right:8px;bottom:8px;width:8px;height:8px;z-index:100';
    document.body.append(blank);
  });
  const blank = page.locator('[data-cursor-blank]');
  const point = await moveToFraction(page, blank);
  await expect(page.locator('html')).toHaveAttribute('data-custom-cursor', 'active');
  await expectIdleCursorAt(page, point);
  await expectDotAt(page, point);

  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.locator('html')).not.toHaveAttribute('data-custom-cursor', 'active');
  await expect(frame(page)).toHaveCSS('opacity', '0');
});

test('restores the native cursor on viewport exit and reactivates on return', async ({ page }) => {
  await expectCursorAvailable(page);
  const button = page.getByRole('banner').getByRole('button', { name: /theme/i });
  await moveToFraction(page, button);
  await expect(page.locator('html')).toHaveAttribute('data-custom-cursor', 'active');

  await page.mouse.move(-10, -10);
  await expect(page.locator('html')).not.toHaveAttribute('data-custom-cursor', 'active');
  await expect(frame(page)).toHaveCSS('opacity', '0');

  await moveToFraction(page, button);
  await expect(page.locator('html')).toHaveAttribute('data-custom-cursor', 'active');
  await expectFrameToMatch(page, button);
});

test('renders contrasting idle corners and plus below the navbar in both themes', async ({
  page,
}) => {
  await page.goto('/contact');
  await expect(cursor(page)).toBeAttached();
  // Remove decorative noise without painting over the page's transparent layers.
  await page.addStyleTag({ content: 'canvas { visibility: hidden !important; }' });
  const luminance = (rgb: number[]) => {
    const linear = rgb.slice(0, 3).map((channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  };

  for (const theme of ['light', 'dark']) {
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
    }, theme);
    await page.mouse.move(32, 300);
    await expectIdleCursorAt(page, { x: 32, y: 300 });
    const shot = await page.screenshot({
      clip: { x: 8, y: 276, width: 48, height: 48 },
      scale: 'css',
    });
    const pixels = await page.evaluate(async (base64) => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 48;
      const context = canvas.getContext('2d')!;
      context.drawImage(image, 0, 0);
      const pixel = (x: number, y: number) => Array.from(context.getImageData(x, y, 1, 1).data);
      return { plus: pixel(24, 24), corner: pixel(8, 8), background: pixel(0, 0) };
    }, shot.toString('base64'));
    const background = luminance(pixels.background);
    for (const pixel of [pixels.plus, pixels.corner]) {
      const mark = luminance(pixel);
      const contrast = (Math.max(mark, background) + 0.05) / (Math.min(mark, background) + 0.05);
      expect(contrast, `${theme} cursor against the page background`).toBeGreaterThan(3);
    }
  }
});

test('uses the nearest button for nested span and SVG pointer targets', async ({ page }) => {
  await expectCursorAvailable(page);
  await page.evaluate(() => {
    const button = document.createElement('button');
    button.dataset.cursorFixture = '';
    button.type = 'button';
    button.textContent = '';
    button.style.cssText =
      'position:fixed;left:320px;top:260px;width:240px;height:100px;display:flex;align-items:center;gap:24px;z-index:10';

    const label = document.createElement('span');
    label.dataset.cursorFixtureLabel = '';
    label.textContent = 'Nested label';
    label.style.cssText = 'display:inline-flex;align-items:center;width:112px;height:48px';

    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.dataset.cursorFixtureIcon = '';
    icon.setAttribute('width', '40');
    icon.setAttribute('height', '40');
    icon.setAttribute('viewBox', '0 0 40 40');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.dataset.cursorFixturePath = '';
    path.setAttribute('d', 'M4 4h32v32H4z');
    path.setAttribute('fill', 'currentColor');
    icon.append(path);

    button.append(label, icon);
    const backdrop = document.createElement('div');
    backdrop.style.cssText =
      'position:fixed;left:300px;top:240px;width:280px;height:140px;z-index:9';
    document.body.append(backdrop, button);
  });

  const button = page.locator('[data-cursor-fixture]');
  const label = page.locator('[data-cursor-fixture-label]');
  const path = page.locator('[data-cursor-fixture-path]');

  for (const child of [label, path]) {
    const point = await moveToFraction(page, child);
    await expect(page.locator('html')).toHaveAttribute('data-custom-cursor', 'active');
    await expectFrameToMatch(page, button);
    await expectDotAt(page, point);
  }

  const box = await button.boundingBox();
  if (!box) {
    throw new Error('Expected the fixture button.');
  }
  const outside = { x: Math.round(box.x - 4), y: Math.round(box.y + box.height / 2) };
  await page.mouse.move(outside.x, outside.y);
  await expectIdleCursorAt(page, outside);
});

test('updates target geometry through scrolling and reflow, then releases when the target is removed', async ({
  page,
}) => {
  await expectCursorAvailable(page);
  await page.evaluate(() => {
    const spacer = document.createElement('div');
    spacer.style.height = '2600px';
    document.body.append(spacer);

    const backdrop = document.createElement('div');
    backdrop.dataset.cursorLayoutBackdrop = '';
    backdrop.style.cssText =
      'position:absolute;top:1450px;left:360px;width:340px;height:220px;z-index:5';

    const target = document.createElement('button');
    target.dataset.cursorLayoutFixture = '';
    target.type = 'button';
    target.textContent = 'Layout fixture';
    target.style.cssText =
      'position:absolute;top:1450px;left:360px;width:220px;height:180px;z-index:6';
    document.body.append(backdrop, target);
  });

  const target = page.locator('[data-cursor-layout-fixture]');
  await target.scrollIntoViewIfNeeded();
  const point = await moveToFraction(page, target, 0.45, 0.5);
  await expectFrameToMatch(page, target);
  await expectDotAt(page, point);

  const beforeScroll = await target.boundingBox();
  const scrollDelta = await page.evaluate(() => {
    const before = window.scrollY;
    window.scrollBy(0, 36);
    return window.scrollY - before;
  });
  expect(scrollDelta).toBeGreaterThan(0);
  await expect
    .poll(async () => {
      const afterScroll = await target.boundingBox();
      return Boolean(beforeScroll && afterScroll && Math.abs(afterScroll.y - beforeScroll.y) > 20);
    })
    .toBe(true);
  await expectFrameToMatch(page, target);

  await target.evaluate((element) => {
    element.style.width = '340px';
    element.style.height = '220px';
  });
  await expectFrameToMatch(page, target);

  const pointer = await dot(page).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  });
  await target.evaluate((element) => element.remove());
  await expectIdleCursorAt(page, pointer);
  await expect(page.locator('html')).toHaveAttribute('data-custom-cursor', 'active');
});

test('restores the native cursor over inputs, editable content, and disabled controls', async ({
  page,
}) => {
  await page.goto('/contact');
  await expect(cursor(page)).toBeAttached();

  const homeLink = page.getByRole('banner').getByRole('link', { name: /, home$/i });
  await moveToFraction(page, homeLink);
  await expect(page.locator('html')).toHaveAttribute('data-custom-cursor', 'active');

  const nameInput = page.getByLabel('Name');
  await nameInput.scrollIntoViewIfNeeded();
  await moveToFraction(page, nameInput);
  await expect(page.locator('html')).not.toHaveAttribute('data-custom-cursor', 'active');
  await expect
    .poll(() => nameInput.evaluate((element) => getComputedStyle(element).cursor))
    .not.toBe('none');
  await nameInput.fill('Ada Lovelace');
  await expect(nameInput).toHaveValue('Ada Lovelace');

  await page.evaluate(() => {
    const editor = document.createElement('div');
    editor.dataset.cursorEditableFixture = '';
    editor.contentEditable = 'true';
    editor.setAttribute('aria-label', 'Cursor test editor');
    editor.style.cssText = 'position:fixed;left:300px;top:300px;width:220px;height:60px';

    const disabled = document.createElement('button');
    disabled.dataset.cursorDisabledFixture = '';
    disabled.disabled = true;
    disabled.textContent = 'Unavailable';
    disabled.style.cssText = 'position:fixed;left:300px;top:400px;width:220px;height:60px';

    document.body.append(editor, disabled);
  });

  const editor = page.getByLabel('Cursor test editor');
  await moveToFraction(page, editor);
  await expect(page.locator('html')).not.toHaveAttribute('data-custom-cursor', 'active');
  await expect
    .poll(() => editor.evaluate((element) => getComputedStyle(element).cursor))
    .not.toBe('none');
  await editor.fill('editable');
  await expect(editor).toHaveText('editable');

  const disabled = page.locator('[data-cursor-disabled-fixture]');
  await moveToFraction(page, disabled);
  await expect(page.locator('html')).not.toHaveAttribute('data-custom-cursor', 'active');
  await expect
    .poll(() => disabled.evaluate((element) => getComputedStyle(element).cursor))
    .not.toBe('none');
  await expect(disabled).toBeDisabled();
});

test('removes the overlay live when reduced motion is enabled and leaves controls usable', async ({
  page,
}) => {
  await expectCursorAvailable(page);
  const themeButton = page.getByRole('banner').getByRole('button', { name: /theme/i });
  await moveToFraction(page, themeButton);
  await expect(page.locator('html')).toHaveAttribute('data-custom-cursor', 'active');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(cursor(page)).toHaveCount(0);
  await expect(page.locator('html')).not.toHaveAttribute('data-custom-cursor', 'active');
  await expect
    .poll(() => themeButton.evaluate((element) => getComputedStyle(element).cursor))
    .not.toBe('none');

  const themeBefore = await page.locator('html').getAttribute('data-theme');
  await themeButton.click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', themeBefore ?? '');
});

test.describe('native cursor environments', () => {
  test.describe('mobile touch', () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

    test('keeps links usable without activating the desktop cursor', async ({ page }) => {
      await page.goto('/about');
      await expect(page.locator('html')).not.toHaveAttribute('data-custom-cursor', 'active');
      await expect(cursor(page)).toHaveCount(0);

      const homeLink = page.getByRole('banner').getByRole('link', { name: /, home$/i });
      await expect(homeLink).toBeVisible();
      await expect
        .poll(() => homeLink.evaluate((element) => getComputedStyle(element).cursor))
        .not.toBe('none');
      await homeLink.tap();
      await expect(page).toHaveURL(/\/$/);
      await expect(page.locator('html')).not.toHaveAttribute('data-custom-cursor', 'active');
    });
  });

  test.describe('JavaScript disabled', () => {
    test.use({ javaScriptEnabled: false });

    test('keeps server-rendered navigation usable with the native cursor', async ({ page }) => {
      await page.goto('/about');
      await expect(page.locator('html')).not.toHaveAttribute('data-custom-cursor', 'active');
      await expect(cursor(page)).toHaveCount(0);

      const homeLink = page.getByRole('banner').getByRole('link', { name: /, home$/i });
      const point = await moveToFraction(page, homeLink);
      await expect
        .poll(() => homeLink.evaluate((element) => getComputedStyle(element).cursor))
        .not.toBe('none');
      await page.mouse.click(point.x, point.y);
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByRole('main')).toBeVisible();
    });
  });
});
