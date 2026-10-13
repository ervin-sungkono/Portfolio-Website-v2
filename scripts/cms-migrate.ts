import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

function makeConnectionConfig(connectionString: string) {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error('DATABASE_URL_MIGRATIONS must be a PostgreSQL URL.');
  }
  if (
    (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') ||
    !url.hostname ||
    url.pathname.length < 2 ||
    url.hash
  ) {
    throw new Error('DATABASE_URL_MIGRATIONS must be a PostgreSQL URL.');
  }
  let username: string;
  try {
    username = decodeURIComponent(url.username);
  } catch {
    throw new Error('DATABASE_URL_MIGRATIONS must use an offline migration principal.');
  }
  if (!username || ['portfolio_public', 'portfolio_cms', 'portfolio_auth'].includes(username)) {
    throw new Error('DATABASE_URL_MIGRATIONS must use an offline migration principal.');
  }

  const queryValues = new Map<string, string[]>();
  for (const [key, value] of url.searchParams) {
    if (!['sslmode', 'channel_binding', 'options'].includes(key)) {
      throw new Error('DATABASE_URL_MIGRATIONS contains an unsupported connection parameter.');
    }
    const values = queryValues.get(key) ?? [];
    values.push(value);
    queryValues.set(key, values);
  }
  if ([...queryValues.values()].some((values) => values.length !== 1)) {
    throw new Error('DATABASE_URL_MIGRATIONS contains duplicate connection parameters.');
  }

  const localHost = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(url.hostname);
  const sslMode = queryValues.get('sslmode')?.[0];
  const validSslMode = localHost
    ? sslMode === undefined || sslMode === 'disable'
    : ['require', 'verify-ca', 'verify-full'].includes(sslMode ?? '');
  if (!validSslMode) {
    throw new Error('DATABASE_URL_MIGRATIONS has an invalid TLS configuration.');
  }
  const channelBinding = queryValues.get('channel_binding')?.[0];
  if (
    (channelBinding !== undefined && !['disable', 'prefer', 'require'].includes(channelBinding)) ||
    (localHost && channelBinding === 'require')
  ) {
    throw new Error('DATABASE_URL_MIGRATIONS has an invalid channel binding configuration.');
  }
  const options = queryValues.get('options')?.[0];
  if (options !== undefined && !/^endpoint=[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(options)) {
    throw new Error('DATABASE_URL_MIGRATIONS has an unsupported PostgreSQL routing option.');
  }
  url.searchParams.delete('sslmode');

  return {
    connectionString: url.toString(),
    ssl: localHost ? false : { rejectUnauthorized: true },
    max: 1,
    connectionTimeoutMillis: 5_000,
    application_name: 'portfolio-cms-migration',
  };
}

async function migrate() {
  const connectionString = process.env.DATABASE_URL_MIGRATIONS;
  if (!connectionString) throw new Error('Set DATABASE_URL_MIGRATIONS in the process environment.');

  const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../db/migrations');
  const files = (await readdir(directory))
    .filter((file) => /^\d{4}_[a-z0-9_-]+\.sql$/i.test(file))
    .sort((left, right) => left.localeCompare(right));
  if (files.length === 0) throw new Error('No CMS migration files were found.');

  const pool = new Pool(makeConnectionConfig(connectionString));
  try {
    const client = await pool.connect();
    let migrationLockAcquired = false;
    try {
      const principal = await client.query<{
        current_user: string;
        rolsuper: boolean;
        rolcreaterole: boolean;
        can_create_schema: boolean;
      }>(`
        SELECT current_user,
               role.rolsuper,
               role.rolcreaterole,
               pg_catalog.has_database_privilege(current_user, current_database(), 'CREATE') AS can_create_schema
        FROM pg_catalog.pg_roles AS role
        WHERE role.rolname = current_user
      `);
      const role = principal.rows[0];
      if (
        ['portfolio_public', 'portfolio_cms', 'portfolio_auth'].includes(role?.current_user ?? '')
      ) {
        throw new Error('CMS migrations must use the offline migration principal.');
      }
      if (!role || (!role.rolsuper && !role.rolcreaterole)) {
        throw new Error(
          'The offline migration principal needs CREATEROLE; superuser access is not required.',
        );
      }
      if (!role.can_create_schema) {
        throw new Error('The offline migration principal needs CREATE on the target database.');
      }
      await client.query('SELECT pg_advisory_lock(hashtextextended($1, 0))', [
        'portfolio-cms-schema-migrations-v1',
      ]);
      migrationLockAcquired = true;
      await client.query('CREATE SCHEMA IF NOT EXISTS cms');
      await client.query(`
        CREATE TABLE IF NOT EXISTS cms.schema_migrations (
          name text PRIMARY KEY,
          checksum text NOT NULL CHECK (checksum ~ '^[a-f0-9]{64}$'),
          applied_at timestamptz NOT NULL DEFAULT now()
        )
      `);

      for (const file of files) {
        const migration = await readFile(path.join(directory, file), 'utf8');
        const checksum = createHash('sha256').update(migration).digest('hex');
        await client.query('BEGIN');
        try {
          const prior = await client.query<{ checksum: string }>(
            'SELECT checksum FROM cms.schema_migrations WHERE name = $1',
            [file],
          );
          if (prior.rows[0]) {
            if (prior.rows[0].checksum !== checksum) {
              throw new Error(`Applied migration ${file} has changed.`);
            }
            await client.query('COMMIT');
            process.stdout.write(`Already applied ${file}\n`);
            continue;
          }

          await client.query(migration);
          await client.query('INSERT INTO cms.schema_migrations (name, checksum) VALUES ($1, $2)', [
            file,
            checksum,
          ]);
          await client.query('COMMIT');
          process.stdout.write(`Applied ${file}\n`);
        } catch (error) {
          await client.query('ROLLBACK').catch(() => undefined);
          throw error;
        }
      }
    } finally {
      if (migrationLockAcquired) {
        await client
          .query('SELECT pg_advisory_unlock(hashtextextended($1, 0))', [
            'portfolio-cms-schema-migrations-v1',
          ])
          .catch(() => undefined);
      }
      client.release();
    }
  } finally {
    await pool.end();
  }
}

function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Unknown migration error.';
  return message
    .replace(/postgres(?:ql)?:\/\/[^\s"'<>]+/giu, '<redacted PostgreSQL URL>')
    .replace(/\b(password|passwd)=([^&\s]+)/giu, '$1=<redacted>');
}

migrate().catch((error: unknown) => {
  process.stderr.write(`CMS migration failed: ${safeErrorMessage(error)}\n`);
  process.exitCode = 1;
});
