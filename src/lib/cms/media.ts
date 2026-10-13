import 'server-only';

import { createHash, randomUUID } from 'node:crypto';
import { del, get, head, put } from '@vercel/blob';
import { getPool } from './db';
import { CmsConflictError, CmsInvariantError, CmsNotFoundError, CmsSetupError } from './errors';
import type { PreparedMediaReference } from './store';
import {
  MAX_MEDIA_UPLOAD_BYTES,
  MediaValidationError,
  isMediaUuid,
  isMediaVersion,
  mediaPublishedUrl,
  mediaStagingPath,
  mediaVerifiedPath,
  inspectNormalizedMedia,
  validateAndNormalizeMedia,
  type MediaMime,
  type ValidatedMedia,
} from './media-validation';

const STAGING_VERSION = '0'.repeat(64);
const ALLOWED_MIME = new Set<MediaMime>(['image/png', 'image/jpeg', 'image/webp']);

type MediaState = 'staging' | 'verified' | 'published' | 'rejected';

export type MediaAsset = {
  id: string;
  version: string;
  state: MediaState;
  privateKey: string;
  mime: MediaMime | null;
  width: number | null;
  height: number | null;
  byteSize: number | null;
  alt: string;
  createdBy: string;
  createdAt: Date;
};

export type MediaSummary = {
  id: string;
  version: string;
  state: MediaState;
  mime: MediaMime | null;
  width: number | null;
  height: number | null;
  byteSize: number | null;
  alt: string;
  url: string | null;
  previewUrl: string;
  createdAt: string;
};

export type PublishedMedia = {
  id: string;
  version: string;
  privateKey: string;
  mime: MediaMime;
  width: number;
  height: number;
  alt: string;
};

export class MediaUploadNotReadyError extends Error {
  readonly status = 409;

  constructor() {
    super('The image upload is not available yet. Try again in a moment.');
    this.name = 'MediaUploadNotReadyError';
  }
}

export function requireBlobToken(): string {
  const name = 'BLOB_PRIVATE_READ_WRITE_TOKEN';
  const token = process.env[name];
  if (!token) throw new CmsSetupError([name]);
  return token;
}

export function mediaMissingSetup(): string[] {
  return ['DATABASE_URL_CMS', 'DATABASE_URL_PUBLIC', 'BLOB_PRIVATE_READ_WRITE_TOKEN'].filter(
    (name) => !process.env[name],
  );
}

function validateAlt(value: string): string {
  const alt = value.trim();
  if (alt.length === 0 || alt.length > 500 || /[<>\u0000-\u001f\u007f-\u009f]/u.test(alt)) {
    throw new MediaValidationError('Enter image alternative text up to 500 characters.');
  }
  return alt;
}

function mapAsset(row: Record<string, unknown>): MediaAsset {
  const id = String(row.id);
  const version = String(row.version);
  const state = String(row.state);
  const privateKey = String(row.private_key);
  const mimeValue = row.mime === null ? null : String(row.mime);
  const width = row.width === null ? null : Number(row.width);
  const height = row.height === null ? null : Number(row.height);
  const byteSize = row.byte_size === null ? null : Number(row.byte_size);
  if (
    !isMediaUuid(id) ||
    !isMediaVersion(version) ||
    !['staging', 'verified', 'published', 'rejected'].includes(state) ||
    privateKey !==
      (state === 'staging' || (state === 'rejected' && version === STAGING_VERSION)
        ? mediaStagingPath(id)
        : mediaVerifiedPath(id, version)) ||
    (mimeValue !== null && !ALLOWED_MIME.has(mimeValue as MediaMime)) ||
    (width !== null && (!Number.isInteger(width) || width < 1)) ||
    (height !== null && (!Number.isInteger(height) || height < 1)) ||
    (byteSize !== null &&
      (!Number.isInteger(byteSize) || byteSize < 1 || byteSize > MAX_MEDIA_UPLOAD_BYTES)) ||
    (state === 'staging' && version !== STAGING_VERSION) ||
    ((state === 'verified' || state === 'published') &&
      (!mimeValue ||
        !width ||
        !height ||
        !byteSize ||
        privateKey !== mediaVerifiedPath(id, version)))
  ) {
    throw new CmsInvariantError('The media record is inconsistent.');
  }
  const createdAt =
    row.created_at instanceof Date ? row.created_at : new Date(String(row.created_at));
  if (Number.isNaN(createdAt.getTime()))
    throw new CmsInvariantError('The media record is inconsistent.');
  return {
    id,
    version,
    state: state as MediaState,
    privateKey,
    mime: mimeValue as MediaMime | null,
    width,
    height,
    byteSize,
    alt: String(row.alt),
    createdBy: String(row.created_by),
    createdAt,
  };
}

