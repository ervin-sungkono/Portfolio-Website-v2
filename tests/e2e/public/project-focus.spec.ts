import { expect, test, type Locator } from '@playwright/test';

async function expectVisibleFocus(link: Locator) {
  await expect(link).toBeFocused();
  const focus = await link.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const width = Number.parseFloat(style.outlineWidth);
    const offset = Number.parseFloat(style.outlineOffset);
    let clipped = false;
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      const parentStyle = getComputedStyle(parent);
      const parentBounds = parent.getBoundingClientRect();
      const edge = width + Math.max(0, offset);
      if (
        (['hidden', 'clip'].includes(parentStyle.overflowX) &&
          (bounds.left - edge < parentBounds.left || bounds.right + edge > parentBounds.right)) ||
        (['hidden', 'clip'].includes(parentStyle.overflowY) &&
          (bounds.top - edge < parentBounds.top || bounds.bottom + edge > parentBounds.bottom))
      ) {
        clipped = true;
        break;
      }
    }
    return {
      visible: element.matches(':focus-visible'),
      style: style.outlineStyle,
      width,
      offset,
      clipped,
    };
  });
  expect(focus.visible).toBe(true);
  expect(focus.style).toBe('solid');
  expect(focus.width).toBeGreaterThanOrEqual(3);
  expect(focus.offset).toBeGreaterThanOrEqual(0);
  expect(focus.clipped).toBe(false);
}

for (const theme of ['light', 'dark'] as const) {
  test(`project cards show an unobscured keyboard focus indicator in ${theme} mode`, async ({
    page,
  }) => {
    await page.addInitScript((value) => localStorage.setItem('portfolio-theme', value), theme);
    for (const width of [390, 1440]) {
      await page.emulateMedia({ reducedMotion: width === 390 ? 'reduce' : 'no-preference' });
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      const section = page.locator('#projects');
      const cards = section.locator('.project-card-link');
      await expect(cards.first()).toBeVisible();
      const count = await cards.count();
      await page.keyboard.press('Tab');
      await cards.first().focus();
      for (let index = 0; index < count; index += 1) {
        if (index > 0) {
          await page.keyboard.press('Tab');
        }
        await expectVisibleFocus(cards.nth(index));
      }
      await page.keyboard.press('Tab');
      await expectVisibleFocus(section.getByRole('link', { name: /Interface studies/ }));
    }
    await page.goto('/project');
    await page.keyboard.press('Tab');
    const archiveCard = page.locator('.project-card-link').first();
    await archiveCard.focus();
    await expectVisibleFocus(archiveCard);
  });
}
