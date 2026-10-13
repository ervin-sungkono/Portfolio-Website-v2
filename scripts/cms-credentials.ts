import { randomBytes } from 'node:crypto';
import { open, unlink, type FileHandle } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool, type PoolClient, type PoolConfig } from 'pg';
import {
  CmsCredentialConfigError,
  getRuntimeTarget,
  makeMigrationConnectionString,
  makeRuntimeURL,
  parsePostgresURL,
  type ParsedPostgresURL,
} from './cms-credential-config.ts';

const runtimeRoles = [
  { name: 'portfolio_public', setting: 'public' },
  { name: 'portfolio_cms', setting: 'cms' },
  { name: 'portfolio_auth', setting: 'auth' },
] as const;
const runtimeRoleNames: string[] = runtimeRoles.map(({ name }) => name);
const managedSchemas = ['cms', 'auth'];
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = path.join(repositoryRoot, '.env.cms.runtime.local');

class SetupError extends Error {}

function makeMigrationPoolConfig(connection: ParsedPostgresURL): PoolConfig {
  return {
    connectionString: makeMigrationConnectionString(connection),
    ssl: connection.local ? false : { rejectUnauthorized: true },
    max: 1,
    connectionTimeoutMillis: 5_000,
    application_name: 'portfolio-cms-credential-setup',
  };
}

async function validateMigrationRoute(client: PoolClient, migration: ParsedPostgresURL) {
  const route = await client.query<{
    database_name: string;
    principal: string;
    is_standby: boolean;
    server_version: number;
    principal_is_superuser: boolean;
    principal_can_create_roles: boolean;
  }>(`
    SELECT current_database() AS database_name,
           current_user AS principal,
           pg_catalog.pg_is_in_recovery() AS is_standby,
           current_setting('server_version_num')::integer AS server_version,
           role_info.rolsuper AS principal_is_superuser,
           role_info.rolcreaterole AS principal_can_create_roles
    FROM pg_catalog.pg_roles AS role_info
    WHERE role_info.rolname = current_user
  `);
  const current = route.rows[0];
  if (
    !current ||
    current.database_name !== migration.database ||
    current.principal !== migration.username ||
    runtimeRoleNames.includes(current.principal) ||
    current.is_standby ||
    current.server_version < 160_000 ||
    (!current.principal_is_superuser && !current.principal_can_create_roles)
  ) {
    throw new SetupError(
      'DATABASE_URL_MIGRATIONS must reach the expected writable database as a privileged offline principal.',
    );
  }
}

