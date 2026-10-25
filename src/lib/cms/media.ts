import 'server-only';

import { createHash } from 'node:crypto';
import { CmsError, validationError } from './errors.ts';
import { assertCmsOwner, githubJson, repoPath } from './github.ts';
import {
  isValidImageBytes,
  readContentFile,
  readProjectMedia,
  resolveRepository,
  writeContentBytes,
} from './repository.ts';
import { uploadMediaSchema, type UploadMediaDocument } from './schemas.ts';

const maxUploadBytes = 1_048_576;
const safeFileName = /^[^/\\\u0000]+$/;

export type UploadMediaInput = UploadMediaDocument;

export type UploadedMedia = {
  path: string;
  rawUrl: string;
  commitUrl: string;
  sha: string;
  contentSha: string;
  alreadyExists: boolean;
};

async function latestCommit(
  repository: Awaited<ReturnType<typeof resolveRepository>>,
  path: string,
  token: string,
) {
  const commits = await githubJson<Array<{ sha: string; html_url: string }>>(
    repoPath(
      repository.owner,
      repository.name,
      `/commits?path=${encodeURIComponent(path)}&sha=${encodeURIComponent(repository.defaultBranch)}&per_page=1`,
    ),
    { token },
  );
  const commit = commits?.[0];
  if (!commit?.sha || !commit.html_url) {
    throw new CmsError('github', 'GitHub could not return the media commit details.', 502);
  }
  return { sha: commit.sha, commitUrl: commit.html_url };
}

function decodeUpload(input: UploadMediaInput): {
  bytes: Uint8Array;
  extension: string;
  stem: string;
} {
  if (input.slug !== 'technologies' && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)) {
    throw validationError('Choose a valid project before uploading media.');
  }
  if (
    input.filename.length > 255 ||
    !safeFileName.test(input.filename) ||
    input.filename === '.' ||
    input.filename === '..'
  ) {
    throw validationError('Use a simple image filename without folder paths.');
  }
  if (
    input.content.length > Math.ceil((maxUploadBytes + 2) / 3) * 4 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input.content)
  ) {
    throw validationError('The image upload is not valid base64 data.');
  }
  const bytes = Buffer.from(input.content, 'base64');
  if (
    !bytes.length ||
    bytes.byteLength > maxUploadBytes ||
    bytes.toString('base64') !== input.content
  ) {
    throw validationError('Images must be no larger than 1 MiB.');
  }

  const sourceExtension = input.filename.split('.').at(-1)?.toLowerCase();
  const extension =
    input.mime === 'image/png' && sourceExtension === 'png'
      ? 'png'
      : input.mime === 'image/jpeg' && (sourceExtension === 'jpg' || sourceExtension === 'jpeg')
        ? 'jpg'
        : input.mime === 'image/webp' && sourceExtension === 'webp'
          ? 'webp'
          : null;
  if (!extension || !isValidImageBytes(`image.${extension}`, bytes)) {
    throw validationError('Choose a PNG, JPEG, or WebP image whose file contents match its type.');
  }

  const sourceStem = input.filename.slice(0, input.filename.lastIndexOf('.'));
  const stem =
    sourceStem
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'image';
  return { bytes, extension, stem };
}

function rawUrl(owner: string, name: string, branch: string, path: string): string {
  return `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/${encodeURIComponent(branch)}/${path
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
}

export async function uploadMedia(token: string, input: unknown): Promise<UploadedMedia> {
  await assertCmsOwner(token);
  const parsed = uploadMediaSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw validationError(
      `${issue?.path.length ? `${issue.path.join('.')}: ` : ''}${issue?.message ?? 'Check the image upload.'}`,
    );
  }
  const { bytes, extension, stem } = decodeUpload(parsed.data);
  const repository = await resolveRepository(token);
  const digest = createHash('sha256').update(bytes).digest('hex');
  const filename = `${digest}-${stem}.${extension}`;
  const path =
    parsed.data.slug === 'technologies'
      ? `media/technologies/${filename}`
      : `media/projects/${parsed.data.slug}/${filename}`;
  const existing = await readContentFile(repository, path, token);
  if (existing) {
    const stored = await readProjectMedia(repository, path);
    if (Buffer.from(stored).equals(Buffer.from(bytes))) {
      const commit = await latestCommit(repository, path, token);
      return {
        path,
        rawUrl: rawUrl(repository.owner, repository.name, repository.defaultBranch, path),
        commitUrl: commit.commitUrl,
        sha: commit.sha,
        contentSha: existing.sha,
        alreadyExists: true,
      };
    }
    throw new CmsError(
      'conflict',
      'An image with this content hash already exists but does not match. Retry the upload.',
      409,
    );
  }

  let alreadyExists = false;
  const result = await writeContentBytes(
    repository,
    path,
    bytes,
    null,
    `cms: upload media ${filename}`,
    token,
  ).catch(async (error: unknown) => {
    if (!(error instanceof CmsError) || error.code !== 'conflict') {
      throw error;
    }
    const concurrent = await readContentFile(repository, path, token);
    if (!concurrent) {
      throw error;
    }
    const stored = await readProjectMedia(repository, path);
    if (!Buffer.from(stored).equals(Buffer.from(bytes))) {
      throw error;
    }
    alreadyExists = true;
    const commit = await latestCommit(repository, path, token);
    return { ...commit, contentSha: concurrent.sha };
  });

  return {
    path,
    rawUrl: rawUrl(repository.owner, repository.name, repository.defaultBranch, path),
    commitUrl: result.commitUrl,
    sha: result.sha,
    contentSha: result.contentSha,
    alreadyExists,
  };
}
