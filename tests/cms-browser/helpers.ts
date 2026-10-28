import { encode } from 'next-auth/jwt';
import { expect, type BrowserContext, type Page } from '@playwright/test';

export const baseURL = 'http://localhost:3104';
export const adminId = '42424242';
export const ownerToken = 'fixture-owner-token';
const cookieName = '__Secure-authjs.session-token';
const authSecret = 'cms-browser-fixture-secret-with-at-least-thirty-two-characters';

export async function addOwnerCookie(
  context: BrowserContext,
  githubId = adminId,
  accessToken = ownerToken,
) {
  const value = await encode({
    secret: authSecret,
    salt: cookieName,
    maxAge: 60 * 60,
    token: {
      sub: githubId,
      githubId,
      githubAccessToken: accessToken,
      githubExpiresAt: Math.floor(Date.now() / 1000) + 60 * 60,
      name: 'Fixture Owner',
    },
  });
  await context.addCookies([
    {
      name: cookieName,
      value,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    },
  ]);
}

export async function waitForStatus(context: BrowserContext, path: string, status: number) {
  await expect
    .poll(async () => (await context.request.get(new URL(path, baseURL).href)).status(), {
      timeout: 30_000,
      intervals: [250, 500, 1_000, 2_000],
    })
    .toBe(status);
}

export async function selectTheme(page: Page, theme: 'light' | 'dark') {
  const root = page.locator('html');
  const current = await root.getAttribute('data-theme');
  if (current === theme) {
    return;
  }
  await page
    .getByRole('button', {
      name: current === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
    })
    .click();
  await expect(root).toHaveAttribute('data-theme', theme);
}
