import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath, pathToFileURL } from 'node:url';

if (Number(process.versions.node.split('.')[0]) < 24) {
  throw new Error('Run the CMS browser suite with Node.js 24.');
}

const root = fileURLToPath(new URL('../', import.meta.url));
const fixture = pathToFileURL(
  fileURLToPath(new URL('../tests/support/fixtures/cms-runtime.mjs', import.meta.url)),
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
  CMS_FIXTURE_PORTFOLIO_OVERRIDE: fileURLToPath(
    new URL('../test-results/cms-portfolio-override.json', import.meta.url),
  ),
};

function run(args, childEnv = env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: root, env: childEnv, stdio: 'inherit' });
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

async function assertPortAvailable() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(3104, '127.0.0.1', resolve);
  });
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

async function runHttpTests() {
  await assertPortAvailable();
  const server = spawn(
    process.execPath,
    ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3104'],
    { cwd: root, env, stdio: 'inherit' },
  );
  let serverError;
  server.on('error', (error) => {
    serverError = error;
  });

  try {
    const deadline = Date.now() + 120_000;
    let ready = false;
    while (Date.now() < deadline) {
      if (serverError || server.exitCode !== null || server.signalCode !== null) {
        throw serverError ?? new Error('The fixture server exited before it was ready.');
      }
      try {
        const response = await fetch(
          'http://127.0.0.1:3104/api/content/project?slug=fixture-project',
          {
            signal: AbortSignal.timeout(1000),
          },
        );
        if (response.ok && (await response.json()).exists === true) {
          ready = true;
          break;
        }
      } catch {
        // The child has not opened its listener yet.
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (!ready) {
      throw new Error('The fixture server did not become ready.');
    }
    await run(['node_modules/vitest/vitest.mjs', 'run', '--config=vitest.http.config.ts'], {
      ...env,
      NODE_OPTIONS: existingOptions,
    });
  } finally {
    if (server.exitCode === null && server.signalCode === null) {
      await new Promise((resolve) => {
        server.once('exit', resolve);
        if (!server.kill()) {
          resolve();
        }
      });
    }
  }
}

const mode = process.argv[2] ?? 'browser';
if (!['browser', 'http', 'all'].includes(mode)) {
  throw new Error('Expected browser, http, or all.');
}
await run(['node_modules/next/dist/bin/next', 'build']);
if (mode !== 'http') {
  await run(['node_modules/@playwright/test/cli.js', 'test', '--config=playwright.cms.config.ts']);
}
if (mode !== 'browser') {
  await runHttpTests();
}
