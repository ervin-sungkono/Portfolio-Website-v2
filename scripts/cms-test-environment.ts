import { randomBytes } from 'node:crypto';
import { open, unlink } from 'node:fs/promises';
import { Pool, type PoolClient } from 'pg';

const testRoles = [
  { name: 'portfolio_public', env: 'PUBLIC', setting: 'public' },
  { name: 'portfolio_cms', env: 'CMS', setting: 'cms' },
  { name: 'portfolio_auth', env: 'AUTH', setting: 'auth' },
] as const;
const testDatabaseName = 'portfolio_cms_test';
const testRoleNames: string[] = testRoles.map(({ name }) => name);

class TestEnvironmentError extends Error {
  constructor(
    message: string,
    readonly commitOutcomeUnknown = false,
  ) {
    super(message);
  }
}

function isLoopback(hostname: string) {
  return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname.toLowerCase());
}

function decodePart(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new TestEnvironmentError('The local migration URL contains invalid URL encoding.');
  }
}

function parseLocalMigrationURL(value: string | undefined) {
  if (!value) {
    throw new TestEnvironmentError(
      'Set CMS_TEST_DATABASE_URL_MIGRATIONS for the local test database.',
    );
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TestEnvironmentError(
      'CMS_TEST_DATABASE_URL_MIGRATIONS must be a valid local PostgreSQL URL.',
    );
  }

  const database = decodePart(url.pathname.slice(1));
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !isLoopback(url.hostname) ||
    database !== testDatabaseName ||
    url.search ||
    url.hash
  ) {
    throw new TestEnvironmentError(
      'CMS_TEST_DATABASE_URL_MIGRATIONS must target the loopback portfolio_cms_test database.',
    );
  }

  const port = url.port ? Number(url.port) : 5432;
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new TestEnvironmentError('The local CMS test database URL must use a valid port.');
  }

  return {
    url,
    hostname: url.hostname,
    port,
    database,
    username: decodePart(url.username),
    password: decodePart(url.password),
  };
}

function makeRuntimeURL(migrationURL: URL, role: string, password: string) {
  const url = new URL(migrationURL);
  url.username = role;
  url.password = password;
  return url.toString();
}

function makeEnvironmentFile(migrationURL: URL, passwords: Map<string, string>) {
  const values: Record<string, string> = {
    BETTER_AUTH_URL: 'http://127.0.0.1:3105',
    BETTER_AUTH_SECRET: randomBytes(32).toString('hex'),
    CMS_BOOTSTRAP_EMAIL: 'qa-owner@example.test',
    CMS_BOOTSTRAP_PASSWORD: randomBytes(32).toString('hex'),
    CMS_CONTENT_SOURCE: 'database',
    CMS_ENVIRONMENT: 'development',
    NEXT_PUBLIC_RECAPTCHA_KEY: 'review-test-key',
  };

  for (const role of testRoles) {
    const password = passwords.get(role.name);
    if (!password) throw new TestEnvironmentError('A local CMS test credential was unavailable.');
    const url = makeRuntimeURL(migrationURL, role.name, password);
    values[`DATABASE_URL_${role.env}`] = url;
    values[`CMS_TEST_DATABASE_URL_${role.env}`] = url;
  }

  return Object.entries(values)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
    .concat('\n');
}

async function validateLocalDatabase(
  client: PoolClient,
  migration: ReturnType<typeof parseLocalMigrationURL>,
) {
  const result = await client.query<{
    database_name: string;
    principal: string;
    is_standby: boolean;
    can_create_roles: boolean;
    is_superuser: boolean;
  }>(`
    SELECT current_database() AS database_name,
           current_user AS principal,
           pg_catalog.pg_is_in_recovery() AS is_standby,
           role_info.rolcreaterole AS can_create_roles,
           role_info.rolsuper AS is_superuser
    FROM pg_catalog.pg_roles AS role_info
    WHERE role_info.rolname = current_user
  `);
  const route = result.rows[0];
  if (
    !route ||
    route.database_name !== migration.database ||
    route.principal !== migration.username ||
    testRoleNames.includes(route.principal) ||
    route.is_standby ||
    (!route.can_create_roles && !route.is_superuser)
  ) {
    throw new TestEnvironmentError(
      'The local migration URL did not reach a writable test database as an offline principal.',
    );
  }
}

