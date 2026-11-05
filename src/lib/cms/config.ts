import 'server-only';

import { CmsError } from './errors.ts';

const sourceRepository = 'portfolio-website-v2';

type CmsConfig = { repository: string };

export function getCmsConfig(): CmsConfig {
  const repository = process.env.GITHUB_REPO?.trim();
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
  if (repository.toLowerCase() === sourceRepository) {
    throw new CmsError(
      'configuration',
      'GITHUB_REPO must point to a separate content repository, not the portfolio source repository.',
      500,
    );
  }

  return { repository };
}