async function validateRuntimeRoles(client: PoolClient) {
  const roles = await client.query<{
    rolname: string;
    rolcanlogin: boolean;
    rolsuper: boolean;
    rolcreatedb: boolean;
    rolcreaterole: boolean;
    rolinherit: boolean;
    rolreplication: boolean;
    rolbypassrls: boolean;
    oid: string;
  }>(
    `SELECT oid, rolname, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole,
            rolinherit, rolreplication, rolbypassrls
     FROM pg_catalog.pg_roles
     WHERE rolname = ANY($1::text[])`,
    [runtimeRoleNames],
  );

  if (
    roles.rowCount !== runtimeRoleNames.length ||
    roles.rows.some(
      (role) =>
        !role.rolcanlogin ||
        role.rolsuper ||
        role.rolcreatedb ||
        role.rolcreaterole ||
        role.rolinherit ||
        role.rolreplication ||
        role.rolbypassrls,
    )
  ) {
    throw new SetupError(
      'The three CMS runtime roles must already exist with the restricted migration flags.',
    );
  }

  const memberships = await client.query<{
    member_name: string;
    granted_name: string;
    admin_option: boolean;
    inherit_option: boolean;
    set_option: boolean;
  }>(
    `SELECT member_role.rolname AS member_name,
            granted_role.rolname AS granted_name,
            membership.admin_option,
            membership.inherit_option,
            membership.set_option
     FROM pg_catalog.pg_auth_members AS membership
     JOIN pg_catalog.pg_roles AS member_role ON member_role.oid = membership.member
     JOIN pg_catalog.pg_roles AS granted_role ON granted_role.oid = membership.roleid
     WHERE membership.member IN (
       SELECT oid FROM pg_catalog.pg_roles WHERE rolname = ANY($1::text[])
     )
        OR membership.roleid IN (
       SELECT oid FROM pg_catalog.pg_roles WHERE rolname = ANY($1::text[])
     )`,
    [runtimeRoleNames],
  );

  const currentPrincipal = await client.query<{ current_user: string }>('SELECT current_user');
  const principal = currentPrincipal.rows[0]?.current_user;
  if (
    memberships.rows.some(
      (membership) =>
        membership.member_name !== principal ||
        !runtimeRoleNames.includes(membership.granted_name) ||
        !membership.admin_option ||
        membership.inherit_option ||
        membership.set_option,
    )
  ) {
    throw new SetupError('A CMS runtime role has an unexpected role membership.');
  }

  const unsafeOwnership = await client.query<{ unsafe_ownership: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM pg_catalog.pg_namespace AS namespace
       WHERE namespace.nspname = ANY($1::text[])
         AND namespace.nspowner IN (
           SELECT oid FROM pg_catalog.pg_roles WHERE rolname = ANY($2::text[])
         )
       UNION ALL
       SELECT 1
       FROM pg_catalog.pg_class AS relation
       JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
       WHERE namespace.nspname = ANY($1::text[])
         AND relation.relowner IN (
           SELECT oid FROM pg_catalog.pg_roles WHERE rolname = ANY($2::text[])
         )
       UNION ALL
       SELECT 1
       FROM pg_catalog.pg_proc AS routine
       JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = routine.pronamespace
       WHERE namespace.nspname = ANY($1::text[])
         AND routine.proowner IN (
           SELECT oid FROM pg_catalog.pg_roles WHERE rolname = ANY($2::text[])
         )
       UNION ALL
       SELECT 1
       FROM pg_catalog.pg_type AS data_type
       JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = data_type.typnamespace
       WHERE namespace.nspname = ANY($1::text[])
         AND data_type.typowner IN (
           SELECT oid FROM pg_catalog.pg_roles WHERE rolname = ANY($2::text[])
         )
     ) AS unsafe_ownership`,
    [managedSchemas, runtimeRoleNames],
  );
  if (unsafeOwnership.rows[0]?.unsafe_ownership) {
    throw new SetupError('A CMS runtime role owns an object in a managed schema.');
  }
}

function hasCode(error: unknown, code: string) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}

async function createOutputFile(contents: string) {
  let handle: FileHandle | undefined;
  let created = false;
  try {
    handle = await open(outputPath, 'wx', 0o600);
    created = true;
    await handle.chmod(0o600);
    await handle.writeFile(contents, 'utf8');
    await handle.sync();
    return handle;
  } catch (error) {
    await handle?.close().catch(() => undefined);
    if (hasCode(error, 'EEXIST')) {
      throw new SetupError(
        'Refusing to overwrite .env.cms.runtime.local; preserve or remove the existing file manually before retrying.',
      );
    }
    if (created) await unlink(outputPath).catch(() => undefined);
    throw new SetupError('Could not create the private CMS runtime environment file.');
  }
}

async function setupCredentials() {
  if (process.argv.length > 2) {
    throw new SetupError('This command accepts connection values only through its environment.');
  }

  const migration = parsePostgresURL(
    process.env.DATABASE_URL_MIGRATIONS,
    'DATABASE_URL_MIGRATIONS',
    {
      credentialsRequired: true,
    },
  );
  const target = getRuntimeTarget(migration, process.env.DATABASE_URL_RUNTIME_ENDPOINT);
  const passwords = new Map(
    runtimeRoles.map(({ name }) => [name, randomBytes(32).toString('hex')]),
  );
  const output = runtimeRoles
    .map(
      ({ name }) =>
        `DATABASE_URL_${name.slice('portfolio_'.length).toUpperCase()}=${makeRuntimeURL(
          name,
          passwords.get(name)!,
          target,
        )}`,
    )
    .join('\n')
    .concat('\n');

  let outputHandle: FileHandle | undefined = await createOutputFile(output);
  let outputCreated = true;
  let commitAttempted = false;
  const pool = new Pool(makeMigrationPoolConfig(migration));

  try {
    const client = await pool.connect();
    try {
      await validateMigrationRoute(client, migration);
      await validateRuntimeRoles(client);
      await client.query('BEGIN');
      try {
        await validateMigrationRoute(client, migration);
        await validateRuntimeRoles(client);
        for (const role of runtimeRoles) {
          await client.query('SELECT pg_catalog.set_config($1, $2, true)', [
            `portfolio_cms_credentials.${role.setting}`,
            passwords.get(role.name)!,
          ]);
        }
        await client.query(`
          DO $portfolio_cms_credentials$
          BEGIN
            EXECUTE format('ALTER ROLE %I PASSWORD %L', 'portfolio_public',
              current_setting('portfolio_cms_credentials.public'));
            EXECUTE format('ALTER ROLE %I PASSWORD %L', 'portfolio_cms',
              current_setting('portfolio_cms_credentials.cms'));
            EXECUTE format('ALTER ROLE %I PASSWORD %L', 'portfolio_auth',
              current_setting('portfolio_cms_credentials.auth'));
          END
          $portfolio_cms_credentials$;
        `);
        commitAttempted = true;
        await client.query('COMMIT');
      } catch (error) {
        if (!commitAttempted) await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      }
    } finally {
      client.release();
    }
    await pool.end();
    await outputHandle.close();
    outputHandle = undefined;
    outputCreated = false;
    process.stdout.write('Created .env.cms.runtime.local with three runtime-only database URLs.\n');
  } catch (error) {
    await outputHandle?.close().catch(() => undefined);
    await pool.end().catch(() => undefined);
    if (outputCreated && !commitAttempted) await unlink(outputPath).catch(() => undefined);
    if (commitAttempted) {
      throw new SetupError(
        'Credential transaction outcome is uncertain. Keep .env.cms.runtime.local and verify the database before retrying.',
      );
    }
    throw error instanceof SetupError || error instanceof CmsCredentialConfigError
      ? error
      : new SetupError(
          'CMS runtime credential setup failed. Verify migration access and role state.',
        );
  }
}

setupCredentials().catch((error: unknown) => {
  const message =
    error instanceof SetupError || error instanceof CmsCredentialConfigError
      ? error.message
      : 'CMS runtime credential setup failed.';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
