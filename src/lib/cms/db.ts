import 'server-only';

import { Pool, type PoolConfig } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { CmsSetupError } from './errors';
import { cmsSchema } from './schema';

export type CmsDatabaseRole = 'public' | 'cms' | 'auth' | 'migration';

const roleConfiguration: Record<CmsDatabaseRole, { env: string; applicationName: string }> = {
  public: { env: 'DATABASE_URL_PUBLIC', applicationName: 'portfolio-public' },
  cms: { env: 'DATABASE_URL_CMS', applicationName: 'portfolio-cms' },
  auth: { env: 'DATABASE_URL_AUTH', applicationName: 'portfolio-auth' },
  migration: { env: 'DATABASE_URL_MIGRATIONS', applicationName: 'portfolio-migrations' },
};

const pools = new Map<CmsDatabaseRole, Pool>();
const databases = new Map<CmsDatabaseRole, NodePgDatabase<typeof cmsSchema>>();

function isLocalHost(hostname: string) {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname === '::1'
  );
}

function connectionConfig(
  connectionString: string,
  environmentName: string,
  role: CmsDatabaseRole,
): Pick<PoolConfig, 'connectionString' | 'ssl'> {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new CmsSetupError([environmentName]);
  }
  if (
    (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') ||
    !url.hostname ||
    url.pathname.length < 2 ||
    url.hash
  ) {
    throw new CmsSetupError([environmentName]);
  }

  let username: string;
  try {
    username = decodeURIComponent(url.username);
  } catch {
    throw new CmsSetupError([environmentName]);
  }
  if (!username) throw new CmsSetupError([environmentName]);
  if (role !== 'migration' && username !== `portfolio_${role}`) {
    throw new CmsSetupError([`${environmentName} (expected portfolio_${role})`]);
  }
  if (
    role === 'migration' &&
    ['portfolio_public', 'portfolio_cms', 'portfolio_auth'].includes(username)
  ) {
    throw new CmsSetupError([`${environmentName} (offline migration principal required)`]);
  }

  const queryValues = new Map<string, string[]>();
  for (const [key, value] of url.searchParams) {
    if (!['sslmode', 'channel_binding', 'options'].includes(key)) {
      throw new CmsSetupError([`${environmentName} (unsupported connection parameter)`]);
    }
    const values = queryValues.get(key) ?? [];
    values.push(value);
    queryValues.set(key, values);
  }
  if ([...queryValues.values()].some((values) => values.length !== 1)) {
    throw new CmsSetupError([`${environmentName} (duplicate connection parameter)`]);
  }

  const local = isLocalHost(url.hostname);
  const sslMode = queryValues.get('sslmode')?.[0];
  const validSslMode = local
    ? sslMode === undefined || sslMode === 'disable'
    : ['require', 'verify-ca', 'verify-full'].includes(sslMode ?? '');
  if (!validSslMode) {
    throw new CmsSetupError([`${environmentName} (TLS configuration is invalid)`]);
  }
  const channelBinding = queryValues.get('channel_binding')?.[0];
  if (
    (channelBinding !== undefined && !['disable', 'prefer', 'require'].includes(channelBinding)) ||
    (local && channelBinding === 'require')
  ) {
    throw new CmsSetupError([`${environmentName} (channel binding configuration is invalid)`]);
  }
  const options = queryValues.get('options')?.[0];
  if (options !== undefined && !/^endpoint=[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(options)) {
    throw new CmsSetupError([`${environmentName} (unsupported PostgreSQL routing option)`]);
  }

  // pg-connection-string may replace an explicit TLS object with URI SSL
  // options, so remove sslmode after using it to enforce the TLS policy here.
  url.searchParams.delete('sslmode');
  return {
    connectionString: url.toString(),
    ssl: local ? false : { rejectUnauthorized: true },
  };
}

function poolConfig(role: CmsDatabaseRole): PoolConfig {
  const configuration = roleConfiguration[role];
  const connectionString = process.env[configuration.env];
  if (!connectionString) throw new CmsSetupError([configuration.env]);

  const parsed = connectionConfig(connectionString, configuration.env, role);
  return {
    ...parsed,
    max: role === 'public' ? 8 : 4,
    idleTimeoutMillis: 15_000,
    connectionTimeoutMillis: 5_000,
    keepAlive: true,
    application_name: configuration.applicationName,
  };
}

export function getPool(role: CmsDatabaseRole): Pool {
  const existing = pools.get(role);
  if (existing) return existing;
  const pool = new Pool(poolConfig(role));
  pools.set(role, pool);
  return pool;
}

function getDatabase(role: CmsDatabaseRole) {
  const existing = databases.get(role);
  if (existing) return existing;
  const database = drizzle(getPool(role), { schema: cmsSchema });
  databases.set(role, database);
  return database;
}

export function getCmsDb(): NodePgDatabase<typeof cmsSchema> {
  return getDatabase('cms');
}

export function getPublicDb(): NodePgDatabase<typeof cmsSchema> {
  return getDatabase('public');
}

export function getAuthDb(): NodePgDatabase<typeof cmsSchema> {
  return getDatabase('auth');
}

export function getMigrationDb(): NodePgDatabase<typeof cmsSchema> {
  return getDatabase('migration');
}

export function getMissingDatabaseConfiguration(): string[] {
  return (['public', 'cms', 'auth'] as const)
    .map((role) => roleConfiguration[role])
    .map(({ env }) => env)
    .filter((env) => !process.env[env]);
}