function summary(asset: MediaAsset): MediaSummary {
  const available =
    (asset.state === 'verified' || asset.state === 'published') &&
    asset.privateKey === mediaVerifiedPath(asset.id, asset.version) &&
    asset.mime !== null &&
    asset.width !== null &&
    asset.height !== null;
  return {
    id: asset.id,
    version: asset.version,
    state: asset.state,
    mime: asset.mime,
    width: asset.width,
    height: asset.height,
    byteSize: asset.byteSize,
    alt: asset.alt,
    url: available ? mediaPublishedUrl(asset.id, asset.version) : null,
    previewUrl: `/api/admin/media/${asset.id}`,
    createdAt: asset.createdAt.toISOString(),
  };
}

async function queryAsset(id: string, ownerId?: string): Promise<MediaAsset | null> {
  if (!isMediaUuid(id)) return null;
  const result = await getPool('cms').query(
    `SELECT id::text, version, state, private_key, mime, width, height,
            byte_size, alt, created_by, created_at
       FROM cms.media_assets
      WHERE id = $1::uuid${ownerId === undefined ? '' : ' AND created_by = $2'}
      ORDER BY created_at DESC
      LIMIT 1`,
    ownerId === undefined ? [id] : [id, ownerId],
  );
  return result.rows[0] ? mapAsset(result.rows[0]) : null;
}

export async function listMediaAssets(ownerId: string): Promise<MediaSummary[]> {
  const result = await getPool('cms').query(
    `SELECT id::text, version, state, private_key, mime, width, height,
            byte_size, alt, created_by, created_at
       FROM cms.media_assets
      WHERE created_by = $1
      ORDER BY created_at DESC, id DESC
      LIMIT 100`,
    [ownerId],
  );
  return result.rows.map((row) => summary(mapAsset(row)));
}

async function cleanAbandonedPrivateObjects(ownerId: string, privateToken: string) {
  const result = await getPool('cms').query(
    `SELECT id::text, version, state, private_key, mime, width, height,
            byte_size, alt, created_by, created_at
       FROM cms.media_assets
      WHERE created_by = $1
        AND (state = 'rejected' OR (state = 'staging' AND created_at < now() - interval '1 hour'))
      ORDER BY created_at ASC
      LIMIT 25`,
    [ownerId],
  );
  for (const row of result.rows) {
    const asset = mapAsset(row);
    try {
      await del(asset.privateKey, { token: privateToken });
    } catch (error) {
      if (!isMissingBlob(error)) {
        console.warn('CMS media expired staging cleanup failed', { assetId: asset.id });
        continue;
      }
    }
    try {
      await getPool('cms').query(
        `UPDATE cms.media_assets SET state = 'rejected'
          WHERE id = $1::uuid AND created_by = $2 AND state = 'staging'`,
        [asset.id, ownerId],
      );
    } catch {
      console.error('CMS media expired staging record cleanup failed', { assetId: asset.id });
    }
  }
}

export async function createMediaUploadIntent(
  ownerId: string,
  rawAlt: string,
): Promise<MediaSummary> {
  const privateToken = requireBlobToken();
  const alt = validateAlt(rawAlt);
  await cleanAbandonedPrivateObjects(ownerId, privateToken);
  const id = randomUUID();
  const privateKey = mediaStagingPath(id);
  const result = await getPool('cms').query(
    `INSERT INTO cms.media_assets
       (id, version, state, private_key, alt, created_by)
     VALUES ($1::uuid, $2, 'staging', $3, $4, $5)
     RETURNING id::text, version, state, private_key, mime, width, height,
               byte_size, alt, created_by, created_at`,
    [id, STAGING_VERSION, privateKey, alt, ownerId],
  );
  if (!result.rows[0]) throw new CmsInvariantError('The upload record could not be created.');
  return summary(mapAsset(result.rows[0]));
}

export async function getUploadIntentForPath(
  pathname: string,
  ownerId: string,
): Promise<MediaAsset | null> {
  const match =
    /^staging\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/.exec(
      pathname,
    );
  if (!match || pathname !== mediaStagingPath(match[1])) return null;
  const asset = await queryAsset(match[1], ownerId);
  if (!asset || asset.state !== 'staging' || asset.privateKey !== pathname) return null;
  return asset;
}

export async function getOwnedMediaAsset(id: string, ownerId: string): Promise<MediaAsset | null> {
  return queryAsset(id, ownerId);
}

