import assert from 'node:assert/strict';
import test from 'node:test';
import type { Pool } from 'pg';
import { createCmsTestPool } from './test-db.ts';

function tableIdentity(table: string): { schema: string; name: string } {
  const separator = table.indexOf('.');
  if (separator < 1 || separator === table.length - 1) {
    throw new Error('Role privilege checks require a schema-qualified table name.');
  }
  return {
    schema: table.slice(0, separator),
    name: table.slice(separator + 1).replace(/^"(.+)"$/u, '$1'),
  };
}

async function tablePrivilege(pool: Pool, table: string, privilege: string): Promise<boolean> {
  const { schema, name } = tableIdentity(table);
  const result = await pool.query(
    `SELECT COALESCE((
       SELECT has_table_privilege(current_user, relation.oid, $3)
         FROM pg_catalog.pg_class AS relation
         JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
        WHERE namespace.nspname = $1 AND relation.relname = $2
     ), false) AS allowed`,
    [schema, name, privilege],
  );
  return result.rows[0]?.allowed === true;
}

async function columnPrivilege(
  pool: Pool,
  table: string,
  column: string,
  privilege: string,
): Promise<boolean> {
  const { schema, name } = tableIdentity(table);
  const result = await pool.query(
    `SELECT COALESCE((
       SELECT has_column_privilege(current_user, relation.oid, $3, $4)
         FROM pg_catalog.pg_class AS relation
         JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
        WHERE namespace.nspname = $1 AND relation.relname = $2
     ), false) AS allowed`,
    [schema, name, column, privilege],
  );
  return result.rows[0]?.allowed === true;
}

async function schemaPrivilege(pool: Pool, schema: string, privilege: string): Promise<boolean> {
  const result = await pool.query('SELECT has_schema_privilege(current_user, $1, $2) AS allowed', [
    schema,
    privilege,
  ]);
  return result.rows[0]?.allowed === true;
}

async function columnSelects(pool: Pool, table: string): Promise<string[]> {
  const result = await pool.query(
    `SELECT column_name
       FROM information_schema.column_privileges
      WHERE table_schema = 'cms'
        AND table_name = $1
        AND grantee = current_user
        AND privilege_type = 'SELECT'
      ORDER BY column_name`,
    [table],
  );
  return result.rows.map((row: { column_name: string }) => row.column_name);
}

async function assertApplicationRole(pool: Pool, expectedName: string) {
  const result = await pool.query(
    `SELECT current_user AS name, rolsuper, rolcreatedb, rolcreaterole, rolinherit,
            rolreplication, rolbypassrls
       FROM pg_catalog.pg_roles
      WHERE rolname = current_user`,
  );
  const role = result.rows[0];
  assert.ok(role, 'The connected PostgreSQL role must exist.');
  assert.equal(role.name, expectedName);
  assert.equal(role.rolsuper, false);
  assert.equal(role.rolcreatedb, false);
  assert.equal(role.rolcreaterole, false);
  assert.equal(role.rolinherit, false);
  assert.equal(role.rolreplication, false);
  assert.equal(role.rolbypassrls, false);
  const memberships = await pool.query(
    `SELECT count(*)::int AS count
       FROM pg_catalog.pg_auth_members
      WHERE member = (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = current_user)
         OR roleid = (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = current_user)`,
  );
  assert.equal(memberships.rows[0]?.count, 0, 'Runtime roles must not have grant memberships.');
}

