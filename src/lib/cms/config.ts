import 'server-only';

import { CmsError } from './errors.ts';

const sourceRepositories = new Set([
  'portfolio-website-2',
  'portofolio-website-2',
  'portfolio-website-v2',
  'portofolio-website-v2',
]);

export type CmsConfig = { adminId: number; repository: string };

export function getCmsConfig(): CmsConfig {
  const configuredId = process.env.GITHUB_ADMIN_ID?.trim();
  const configuredRepository = process.env.GITHUB_REPO?.trim();
  // The public portfolio has a known content repository; paired overrides support fixtures.
  const adminIdValue = configuredId || (!configuredRepository ? '43065067' : undefined);
  const repository = configuredRepository || (!configuredId ? 'web-assets' : undefined);

  if (
    !adminIdValue ||
    !/^\d+$/.test(adminIdValue) ||
    !Number.isSafeInteger(Number(adminIdValue)) ||
    Number(adminIdValue) < 1
  ) {
    throw new CmsError('configuration', 'Set GITHUB_ADMIN_ID to the numeric GitHub user ID.', 500);
  }
  if (
    !repository ||
    repository.length > 100 ||
    repository === '.' ||
    repository === '..' ||
    !/^[A-Za-z0-9_.-]+$/.test(repository)
  ) {
    throw new CmsError(
      'configuration',
      'Set GITHUB_REPO to a repository name without an owner or path.',
      500,
    );
  }
  if (sourceRepositories.has(repository.toLowerCase())) {
    throw new CmsError(
      'configuration',
      'GITHUB_REPO must point to a separate content repository, not the portfolio source repository.',
      500,
    );
  }

  return { adminId: Number(adminIdValue), repository };
}

export function getPublicSource() {
  const { adminId, repository } = getCmsConfig();
  const isDefault = adminId === 43065067 && repository.toLowerCase() === 'web-assets';
  const owner = process.env.GITHUB_CONTENT_OWNER?.trim() || (isDefault ? 'ervin-sungkono' : '');
  const branch = process.env.GITHUB_CONTENT_BRANCH?.trim() || (isDefault ? 'master' : '');
  if (!/^[A-Za-z0-9-]+$/.test(owner) || !branch || branch.length > 255) {
    throw new CmsError(
      'configuration',
      'Set GITHUB_CONTENT_OWNER and GITHUB_CONTENT_BRANCH for the public content repository.',
      500,
    );
  }
  return { owner, name: repository, branch };
}
