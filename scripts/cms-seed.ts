import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { projectStudies } from '../src/content/engineering.ts';
import { profile, skills } from '../src/content/profile.ts';
import {
  getEntryTitle,
  validatePayload,
  type CmsKind,
  type CmsPayload,
} from '../src/lib/cms/model.ts';

const SYSTEM_ACTOR = 'system:cms-seed';

function makeConnectionConfig(connectionString: string) {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error('DATABASE_URL_CMS must be a PostgreSQL URL.');
  }
  if (
    (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') ||
    !url.hostname ||
    url.pathname.length < 2 ||
    url.hash
  ) {
    throw new Error('DATABASE_URL_CMS must be a PostgreSQL URL.');
  }
  let username: string;
  try {
    username = decodeURIComponent(url.username);
  } catch {
    throw new Error('DATABASE_URL_CMS must use the portfolio CMS role.');
  }
  if (username !== 'portfolio_cms') {
    throw new Error('DATABASE_URL_CMS must use the portfolio CMS role.');
  }

  const queryValues = new Map<string, string[]>();
  for (const [key, value] of url.searchParams) {
    if (!['sslmode', 'channel_binding', 'options'].includes(key)) {
      throw new Error('DATABASE_URL_CMS contains an unsupported connection parameter.');
    }
    const values = queryValues.get(key) ?? [];
    values.push(value);
    queryValues.set(key, values);
  }
  if ([...queryValues.values()].some((values) => values.length !== 1)) {
    throw new Error('DATABASE_URL_CMS contains duplicate connection parameters.');
  }

  const localHost = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(url.hostname);
  const sslMode = queryValues.get('sslmode')?.[0];
  const validSslMode = localHost
    ? sslMode === undefined || sslMode === 'disable'
    : ['require', 'verify-ca', 'verify-full'].includes(sslMode ?? '');
  if (!validSslMode) {
    throw new Error('DATABASE_URL_CMS has an invalid TLS configuration.');
  }
  const channelBinding = queryValues.get('channel_binding')?.[0];
  if (
    (channelBinding !== undefined && !['disable', 'prefer', 'require'].includes(channelBinding)) ||
    (localHost && channelBinding === 'require')
  ) {
    throw new Error('DATABASE_URL_CMS has an invalid channel binding configuration.');
  }
  const options = queryValues.get('options')?.[0];
  if (options !== undefined && !/^endpoint=[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(options)) {
    throw new Error('DATABASE_URL_CMS has an unsupported PostgreSQL routing option.');
  }
  url.searchParams.delete('sslmode');
  return {
    connectionString: url.toString(),
    ssl: localHost ? false : { rejectUnauthorized: true },
    max: 1,
    connectionTimeoutMillis: 5_000,
    application_name: 'portfolio-cms-seed',
  };
}

type SeedRecord = { kind: CmsKind; slug: string; position: number; payload: CmsPayload };

async function loadSeedRecords(): Promise<SeedRecord[]> {
  const contentDirectory = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../src/content',
  );
  const projectData = JSON.parse(
    await readFile(path.join(contentDirectory, 'projects.json'), 'utf8'),
  ) as unknown[];
  const designData = JSON.parse(
    await readFile(path.join(contentDirectory, 'designs.json'), 'utf8'),
  ) as unknown[];

  const projectRows = projectData.map((candidate, position) => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      throw new Error('The project snapshot contains an invalid record.');
    }
    const project = candidate as Record<string, unknown>;
    if (typeof project.slug !== 'string')
      throw new Error('The project snapshot contains an invalid slug.');
    const study = projectStudies[project.slug];
    const payload = validatePayload('project', {
      ...project,
      ...(study ? { study: structuredClone(study) } : {}),
    });
    return { kind: 'project' as const, slug: payload.slug, position, payload };
  });

  const designRows = designData.map((candidate, position) => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      throw new Error('The design snapshot contains an invalid record.');
    }
    const design = validatePayload('design', candidate);
    return { kind: 'design' as const, slug: design.id, position, payload: design };
  });

  const profilePayload = validatePayload('profile', { ...profile, skills });
  const studySlugs = Object.keys(projectStudies);
  if (studySlugs.some((slug) => !projectRows.some((project) => project.slug === slug))) {
    throw new Error('A project study does not belong to a snapshot project.');
  }

  return [
    ...projectRows,
    ...designRows,
    { kind: 'profile', slug: 'profile', position: 0, payload: profilePayload },
  ];
}

async function seed() {
  const connectionString = process.env.DATABASE_URL_CMS;
  if (!connectionString) throw new Error('Set DATABASE_URL_CMS in the process environment.');
  const records = await loadSeedRecords();
  const pool = new Pool(makeConnectionConfig(connectionString));
  let inserted = 0;
  let skipped = 0;

  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      try {
        await client.query("SELECT pg_advisory_xact_lock(hashtext('portfolio-cms-seed-v1'))");

        for (const record of records) {
          const existing = await client.query(
            'SELECT 1 FROM cms.entries WHERE kind = $1 AND slug = $2',
            [record.kind, record.slug],
          );
          if (existing.rowCount) {
            skipped += 1;
            continue;
          }

          const id = randomUUID();
          const title = getEntryTitle(record.kind, record.payload);
          await client.query(
            `
              INSERT INTO cms.entries
                (id, kind, slug, title, position, draft_revision, published_revision, has_published, archived)
              VALUES ($1, $2, $3, $4, $5, 1, 1, true, false)
            `,
            [id, record.kind, record.slug, title, record.position],
          );
          await client.query(
            `
              INSERT INTO cms.entry_revisions (entry_id, version, kind, slug, actor_id, payload)
              VALUES ($1, 1, $2, $3, $4, $5::jsonb)
            `,
            [id, record.kind, record.slug, SYSTEM_ACTOR, JSON.stringify(record.payload)],
          );
          await client.query(
            `
              INSERT INTO cms.published_content
                (entry_id, kind, slug, position, payload, revision, published_at)
              VALUES ($1, $2, $3, $4, $5::jsonb, 1, now())
            `,
            [id, record.kind, record.slug, record.position, JSON.stringify(record.payload)],
          );
          await client.query(
            `
              INSERT INTO cms.audit_events (actor_id, action, entry_id, metadata)
              VALUES ($1, 'seeded', $2, $3::jsonb)
            `,
            [
              SYSTEM_ACTOR,
              id,
              JSON.stringify({ kind: record.kind, slug: record.slug, revision: 1 }),
            ],
          );
          await client.query(
            `
              INSERT INTO cms.publish_outbox (event_type, entry_id, slug)
              VALUES ('content.published', $1, $2)
            `,
            [id, record.slug],
          );
          inserted += 1;
        }

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      }
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }

  process.stdout.write(
    `CMS seed complete: ${inserted} imported, ${skipped} existing records protected.\n`,
  );
}

seed().catch((error: unknown) => {
  const message = (error instanceof Error ? error.message : 'Unknown seed error.')
    .replace(/postgres(?:ql)?:\/\/[^\s"'<>]+/giu, '<redacted PostgreSQL URL>')
    .replace(/\b(password|passwd)=([^&\s]+)/giu, '$1=<redacted>');
  process.stderr.write(`CMS seed failed: ${message}\n`);
  process.exitCode = 1;
});