test('public database role reads only the published projections', async () => {
  const pool = createCmsTestPool('public');
  try {
    await assertApplicationRole(pool, 'portfolio_public');

    assert.equal(await schemaPrivilege(pool, 'cms', 'USAGE'), true);
    assert.equal(await schemaPrivilege(pool, 'auth', 'USAGE'), false);
    assert.equal(await schemaPrivilege(pool, 'cms', 'CREATE'), false);
    assert.equal(await schemaPrivilege(pool, 'auth', 'CREATE'), false);
    assert.equal(await schemaPrivilege(pool, 'public', 'CREATE'), false);
    await pool.query('SELECT kind, slug, position, payload FROM cms.published_content LIMIT 0');
    await pool.query(
      'SELECT asset_id, version, private_key, mime, width, height, alt FROM cms.published_media LIMIT 0',
    );
    assert.deepEqual(await columnSelects(pool, 'published_content'), [
      'kind',
      'payload',
      'position',
      'slug',
    ]);
    assert.deepEqual(await columnSelects(pool, 'published_media'), [
      'alt',
      'asset_id',
      'height',
      'mime',
      'private_key',
      'version',
      'width',
    ]);

    const privateTables = [
      'cms.entries',
      'cms.entry_revisions',
      'cms.audit_events',
      'cms.publish_outbox',
      'cms.save_requests',
      'cms.media_assets',
      'auth."user"',
      'auth."session"',
      'auth."account"',
      'auth."twoFactor"',
      'auth.admin_memberships',
    ];
    for (const table of privateTables) {
      assert.equal(await tablePrivilege(pool, table, 'SELECT'), false, `${table} is private.`);
      await assert.rejects(pool.query(`SELECT 1 FROM ${table} LIMIT 0`), { code: '42501' });
    }

    for (const table of ['cms.published_content', 'cms.published_media']) {
      for (const privilege of ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) {
        assert.equal(await tablePrivilege(pool, table, privilege), false, `${table} is read-only.`);
      }
    }

    await assert.rejects(
      pool.query('UPDATE cms.published_content SET position = position WHERE false'),
      { code: '42501' },
    );
    await assert.rejects(
      pool.query(
        `INSERT INTO cms.published_content
           (entry_id, kind, slug, position, payload, revision)
         VALUES ('00000000-0000-4000-8000-000000000001', 'project', 'qa-probe', 0, '{}', 1)`,
      ),
      { code: '42501' },
    );
    await assert.rejects(pool.query('SELECT entry_id FROM cms.published_content LIMIT 0'), {
      code: '42501',
    });
  } finally {
    await pool.end();
  }
});

test('CMS database role can edit content but cannot alter auth membership or audit history', async () => {
  const pool = createCmsTestPool('cms');
  try {
    await assertApplicationRole(pool, 'portfolio_cms');
    assert.equal(await schemaPrivilege(pool, 'cms', 'USAGE'), true);
    assert.equal(await schemaPrivilege(pool, 'auth', 'USAGE'), false);
    assert.equal(await schemaPrivilege(pool, 'cms', 'CREATE'), false);
    assert.equal(await schemaPrivilege(pool, 'auth', 'CREATE'), false);
    assert.equal(await schemaPrivilege(pool, 'public', 'CREATE'), false);

    for (const table of ['cms.entries', 'cms.entry_revisions', 'cms.published_content']) {
      assert.equal(await tablePrivilege(pool, table, 'SELECT'), true);
    }
    assert.equal(await tablePrivilege(pool, 'cms.entries', 'INSERT'), true);
    assert.equal(await tablePrivilege(pool, 'cms.entries', 'UPDATE'), false);
    for (const column of [
      'slug',
      'title',
      'position',
      'draft_revision',
      'published_revision',
      'has_published',
      'updated_at',
    ]) {
      assert.equal(await columnPrivilege(pool, 'cms.entries', column, 'UPDATE'), true);
    }
    for (const column of ['id', 'kind', 'created_at', 'archived']) {
      assert.equal(await columnPrivilege(pool, 'cms.entries', column, 'UPDATE'), false);
    }
    await assert.rejects(pool.query('UPDATE cms.entries SET archived = true WHERE false'), {
      code: '42501',
    });
    assert.equal(await tablePrivilege(pool, 'cms.entries', 'DELETE'), false);
    assert.equal(await tablePrivilege(pool, 'cms.audit_events', 'INSERT'), true);
    assert.equal(await tablePrivilege(pool, 'cms.audit_events', 'UPDATE'), false);
    assert.equal(await tablePrivilege(pool, 'cms.audit_events', 'DELETE'), false);
    assert.equal(await tablePrivilege(pool, 'cms.publish_outbox', 'UPDATE'), false);
    assert.equal(await columnPrivilege(pool, 'cms.publish_outbox', 'completed_at', 'UPDATE'), true);
    for (const column of ['id', 'event_type', 'entry_id', 'slug', 'created_at']) {
      assert.equal(await columnPrivilege(pool, 'cms.publish_outbox', column, 'UPDATE'), false);
    }
    assert.equal(await tablePrivilege(pool, 'cms.media_assets', 'UPDATE'), false);
    for (const column of [
      'version',
      'state',
      'private_key',
      'mime',
      'width',
      'height',
      'byte_size',
      'alt',
    ]) {
      assert.equal(await columnPrivilege(pool, 'cms.media_assets', column, 'UPDATE'), true);
    }
    for (const column of ['id', 'created_by', 'created_at']) {
      assert.equal(await columnPrivilege(pool, 'cms.media_assets', column, 'UPDATE'), false);
    }
    await assert.rejects(
      pool.query('UPDATE cms.media_assets SET created_by = created_by WHERE false'),
      { code: '42501' },
    );
    assert.equal(await tablePrivilege(pool, 'auth.admin_memberships', 'SELECT'), false);
    assert.equal(await tablePrivilege(pool, 'auth.admin_memberships', 'INSERT'), false);
    assert.equal(await tablePrivilege(pool, 'auth.admin_memberships', 'UPDATE'), false);
    assert.equal(await tablePrivilege(pool, 'auth.admin_memberships', 'DELETE'), false);
  } finally {
    await pool.end();
  }
});

