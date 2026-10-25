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
  const adminIdValue = process.env.GITHUB_ADMIN_ID?.trim();
  const repository = process.env.GITHUB_REPO?.trim();

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
