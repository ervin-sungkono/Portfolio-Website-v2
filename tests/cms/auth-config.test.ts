import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createBootstrapAuth, getAuth, getCmsSetupStatus } from '../../src/lib/cms/auth.ts';
import { getPool } from '../../src/lib/cms/db.ts';
import { CmsSetupError } from '../../src/lib/cms/errors.ts';

const environmentKeys = [
  'DATABASE_URL_AUTH',
  'BETTER_AUTH_URL',
  'BETTER_AUTH_SECRET',
  'CMS_ENVIRONMENT',
  'CMS_BOOTSTRAP_EMAIL',
  'CMS_BOOTSTRAP_PASSWORD',
  'CMS_BOOTSTRAP_NAME',
] as const;

const originalEnvironment = new Map(environmentKeys.map((key) => [key, process.env[key]]));
let testAuthPool: ReturnType<typeof getPool> | undefined;

function clearAuthEnvironment() {
  for (const key of environmentKeys) delete process.env[key];
}

function restoreAuthEnvironment() {
  for (const key of environmentKeys) {
    const value = originalEnvironment.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

after(async () => {
  restoreAuthEnvironment();
  if (testAuthPool) await testAuthPool.end();
});

test('auth setup status reports required configuration by environment name without opening a database connection', async () => {
  clearAuthEnvironment();

  const status = await getCmsSetupStatus();
  assert.equal(status.ready, false);
  assert.deepEqual(status.missing, ['DATABASE_URL_AUTH', 'BETTER_AUTH_URL', 'BETTER_AUTH_SECRET']);

  assert.throws(
    () => getAuth(),
    (error: unknown) => {
      assert.ok(error instanceof CmsSetupError);
      assert.deepEqual(error.missing, [
        'DATABASE_URL_AUTH',
        'BETTER_AUTH_URL',
        'BETTER_AUTH_SECRET',
      ]);
      return true;
    },
  );
});

test('runtime Better Auth policy disables signup and uses database-backed sessions, MFA, and rate limits', async () => {
  clearAuthEnvironment();
  process.env.DATABASE_URL_AUTH =
    'postgresql://portfolio_auth:test@localhost:55432/portfolio_cms_test';
  process.env.BETTER_AUTH_URL = 'https://localhost:3105';
  process.env.BETTER_AUTH_SECRET = 'config-test-secret-which-is-longer-than-thirty-two-bytes';
  process.env.CMS_ENVIRONMENT = 'development';
  testAuthPool = getPool('auth');

  const setup = await getCmsSetupStatus();
  assert.deepEqual(setup, { ready: true, missing: [] });

  const auth = getAuth();
  assert.equal(auth.options.emailAndPassword?.enabled, true);
  assert.equal(auth.options.emailAndPassword?.disableSignUp, true);
  assert.equal(auth.options.session?.cookieCache?.enabled, false);
  assert.equal(auth.options.rateLimit?.enabled, true);
  assert.equal(auth.options.rateLimit?.storage, 'database');
  assert.deepEqual(auth.options.trustedOrigins, ['https://localhost:3105']);
  assert.equal(auth.options.advanced?.useSecureCookies, true);
  assert.equal(auth.options.plugins?.length, 1);
});

test('bootstrap instance is constrained to its environment email and never auto-signs in', () => {
  clearAuthEnvironment();
  process.env.DATABASE_URL_AUTH =
    'postgresql://portfolio_auth:test@localhost:55432/portfolio_cms_test';
  process.env.BETTER_AUTH_URL = 'http://localhost:3105';
  process.env.BETTER_AUTH_SECRET = 'config-test-secret-which-is-longer-than-thirty-two-bytes';
  process.env.CMS_ENVIRONMENT = 'development';
  process.env.CMS_BOOTSTRAP_EMAIL = 'Owner@Example.com';
  process.env.CMS_BOOTSTRAP_PASSWORD = 'test-owner-password-long-enough';
  testAuthPool = getPool('auth');

  const auth = createBootstrapAuth();
  assert.equal(auth.options.emailAndPassword?.disableSignUp, false);
  assert.equal(auth.options.emailAndPassword?.autoSignIn, false);
  assert.equal(auth.options.databaseHooks?.user?.create?.before instanceof Function, true);
});

test('auth configuration rejects insecure remote URLs and weak secrets', async () => {
  clearAuthEnvironment();
  process.env.DATABASE_URL_AUTH =
    'postgresql://portfolio_auth:test@localhost:55432/portfolio_cms_test';
  process.env.BETTER_AUTH_URL = 'http://cms.example.com';
  process.env.BETTER_AUTH_SECRET = 'short';
  process.env.CMS_ENVIRONMENT = 'production';

  const status = await getCmsSetupStatus();
  assert.equal(status.ready, false);
  assert.deepEqual(status.missing, ['BETTER_AUTH_URL', 'BETTER_AUTH_SECRET']);

  process.env.BETTER_AUTH_URL = 'http://localhost:3105';
  process.env.BETTER_AUTH_SECRET = 'config-test-secret-which-is-longer-than-thirty-two-bytes';
  const productionLocalHttp = await getCmsSetupStatus();
  assert.deepEqual(productionLocalHttp, { ready: false, missing: ['BETTER_AUTH_URL'] });
});
