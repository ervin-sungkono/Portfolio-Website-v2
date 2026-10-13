import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://127.0.0.1:3105';
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
const testDatabaseVariables = [
  'CMS_TEST_DATABASE_URL_PUBLIC',
  'CMS_TEST_DATABASE_URL_CMS',
  'CMS_TEST_DATABASE_URL_AUTH',
  'CMS_TEST_DATABASE_URL_MIGRATIONS',
] as const;

for (const variable of testDatabaseVariables) {
  const value = process.env[variable];
  if (!value) throw new Error(`${variable} is required for the CMS browser suite.`);

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${variable} must be a valid local PostgreSQL URL.`);
  }

  if (
    !['127.0.0.1', 'localhost', '::1', '[::1]'].includes(url.hostname) ||
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    url.pathname !== '/portfolio_cms_test' ||
    url.search.length > 0 ||
    url.hash.length > 0
  ) {
    throw new Error(
      `${variable} must target the isolated portfolio_cms_test database on loopback.`,
    );
  }
}

export default defineConfig({
  testDir: './tests/browser',
  testMatch: 'cms-*.spec.ts',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 7_000 },
  reporter: 'list',
  outputDir: 'test-results/cms',
  use: {
    baseURL,
    trace: 'off',
    screenshot: 'off',
    reducedMotion: 'reduce',
    ...devices['Desktop Chrome'],
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [{ name: 'cms-chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node tests/cms/start-server.mjs',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    // start-server.mjs forwards an explicit runtime-only environment to Next.
  },
});