async function streamToBuffer(
  stream: ReadableStream<Uint8Array>,
  maxBytes: number,
): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          // Keep the size error as the useful failure.
        }
        throw new MediaValidationError('Images must be 5 MiB or smaller.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(
    chunks.map((chunk) => Buffer.from(chunk)),
    size,
  );
}

function isMissingBlob(error: unknown): boolean {
  return error instanceof Error && error.name === 'BlobNotFoundError';
}

async function removePrivateBlob(privateKey: string, token: string, id: string) {
  try {
    await del(privateKey, { token });
  } catch (error) {
    if (isMissingBlob(error)) return;
    // Cleanup is best effort; never log a pathname or token.
    console.warn('CMS media private object cleanup failed', { assetId: id });
  }
}

async function rejectAndClean(asset: MediaAsset, token: string) {
  try {
    const result = await getPool('cms').query(
      `UPDATE cms.media_assets
          SET state = 'rejected'
        WHERE id = $1::uuid AND created_by = $2 AND state IN ('staging', 'verified')`,
      [asset.id, asset.createdBy],
    );
    if (result.rowCount === 1) {
      await removePrivateBlob(asset.privateKey, token, asset.id);
    }
  } catch {
    console.error('CMS media rejection could not be persisted', { assetId: asset.id });
  }
}

async function loadPrivateUpload(asset: MediaAsset, token: string): Promise<Buffer> {
  try {
    const metadata = await head(asset.privateKey, { token });
    if (metadata.pathname !== asset.privateKey || metadata.size > MAX_MEDIA_UPLOAD_BYTES) {
      throw new MediaValidationError('Images must be 5 MiB or smaller.');
    }
    const result = await get(asset.privateKey, { access: 'private', token, useCache: false });
    if (!result || result.statusCode !== 200 || !result.stream)
      throw new MediaUploadNotReadyError();
    if (result.blob.pathname !== asset.privateKey || result.blob.size > MAX_MEDIA_UPLOAD_BYTES) {
      throw new MediaValidationError('Images must be 5 MiB or smaller.');
    }
    return await streamToBuffer(result.stream, MAX_MEDIA_UPLOAD_BYTES);
  } catch (error) {
    if (
      error instanceof MediaValidationError ||
      error instanceof MediaUploadNotReadyError ||
      isMissingBlob(error)
    ) {
      if (isMissingBlob(error)) throw new MediaUploadNotReadyError();
      throw error;
    }
    throw error;
  }
}

async function loadVerifiedPrivateObject(asset: MediaAsset, token: string): Promise<Buffer> {
  try {
    return await loadPrivateUpload(asset, token);
  } catch (error) {
    if (error instanceof MediaUploadNotReadyError) {
      throw new CmsInvariantError('A verified private image is missing from storage.');
    }
    throw error;
  }
}

async function recordVerifiedMedia(
  asset: MediaAsset,
  normalized: ValidatedMedia,
  privateKey: string,
): Promise<MediaAsset> {
  const result = await getPool('cms').query(
    `UPDATE cms.media_assets
        SET private_key = $1,
            version = $2,
            state = 'verified',
            mime = $3,
            width = $4,
            height = $5,
            byte_size = $6
      WHERE id = $7::uuid
        AND created_by = $8
        AND state IN ('staging', 'verified')
      RETURNING id::text, version, state, private_key, mime, width, height,
                byte_size, alt, created_by, created_at`,
    [
      privateKey,
      normalized.version,
      normalized.mime,
      normalized.width,
      normalized.height,
      normalized.byteSize,
      asset.id,
      asset.createdBy,
    ],
  );
  if (!result.rows[0]) throw new CmsConflictError('This image upload can no longer be finalized.');
  return mapAsset(result.rows[0]);
}

async function confirmExistingObject(
  pathname: string,
  normalized: ValidatedMedia,
  token: string,
): Promise<boolean> {
  try {
    const result = await get(pathname, { access: 'private', token, useCache: false });
    if (!result || result.statusCode !== 200 || !result.stream) return false;
    if (result.blob.pathname !== pathname || result.blob.size > MAX_MEDIA_UPLOAD_BYTES)
      return false;
    const stored = await streamToBuffer(result.stream, MAX_MEDIA_UPLOAD_BYTES);
    return (
      result.blob.contentType === normalized.mime &&
      stored.byteLength === normalized.bytes.byteLength &&
      createHash('sha256').update(stored).digest('hex') === normalized.version
    );
  } catch {
    return false;
  }
}

