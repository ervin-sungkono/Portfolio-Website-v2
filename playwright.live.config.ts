import { defineConfig } from '@playwright/test';
import config from './playwright.config';

// Targets the already-running server; contact requests are intercepted by the tests.
export default defineConfig({
  ...config,
  use: { ...config.use, baseURL: 'http://localhost:3000' },
  webServer: undefined,
  workers: 1,
  outputDir: 'test-results/live',
});
