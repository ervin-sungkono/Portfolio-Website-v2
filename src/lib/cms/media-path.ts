export type CmsMediaScope = 'project' | 'technology';
export type CmsImageMime = 'image/png' | 'image/jpeg' | 'image/webp';

const projectSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const safeFileName = /^[^/\\\u0000]+$/;

function extensionFor(filename: string, mime: CmsImageMime): 'png' | 'jpg' | 'webp' | null {
  const sourceExtension = filename.split('.').at(-1)?.toLowerCase();
  if (mime === 'image/png' && sourceExtension === 'png') {
    return 'png';
  }
  if (mime === 'image/jpeg' && (sourceExtension === 'jpg' || sourceExtension === 'jpeg')) {
    return 'jpg';
  }
  if (mime === 'image/webp' && sourceExtension === 'webp') {
    return 'webp';
  }
  return null;
}

/**
 * Computes the immutable CMS media path from metadata and a lowercase SHA-256 hex digest.
 * Browsers can compute the digest with `crypto.subtle.digest('SHA-256', fileBytes)`.
 */
export function mediaPathForDigest(
  scope: CmsMediaScope,
  slug: string,
  filename: string,
  mime: CmsImageMime,
  sha256Hex: string,
): string | null {
  if (
    !filename.length ||
    filename.length > 255 ||
    !safeFileName.test(filename) ||
    filename === '.' ||
    filename === '..' ||
    !/^[a-f0-9]{64}$/.test(sha256Hex)
  ) {
    return null;
  }
  if (scope === 'technology' ? slug !== 'technologies' : !projectSlugPattern.test(slug)) {
    return null;
  }

  const extension = extensionFor(filename, mime);
  if (!extension) {
    return null;
  }
  const sourceStem = filename.slice(0, filename.lastIndexOf('.'));
  const stem =
    sourceStem
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'image';
  const relativeDirectory =
    scope === 'technology' ? 'media/technologies' : `media/projects/${slug}`;
  return `${relativeDirectory}/${sha256Hex}-${stem}.${extension}`;
}
