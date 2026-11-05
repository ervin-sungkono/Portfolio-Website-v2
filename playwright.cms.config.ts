import { defineConfig, devices } from '@playwright/test';

const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
const node = process.execPath.includes(' ') ? `"${process.execPath}"` : process.execPath;
const portValue = process.env.CMS_FIXTURE_PORT ?? '3104';
if (!/^\d+$/.test(portValue) || Number(portValue) < 1 || Number(portValue) > 65535) {
  throw new Error('CMS_FIXTURE_PORT must be an integer from 1 to 65535.');
}
const port = Number(portValue);

export default defineConfig({
  testDir: './tests/e2e/cms',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 8_000 },
  reporter: 'list',
  outputDir: 'test-results/cms',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    reducedMotion: 'reduce',
    ...devices['Desktop Chrome'],
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [{ name: 'cms-chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `${node} node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}/admin`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NODE_ENV: 'production',
      PORT: String(port),
      CMS_FIXTURE_PORT: String(port),
      NODE_DISABLE_COMPILE_CACHE: '1',
      NODE_OPTIONS: process.env.NODE_OPTIONS ?? '',
      AUTH_TRUST_HOST: 'true',
      AUTH_SECRET: process.env.AUTH_SECRET ?? '',
      AUTH_GITHUB_ID: process.env.AUTH_GITHUB_ID ?? '',
      AUTH_GITHUB_SECRET: process.env.AUTH_GITHUB_SECRET ?? '',
      GITHUB_PAT: process.env.GITHUB_PAT ?? '',
      DRIBBBLE_TOKEN: process.env.DRIBBBLE_TOKEN ?? '',
      GITHUB_REPO: process.env.GITHUB_REPO ?? '',
      NEXT_PUBLIC_RECAPTCHA_KEY: 'review-test-key',
      EMAIL: '',
      EMAIL_PASS: '',
      RECAPTCHA_SECRET: '',
      NEXT_TELEMETRY_DISABLED: '1',
      CMS_FIXTURE_PORTFOLIO_OVERRIDE: process.env.CMS_FIXTURE_PORTFOLIO_OVERRIDE ?? '',
    },
  },
});
