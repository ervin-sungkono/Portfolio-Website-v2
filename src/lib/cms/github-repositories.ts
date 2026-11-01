import 'server-only';

import { assertCmsOwner, githubJson } from './github.ts';
import { CmsError, validationError } from './errors.ts';

type GitHubRepositoryResponse = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string | null;
  homepage: string | null;
  topics: string[];
  created_at: string;
  updated_at: string;
  default_branch: string;
  language: string | null;
  archived: boolean;
  fork: boolean;
  owner: { id: number; login: string };
};

export type GitHubImportRepository = {
  id: number;
  ownerId: number;
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  htmlUrl: string;
  description: string | null;
  homepage: string | null;
  topics: string[];
  createdAt: string;
  updatedAt: string;
  defaultBranch: string;
  language: string | null;
  archived: boolean;
  fork: boolean;
  ownedByPatOwner: boolean;
};

const pageSize = 100;
const maxPages = 50;

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

function mapRepository(
  repository: GitHubRepositoryResponse,
  patOwnerId: number,
): GitHubImportRepository {
  if (
    !Number.isSafeInteger(repository.id) ||
    repository.id <= 0 ||
    !Number.isSafeInteger(repository.owner?.id) ||
    repository.owner.id <= 0 ||
    typeof repository.name !== 'string' ||
    !/^[A-Za-z0-9._-]+$/.test(repository.name) ||
    typeof repository.full_name !== 'string' ||
    typeof repository.owner.login !== 'string' ||
    !/^[A-Za-z0-9-]+$/.test(repository.owner.login) ||
    typeof repository.private !== 'boolean' ||
    typeof repository.html_url !== 'string' ||
    !isHttpsUrl(repository.html_url) ||
    typeof repository.created_at !== 'string' ||
    typeof repository.updated_at !== 'string' ||
    typeof repository.default_branch !== 'string' ||
    !Array.isArray(repository.topics) ||
    repository.topics.some((topic) => typeof topic !== 'string') ||
    typeof repository.archived !== 'boolean' ||
    typeof repository.fork !== 'boolean'
  ) {
    throw new CmsError('github', 'GitHub returned incomplete repository metadata.', 502);
  }

  return {
    id: repository.id,
    ownerId: repository.owner.id,
    owner: repository.owner.login,
    name: repository.name,
    fullName: repository.full_name,
    private: repository.private,
    htmlUrl: repository.html_url,
    description: typeof repository.description === 'string' ? repository.description : null,
    homepage: typeof repository.homepage === 'string' ? repository.homepage : null,
    topics: repository.topics,
    createdAt: repository.created_at,
    updatedAt: repository.updated_at,
    defaultBranch: repository.default_branch,
    language: typeof repository.language === 'string' ? repository.language : null,
    archived: repository.archived,
    fork: repository.fork,
    ownedByPatOwner: repository.owner.id === patOwnerId,
  };
}

export async function listOwnerRepositories(token: string): Promise<GitHubImportRepository[]> {
  const user = await assertCmsOwner(token);
  const repositories: GitHubImportRepository[] = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const query = new URLSearchParams({
      affiliation: 'owner,collaborator,organization_member',
      per_page: String(pageSize),
      page: String(page),
      sort: 'updated',
      direction: 'desc',
      visibility: 'all',
    });
    const items = await githubJson<GitHubRepositoryResponse[]>(`/user/repos?${query}`, { token });
    const current = (items ?? []).map((repository) => mapRepository(repository, user.id));
    repositories.push(...current);
    if (current.length < pageSize) {
      return repositories;
    }
  }

  throw new CmsError(
    'unsupported_repository',
    'The repository list is larger than the importer can load. Narrow the GitHub account access and retry.',
    502,
  );
}

export async function getOwnerRepository(
  token: string,
  id: number,
): Promise<GitHubImportRepository> {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw validationError('Choose a valid GitHub repository.');
  }
  const repository = (await listOwnerRepositories(token)).find((item) => item.id === id);
  if (!repository) {
    throw new CmsError(
      'forbidden',
      'The selected repository is not accessible to the configured GitHub account.',
      403,
    );
  }
  return repository;
}
