import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { Pool } from 'pg';
import projectSnapshots from '../../src/content/projects.json' with { type: 'json' };
import { CmsConflictError, CmsInvariantError } from '../../src/lib/cms/errors.ts';
import type { ProjectPayload } from '../../src/lib/cms/model.ts';
import {
  type PreparedMediaReference,
  publishEntry,
  readEntry,
  readPublishedEntries,
  restoreEntry,
  saveEntry,
  unpublishEntry,
} from '../../src/lib/cms/store.ts';
import { cmsTestDatabaseUrl, createCmsTestPool } from './test-db.ts';

// The store deliberately reads DATABASE_URL_* at runtime. Point its lazy pools
// only at the explicitly validated QA URLs in this isolated test process.
process.env.DATABASE_URL_CMS = cmsTestDatabaseUrl('cms');
process.env.DATABASE_URL_PUBLIC = cmsTestDatabaseUrl('public');

const actor = { userId: 'cms-qa-test-owner' };
const sourceImage = (projectSnapshots[0] as ProjectPayload).image;

function projectPayload(slug: string, name: string, image = sourceImage): ProjectPayload {
  return {
    id: `qa-${slug}`,
    slug,
    name,
    description: `Private QA draft for ${slug}.`,
    image,
    topics: ['CMS integration'],
    category: 'Integration Test',
    source: 'https://github.com/ervin-sungkono/Portfolio-Website-v2',
    demo: null,
  };
}

async function removeEntry(pool: Pool, id: string) {
  await pool.query('DELETE FROM cms.publish_outbox WHERE entry_id = $1::uuid', [id]);
  await pool.query('DELETE FROM cms.save_requests WHERE entry_id = $1::uuid', [id]);
  await pool.query('DELETE FROM cms.published_content WHERE entry_id = $1::uuid', [id]);
  await pool.query('DELETE FROM cms.entry_revisions WHERE entry_id = $1::uuid', [id]);
  await pool.query('DELETE FROM cms.audit_events WHERE entry_id = $1::uuid', [id]);
  await pool.query('DELETE FROM cms.entries WHERE id = $1::uuid', [id]);
}

async function makeMigrationPool() {
  return createCmsTestPool('migrations');
}

test('CMS saves are idempotent and optimistic revisions reject a lost update', async () => {
  const migration = await makeMigrationPool();
  const slug = `qa-save-${randomUUID()}`;
  let entryId: string | undefined;
  try {
    const originalInput = {
      kind: 'project' as const,
      slug,
      position: 0,
      payload: projectPayload(slug, 'QA first draft'),
      requestId: randomUUID(),
    };
    const first = await saveEntry(originalInput, actor);
    entryId = first.id;
    assert.equal(first.draftRevision, 1);
    assert.equal(first.history.length, 1);
    assert.equal(first.history[0]?.actorId, actor.userId);

    const replay = await saveEntry(originalInput, actor);
    assert.equal(replay.id, first.id);
    assert.equal(replay.draftRevision, 1);
    assert.equal(replay.history.length, 1);

    const secondPayload = projectPayload(slug, 'QA second draft');
    const second = await saveEntry(
      {
        id: first.id,
        kind: 'project',
        slug,
        position: 1,
        payload: secondPayload,
        expectedRevision: 1,
        requestId: randomUUID(),
      },
      actor,
    );
    assert.equal(second.draftRevision, 2);
    assert.equal(second.history.length, 2);

    const retryAfterLaterSave = await saveEntry(originalInput, actor);
    const revisionRows = await migration.query(
      'SELECT count(*)::int AS count FROM cms.entry_revisions WHERE entry_id = $1::uuid',
      [first.id],
    );
    assert.equal(
      revisionRows.rows[0]?.count,
      2,
      'replaying an old request must not create another revision',
    );
    assert.equal(retryAfterLaterSave.id, first.id);
    assert.equal(
      retryAfterLaterSave.draftRevision,
      1,
      'an idempotent retry returns its original revision',
    );

    const competing = await Promise.allSettled([
      saveEntry(
        {
          id: first.id,
          kind: 'project',
          slug,
          position: 2,
          payload: projectPayload(slug, 'QA competing draft A'),
          expectedRevision: 2,
          requestId: randomUUID(),
        },
        actor,
      ),
      saveEntry(
        {
          id: first.id,
          kind: 'project',
          slug,
          position: 3,
          payload: projectPayload(slug, 'QA competing draft B'),
          expectedRevision: 2,
          requestId: randomUUID(),
        },
        actor,
      ),
    ]);
    assert.equal(competing.filter((result) => result.status === 'fulfilled').length, 1);
    const rejected = competing.find((result) => result.status === 'rejected');
    assert.ok(rejected && rejected.status === 'rejected');
    assert.ok(rejected.reason instanceof CmsConflictError);

    const finalEntry = await readEntry(first.id);
    assert.equal(finalEntry?.draftRevision, 3);
    assert.equal(finalEntry?.history.length, 3);
  } finally {
    if (entryId) await removeEntry(migration, entryId);
    await migration.end();
  }
});