async function storeVerifiedPrivateObject(
  pathname: string,
  normalized: ValidatedMedia,
  token: string,
): Promise<void> {
  try {
    const result = await put(pathname, normalized.bytes, {
      access: 'private',
      token,
      contentType: normalized.mime,
      addRandomSuffix: false,
      allowOverwrite: false,
      cacheControlMaxAge: 60,
    });
    if (result.pathname !== pathname || result.contentType !== normalized.mime) {
      throw new CmsInvariantError('The private media provider returned an unexpected object.');
    }
  } catch (error) {
    if (error instanceof CmsInvariantError) throw error;
    if (await confirmExistingObject(pathname, normalized, token)) return;
    throw error;
  }
}

export async function finalizeMediaUpload(id: string, ownerId: string): Promise<MediaSummary> {
  if (!isMediaUuid(id)) throw new CmsNotFoundError('The image was not found.');
  const asset = await queryAsset(id, ownerId);
  if (!asset) throw new CmsNotFoundError('The image was not found.');
  if (asset.state === 'rejected')
    throw new CmsConflictError('This image upload was rejected. Start a new upload.');
  if (asset.state === 'published') return summary(asset);

  const privateToken = requireBlobToken();
  if (asset.state === 'verified') {
    try {
      const bytes = await loadVerifiedPrivateObject(asset, privateToken);
      await inspectNormalizedMedia(bytes, {
        version: asset.version,
        mime: asset.mime!,
        width: asset.width!,
        height: asset.height!,
      });
      return summary(asset);
    } catch (error) {
      if (error instanceof MediaValidationError) {
        await rejectAndClean(asset, privateToken);
        throw new CmsInvariantError('The saved private image failed its integrity check.');
      }
      throw error;
    }
  }

  let normalized: ValidatedMedia;
  try {
    const uploaded = await loadPrivateUpload(asset, privateToken);
    normalized = await validateAndNormalizeMedia(uploaded);
  } catch (error) {
    if (error instanceof MediaValidationError) {
      await rejectAndClean(asset, privateToken);
      throw error;
    }
    throw error;
  }
  const verifiedKey = mediaVerifiedPath(asset.id, normalized.version);
  await storeVerifiedPrivateObject(verifiedKey, normalized, privateToken);
  let verified: MediaAsset;
  try {
    verified = await recordVerifiedMedia(asset, normalized, verifiedKey);
  } catch (error) {
    // Preserve the object if the DB committed but its response was lost. If
    // the asset still points elsewhere, the canonical copy is an orphan and
    // can be removed without damaging a retryable upload.
    try {
      const current = await queryAsset(asset.id, ownerId);
      if (
        !current ||
        (current.state !== 'verified' && current.state !== 'published') ||
        current.version !== normalized.version ||
        current.privateKey !== verifiedKey
      ) {
        await removePrivateBlob(verifiedKey, privateToken, asset.id);
      }
    } catch {
      console.warn('CMS media orphan cleanup deferred', { assetId: asset.id });
    }
    throw error;
  }
  await removePrivateBlob(asset.privateKey, privateToken, verified.id);
  return summary(verified);
}

export async function publishMediaReferences(
  references: readonly { id: string; version: string }[],
  ownerId: string,
): Promise<PreparedMediaReference[]> {
  const unique = new Map<string, { id: string; version: string }>();
  for (const reference of references) {
    if (!isMediaUuid(reference.id) || !isMediaVersion(reference.version)) {
      throw new MediaValidationError('The draft contains an invalid image reference.');
    }
    const id = reference.id.toLowerCase();
    unique.set(`${id}/${reference.version}`, { id, version: reference.version });
  }
  const assets: MediaAsset[] = [];
  for (const reference of unique.values()) {
    const asset = await queryAsset(reference.id, ownerId);
    if (!asset || asset.version !== reference.version) {
      throw new CmsNotFoundError('A referenced image was not found.');
    }
    if (asset.state !== 'verified' && asset.state !== 'published') {
      throw new CmsConflictError('Verify every referenced image before publishing this content.');
    }
    assets.push(asset);
  }

  const verifiedAssets = assets.filter((asset) => asset.state === 'verified');
  if (verifiedAssets.length === 0) return [];
  const privateToken = requireBlobToken();
  const prepared: PreparedMediaReference[] = [];
  for (const asset of verifiedAssets) {
    if (
      !asset.mime ||
      !asset.width ||
      !asset.height ||
      !asset.byteSize ||
      asset.privateKey !== mediaVerifiedPath(asset.id, asset.version)
    ) {
      throw new CmsInvariantError('The verified media record is incomplete.');
    }
    let normalized: ValidatedMedia;
    try {
      const bytes = await loadVerifiedPrivateObject(asset, privateToken);
      normalized = await inspectNormalizedMedia(bytes, {
        version: asset.version,
        mime: asset.mime,
        width: asset.width,
        height: asset.height,
      });
    } catch (error) {
      if (error instanceof MediaValidationError) {
        throw new CmsInvariantError('The saved private image failed its integrity check.');
      }
      throw error;
    }
    if (normalized.byteSize !== asset.byteSize) {
      throw new CmsInvariantError('The saved private image metadata is inconsistent.');
    }
    prepared.push({
      id: asset.id,
      version: asset.version,
      ownerId,
      privateKey: mediaVerifiedPath(asset.id, asset.version),
      mime: normalized.mime,
      width: normalized.width,
      height: normalized.height,
      byteSize: normalized.byteSize,
      alt: asset.alt,
    });
  }
  return prepared;
}