async function setTestRolePasswords(client: PoolClient, passwords: Map<string, string>) {
  await client.query('BEGIN');
  let commitAttempted = false;
  try {
    for (const role of testRoles) {
      await client.query('SELECT pg_catalog.set_config($1, $2, true)', [
        `portfolio_cms_test_credentials.${role.setting}`,
        passwords.get(role.name),
      ]);
    }
    await client.query(`
      DO $portfolio_cms_test_credentials$
      BEGIN
        EXECUTE format('ALTER ROLE %I PASSWORD %L', 'portfolio_public',
          current_setting('portfolio_cms_test_credentials.public'));
        EXECUTE format('ALTER ROLE %I PASSWORD %L', 'portfolio_cms',
          current_setting('portfolio_cms_test_credentials.cms'));
        EXECUTE format('ALTER ROLE %I PASSWORD %L', 'portfolio_auth',
          current_setting('portfolio_cms_test_credentials.auth'));
      END
      $portfolio_cms_test_credentials$;
    `);
    commitAttempted = true;
    await client.query('COMMIT');
  } catch {
    if (!commitAttempted) await client.query('ROLLBACK').catch(() => undefined);
    throw new TestEnvironmentError(
      commitAttempted
        ? 'The local role credential commit outcome is uncertain; keep the temporary secret file until verifying the test database.'
        : 'Could not prepare restricted role credentials for the local CMS test database.',
      commitAttempted,
    );
  }
}

async function prepareTestEnvironment() {
  if (process.argv.length > 2) {
    throw new TestEnvironmentError(
      'This command accepts connection values only through its environment.',
    );
  }
  const secretFile = process.env.CMS_TEST_SECRET_FILE;
  if (!secretFile || !secretFile.startsWith('/')) {
    throw new TestEnvironmentError(
      'Set CMS_TEST_SECRET_FILE to a new absolute temporary file path.',
    );
  }

  const migration = parseLocalMigrationURL(process.env.CMS_TEST_DATABASE_URL_MIGRATIONS);
  const passwords = new Map(testRoles.map(({ name }) => [name, randomBytes(32).toString('hex')]));
  const contents = makeEnvironmentFile(migration.url, passwords);
  let fileCreated = false;
  let handle;
  try {
    handle = await open(secretFile, 'wx', 0o600);
    fileCreated = true;
    await handle.chmod(0o600);
    await handle.writeFile(contents, 'utf8');
    await handle.sync();
    await handle.close();
    handle = undefined;
  } catch (error) {
    await handle?.close().catch(() => undefined);
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'EEXIST') {
      throw new TestEnvironmentError('Refusing to overwrite the CMS test secret file.');
    }
    if (fileCreated) await unlink(secretFile).catch(() => undefined);
    throw new TestEnvironmentError('Could not write the private CMS test secret file.');
  }

  const pool = new Pool({
    host: migration.hostname.replace(/^\[|\]$/gu, ''),
    port: migration.port,
    database: migration.database,
    user: migration.username,
    password: migration.password,
    ssl: false,
    max: 1,
    connectionTimeoutMillis: 5_000,
    application_name: 'portfolio-cms-test-setup',
  });
  try {
    const client = await pool.connect();
    try {
      await validateLocalDatabase(client, migration);
      await setTestRolePasswords(client, passwords);
    } finally {
      client.release();
    }
    await pool.end();
    process.stdout.write('Prepared the restricted local CMS test environment.\n');
  } catch (error) {
    await pool.end().catch(() => undefined);
    if (!(error instanceof TestEnvironmentError && error.commitOutcomeUnknown)) {
      await unlink(secretFile).catch(() => undefined);
    }
    throw error instanceof TestEnvironmentError
      ? error
      : new TestEnvironmentError(
          'CMS test environment setup failed without printing generated credentials.',
        );
  }
}

prepareTestEnvironment().catch((error: unknown) => {
  const message =
    error instanceof TestEnvironmentError ? error.message : 'CMS test environment setup failed.';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
