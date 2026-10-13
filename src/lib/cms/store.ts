import 'server-only';

import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { getPool } from './db';
import {
  CmsConflictError,
  CmsForbiddenError,
  CmsInvariantError,
  CmsNotFoundError,
  CmsSetupError,
  CmsValidationError,
} from './errors';
import {
  getEntryTitle,
  getPayloadMediaReferences,
  isCmsKind,
  validatePayload,
  type CmsKind,
  type CmsPayload,
} from './model';

export type { CmsKind, CmsPayload } from './model';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_POSITION = 1_000_000;
const MAX_REVISION = 2_000_000_000;

export type CmsActor = { userId: string };

export type CmsEntry = {
  id: string;
  kind: CmsKind;
  slug: string;
  title: string;
  position: number;
  draftRevision: number;
  publishedRevision: number | null;
  archived: boolean;
  updatedAt: string;
};

export type CmsRevision = {
  version: number;
  createdAt: string;
  actorId: string;
  payload: CmsPayload;
};

export type CmsEntryDetail = CmsEntry & {
  payload: CmsPayload;
  history: CmsRevision[];
};

export type SaveEntryInput = {
  id?: string;
  kind: CmsKind;
  slug: string;
  position: number;
  payload: CmsPayload;
  expectedRevision?: number;
  requestId: string;
};

export type CmsMutationResult = { entry: CmsEntryDetail; eventId: string };

export type CmsAuditEvent = {
  id: string;
  action: 'created' | 'saved' | 'published' | 'unpublished' | 'restored' | 'seeded';
  actorId: string;
  entryId: string | null;
  metadata: Record<string, string | number | boolean | null>;
  createdAt: string;
};

export type CmsPublishEvent = {
  id: string;
  eventType: 'content.published' | 'content.unpublished';
  entryId: string;
  slug: string;
  createdAt: string;
};

export type PreparedMediaReference = {
  id: string;
  version: string;
  ownerId: string;
  privateKey: string;
  mime: 'image/png' | 'image/jpeg' | 'image/webp';
  width: number;
  height: number;
  byteSize: number;
  alt: string;
};

export type PublishedEntry = {
  kind: CmsKind;
  slug: string;
  position: number;
  payload: CmsPayload;
};

type EntryRow = {
  id: string;
  kind: string;
  slug: string;
  title: string;
  position: number;
  draft_revision: number;
  published_revision: number | null;
  has_published: boolean;
  archived: boolean;
  updated_at: Date | string;
};

type EntryPayloadRow = EntryRow & { payload: unknown };

type RevisionRow = {
  version: number;
  kind: string;
  slug: string;
  actor_id: string;
  payload: unknown;
  created_at: Date | string;
};

type PublishRevisionRow = {
  kind: string;
  slug: string;
  position: number;
  payload: unknown;
  draft_revision: number;
  published_revision: number | null;
  has_published: boolean;
  archived: boolean;
};

type ExistingEntryRow = {
  id: string;
  kind: string;
  slug: string;
  draft_revision: number;
  published_revision: number | null;
  has_published: boolean;
  archived: boolean;
};

function checkUuid(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new CmsValidationError(`Enter a valid ${field}.`);
  }
}

function checkRevision(value: unknown, allowZero = false): asserts value is number {
  const minimum = allowZero ? 0 : 1;
  if (
    !Number.isSafeInteger(value) ||
    (value as number) < minimum ||
    (value as number) > MAX_REVISION
  ) {
    throw new CmsValidationError('The revision number is invalid.');
  }
}

function checkPosition(value: unknown): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > MAX_POSITION) {
    throw new CmsValidationError('The content position is invalid.');
  }
}

function checkActor(actor: CmsActor): string {
  const userId = actor?.userId;
  if (
    typeof userId !== 'string' ||
    userId.trim().length === 0 ||
    userId.length > 255 ||
    /[\u0000-\u001f\u007f]/u.test(userId)
  ) {
    throw new CmsForbiddenError('A verified owner session is required.');
  }
  return userId;
}

function checkSlug(kind: CmsKind, slug: unknown): asserts slug is string {
  if (typeof slug !== 'string' || slug.length > 80) {
    throw new CmsValidationError('Enter a valid content slug.');
  }
  if (kind === 'profile' ? slug !== 'profile' : !SLUG_PATTERN.test(slug)) {
    throw new CmsValidationError('Enter a valid content slug.');
  }
}

