import { defineConfig, devices } from '@playwright/test';

const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH;

export default defineConfig({
  testDir: './tests/browser',
  testIgnore: 'cms-*.spec.ts',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  outputDir: 'test-results',
  use: {
    baseURL: 'http://127.0.0.1:3103',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    reducedMotion: 'reduce',
    ...devices['Desktop Chrome'],
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run start -- --hostname 127.0.0.1 --port 3103',
    url: 'http://127.0.0.1:3103',
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_RECAPTCHA_KEY: 'review-test-key',
      EMAIL: '',
      EMAIL_PASS: '',
      RECAPTCHA_SECRET: '',
      CMS_CONTENT_SOURCE: 'static',
      DATABASE_URL_PUBLIC: '',
      DATABASE_URL_CMS: '',
      DATABASE_URL_AUTH: '',
      DATABASE_URL_MIGRATIONS: '',
      BETTER_AUTH_SECRET: '',
      BETTER_AUTH_URL: '',
      CMS_BOOTSTRAP_EMAIL: '',
      CMS_BOOTSTRAP_PASSWORD: '',
      BLOB_PRIVATE_READ_WRITE_TOKEN: '',
    },
  },
});