test('auth database role can verify owners without reading or writing CMS content', async () => {
  const pool = createCmsTestPool('auth');
  try {
    await assertApplicationRole(pool, 'portfolio_auth');
    assert.equal(await schemaPrivilege(pool, 'auth', 'USAGE'), true);
    assert.equal(await schemaPrivilege(pool, 'cms', 'USAGE'), false);
    assert.equal(await schemaPrivilege(pool, 'auth', 'CREATE'), false);
    assert.equal(await schemaPrivilege(pool, 'cms', 'CREATE'), false);
    assert.equal(await schemaPrivilege(pool, 'public', 'CREATE'), false);
    assert.equal(await tablePrivilege(pool, 'auth."user"', 'SELECT'), true);
    assert.equal(await tablePrivilege(pool, 'auth."session"', 'SELECT'), true);
    assert.equal(await tablePrivilege(pool, 'auth."account"', 'SELECT'), true);
    assert.equal(await tablePrivilege(pool, 'auth."twoFactor"', 'SELECT'), true);
    assert.equal(await tablePrivilege(pool, 'auth.admin_memberships', 'SELECT'), true);
    for (const table of ['auth."user"', 'auth."session"', 'auth."account"', 'auth."twoFactor"']) {
      assert.equal(await tablePrivilege(pool, table, 'INSERT'), true);
      assert.equal(await tablePrivilege(pool, table, 'UPDATE'), true);
    }

    for (const table of [
      'cms.entries',
      'cms.entry_revisions',
      'cms.published_content',
      'cms.audit_events',
      'cms.media_assets',
    ]) {
      assert.equal(
        await tablePrivilege(pool, table, 'SELECT'),
        false,
        `${table} is outside auth scope.`,
      );
      assert.equal(
        await tablePrivilege(pool, table, 'INSERT'),
        false,
        `${table} is outside auth scope.`,
      );
      assert.equal(
        await tablePrivilege(pool, table, 'UPDATE'),
        false,
        `${table} is outside auth scope.`,
      );
      assert.equal(
        await tablePrivilege(pool, table, 'DELETE'),
        false,
        `${table} is outside auth scope.`,
      );
    }
    await assert.rejects(pool.query('SELECT 1 FROM cms.entries LIMIT 0'), { code: '42501' });

    for (const privilege of ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) {
      assert.equal(
        await tablePrivilege(pool, 'auth.admin_memberships', privilege),
        false,
        'Only the offline migration role can change owner membership.',
      );
    }
    await assert.rejects(
      pool.query('UPDATE auth.admin_memberships SET active = false WHERE false'),
      { code: '42501' },
    );
  } finally {
    await pool.end();
  }
});
