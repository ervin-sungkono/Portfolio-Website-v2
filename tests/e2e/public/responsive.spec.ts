import { expect, test } from '@playwright/test';

const routes = ['/', '/about', '/project', '/project/wetrack-app', '/design', '/contact'];
const widths = [320, 390, 820, 1024, 1440];

for (const theme of ['light', 'dark'] as const) {
  test(`public routes reflow and expose keyboard focus in ${theme} theme`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.addInitScript((value) => localStorage.setItem('portfolio-theme', value), theme);

    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of routes) {
        const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
        expect(response?.status(), `${theme} ${width}px ${route}`).toBe(200);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await page.keyboard.press('Tab');
        const skip = page.getByRole('link', { name: 'Skip to Content' });
        await expect(skip).toBeFocused();
        const focus = await skip.evaluate((element) => {
          const style = getComputedStyle(element);
          return { visible: element.matches(':focus-visible'), outline: style.outlineStyle, width: style.outlineWidth };
        });
        expect(focus.visible).toBe(true);
        expect(focus.outline).not.toBe('none');
        expect(parseFloat(focus.width)).toBeGreaterThan(0);

        const documentWidth = () => page.evaluate(() => ({ actual: document.documentElement.scrollWidth, viewport: innerWidth }));
        const normal = await documentWidth();
        expect(normal.actual, `${theme} ${width}px ${route} overflow`).toBeLessThanOrEqual(normal.viewport + 1);

        if (width === 320 || width === 820) {
          await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
          await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
          const enlarged = await documentWidth();
          expect(enlarged.actual, `${theme} ${width}px ${route} enlarged text overflow`).toBeLessThanOrEqual(enlarged.viewport + 1);
        }
      }
    }
  });
}

test('mobile menu remains keyboard accessible on a short screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 440 });
  await page.goto('/');
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });

  const menu = page.getByRole('button', { name: 'Open menu' });
  await page.getByRole('link', { name: 'Skip to Content' }).focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(menu).toBeFocused();
  await page.keyboard.press('Enter');
  const close = page.getByRole('button', { name: 'Close menu' });
  await expect(close).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Home' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');

  await page.keyboard.press('Enter');
  const contact = page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Contact' });
  await contact.focus();
  await expect(contact).toBeInViewport();
  await page.keyboard.press('Tab');
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
});
