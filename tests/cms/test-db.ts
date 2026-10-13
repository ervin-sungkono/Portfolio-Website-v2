import { Pool } from 'pg';

export type CmsTestRole = 'public' | 'cms' | 'auth' | 'migrations';

const roleEnvironment: Record<CmsTestRole, string> = {
  public: 'CMS_TEST_DATABASE_URL_PUBLIC',
  cms: 'CMS_TEST_DATABASE_URL_CMS',
  auth: 'CMS_TEST_DATABASE_URL_AUTH',
  migrations: 'CMS_TEST_DATABASE_URL_MIGRATIONS',
};

/** Validates a dedicated QA URL without ever formatting its credentials. */
export function cmsTestDatabaseUrl(role: CmsTestRole): string {
  const variable = roleEnvironment[role];
  const value = process.env[variable];
  if (!value) throw new Error(`${variable} is required for CMS integration tests.`);

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${variable} must be a valid local PostgreSQL URL.`);
  }

  const localHost = ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(url.hostname);
  if (
    !localHost ||
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    url.pathname !== '/portfolio_cms_test' ||
    url.search.length > 0 ||
    url.hash.length > 0
  ) {
    throw new Error(
      `${variable} must target the isolated portfolio_cms_test database on loopback.`,
    );
  }

  return value;
}

/**
 * Opens only the isolated local QA database. Never fall back to app runtime
 * URLs: those may point at a hosted service and are intentionally a separate
 * set of credentials.
 */
export function createCmsTestPool(role: CmsTestRole): Pool {
  return new Pool({
    connectionString: cmsTestDatabaseUrl(role),
    application_name: `portfolio-cms-qa-${role}`,
    max: 4,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 5_000,
    ssl: false,
  });
}

export async function closeCmsTestPools(pools: Pool[]) {
  await Promise.all(pools.map((pool) => pool.end()));
}