export async function getPublishedMedia(
  id: string,
  version: string,
): Promise<PublishedMedia | null> {
  if (!isMediaUuid(id) || !isMediaVersion(version)) return null;
  id = id.toLowerCase();
  const result = await getPool('public').query(
    `SELECT asset_id::text AS id, version, private_key, mime, width, height, alt
       FROM cms.published_media
      WHERE asset_id = $1::uuid AND version = $2
      LIMIT 1`,
    [id, version],
  );
  const row = result.rows[0];
  if (!row) return null;
  const mime = String(row.mime);
  const alt = String(row.alt);
  if (
    row.id !== id ||
    row.version !== version ||
    String(row.private_key) !== mediaVerifiedPath(id, version) ||
    !ALLOWED_MIME.has(mime as MediaMime) ||
    !Number.isInteger(Number(row.width)) ||
    !Number.isInteger(Number(row.height)) ||
    Number(row.width) < 1 ||
    Number(row.height) < 1 ||
    Number(row.width) * Number(row.height) > 16_000_000 ||
    alt.length < 1 ||
    alt.length > 500 ||
    alt.trim() !== alt ||
    /[<>\u0000-\u001f\u007f-\u009f]/u.test(alt)
  ) {
    throw new CmsInvariantError('The published image projection is inconsistent.');
  }
  return {
    id,
    version,
    privateKey: String(row.private_key),
    mime: mime as MediaMime,
    width: Number(row.width),
    height: Number(row.height),
    alt,
  };
}

export async function openPublishedMedia(asset: PublishedMedia) {
  const token = requireBlobToken();
  const expectedPath = mediaVerifiedPath(asset.id, asset.version);
  if (
    asset.privateKey !== expectedPath ||
    !isMediaUuid(asset.id) ||
    !isMediaVersion(asset.version) ||
    !ALLOWED_MIME.has(asset.mime)
  ) {
    throw new CmsInvariantError('The published image address is inconsistent.');
  }
  const result = await get(expectedPath, { access: 'private', token, useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  if (
    result.blob.pathname !== expectedPath ||
    result.blob.contentType !== asset.mime ||
    result.blob.size < 1 ||
    result.blob.size > MAX_MEDIA_UPLOAD_BYTES
  ) {
    throw new CmsInvariantError('The published image object is inconsistent.');
  }
  return { stream: result.stream, byteSize: result.blob.size };
}

export async function openOwnerPreview(id: string, ownerId: string) {
  const asset = await getOwnedMediaAsset(id, ownerId);
  if (
    !asset ||
    (asset.state !== 'verified' && asset.state !== 'published') ||
    asset.privateKey !== mediaVerifiedPath(asset.id, asset.version) ||
    !asset.mime ||
    !asset.width ||
    !asset.height
  ) {
    throw new CmsNotFoundError('The image was not found.');
  }
  if (asset.state === 'verified') {
    const token = requireBlobToken();
    const bytes = await loadVerifiedPrivateObject(asset, token);
    const verified = await inspectNormalizedMedia(bytes, {
      version: asset.version,
      mime: asset.mime,
      width: asset.width,
      height: asset.height,
    });
    return {
      body: verified.bytes,
      byteSize: verified.byteSize,
      mime: verified.mime,
      width: verified.width,
      height: verified.height,
    };
  }
  const opened = await openPublishedMedia({
    id: asset.id,
    version: asset.version,
    privateKey: asset.privateKey,
    mime: asset.mime,
    width: asset.width ?? 0,
    height: asset.height ?? 0,
    alt: asset.alt,
  });
  if (!opened) throw new CmsNotFoundError('The image was not found.');
  return {
    body: opened.stream,
    byteSize: opened.byteSize,
    mime: asset.mime,
    width: asset.width,
    height: asset.height,
  };
}

export function isMediaUploadConflict(error: unknown): error is CmsConflictError {
  return error instanceof CmsConflictError;
}
