import 'server-only';

import { createHash } from 'node:crypto';
import { CmsSetupError } from './errors';

type CmsEnvironment = 'development' | 'preview' | 'production';

function setupError() {
  return new CmsSetupError(['DATABASE_URL_PUBLIC']);
}

function readDatabaseIdentity(value: string | undefined) {
  if (!value) throw setupError();

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw setupError();
  }

  if (
    (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') ||
    !url.hostname ||
    !url.username ||
    !url.pathname ||
    url.pathname === '/' ||
    url.hash
  ) {
    throw setupError();
  }

  // Match the driver's allowed parameters; include Neon's optional endpoint
  // routing identity, which can select a different branch on a shared host.
  for (const key of url.searchParams.keys()) {
    if (
      !['sslmode', 'channel_binding', 'options'].includes(key) ||
      url.searchParams.getAll(key).length !== 1
    )
      throw setupError();
  }
  const endpoint = url.searchParams.get('options');
  if (endpoint !== null && !/^endpoint=[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(endpoint))
    throw setupError();
  const local = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(url.hostname);
  const sslmode = url.searchParams.get('sslmode');
  if (
    local
      ? sslmode !== null && sslmode !== 'disable'
      : !['require', 'verify-ca', 'verify-full'].includes(sslmode ?? '')
  )
    throw setupError();
  const channelBinding = url.searchParams.get('channel_binding');
  if (
    (channelBinding !== null && !['disable', 'prefer', 'require'].includes(channelBinding)) ||
    (local && channelBinding === 'require')
  )
    throw setupError();

  let username: string;
  let database: string;
  try {
    username = decodeURIComponent(url.username);
    database = decodeURIComponent(url.pathname.slice(1));
  } catch {
    throw setupError();
  }

  const port = url.port ? Number(url.port) : 5432;
  if (
    !username ||
    !database ||
    username !== 'portfolio_public' ||
    /[\u0000-\u001f\u007f]/.test(username) ||
    /[\u0000-\u001f\u007f]/.test(database) ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65_535
  ) {
    throw setupError();
  }

  return {
    host: url.hostname.toLowerCase(),
    port,
    database,
    username,
    endpoint,
  };
}

function environmentValue(value: string | undefined, fallback: CmsEnvironment): CmsEnvironment {
  const environment = value ?? fallback;
  if (environment !== 'development' && environment !== 'preview' && environment !== 'production') {
    throw new CmsSetupError(['CMS_ENVIRONMENT']);
  }
  return environment;
}

function previewBranch(isPreview: boolean): string | null {
  if (!isPreview) return null;

  const branch = process.env.VERCEL_GIT_COMMIT_REF;
  if (
    !branch ||
    branch.length > 255 ||
    branch.trim() !== branch ||
    /[\u0000-\u0020\u007f]/.test(branch)
  ) {
    throw new CmsSetupError(['VERCEL_GIT_COMMIT_REF']);
  }
  return branch;
}

/**
 * Builds a non-reversible namespace for the published-content cache.
 * Credentials, URL query parameters, and request data never enter the hash.
 */
export function getPublishedCacheScope(): string {
  const database = readDatabaseIdentity(process.env.DATABASE_URL_PUBLIC);
  const vercelValue = process.env.VERCEL_ENV;
  if (
    vercelValue !== undefined &&
    vercelValue !== 'development' &&
    vercelValue !== 'preview' &&
    vercelValue !== 'production'
  ) {
    throw new CmsSetupError(['VERCEL_ENV']);
  }

  const vercelEnvironment = vercelValue ?? 'local';
  const defaultCmsEnvironment =
    vercelEnvironment === 'preview' || vercelEnvironment === 'production'
      ? vercelEnvironment
      : process.env.NODE_ENV === 'production'
        ? 'production'
        : 'development';
  const cmsEnvironment = environmentValue(process.env.CMS_ENVIRONMENT, defaultCmsEnvironment);
  const branch = previewBranch(vercelEnvironment === 'preview' || cmsEnvironment === 'preview');

  const namespace = createHash('sha256')
    .update(
      JSON.stringify([
        'cms-published-v3',
        database.host,
        database.port,
        database.database,
        database.username,
        database.endpoint,
        vercelEnvironment,
        cmsEnvironment,
        branch,
      ]),
    )
    .digest('hex');

  return `cms-published-v3:${namespace}`;
}
