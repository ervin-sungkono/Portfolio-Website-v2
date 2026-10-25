import { defineConfig, devices } from '@playwright/test';

const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
const node = process.execPath.includes(' ') ? `"${process.execPath}"` : process.execPath;

export default defineConfig({
  testDir: './tests/cms-browser',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 8_000 },
  reporter: 'list',
  outputDir: 'test-results/cms',
  use: {
    baseURL: 'http://localhost:3104',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    reducedMotion: 'reduce',
    ...devices['Desktop Chrome'],
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [{ name: 'cms-chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `${node} node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3104`,
    url: 'http://127.0.0.1:3104/admin',
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NODE_ENV: 'production',
      PORT: '3104',
      NODE_DISABLE_COMPILE_CACHE: '1',
      NODE_OPTIONS: process.env.NODE_OPTIONS ?? '',
      AUTH_TRUST_HOST: 'true',
      AUTH_SECRET: process.env.AUTH_SECRET ?? '',
      AUTH_GITHUB_ID: process.env.AUTH_GITHUB_ID ?? '',
      AUTH_GITHUB_SECRET: process.env.AUTH_GITHUB_SECRET ?? '',
      GITHUB_ADMIN_ID: process.env.GITHUB_ADMIN_ID ?? '',
      GITHUB_REPO: process.env.GITHUB_REPO ?? '',
      NEXT_PUBLIC_RECAPTCHA_KEY: 'review-test-key',
      EMAIL: '',
      EMAIL_PASS: '',
      RECAPTCHA_SECRET: '',
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
});