function checkPayloadSlug(kind: CmsKind, slug: string, payload: CmsPayload) {
  if (kind === 'project' && ('slug' in payload ? payload.slug : '') !== slug) {
    throw new CmsValidationError('The project slug must match the entry slug.');
  }
  if (kind === 'design' && ('id' in payload ? payload.id : '') !== slug) {
    throw new CmsValidationError('The design ID must match the entry slug.');
  }
  if (kind === 'profile' && slug !== 'profile') {
    throw new CmsValidationError('The profile slug must be profile.');
  }
}

function parseKind(value: string): CmsKind {
  if (!isCmsKind(value))
    throw new CmsInvariantError('Stored CMS data has an invalid content kind.');
  return value;
}

function parseStoredPayload(kindValue: string, slug: string, payload: unknown): CmsPayload {
  const kind = parseKind(kindValue);
  let parsed: CmsPayload;
  try {
    parsed = validatePayload(kind, payload);
    checkPayloadSlug(kind, slug, parsed);
  } catch {
    throw new CmsInvariantError('Stored CMS content failed validation.');
  }
  return parsed;
}

function isoDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime()))
    throw new CmsInvariantError('Stored CMS data has an invalid timestamp.');
  return date.toISOString();
}

function mapEntry(row: EntryRow): CmsEntry {
  return {
    id: row.id,
    kind: parseKind(row.kind),
    slug: row.slug,
    title: row.title,
    position: row.position,
    draftRevision: row.draft_revision,
    publishedRevision: row.published_revision,
    archived: row.archived,
    updatedAt: isoDate(row.updated_at),
  };
}

function mapStoreError(error: unknown): Error {
  if (
    error instanceof CmsConflictError ||
    error instanceof CmsForbiddenError ||
    error instanceof CmsInvariantError ||
    error instanceof CmsNotFoundError ||
    error instanceof CmsSetupError ||
    error instanceof CmsValidationError
  ) {
    return error;
  }

  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (code === '23505' || code === '40001' || code === '40P01') {
      return new CmsConflictError(
        'The content changed or its slug is already in use. Reload and try again.',
      );
    }
    if (code === '23514' || code === '23503' || code === '22P02') {
      return new CmsInvariantError('The requested CMS change violates a data rule.');
    }
  }

  return new CmsSetupError([], 'CMS storage is temporarily unavailable.');
}

async function withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  let client: PoolClient | undefined;
  try {
    client = await getPool('cms').connect();
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Preserve the original, safely mapped error.
      }
    }
    throw mapStoreError(error);
  } finally {
    client?.release();
  }
}

async function withQuery<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw mapStoreError(error);
  }
}

async function loadEntryDetail(client: PoolClient, id: string): Promise<CmsEntryDetail | null> {
  const currentResult = await client.query<EntryPayloadRow>(
    `
      SELECT e.id, e.kind, e.slug, e.title, e.position, e.draft_revision,
             e.published_revision, e.has_published, e.archived, e.updated_at,
             r.payload
      FROM cms.entries AS e
      LEFT JOIN cms.entry_revisions AS r
        ON r.entry_id = e.id AND r.version = e.draft_revision
      WHERE e.id = $1
    `,
    [id],
  );
  const row = currentResult.rows[0];
  if (!row) return null;
  if (row.draft_revision < 1 || row.payload === null || row.payload === undefined) {
    throw new CmsInvariantError('The CMS entry has no draft revision.');
  }

  const kind = parseKind(row.kind);
  const payload = parseStoredPayload(kind, row.slug, row.payload);
  const revisionsResult = await client.query<RevisionRow>(
    `
      SELECT version, kind, slug, actor_id, payload, created_at
      FROM cms.entry_revisions
      WHERE entry_id = $1
      ORDER BY version DESC
    `,
    [id],
  );
  const history = revisionsResult.rows.map((revision) => ({
    version: revision.version,
    createdAt: isoDate(revision.created_at),
    actorId: revision.actor_id,
    payload: parseStoredPayload(revision.kind, revision.slug, revision.payload),
  }));

  return { ...mapEntry(row), payload, history };
}

function actorMetadata(kind: CmsKind, slug: string, revision: number, position?: number) {
  return position === undefined ? { kind, slug, revision } : { kind, slug, revision, position };
}

