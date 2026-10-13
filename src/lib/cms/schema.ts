import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type { CmsKind, CmsPayload } from './model';

const cms = pgSchema('cms');

export const entries = cms.table(
  'entries',
  {
    id: uuid().notNull(),
    kind: text().$type<CmsKind>().notNull(),
    slug: text().notNull(),
    title: text().notNull(),
    position: integer().notNull(),
    draftRevision: integer('draft_revision').notNull().default(0),
    publishedRevision: integer('published_revision'),
    hasPublished: boolean('has_published').notNull().default(false),
    archived: boolean().notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    uniqueIndex('entries_kind_slug_uidx').on(table.kind, table.slug),
    uniqueIndex('entries_profile_singleton_uidx')
      .on(table.kind)
      .where(sql`${table.kind} = 'profile'`),
    check('entries_position_check', sql`${table.position} >= 0`),
    check('entries_revision_check', sql`${table.draftRevision} >= 0`),
    check(
      'entries_slug_check',
      sql`(${table.kind} = 'profile' AND ${table.slug} = 'profile') OR (${table.kind} <> 'profile' AND ${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$')`,
    ),
  ],
);

export const entryRevisions = cms.table(
  'entry_revisions',
  {
    entryId: uuid('entry_id').notNull(),
    version: integer().notNull(),
    kind: text().$type<CmsKind>().notNull(),
    slug: text().notNull(),
    actorId: text('actor_id').notNull(),
    payload: jsonb().$type<CmsPayload>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.entryId, table.version] }),
    check('entry_revisions_version_check', sql`${table.version} > 0`),
  ],
);

export const publishedContent = cms.table(
  'published_content',
  {
    entryId: uuid('entry_id').notNull(),
    kind: text().$type<CmsKind>().notNull(),
    slug: text().notNull(),
    position: integer().notNull(),
    payload: jsonb().$type<CmsPayload>().notNull(),
    revision: integer().notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.entryId] }),
    uniqueIndex('published_content_kind_slug_uidx').on(table.kind, table.slug),
    uniqueIndex('published_content_profile_singleton_uidx')
      .on(table.kind)
      .where(sql`${table.kind} = 'profile'`),
    check('published_content_position_check', sql`${table.position} >= 0`),
  ],
);

export const auditEvents = cms.table(
  'audit_events',
  {
    id: uuid().notNull().defaultRandom(),
    actorId: text('actor_id').notNull(),
    action: text().notNull(),
    entryId: uuid('entry_id'),
    metadata: jsonb()
      .$type<Record<string, string | number | boolean | null>>()
      .notNull()
      .default({}),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.id] })],
);

export const publishOutbox = cms.table(
  'publish_outbox',
  {
    id: uuid().notNull().defaultRandom(),
    eventType: text('event_type').notNull(),
    entryId: uuid('entry_id').notNull(),
    slug: text().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [primaryKey({ columns: [table.id] })],
);

export const saveRequests = cms.table(
  'save_requests',
  {
    requestId: uuid('request_id').notNull(),
    actorId: text('actor_id').notNull(),
    fingerprint: text().notNull(),
    entryId: uuid('entry_id').notNull(),
    revision: integer().notNull(),
    position: integer().notNull(),
    publishedRevision: integer('published_revision'),
    archived: boolean().notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.requestId] }),
    check('save_requests_revision_check', sql`${table.revision} > 0`),
  ],
);

export const mediaAssets = cms.table(
  'media_assets',
  {
    id: uuid().notNull(),
    version: text().notNull(),
    state: text().notNull(),
    privateKey: text('private_key').notNull(),
    mime: text(),
    width: integer(),
    height: integer(),
    byteSize: integer('byte_size'),
    alt: text().notNull(),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.id, table.version] }),
    check(
      'media_assets_state_check',
      sql`${table.state} IN ('staging', 'verified', 'published', 'rejected')`,
    ),
    check('media_assets_version_check', sql`${table.version} ~ '^[a-f0-9]{64}$'`),
    check(
      'media_assets_private_key_state_check',
      sql`(${table.state} = 'staging' AND ${table.version} = repeat('0', 64) AND ${table.privateKey} = 'staging/' || ${table.id}::text) OR (${table.state} = 'rejected' AND ${table.version} = repeat('0', 64) AND ${table.privateKey} = 'staging/' || ${table.id}::text) OR (${table.state} = 'rejected' AND ${table.version} <> repeat('0', 64) AND ${table.privateKey} = 'verified/' || ${table.id}::text || '/' || ${table.version}) OR (${table.state} IN ('verified', 'published') AND ${table.privateKey} = 'verified/' || ${table.id}::text || '/' || ${table.version})`,
    ),
    check(
      'media_assets_dimensions_check',
      sql`(${table.width} IS NULL OR ${table.width} > 0) AND (${table.height} IS NULL OR ${table.height} > 0)`,
    ),
    check('media_assets_byte_size_check', sql`${table.byteSize} IS NULL OR ${table.byteSize} > 0`),
  ],
);

export const publishedMedia = cms.table(
  'published_media',
  {
    assetId: uuid('asset_id').notNull(),
    version: text().notNull(),
    privateKey: text('private_key').notNull(),
    mime: text().notNull(),
    width: integer().notNull(),
    height: integer().notNull(),
    alt: text().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.assetId, table.version] }),
    check('published_media_version_check', sql`${table.version} ~ '^[a-f0-9]{64}$'`),
    check('published_media_dimensions_check', sql`${table.width} > 0 AND ${table.height} > 0`),
    check(
      'published_media_storage_key_check',
      sql`${table.privateKey} = 'verified/' || ${table.assetId}::text || '/' || ${table.version}`,
    ),
  ],
);

export const cmsSchema = {
  entries,
  entryRevisions,
  publishedContent,
  auditEvents,
  publishOutbox,
  saveRequests,
  mediaAssets,
  publishedMedia,
};
