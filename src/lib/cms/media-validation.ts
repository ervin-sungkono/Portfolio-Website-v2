import { createHash } from 'node:crypto';
import sharp from 'sharp';

export const MAX_MEDIA_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_MEDIA_PIXELS = 16_000_000;

export type MediaFormat = 'png' | 'jpeg' | 'webp';
export type MediaMime = 'image/png' | 'image/jpeg' | 'image/webp';

export class MediaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MediaValidationError';
  }
}

export type ValidatedMedia = {
  bytes: Buffer;
  format: MediaFormat;
  mime: MediaMime;
  width: number;
  height: number;
  byteSize: number;
  version: string;
};

function sniffFormat(bytes: Buffer): MediaFormat | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes.subarray(1, 4).toString('ascii') === 'PNG' &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpeg';
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}

function mimeForFormat(format: MediaFormat): MediaMime {
  switch (format) {
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
  }
}

/**
 * Validates the uploaded bytes, decodes them under a pixel cap, applies EXIF
 * orientation, strips metadata, re-encodes to the detected raster format, and
 * returns an immutable content hash for the cleaned bytes.
 */
export async function validateAndNormalizeMedia(input: Uint8Array): Promise<ValidatedMedia> {
  if (input.byteLength === 0) throw new MediaValidationError('Choose a non-empty image file.');
  if (input.byteLength > MAX_MEDIA_UPLOAD_BYTES) {
    throw new MediaValidationError('Images must be 5 MiB or smaller.');
  }

  const bytes = Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  const detectedFormat = sniffFormat(bytes);
  if (!detectedFormat) {
    throw new MediaValidationError('Use a PNG, JPEG, or WebP image.');
  }

  try {
    const image = sharp(bytes, { failOn: 'error', limitInputPixels: MAX_MEDIA_PIXELS });
    const metadata = await image.metadata();
    if (metadata.format !== detectedFormat) {
      throw new MediaValidationError('The image signature and decoded format do not match.');
    }
    if ((metadata.pages ?? 1) !== 1) {
      throw new MediaValidationError('Animated images are not supported for new uploads.');
    }
    if (
      !metadata.width ||
      !metadata.height ||
      metadata.width * metadata.height > MAX_MEDIA_PIXELS
    ) {
      throw new MediaValidationError('Images must contain 16 megapixels or fewer.');
    }

    const rotated = image.rotate();
    const encoder =
      detectedFormat === 'png'
        ? rotated.png({ compressionLevel: 9, adaptiveFiltering: true })
        : detectedFormat === 'jpeg'
          ? rotated.jpeg({ quality: 90, mozjpeg: true })
          : rotated.webp({ quality: 90 });
    const encoded = await encoder.toBuffer({ resolveWithObject: true });

    if (encoded.info.format !== detectedFormat || !encoded.info.width || !encoded.info.height) {
      throw new MediaValidationError('The image could not be safely decoded.');
    }
    if (encoded.info.width * encoded.info.height > MAX_MEDIA_PIXELS) {
      throw new MediaValidationError('Images must contain 16 megapixels or fewer.');
    }
    if (encoded.data.byteLength > MAX_MEDIA_UPLOAD_BYTES) {
      throw new MediaValidationError('The normalized image is larger than 5 MiB.');
    }

    return {
      bytes: encoded.data,
      format: detectedFormat,
      mime: mimeForFormat(detectedFormat),
      width: encoded.info.width,
      height: encoded.info.height,
      byteSize: encoded.data.byteLength,
      version: createHash('sha256').update(encoded.data).digest('hex'),
    };
  } catch (error) {
    if (error instanceof MediaValidationError) throw error;
    if (error instanceof Error && /pixel|dimension.*limit|too large/i.test(error.message)) {
      throw new MediaValidationError('Images must contain 16 megapixels or fewer.');
    }
    throw new MediaValidationError('The image is damaged or could not be decoded safely.');
  }
}

/** Checks a server-normalized private object without applying a second lossy encode. */
export async function inspectNormalizedMedia(
  input: Uint8Array,
  expected: { version: string; mime: MediaMime; width: number; height: number },
): Promise<ValidatedMedia> {
  if (input.byteLength === 0 || input.byteLength > MAX_MEDIA_UPLOAD_BYTES) {
    throw new MediaValidationError('The verified image is missing or too large.');
  }
  const bytes = Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  const format = sniffFormat(bytes);
  if (!format) throw new MediaValidationError('The verified image signature is invalid.');
  const mime = mimeForFormat(format);
  if (
    mime !== expected.mime ||
    createHash('sha256').update(bytes).digest('hex') !== expected.version
  ) {
    throw new MediaValidationError('The verified image does not match its saved version.');
  }
  try {
    const metadata = await sharp(bytes, {
      failOn: 'error',
      limitInputPixels: MAX_MEDIA_PIXELS,
    }).metadata();
    if (
      metadata.format !== format ||
      (metadata.pages ?? 1) !== 1 ||
      metadata.width !== expected.width ||
      metadata.height !== expected.height ||
      !metadata.width ||
      !metadata.height ||
      metadata.width * metadata.height > MAX_MEDIA_PIXELS
    ) {
      throw new MediaValidationError('The verified image dimensions are invalid.');
    }
    return {
      bytes,
      format,
      mime,
      width: metadata.width,
      height: metadata.height,
      byteSize: bytes.byteLength,
      version: expected.version,
    };
  } catch (error) {
    if (error instanceof MediaValidationError) throw error;
    if (error instanceof Error && /pixel|dimension.*limit|too large/i.test(error.message)) {
      throw new MediaValidationError('Images must contain 16 megapixels or fewer.');
    }
    throw new MediaValidationError('The verified image is damaged or could not be decoded safely.');
  }
}

export function isMediaUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function isMediaVersion(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}

export function mediaStagingPath(id: string): string {
  if (!isMediaUuid(id)) throw new MediaValidationError('The media ID is invalid.');
  return `staging/${id.toLowerCase()}`;
}

export function mediaVerifiedPath(id: string, version: string): string {
  if (!isMediaUuid(id) || !isMediaVersion(version)) {
    throw new MediaValidationError('The verified media address is invalid.');
  }
  return `verified/${id.toLowerCase()}/${version}`;
}

export function mediaPublishedUrl(id: string, version: string): string {
  if (!isMediaUuid(id) || !isMediaVersion(version)) {
    throw new MediaValidationError('The published media URL is invalid.');
  }
  return `/media/published/${id.toLowerCase()}/${version}`;
}