test('publish, restore, and unpublish change only the public projection at commit', async () => {
  const migration = await makeMigrationPool();
  const slug = `qa-publish-${randomUUID()}`;
  let entryId: string | undefined;
  try {
    const draft = await saveEntry(
      {
        kind: 'project',
        slug,
        position: 0,
        payload: projectPayload(slug, 'QA published revision one'),
        requestId: randomUUID(),
      },
      actor,
    );
    entryId = draft.id;

    assert.equal(
      (await readPublishedEntries()).some((entry) => entry.slug === slug),
      false,
    );
    await publishEntry(draft.id, draft.draftRevision, actor);
    const firstPublic = (await readPublishedEntries()).find((entry) => entry.slug === slug);
    assert.equal(
      (firstPublic?.payload as ProjectPayload | undefined)?.name,
      'QA published revision one',
    );

    const nextDraft = await saveEntry(
      {
        id: draft.id,
        kind: 'project',
        slug,
        position: 1,
        payload: projectPayload(slug, 'QA unpublished revision two'),
        expectedRevision: 1,
        requestId: randomUUID(),
      },
      actor,
    );
    const stillFirstPublic = (await readPublishedEntries()).find((entry) => entry.slug === slug);
    assert.equal(
      (stillFirstPublic?.payload as ProjectPayload | undefined)?.name,
      'QA published revision one',
    );

    await publishEntry(draft.id, nextDraft.draftRevision, actor);
    const secondPublic = (await readPublishedEntries()).find((entry) => entry.slug === slug);
    assert.equal(
      (secondPublic?.payload as ProjectPayload | undefined)?.name,
      'QA unpublished revision two',
    );

    const restored = await restoreEntry(draft.id, 1, 2, actor);
    assert.equal(restored.draftRevision, 3);
    assert.equal((restored.payload as ProjectPayload).name, 'QA published revision one');
    const stillSecondPublic = (await readPublishedEntries()).find((entry) => entry.slug === slug);
    assert.equal(
      (stillSecondPublic?.payload as ProjectPayload | undefined)?.name,
      'QA unpublished revision two',
    );

    await publishEntry(draft.id, restored.draftRevision, actor);
    const restoredPublic = (await readPublishedEntries()).find((entry) => entry.slug === slug);
    assert.equal(
      (restoredPublic?.payload as ProjectPayload | undefined)?.name,
      'QA published revision one',
    );

    await assert.rejects(
      saveEntry(
        {
          id: draft.id,
          kind: 'project',
          slug: `${slug}-changed`,
          position: 0,
          payload: projectPayload(`${slug}-changed`, 'QA illegal slug change'),
          expectedRevision: 3,
          requestId: randomUUID(),
        },
        actor,
      ),
      CmsConflictError,
    );

    const unpublished = await unpublishEntry(draft.id, restored.draftRevision, actor);
    assert.equal(unpublished.entry.publishedRevision, null);
    assert.equal(
      (await readPublishedEntries()).some((entry) => entry.slug === slug),
      false,
    );

    const outbox = await migration.query(
      'SELECT event_type FROM cms.publish_outbox WHERE entry_id = $1::uuid ORDER BY created_at',
      [draft.id],
    );
    assert.deepEqual(
      outbox.rows.map((row: { event_type: string }) => row.event_type),
      ['content.published', 'content.published', 'content.published', 'content.unpublished'],
    );
  } finally {
    if (entryId) await removeEntry(migration, entryId);
    await migration.end();
  }
});

