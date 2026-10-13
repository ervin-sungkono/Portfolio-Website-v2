import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import sharp from 'sharp';
import { hasExactOrigin, readBoundedJson } from '../../src/lib/cms/media-http.ts';
import { CmsSetupError } from '../../src/lib/cms/errors.ts';
import { requireBlobToken } from '../../src/lib/cms/media.ts';
import {
  MAX_MEDIA_PIXELS,
  MAX_MEDIA_UPLOAD_BYTES,
  MediaValidationError,
  isMediaUuid,
  isMediaVersion,
  mediaPublishedUrl,
  mediaStagingPath,
  mediaVerifiedPath,
  inspectNormalizedMedia,
  validateAndNormalizeMedia,
} from '../../src/lib/cms/media-validation.ts';

async function image(format: 'png' | 'jpeg' | 'webp', width = 2, height = 3) {
  return sharp({
    create: { width, height, channels: 3, background: { r: 24, g: 128, b: 220 } },
  })
    .toFormat(format)
    .toBuffer();
}

test('normalizes allowed raster formats and hashes the bytes it returns', async () => {
  const png = await validateAndNormalizeMedia(await image('png'));
  const jpeg = await validateAndNormalizeMedia(await image('jpeg'));
  const webp = await validateAndNormalizeMedia(await image('webp'));

  assert.deepEqual([png.mime, jpeg.mime, webp.mime], ['image/png', 'image/jpeg', 'image/webp']);
  assert.deepEqual([png.width, png.height], [2, 3]);
  assert.deepEqual([jpeg.width, jpeg.height], [2, 3]);
  assert.deepEqual([webp.width, webp.height], [2, 3]);
  for (const item of [png, jpeg, webp]) {
    assert.equal(item.version.length, 64);
    assert.equal(item.byteSize, item.bytes.byteLength);
    assert.equal(item.version, createHash('sha256').update(item.bytes).digest('hex'));
  }
});

test('rechecks normalized media hash, mime, format, and decoded dimensions before delivery', async () => {
  const normalized = await validateAndNormalizeMedia(await image('png', 6, 4));
  const inspected = await inspectNormalizedMedia(normalized.bytes, {
    version: normalized.version,
    mime: normalized.mime,
    width: normalized.width,
    height: normalized.height,
  });

  assert.equal(inspected.version, normalized.version);
  assert.deepEqual([inspected.mime, inspected.width, inspected.height], ['image/png', 6, 4]);
  await assert.rejects(
    inspectNormalizedMedia(normalized.bytes, {
      ...normalized,
      version: '0'.repeat(64),
    }),
    /does not match its saved version/,
  );
  await assert.rejects(
    inspectNormalizedMedia(normalized.bytes, {
      version: normalized.version,
      mime: normalized.mime,
      width: 5,
      height: normalized.height,
    }),
    /dimensions are invalid/,
  );
});

test('rejects SVG, GIF, and bytes whose signatures do not identify an allowed image', async () => {
  const unsupported = [
    Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
    Buffer.from('GIF89a\x01\x00\x01\x00'),
    Buffer.from('not an image'),
  ];
  for (const value of unsupported) {
    await assert.rejects(validateAndNormalizeMedia(value), MediaValidationError);
  }
});

test('rejects payloads larger than 5 MiB before attempting to decode them', async () => {
  await assert.rejects(
    validateAndNormalizeMedia(Buffer.alloc(MAX_MEDIA_UPLOAD_BYTES + 1)),
    /5 MiB/,
  );
});

test('rejects decoded image dimensions above the 16 megapixel limit', async () => {
  const tooLarge = await image('png', 4001, 4000);
  assert.ok(4001 * 4000 > MAX_MEDIA_PIXELS);
  await assert.rejects(validateAndNormalizeMedia(tooLarge), /16 megapixels/);
});

test('accepts only safe UUID and SHA-256 address segments', () => {
  const id = '4f56af0e-3db6-4bd4-96f1-6e681a871023';
  const version = 'a'.repeat(64);
  assert.equal(isMediaUuid(id), true);
  assert.equal(isMediaUuid('../published'), false);
  assert.equal(isMediaVersion(version), true);
  assert.equal(isMediaVersion(`${version}?download=1`), false);
  assert.equal(mediaStagingPath(id), `staging/${id}`);
  assert.equal(mediaVerifiedPath(id, version), `verified/${id}/${version}`);
  assert.equal(mediaPublishedUrl(id, version), `/media/published/${id}/${version}`);
  assert.throws(() => mediaPublishedUrl(id, `${version}?download=1`), MediaValidationError);
  assert.throws(() => mediaStagingPath('../published'), MediaValidationError);
});

test('requires an exact same-origin request for media mutations', () => {
  const sameOrigin = new Request('https://cms.example/api/admin/media', {
    method: 'POST',
    headers: { origin: 'https://cms.example', 'sec-fetch-site': 'same-origin' },
  });
  assert.equal(hasExactOrigin(sameOrigin), true);

  const invalidHeaders: Record<string, string>[] = [
    { origin: 'https://attacker.example' },
    { origin: 'https://cms.example/' },
    { origin: 'https://cms.example', 'sec-fetch-site': 'cross-site' },
    {},
  ];
  for (const headers of invalidHeaders) {
    const request = new Request('https://cms.example/api/admin/media', {
      method: 'POST',
      headers,
    });
    assert.equal(hasExactOrigin(request), false);
  }
});

test('uses only the private Blob token for media operations', () => {
  const originalPrivate = process.env.BLOB_PRIVATE_READ_WRITE_TOKEN;
  const originalPublic = process.env.BLOB_PUBLIC_READ_WRITE_TOKEN;
  try {
    process.env.BLOB_PRIVATE_READ_WRITE_TOKEN = 'private-test-token';
    process.env.BLOB_PUBLIC_READ_WRITE_TOKEN = 'public-test-token';
    assert.equal(requireBlobToken(), 'private-test-token');

    delete process.env.BLOB_PRIVATE_READ_WRITE_TOKEN;
    assert.throws(requireBlobToken, (error) => {
      assert.ok(error instanceof CmsSetupError);
      assert.deepEqual(error.missing, ['BLOB_PRIVATE_READ_WRITE_TOKEN']);
      return true;
    });
  } finally {
    if (originalPrivate === undefined) delete process.env.BLOB_PRIVATE_READ_WRITE_TOKEN;
    else process.env.BLOB_PRIVATE_READ_WRITE_TOKEN = originalPrivate;
    if (originalPublic === undefined) delete process.env.BLOB_PUBLIC_READ_WRITE_TOKEN;
    else process.env.BLOB_PUBLIC_READ_WRITE_TOKEN = originalPublic;
  }
});

test('bounds media JSON request bodies and requires the JSON content type', async () => {
  const exact = new Request('https://cms.example/api/admin/media', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{"alt":"a"}',
  });
  assert.deepEqual(await readBoundedJson(exact, 11), { alt: 'a' });

  const tooLarge = new Request('https://cms.example/api/admin/media', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{"alt":"ab"}',
  });
  await assert.rejects(readBoundedJson(tooLarge, 11), /too large/);

  const wrongType = new Request('https://cms.example/api/admin/media', {
    method: 'POST',
    headers: { 'content-type': 'text/plain' },
    body: '{}',
  });
  await assert.rejects(readBoundedJson(wrongType, 11), /JSON/);
});
