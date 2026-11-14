import { expect, test } from '@playwright/test';

test.use({ reducedMotion: 'no-preference', viewport: { width: 1440, height: 1000 } });

test('draws the experience timeline with scrolling and hides it for reduced motion', async ({
  page,
}) => {
  await page.goto('/about');
  const timeline = page.locator('.experience-section-timeline');
  const rail = timeline.locator('.experience-section-timeline-rail');
  const progress = rail.locator('.experience-section-timeline-progress');
  await expect(timeline.locator('.experience-section-timeline-entry').first()).toBeVisible();

  const start = await rail.evaluate((element) => element.getBoundingClientRect().top + window.scrollY);
  await page.evaluate((position) => window.scrollTo({ top: Math.max(0, position - window.innerHeight), behavior: 'instant' }), start);
  const scale = () => progress.evaluate((element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).m22);
  const initial = await scale();
  const end = await rail.evaluate((element) => element.getBoundingClientRect().bottom + window.scrollY);
  await page.evaluate((position) => window.scrollTo({ top: position - window.innerHeight / 2, behavior: 'instant' }), end);
  await expect.poll(scale).toBeGreaterThan(initial + 0.2);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(rail).toBeHidden();
});

test('keeps the typed hero text visible without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/');
  const text = page.locator('[data-typewriter]');
  await expect(text).toHaveText('Software Engineering & Interface Design');
  await expect(text).toBeVisible();
  await expect(text).toHaveCSS('clip-path', 'none');
  await context.close();
});