test('failed publication rolls back media and content projections together', async () => {
  const migration = await makeMigrationPool();
  const slug = `qa-atomic-${randomUUID()}`;
  const mediaId = randomUUID();
  const mediaVersion = 'b'.repeat(64);
  const mediaPath = `verified/${mediaId}/${mediaVersion}`;
  const mediaUrl = `/media/published/${mediaId}/${mediaVersion}`;
  const mediaAlt = 'QA atomicity test image';
  const preparedMedia: PreparedMediaReference = {
    id: mediaId,
    version: mediaVersion,
    ownerId: actor.userId,
    privateKey: mediaPath,
    mime: 'image/png',
    width: 2,
    height: 3,
    byteSize: 70,
    alt: mediaAlt,
  };
  let entryId: string | undefined;
  let triggerCreated = false;
  let publicProjection: Pool | undefined;
  try {
    await migration.query(
      `INSERT INTO cms.media_assets
         (id, version, state, private_key, mime, width, height, byte_size, alt, created_by)
       VALUES ($1::uuid, $2, 'verified', $3, $4, $5, $6, $7, $8, $9)`,
      [
        mediaId,
        mediaVersion,
        mediaPath,
        preparedMedia.mime,
        preparedMedia.width,
        preparedMedia.height,
        preparedMedia.byteSize,
        mediaAlt,
        actor.userId,
      ],
    );
    const draft = await saveEntry(
      {
        kind: 'project',
        slug,
        position: 0,
        payload: projectPayload(slug, 'QA atomicity draft', mediaUrl),
        requestId: randomUUID(),
      },
      actor,
    );
    entryId = draft.id;

    publicProjection = createCmsTestPool('public');
    const mediaBeforePublish = await publicProjection.query(
      'SELECT 1 FROM cms.published_media WHERE asset_id = $1::uuid AND version = $2',
      [mediaId, mediaVersion],
    );
    assert.equal(
      mediaBeforePublish.rowCount,
      0,
      'Verified media is private until content publishes.',
    );

    await assert.rejects(
      publishEntry(draft.id, draft.draftRevision + 1, actor, [preparedMedia]),
      CmsConflictError,
    );
    const staleAttempt = await migration.query(
      `SELECT state,
              (SELECT count(*)::int FROM cms.published_media WHERE asset_id = $1::uuid) AS projections
         FROM cms.media_assets WHERE id = $1::uuid AND version = $2`,
      [mediaId, mediaVersion],
    );
    assert.deepEqual(staleAttempt.rows[0], { state: 'verified', projections: 0 });

    await migration.query(`
      CREATE OR REPLACE FUNCTION cms.qa_reject_cms_publish()
      RETURNS trigger LANGUAGE plpgsql AS $qa$
      BEGIN
        RAISE EXCEPTION 'Intentional isolated CMS publication failure' USING ERRCODE = '23514';
      END
      $qa$
    `);
    await migration.query(`
      CREATE TRIGGER qa_reject_cms_publish
      BEFORE INSERT ON cms.audit_events
      FOR EACH ROW
      WHEN (NEW.action = 'published' AND NEW.entry_id = '${draft.id}'::uuid)
      EXECUTE FUNCTION cms.qa_reject_cms_publish()
    `);
    triggerCreated = true;

    await assert.rejects(
      publishEntry(draft.id, draft.draftRevision, actor, [preparedMedia]),
      CmsInvariantError,
    );

    const entryAfterFailure = await readEntry(draft.id);
    assert.equal(entryAfterFailure?.publishedRevision, null);
    assert.equal(
      (await readPublishedEntries()).some((entry) => entry.slug === slug),
      false,
    );

    const sideEffects = await migration.query(
      `SELECT
         (SELECT count(*)::int FROM cms.published_content WHERE entry_id = $1::uuid) AS projections,
         (SELECT count(*)::int FROM cms.audit_events WHERE entry_id = $1::uuid AND action = 'published') AS audits,
         (SELECT count(*)::int FROM cms.publish_outbox WHERE entry_id = $1::uuid) AS events,
         (SELECT count(*)::int FROM cms.published_media WHERE asset_id = $2::uuid) AS media_projections,
         (SELECT state FROM cms.media_assets WHERE id = $2::uuid AND version = $3) AS media_state`,
      [draft.id, mediaId, mediaVersion],
    );
    assert.deepEqual(sideEffects.rows[0], {
      projections: 0,
      audits: 0,
      events: 0,
      media_projections: 0,
      media_state: 'verified',
    });
    const gatewayAfterFailure = await publicProjection.query(
      'SELECT 1 FROM cms.published_media WHERE asset_id = $1::uuid AND version = $2',
      [mediaId, mediaVersion],
    );
    const contentAfterFailure = await publicProjection.query(
      `SELECT slug, payload->>'image' AS image
         FROM cms.published_content
        WHERE slug = $1`,
      [slug],
    );
    assert.equal(gatewayAfterFailure.rowCount, 0);
    assert.equal(contentAfterFailure.rowCount, 0);

    await migration.query('DROP TRIGGER IF EXISTS qa_reject_cms_publish ON cms.audit_events');
    await migration.query('DROP FUNCTION IF EXISTS cms.qa_reject_cms_publish()');
    triggerCreated = false;
    await publishEntry(draft.id, draft.draftRevision, actor, [preparedMedia]);

    const committed = await migration.query(
      `SELECT ma.state AS media_state, pm.private_key,
              pc.slug, pc.payload->>'image' AS image
         FROM cms.media_assets AS ma
         JOIN cms.published_media AS pm
           ON pm.asset_id = ma.id AND pm.version = ma.version
         JOIN cms.published_content AS pc ON pc.entry_id = $1::uuid
        WHERE ma.id = $2::uuid AND ma.version = $3`,
      [draft.id, mediaId, mediaVersion],
    );
    assert.deepEqual(committed.rows[0], {
      media_state: 'published',
      private_key: mediaPath,
      slug,
      image: mediaUrl,
    });

    const visibleMedia = await publicProjection.query(
      'SELECT 1 FROM cms.published_media WHERE asset_id = $1::uuid AND version = $2',
      [mediaId, mediaVersion],
    );
    const visibleContent = await publicProjection.query(
      `SELECT slug, payload->>'image' AS image
         FROM cms.published_content
        WHERE slug = $1`,
      [slug],
    );
    assert.equal(visibleMedia.rowCount, 1);
    assert.deepEqual(visibleContent.rows[0], { slug, image: mediaUrl });

    await unpublishEntry(draft.id, draft.draftRevision, actor);
    const mediaAfterUnpublish = await publicProjection.query(
      'SELECT 1 FROM cms.published_media WHERE asset_id = $1::uuid AND version = $2',
      [mediaId, mediaVersion],
    );
    const contentAfterUnpublish = await publicProjection.query(
      'SELECT slug FROM cms.published_content WHERE slug = $1',
      [slug],
    );
    assert.equal(mediaAfterUnpublish.rowCount, 1, 'Published immutable media remains addressable.');
    assert.equal(contentAfterUnpublish.rowCount, 0, 'Unpublishing removes the content projection.');
  } finally {
    if (triggerCreated) {
      await migration.query('DROP TRIGGER IF EXISTS qa_reject_cms_publish ON cms.audit_events');
      await migration.query('DROP FUNCTION IF EXISTS cms.qa_reject_cms_publish()');
    }
    if (entryId) await removeEntry(migration, entryId);
    await migration.query('DELETE FROM cms.published_media WHERE asset_id = $1::uuid', [mediaId]);
    await migration.query('DELETE FROM cms.media_assets WHERE id = $1::uuid', [mediaId]);
    await publicProjection?.end();
    await migration.end();
  }
});
