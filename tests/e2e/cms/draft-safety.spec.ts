import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import {
  cmsBaseUrl as baseURL,
  cmsCookieName as cookieName,
  cmsPatUserId as ownerId,
  cmsSessionCookie,
} from '../../support/cms-fixture';

type DraftSafetyWindow = Window & {
  __gateDraftWrites?: boolean;
  __draftWriteStarted?: boolean;
  __failDraftWrites?: boolean;
  __draftWriteGate?: Promise<void>;
  __releaseDraftWrite?: () => void;
  __draftWritesInFlight?: number;
};

async function addOwnerCookie(context: BrowserContext) {
  await context.addCookies([
    {
      name: cookieName,
      value: await cmsSessionCookie(cookieName, ownerId),
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    },
  ]);
}

async function hasBeforeUnloadWarning(page: Page) {
  return page.evaluate(() => {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
}

async function readSavedDraft(page: Page) {
  return page.evaluate(async () => {
    const cache = await caches.open('portfolio-cms-draft-v1');
    const response = await cache.match('/__portfolio-cms-draft__/state');
    return response ? response.json() : null;
  });
}

test('one tab owns the browser draft and a locked tab cannot replace it', async ({ browser }) => {
  const context = await browser.newContext({ baseURL });
  await addOwnerCookie(context);
  const ownerPage = await context.newPage();
  await ownerPage.goto('/admin');
  await expect(ownerPage.getByRole('heading', { name: 'Content editor' })).toBeVisible();
  await ownerPage.getByLabel('Choose a project').selectOption('fixture-project');
  await ownerPage
    .getByLabel('Summary', { exact: true })
    .fill('Saved while one browser tab owns the draft.');
  await ownerPage.getByRole('button', { name: 'Save project draft', exact: true }).click();
  await expect(
    ownerPage.getByRole('status').filter({ hasText: 'Project saved to the browser draft.' }),
  ).toBeVisible();
  const savedBeforeLock = await readSavedDraft(ownerPage);

  const lockedPage = await context.newPage();
  await lockedPage.goto('/admin/import');
  await expect(
    lockedPage.getByRole('heading', { name: 'The CMS draft is open in another tab' }),
  ).toBeVisible();
  await expect(
    lockedPage.getByRole('button', { name: 'Reload after closing the other tab' }),
  ).toBeVisible();
  await expect(
    lockedPage.getByRole('heading', { name: 'Map a GitHub repository to a project' }),
  ).toHaveCount(0);
  expect(await readSavedDraft(lockedPage)).toEqual(savedBeforeLock);

  await ownerPage.close();
  await expect
    .poll(() =>
      lockedPage.evaluate(async () => {
        const { held = [] } = await navigator.locks.query();
        return held.some((lock) => lock.name === 'portfolio-cms-draft-v1:editing');
      }),
    )
    .toBe(false);
  await lockedPage.getByRole('button', { name: 'Reload after closing the other tab' }).click();
  await expect(
    lockedPage.getByRole('heading', { name: 'Map a GitHub repository to a project' }),
  ).toBeVisible();
  await lockedPage.goto('/admin');
  await expect(lockedPage.getByRole('heading', { name: 'Content editor' })).toBeVisible();
  await lockedPage.getByLabel('Choose a project').selectOption('fixture-project');
  await expect(lockedPage.getByLabel('Summary', { exact: true })).toHaveValue(
    'Saved while one browser tab owns the draft.',
  );
  await context.close();
});

test('the provider stays read-only when Web Locks are unavailable', async ({ browser }) => {
  const context = await browser.newContext({ baseURL });
  await addOwnerCookie(context);
  const page = await context.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
  });

  await page.goto('/admin');
  await expect(
    page.getByRole('heading', { name: 'CMS editing is read-only in this browser' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Content editor' })).toHaveCount(0);
  expect(await page.evaluate(() => caches.keys())).not.toContain('portfolio-cms-draft-v1');
  await context.close();
});

test('the provider warns during queued writes and after a failed save until persistence succeeds', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL });
  await addOwnerCookie(context);
  const page = await context.newPage();
  await page.addInitScript(() => {
    const guardedWindow = window as DraftSafetyWindow;
    guardedWindow.__draftWriteGate = Promise.resolve();
    guardedWindow.__releaseDraftWrite = () => undefined;
    guardedWindow.__gateDraftWrites = false;
    guardedWindow.__draftWriteStarted = false;
    guardedWindow.__failDraftWrites = false;
    guardedWindow.__draftWritesInFlight = 0;

    const originalPut = Cache.prototype.put;
    Cache.prototype.put = async function (requestInfo, response) {
      const requestUrl =
        typeof requestInfo === 'string' || requestInfo instanceof URL
          ? String(requestInfo)
          : requestInfo.url;
      const path = new URL(requestUrl, window.location.href).pathname;
      if (path === '/__portfolio-cms-draft__/state') {
        guardedWindow.__draftWritesInFlight = (guardedWindow.__draftWritesInFlight ?? 0) + 1;
        try {
          if (guardedWindow.__gateDraftWrites) {
            guardedWindow.__draftWriteStarted = true;
            await guardedWindow.__draftWriteGate;
            if (guardedWindow.__failDraftWrites) {
              throw new DOMException('Storage is full.', 'QuotaExceededError');
            }
          }
          return await originalPut.call(this, requestInfo, response);
        } finally {
          guardedWindow.__draftWritesInFlight = (guardedWindow.__draftWritesInFlight ?? 1) - 1;
        }
      }
      return originalPut.call(this, requestInfo, response);
    };
  });

  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Content editor' })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => (window as DraftSafetyWindow).__draftWritesInFlight))
    .toBe(0);
  expect(await hasBeforeUnloadWarning(page)).toBe(false);
  await page.getByLabel('Choose a project').selectOption('fixture-project');
  await expect
    .poll(() => page.evaluate(() => (window as DraftSafetyWindow).__draftWritesInFlight))
    .toBe(0);
  await page.evaluate(() => {
    const guardedWindow = window as DraftSafetyWindow;
    let release!: () => void;
    guardedWindow.__draftWriteGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    guardedWindow.__releaseDraftWrite = release;
    guardedWindow.__gateDraftWrites = true;
    guardedWindow.__draftWriteStarted = false;
  });
  await page
    .getByLabel('Summary', { exact: true })
    .fill('A local save that is still waiting for Cache Storage.');
  await page.getByRole('button', { name: 'Save project draft', exact: true }).click();
  await page.waitForFunction(() => (window as DraftSafetyWindow).__draftWriteStarted);
  await expect(page.getByText(/Saving draft in this browser/)).toBeVisible();
  expect(await hasBeforeUnloadWarning(page)).toBe(true);

  await page.evaluate(() => (window as DraftSafetyWindow).__releaseDraftWrite?.());
  await expect(
    page.getByRole('status').filter({ hasText: 'Project saved to the browser draft.' }),
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => (window as DraftSafetyWindow).__draftWritesInFlight))
    .toBe(0);
  expect(await hasBeforeUnloadWarning(page)).toBe(false);

  await page.evaluate(() => {
    const guardedWindow = window as DraftSafetyWindow;
    guardedWindow.__draftWriteStarted = false;
    guardedWindow.__failDraftWrites = true;
  });
  await page
    .getByLabel('Summary', { exact: true })
    .fill('A draft update whose storage write fails.');
  await page.getByRole('button', { name: 'Save project draft', exact: true }).click();
  await page.waitForFunction(() => (window as DraftSafetyWindow).__draftWriteStarted);
  await expect(
    page.getByRole('alert').filter({ hasText: 'The browser could not save this draft.' }),
  ).toBeVisible();
  expect(await hasBeforeUnloadWarning(page)).toBe(true);

  await page.evaluate(() => {
    const guardedWindow = window as DraftSafetyWindow;
    guardedWindow.__draftWriteStarted = false;
    guardedWindow.__failDraftWrites = false;
  });
  await page
    .getByLabel('Summary', { exact: true })
    .fill('A later local save successfully persists the draft.');
  await page.getByRole('button', { name: 'Save project draft', exact: true }).click();
  await page.waitForFunction(() => (window as DraftSafetyWindow).__draftWriteStarted);
  await expect(
    page.getByRole('status').filter({ hasText: 'Project saved to the browser draft.' }),
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => (window as DraftSafetyWindow).__draftWritesInFlight))
    .toBe(0);
  expect(await hasBeforeUnloadWarning(page)).toBe(false);
  await context.close();
});
