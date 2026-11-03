import 'server-only';

import { createHash } from 'node:crypto';
import { CmsError, validationError } from './errors.ts';
import { assertCmsOwner } from './github.ts';
import { createGitBlob, readGitBlob } from './git-data.ts';
import { mediaPathForDigest } from './media-path.ts';
import { isValidImageBytes, resolveRepository } from './repository.ts';
import { stageMediaBlobSchema } from './schemas.ts';

const maxUploadBytes = 1_048_576;

export type StagedMediaBlob = {
  scope: 'project' | 'technology';
  slug: string;
  filename: string;
  mime: 'image/png' | 'image/jpeg' | 'image/webp';
  path: string;
  blobSha: string;
};

function decodeUpload(content: string): Uint8Array {
  if (
    content.length > Math.ceil((maxUploadBytes + 2) / 3) * 4 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(content)
  ) {
    throw validationError('The image upload is not valid base64 data.');
  }
  const bytes = Buffer.from(content, 'base64');
  if (!bytes.length || bytes.byteLength > maxUploadBytes || bytes.toString('base64') !== content) {
    throw validationError('Images must be no larger than 1 MiB.');
  }
  return bytes;
}

export async function stageMediaBlob(token: string, input: unknown): Promise<StagedMediaBlob> {
  await assertCmsOwner(token);
  const parsed = stageMediaBlobSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw validationError(
      `${issue?.path.length ? `${issue.path.join('.')}: ` : ''}${issue?.message ?? 'Check the image upload.'}`,
    );
  }

  const bytes = decodeUpload(parsed.data.content);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const path = mediaPathForDigest(
    parsed.data.scope,
    parsed.data.slug,
    parsed.data.filename,
    parsed.data.mime,
    sha256,
  );
  if (!path || !isValidImageBytes(path, bytes)) {
    throw validationError('Choose a PNG, JPEG, or WebP image whose file contents match its type.');
  }

  const repository = await resolveRepository(token);
  const blobSha = await createGitBlob(repository, bytes, token);
  return {
    scope: parsed.data.scope,
    slug: parsed.data.slug,
    filename: parsed.data.filename,
    mime: parsed.data.mime,
    path,
    blobSha,
  };
}

export async function readAndVerifyStagedMedia(
  token: string,
  repository: Awaited<ReturnType<typeof resolveRepository>>,
  media: StagedMediaBlob,
): Promise<Uint8Array> {
  const blob = await readGitBlob(repository, media.blobSha, token, maxUploadBytes);
  const sha256 = createHash('sha256').update(blob.bytes).digest('hex');
  const path = mediaPathForDigest(media.scope, media.slug, media.filename, media.mime, sha256);
  if (
    blob.sha !== media.blobSha ||
    path !== media.path ||
    !isValidImageBytes(media.path, blob.bytes)
  ) {
    throw new CmsError(
      'validation',
      `The staged image ${media.path} does not match its file data and metadata. Upload it again.`,
      400,
    );
  }
  return blob.bytes;
}
