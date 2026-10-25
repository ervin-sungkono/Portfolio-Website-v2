import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

if (Number(process.versions.node.split('.')[0]) < 24) {
  throw new Error('Run the CMS browser suite with Node.js 24.');
}

const root = fileURLToPath(new URL('../', import.meta.url));
const fixture = pathToFileURL(
  fileURLToPath(new URL('../tests/fixtures/cms-runtime.mjs', import.meta.url)),
).href;
const fixtureOption = `--import=${fixture}`;
const existingOptions = process.env.NODE_OPTIONS ?? '';
const env = {
  ...process.env,
  NODE_ENV: 'production',
  PORT: '3104',
  NODE_DISABLE_COMPILE_CACHE: '1',
  NODE_OPTIONS: existingOptions.includes(fixture)
    ? existingOptions
    : `${existingOptions} ${fixtureOption}`.trim(),
  AUTH_SECRET: 'cms-browser-fixture-secret-with-at-least-thirty-two-characters',
  AUTH_TRUST_HOST: 'true',
  AUTH_GITHUB_ID: 'fixture-github-client-id',
  AUTH_GITHUB_SECRET: 'fixture-github-client-secret',
  GITHUB_ADMIN_ID: '42424242',
  GITHUB_REPO: 'portfolio-content-fixture',
  NEXT_PUBLIC_RECAPTCHA_KEY: 'review-test-key',
  EMAIL: '',
  EMAIL_PASS: '',
  RECAPTCHA_SECRET: '',
  NEXT_TELEMETRY_DISABLED: '1',
};

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: root, env, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`CMS browser command failed (${signal ?? code}).`));
      }
    });
  });
}

await run(['node_modules/next/dist/bin/next', 'build']);
await run(['node_modules/@playwright/test/cli.js', 'test', '--config=playwright.cms.config.ts']);