function fingerprint(input: {
  id: string | null;
  kind: CmsKind;
  slug: string;
  position: number;
  expectedRevision: number | null;
  payload: CmsPayload;
}) {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

async function readIdempotentResult(
  client: PoolClient,
  requestId: string,
  actorId: string,
  expectedFingerprint: string,
): Promise<CmsEntryDetail | null> {
  const result = await client.query<{
    actor_id: string;
    fingerprint: string;
    entry_id: string;
    revision: number;
    position: number;
    published_revision: number | null;
    archived: boolean;
  }>(
    `
      SELECT actor_id, fingerprint, entry_id, revision, position, published_revision, archived
      FROM cms.save_requests
      WHERE request_id = $1
    `,
    [requestId],
  );
  const row = result.rows[0];
  if (!row) return null;
  if (row.actor_id !== actorId || row.fingerprint !== expectedFingerprint) {
    throw new CmsConflictError('This save request ID has already been used. Reload and try again.');
  }
  const entry = await loadEntryRevisionDetail(
    client,
    row.entry_id,
    row.revision,
    row.position,
    row.published_revision,
    row.archived,
  );
  if (!entry) throw new CmsInvariantError('The saved CMS request points to a missing entry.');
  return entry;
}

async function loadEntryRevisionDetail(
  client: PoolClient,
  id: string,
  version: number,
  position: number,
  publishedRevision: number | null,
  archived: boolean,
): Promise<CmsEntryDetail | null> {
  const result = await client.query<RevisionRow>(
    `
      SELECT version, kind, slug, actor_id, payload, created_at
      FROM cms.entry_revisions
      WHERE entry_id = $1 AND version = $2
    `,
    [id, version],
  );
  const row = result.rows[0];
  if (!row) return null;
  const kind = parseKind(row.kind);
  const payload = parseStoredPayload(kind, row.slug, row.payload);
  const revisionsResult = await client.query<RevisionRow>(
    `
      SELECT version, kind, slug, actor_id, payload, created_at
      FROM cms.entry_revisions
      WHERE entry_id = $1 AND version <= $2
      ORDER BY version DESC
    `,
    [id, version],
  );
  const history = revisionsResult.rows.map((revision) => ({
    version: revision.version,
    createdAt: isoDate(revision.created_at),
    actorId: revision.actor_id,
    payload: parseStoredPayload(revision.kind, revision.slug, revision.payload),
  }));
  return {
    id,
    kind,
    slug: row.slug,
    title: getEntryTitle(kind, payload),
    position,
    draftRevision: version,
    publishedRevision,
    archived,
    updatedAt: isoDate(row.created_at),
    payload,
    history,
  };
}

export async function listEntries(): Promise<CmsEntry[]> {
  return withQuery(async () => {
    const result = await getPool('cms').query<EntryRow>(
      `
        SELECT id, kind, slug, title, position, draft_revision, published_revision,
               has_published, archived, updated_at
        FROM cms.entries
        ORDER BY CASE kind WHEN 'project' THEN 0 WHEN 'design' THEN 1 ELSE 2 END,
                 position, slug
      `,
    );
    return result.rows.map(mapEntry);
  });
}

export async function readEntry(id: string): Promise<CmsEntryDetail | null> {
  checkUuid(id, 'entry ID');
  return withQuery(async () => {
    const client = await getPool('cms').connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const entry = await loadEntryDetail(client, id);
      await client.query('COMMIT');
      return entry;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  });
}

export async function saveEntry(input: SaveEntryInput, actor: CmsActor): Promise<CmsEntryDetail> {
  const actorId = checkActor(actor);
  if (!input || !isCmsKind(input.kind))
    throw new CmsValidationError('Choose a valid content type.');
  const { kind } = input;
  checkSlug(kind, input.slug);
  checkPosition(input.position);
  checkUuid(input.requestId, 'request ID');
  if (input.id !== undefined) checkUuid(input.id, 'entry ID');
  if (input.expectedRevision !== undefined) checkRevision(input.expectedRevision, true);
  if (input.id !== undefined && input.expectedRevision === undefined) {
    throw new CmsValidationError('Reload the entry before saving it.');
  }
  if (input.id === undefined && input.expectedRevision !== undefined) {
    throw new CmsValidationError('A new entry cannot have an expected revision.');
  }

  const payload = validatePayload(kind, input.payload);
  checkPayloadSlug(kind, input.slug, payload);
  const saveFingerprint = fingerprint({
    id: input.id ?? null,
    kind,
    slug: input.slug,
    position: input.position,
    expectedRevision: input.expectedRevision ?? null,
    payload,
  });

  return withTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [input.requestId]);
    const replay = await readIdempotentResult(client, input.requestId, actorId, saveFingerprint);
    if (replay) return replay;

    let existing: ExistingEntryRow | undefined;
    if (input.id) {
      const entryResult = await client.query<ExistingEntryRow>(
        `
          SELECT id, kind, slug, draft_revision, published_revision, has_published, archived
          FROM cms.entries
          WHERE id = $1
          FOR UPDATE
        `,
        [input.id],
      );
      existing = entryResult.rows[0];
      if (!existing) throw new CmsNotFoundError('The entry no longer exists.');
      if (existing.kind !== kind) {
        throw new CmsConflictError('An entry cannot change its content type.');
      }
      if (input.expectedRevision !== existing.draft_revision) {
        throw new CmsConflictError();
      }
      if (existing.has_published && input.slug !== existing.slug) {
        throw new CmsConflictError('A published entry keeps its original URL.');
      }
    }

    await assertDraftMediaMayBeUsed(client, payload, actorId);

    const nextVersion = existing ? existing.draft_revision + 1 : 1;
    if (nextVersion > MAX_REVISION)
      throw new CmsConflictError('This entry has reached its revision limit.');
    const id = existing?.id ?? randomUUID();
    const title = getEntryTitle(kind, payload);

    if (existing) {
      await client.query(
        `
          UPDATE cms.entries
          SET slug = $2, title = $3, position = $4, draft_revision = $5, updated_at = now()
          WHERE id = $1
        `,
        [id, input.slug, title, input.position, nextVersion],
      );
    } else {
      await client.query(
        `
          INSERT INTO cms.entries
            (id, kind, slug, title, position, draft_revision, published_revision, has_published, archived)
          VALUES ($1, $2, $3, $4, $5, $6, NULL, false, false)
        `,
        [id, kind, input.slug, title, input.position, nextVersion],
      );
    }

    await client.query(
      `
        INSERT INTO cms.entry_revisions (entry_id, version, kind, slug, actor_id, payload)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb)
      `,
      [id, nextVersion, kind, input.slug, actorId, JSON.stringify(payload)],
    );
    await client.query(
      `
        INSERT INTO cms.audit_events (actor_id, action, entry_id, metadata)
        VALUES ($1, $2, $3, $4::jsonb)
      `,
      [
        actorId,
        existing ? 'saved' : 'created',
        id,
        JSON.stringify(actorMetadata(kind, input.slug, nextVersion, input.position)),
      ],
    );
    await client.query(
      `
        INSERT INTO cms.save_requests
          (request_id, actor_id, fingerprint, entry_id, revision, position, published_revision, archived)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        input.requestId,
        actorId,
        saveFingerprint,
        id,
        nextVersion,
        input.position,
        existing?.published_revision ?? null,
        existing?.archived ?? false,
      ],
    );

    const saved = await loadEntryDetail(client, id);
    if (!saved) throw new CmsInvariantError('The saved CMS entry could not be read.');
    return saved;
  });
}

async function loadPublishRevision(
  client: PoolClient,
  id: string,
): Promise<PublishRevisionRow | null> {
  const result = await client.query<PublishRevisionRow>(
    `
      SELECT e.kind, e.slug, e.position, r.payload, e.draft_revision,
             e.published_revision, e.has_published, e.archived
      FROM cms.entries AS e
      JOIN cms.entry_revisions AS r
        ON r.entry_id = e.id AND r.version = e.draft_revision
      WHERE e.id = $1
      FOR UPDATE OF e
    `,
    [id],
  );
  return result.rows[0] ?? null;
}

async function assertDraftMediaMayBeUsed(client: PoolClient, payload: CmsPayload, actorId: string) {
  for (const reference of getPayloadMediaReferences(payload)) {
    const result = await client.query<{
      state: string;
      created_by: string;
      has_public_projection: boolean;
    }>(
      `
        SELECT ma.state, ma.created_by, (pm.asset_id IS NOT NULL) AS has_public_projection
        FROM cms.media_assets AS ma
        LEFT JOIN cms.published_media AS pm
          ON pm.asset_id = ma.id AND pm.version = ma.version
        WHERE ma.id = $1::uuid AND ma.version = $2
      `,
      [reference.id, reference.version],
    );
    const asset = result.rows[0];
    if (!asset || !['verified', 'published'].includes(asset.state)) {
      throw new CmsConflictError('The selected image is no longer available.');
    }
    if (asset.created_by !== actorId) {
      throw new CmsForbiddenError('A media image can only be used by its owner.');
    }
    if (asset.state === 'published' && !asset.has_public_projection) {
      throw new CmsInvariantError('A published image has no public projection.');
    }
    if (asset.state === 'verified' && asset.has_public_projection) {
      throw new CmsInvariantError('An unverified image already has a public projection.');
    }
  }
}

const MEDIA_MIMES = new Set<PreparedMediaReference['mime']>([
  'image/png',
  'image/jpeg',
  'image/webp',
]);

function mediaReferenceKey(reference: { id: string; version: string }) {
  return `${reference.id}/${reference.version}`;
}

function validatePreparedMediaReferences(
  prepared: readonly PreparedMediaReference[],
  references: readonly { id: string; version: string }[],
  actorId: string,
): Map<string, PreparedMediaReference> {
  if (!Array.isArray(prepared) || prepared.length > references.length) {
    throw new CmsConflictError('The selected image could not be prepared for publishing.');
  }
  const referenceKeys = new Set(references.map(mediaReferenceKey));
  const proofs = new Map<string, PreparedMediaReference>();
  for (const candidate of prepared) {
    if (!candidate || typeof candidate !== 'object') {
      throw new CmsConflictError('The selected image could not be prepared for publishing.');
    }
    const proof = candidate as PreparedMediaReference;
    const idIsValid = typeof proof.id === 'string' && UUID_PATTERN.test(proof.id);
    const versionIsValid =
      typeof proof.version === 'string' && /^[a-f0-9]{64}$/.test(proof.version);
    if (!idIsValid || !versionIsValid || proof.id !== proof.id.toLowerCase()) {
      throw new CmsConflictError('The selected image could not be prepared for publishing.');
    }
    const key = mediaReferenceKey(proof);
    if (
      proof.ownerId !== actorId ||
      !referenceKeys.has(key) ||
      proofs.has(key) ||
      proof.privateKey !== `verified/${proof.id}/${proof.version}` ||
      !MEDIA_MIMES.has(proof.mime) ||
      !Number.isSafeInteger(proof.width) ||
      !Number.isSafeInteger(proof.height) ||
      proof.width < 1 ||
      proof.height < 1 ||
      proof.width * proof.height > 16_000_000 ||
      !Number.isSafeInteger(proof.byteSize) ||
      proof.byteSize < 1 ||
      proof.byteSize > 5 * 1024 * 1024 ||
      typeof proof.alt !== 'string' ||
      proof.alt.length < 1 ||
      proof.alt.length > 500 ||
      proof.alt.trim() !== proof.alt ||
      /[<>\u0000-\u001f\u007f-\u009f]/u.test(proof.alt)
    ) {
      throw new CmsConflictError('The selected image could not be prepared for publishing.');
    }
    proofs.set(key, proof);
  }
  return proofs;
}

function matchesPreparedMedia(
  asset: {
    id: string;
    version: string;
    created_by: string;
    private_key: string;
    mime: string | null;
    width: number | null;
    height: number | null;
    byte_size: number | null;
    alt: string;
  },
  proof: PreparedMediaReference,
): boolean {
  return (
    asset.id === proof.id &&
    asset.version === proof.version &&
    asset.created_by === proof.ownerId &&
    asset.private_key === proof.privateKey &&
    asset.mime === proof.mime &&
    asset.width === proof.width &&
    asset.height === proof.height &&
    asset.byte_size === proof.byteSize &&
    asset.alt === proof.alt
  );
}

async function preparePublishedMediaProjection(
  client: PoolClient,
  payload: CmsPayload,
  actorId: string,
  prepared: readonly PreparedMediaReference[],
) {
  const references = getPayloadMediaReferences(payload);
  const proofs = validatePreparedMediaReferences(prepared, references, actorId);

  for (const reference of references) {
    const result = await client.query<{
      id: string;
      version: string;
      state: string;
      private_key: string;
      mime: string | null;
      width: number | null;
      height: number | null;
      byte_size: number | null;
      alt: string;
      created_by: string;
      has_public_projection: boolean;
      projected_private_key: string | null;
      projected_mime: string | null;
      projected_width: number | null;
      projected_height: number | null;
      projected_alt: string | null;
    }>(
      `
        SELECT ma.id::text, ma.version, ma.state, ma.private_key,
               ma.mime, ma.width, ma.height, ma.byte_size, ma.alt, ma.created_by,
               (pm.asset_id IS NOT NULL) AS has_public_projection,
               pm.private_key AS projected_private_key, pm.mime AS projected_mime,
               pm.width AS projected_width, pm.height AS projected_height,
               pm.alt AS projected_alt
        FROM cms.media_assets AS ma
        LEFT JOIN cms.published_media AS pm
          ON pm.asset_id = ma.id AND pm.version = ma.version
        WHERE ma.id = $1::uuid AND ma.version = $2
        FOR UPDATE OF ma
      `,
      [reference.id, reference.version],
    );
    const asset = result.rows[0];
    if (!asset) throw new CmsConflictError('The selected image is no longer available.');
    if (asset.created_by !== actorId) {
      throw new CmsForbiddenError('A media image can only be published by its owner.');
    }

    const expectedPrivateKey = `verified/${reference.id}/${reference.version}`;
    if (
      asset.private_key !== expectedPrivateKey ||
      !asset.mime ||
      !MEDIA_MIMES.has(asset.mime as PreparedMediaReference['mime']) ||
      !asset.width ||
      !asset.height ||
      asset.width < 1 ||
      asset.height < 1 ||
      asset.width * asset.height > 16_000_000 ||
      !asset.byte_size ||
      asset.byte_size < 1 ||
      asset.byte_size > 5 * 1024 * 1024 ||
      asset.alt.length < 1 ||
      asset.alt.length > 500 ||
      asset.alt.trim() !== asset.alt ||
      /[<>\u0000-\u001f\u007f-\u009f]/u.test(asset.alt)
    ) {
      throw new CmsInvariantError('The selected media record is inconsistent.');
    }

    const proof = proofs.get(mediaReferenceKey(reference));
    if (proof && !matchesPreparedMedia(asset, proof)) {
      throw new CmsConflictError('The selected image changed while it was being prepared.');
    }

    if (asset.state === 'published') {
      if (
        !asset.has_public_projection ||
        asset.projected_private_key !== asset.private_key ||
        asset.projected_mime !== asset.mime ||
        asset.projected_width !== asset.width ||
        asset.projected_height !== asset.height ||
        asset.projected_alt !== asset.alt
      ) {
        throw new CmsInvariantError('A published image has no matching public projection.');
      }
      continue;
    }

    if (asset.state !== 'verified') {
      throw new CmsConflictError('Verify the selected image before publishing this content.');
    }
    if (!proof) {
      throw new CmsConflictError('Prepare the selected image before publishing this content.');
    }
    if (asset.has_public_projection) {
      throw new CmsInvariantError('An unpublished image already has a public projection.');
    }

    await client.query(
      `
        INSERT INTO cms.published_media
          (asset_id, version, private_key, mime, width, height, alt)
        VALUES ($1::uuid, $2, $3, $4, $5, $6, $7)
      `,
      [
        asset.id,
        asset.version,
        asset.private_key,
        asset.mime,
        asset.width,
        asset.height,
        asset.alt,
      ],
    );
    const updated = await client.query(
      `
        UPDATE cms.media_assets
        SET state = 'published'
        WHERE id = $1::uuid AND version = $2 AND state = 'verified' AND created_by = $3
      `,
      [asset.id, asset.version, actorId],
    );
    if (updated.rowCount !== 1) {
      throw new CmsConflictError('The selected image changed before the content was published.');
    }
  }
}

async function insertOutboxEvent(
  client: PoolClient,
  eventType: CmsPublishEvent['eventType'],
  entryId: string,
  slug: string,
) {
  const result = await client.query<{ id: string }>(
    `
      INSERT INTO cms.publish_outbox (event_type, entry_id, slug)
      VALUES ($1, $2, $3)
      RETURNING id
    `,
    [eventType, entryId, slug],
  );
  const event = result.rows[0];
  if (!event) throw new CmsInvariantError('The publish event could not be recorded.');
  return event.id;
}

export async function publishEntry(
  id: string,
  expectedRevision: number,
  actor: CmsActor,
  preparedMedia: readonly PreparedMediaReference[] = [],
): Promise<CmsMutationResult> {
  const actorId = checkActor(actor);
  checkUuid(id, 'entry ID');
  checkRevision(expectedRevision);

  return withTransaction(async (client) => {
    const row = await loadPublishRevision(client, id);
    if (!row) throw new CmsNotFoundError('The entry or its draft revision no longer exists.');
    if (row.draft_revision !== expectedRevision) throw new CmsConflictError();
    if (row.archived) throw new CmsConflictError('Archived content cannot be published.');
    if (row.published_revision === expectedRevision) {
      throw new CmsConflictError('This revision is already published.');
    }
    const kind = parseKind(row.kind);
    const payload = parseStoredPayload(kind, row.slug, row.payload);
    await preparePublishedMediaProjection(client, payload, actorId, preparedMedia);

    await client.query(
      `
        INSERT INTO cms.published_content
          (entry_id, kind, slug, position, payload, revision, published_at)
        VALUES ($1, $2, $3, $4, $5::jsonb, $6, now())
        ON CONFLICT (entry_id) DO UPDATE SET
          kind = EXCLUDED.kind,
          slug = EXCLUDED.slug,
          position = EXCLUDED.position,
          payload = EXCLUDED.payload,
          revision = EXCLUDED.revision,
          published_at = EXCLUDED.published_at
      `,
      [id, kind, row.slug, row.position, JSON.stringify(payload), row.draft_revision],
    );
    await client.query(
      `
        UPDATE cms.entries
        SET published_revision = $2, has_published = true, updated_at = now()
        WHERE id = $1
      `,
      [id, row.draft_revision],
    );
    await client.query(
      `
        INSERT INTO cms.audit_events (actor_id, action, entry_id, metadata)
        VALUES ($1, 'published', $2, $3::jsonb)
      `,
      [
        actorId,
        id,
        JSON.stringify(actorMetadata(kind, row.slug, row.draft_revision, row.position)),
      ],
    );
    const eventId = await insertOutboxEvent(client, 'content.published', id, row.slug);
    const entry = await loadEntryDetail(client, id);
    if (!entry) throw new CmsInvariantError('The published CMS entry could not be read.');
    return { entry, eventId };
  });
}

export async function unpublishEntry(
  id: string,
  expectedRevision: number,
  actor: CmsActor,
): Promise<CmsMutationResult> {
  const actorId = checkActor(actor);
  checkUuid(id, 'entry ID');
  checkRevision(expectedRevision);

  return withTransaction(async (client) => {
    const row = await loadPublishRevision(client, id);
    if (!row) throw new CmsNotFoundError('The entry or its draft revision no longer exists.');
    if (row.draft_revision !== expectedRevision) throw new CmsConflictError();
    if (row.published_revision === null) {
      throw new CmsConflictError('This entry is not currently published.');
    }
    const kind = parseKind(row.kind);
    await client.query('DELETE FROM cms.published_content WHERE entry_id = $1', [id]);
    await client.query(
      `
        UPDATE cms.entries
        SET published_revision = NULL, updated_at = now()
        WHERE id = $1
      `,
      [id],
    );
    await client.query(
      `
        INSERT INTO cms.audit_events (actor_id, action, entry_id, metadata)
        VALUES ($1, 'unpublished', $2, $3::jsonb)
      `,
      [
        actorId,
        id,
        JSON.stringify(actorMetadata(kind, row.slug, row.draft_revision, row.position)),
      ],
    );
    const eventId = await insertOutboxEvent(client, 'content.unpublished', id, row.slug);
    const entry = await loadEntryDetail(client, id);
    if (!entry) throw new CmsInvariantError('The unpublished CMS entry could not be read.');
    return { entry, eventId };
  });
}

export async function restoreEntry(
  id: string,
  revisionVersion: number,
  expectedRevision: number,
  actor: CmsActor,
): Promise<CmsEntryDetail> {
  const actorId = checkActor(actor);
  checkUuid(id, 'entry ID');
  checkRevision(revisionVersion);
  checkRevision(expectedRevision);

  return withTransaction(async (client) => {
    const entryResult = await client.query<{
      id: string;
      kind: string;
      slug: string;
      draft_revision: number;
      has_published: boolean;
      archived: boolean;
    }>(
      `
        SELECT id, kind, slug, draft_revision, has_published, archived
        FROM cms.entries
        WHERE id = $1
        FOR UPDATE
      `,
      [id],
    );
    const entry = entryResult.rows[0];
    if (!entry) throw new CmsNotFoundError('The entry no longer exists.');
    if (entry.draft_revision !== expectedRevision) throw new CmsConflictError();

    const revisionResult = await client.query<RevisionRow>(
      `
        SELECT version, kind, slug, actor_id, payload, created_at
        FROM cms.entry_revisions
        WHERE entry_id = $1 AND version = $2
      `,
      [id, revisionVersion],
    );
    const source = revisionResult.rows[0];
    if (!source) throw new CmsNotFoundError('The selected revision no longer exists.');
    if (source.kind !== entry.kind)
      throw new CmsInvariantError('The revision content type is inconsistent.');
    if (entry.has_published && source.slug !== entry.slug) {
      throw new CmsConflictError('A published entry keeps its original URL.');
    }
    const kind = parseKind(entry.kind);
    const payload = parseStoredPayload(kind, source.slug, source.payload);
    await assertDraftMediaMayBeUsed(client, payload, actorId);
    const nextVersion = entry.draft_revision + 1;
    if (nextVersion > MAX_REVISION)
      throw new CmsConflictError('This entry has reached its revision limit.');
    const title = getEntryTitle(kind, payload);

    await client.query(
      `
        UPDATE cms.entries
        SET slug = $2, title = $3, draft_revision = $4, updated_at = now()
        WHERE id = $1
      `,
      [id, source.slug, title, nextVersion],
    );
    await client.query(
      `
        INSERT INTO cms.entry_revisions (entry_id, version, kind, slug, actor_id, payload)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb)
      `,
      [id, nextVersion, kind, source.slug, actorId, JSON.stringify(payload)],
    );
    await client.query(
      `
        INSERT INTO cms.audit_events (actor_id, action, entry_id, metadata)
        VALUES ($1, 'restored', $2, $3::jsonb)
      `,
      [
        actorId,
        id,
        JSON.stringify({
          kind,
          slug: source.slug,
          revision: nextVersion,
          restoredFrom: revisionVersion,
        }),
      ],
    );
    const restored = await loadEntryDetail(client, id);
    if (!restored) throw new CmsInvariantError('The restored CMS entry could not be read.');
    return restored;
  });
}

export async function listAuditEvents(limit = 30): Promise<CmsAuditEvent[]> {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new CmsValidationError('Audit event limit must be between 1 and 100.');
  }
  return withQuery(async () => {
    const result = await getPool('cms').query<{
      id: string;
      action: CmsAuditEvent['action'];
      actor_id: string;
      entry_id: string | null;
      metadata: unknown;
      created_at: Date | string;
    }>(
      `
        SELECT id, action, actor_id, entry_id, metadata, created_at
        FROM cms.audit_events
        ORDER BY created_at DESC, id DESC
        LIMIT $1
      `,
      [limit],
    );
    return result.rows.map((row) => {
      if (!row.metadata || typeof row.metadata !== 'object' || Array.isArray(row.metadata)) {
        throw new CmsInvariantError('Stored CMS audit metadata is invalid.');
      }
      return {
        id: row.id,
        action: row.action,
        actorId: row.actor_id,
        entryId: row.entry_id,
        metadata: row.metadata as CmsAuditEvent['metadata'],
        createdAt: isoDate(row.created_at),
      };
    });
  });
}

export async function getPendingPublishEvents(): Promise<CmsPublishEvent[]> {
  return withQuery(async () => {
    const result = await getPool('cms').query<{
      id: string;
      event_type: CmsPublishEvent['eventType'];
      entry_id: string;
      slug: string;
      created_at: Date | string;
    }>(
      `
        SELECT id, event_type, entry_id, slug, created_at
        FROM cms.publish_outbox
        WHERE completed_at IS NULL
        ORDER BY created_at, id
        LIMIT 100
      `,
    );
    return result.rows.map((row) => ({
      id: row.id,
      eventType: row.event_type,
      entryId: row.entry_id,
      slug: row.slug,
      createdAt: isoDate(row.created_at),
    }));
  });
}

export async function completePublishEvent(id: string): Promise<boolean> {
  checkUuid(id, 'publish event ID');
  return withQuery(async () => {
    const result = await getPool('cms').query(
      `
        UPDATE cms.publish_outbox
        SET completed_at = now()
        WHERE id = $1 AND completed_at IS NULL
      `,
      [id],
    );
    return result.rowCount === 1;
  });
}

export async function readPublishedEntries(): Promise<PublishedEntry[]> {
  return withQuery(async () => {
    const result = await getPool('public').query<{
      kind: string;
      slug: string;
      position: number;
      payload: unknown;
    }>(
      `
        SELECT kind, slug, position, payload
        FROM cms.published_content
        ORDER BY CASE kind WHEN 'project' THEN 0 WHEN 'design' THEN 1 ELSE 2 END,
                 position, slug
      `,
    );
    return result.rows.map((row) => {
      const kind = parseKind(row.kind);
      checkSlug(kind, row.slug);
      checkPosition(row.position);
      return {
        kind,
        slug: row.slug,
        position: row.position,
        payload: parseStoredPayload(kind, row.slug, row.payload),
      };
    });
  });
}
