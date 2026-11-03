import 'server-only';

import { CmsError } from './errors.ts';
import { githubJson, repoPath } from './github.ts';
import { cmsIdentity } from './git-identity.ts';
import type { RepositoryContext } from './repository.ts';

const gitShaPattern = /^[a-f0-9]{40}$/i;
const updateRefsMutation = `
  mutation UpdateCmsBranch($input: UpdateRefsInput!) {
    updateRefs(input: $input) {
      clientMutationId
    }
  }
`;

export type GitBranchState = { commitSha: string; treeSha: string };
export type GitTreeChange = { path: string; sha: string | null };
export type GitBlobData = { sha: string; size: number; bytes: Uint8Array };

function requireSha(value: unknown, description: string): string {
  if (typeof value !== 'string' || !gitShaPattern.test(value)) {
    throw new CmsError('github', `GitHub returned an invalid ${description}.`, 502);
  }
  return value;
}

function refPath(repository: RepositoryContext, plural = false): string {
  const branch = repository.defaultBranch.split('/').map(encodeURIComponent).join('/');
  return repoPath(
    repository.owner,
    repository.name,
    `/git/${plural ? 'refs' : 'ref'}/heads/${branch}`,
  );
}

export async function getGitBranchState(
  repository: RepositoryContext,
  token: string,
): Promise<GitBranchState> {
  const reference = await githubJson<{ object?: { sha?: string; type?: string } }>(
    refPath(repository),
    { token },
  );
  if (!reference?.object || reference.object.type !== 'commit') {
    throw new CmsError(
      'unsupported_repository',
      'The content branch does not point to a commit.',
      409,
    );
  }
  const commitSha = requireSha(reference.object.sha, 'branch commit SHA');
  const commit = await githubJson<{ tree?: { sha?: string } }>(
    repoPath(repository.owner, repository.name, `/git/commits/${commitSha}`),
    { token },
  );
  return { commitSha, treeSha: requireSha(commit?.tree?.sha, 'branch tree SHA') };
}

export async function createGitBlob(
  repository: RepositoryContext,
  bytes: Uint8Array,
  token: string,
): Promise<string> {
  const blob = await githubJson<{ sha?: string }>(
    repoPath(repository.owner, repository.name, '/git/blobs'),
    {
      token,
      method: 'POST',
      body: { content: Buffer.from(bytes).toString('base64'), encoding: 'base64' },
    },
  );
  return requireSha(blob?.sha, 'blob SHA');
}

export async function readGitBlob(
  repository: RepositoryContext,
  sha: string,
  token: string,
  maxBytes = 1_048_576,
): Promise<GitBlobData> {
  const requestedSha = requireSha(sha, 'blob SHA');
  const blob = await githubJson<{
    sha?: string;
    size?: number;
    encoding?: string;
    content?: string;
  }>(repoPath(repository.owner, repository.name, `/git/blobs/${requestedSha}`), { token });
  if (
    !blob ||
    blob.encoding !== 'base64' ||
    typeof blob.content !== 'string' ||
    !Number.isSafeInteger(blob.size) ||
    blob.size! < 0 ||
    blob.size! > maxBytes
  ) {
    throw new CmsError(
      'validation',
      'A staged image blob is invalid or exceeds the 1 MiB limit.',
      400,
    );
  }
  const encoded = blob.content.replace(/\s/g, '');
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
    throw new CmsError('validation', 'A staged image blob is not valid base64 data.', 400);
  }
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.byteLength !== blob.size || bytes.toString('base64') !== encoded) {
    throw new CmsError('validation', 'A staged image blob does not match its declared size.', 400);
  }
  return { sha: requireSha(blob.sha, 'blob SHA'), size: bytes.byteLength, bytes };
}

export async function createGitTree(
  repository: RepositoryContext,
  baseTreeSha: string,
  changes: GitTreeChange[],
  token: string,
): Promise<string> {
  const tree = await githubJson<{ sha?: string }>(
    repoPath(repository.owner, repository.name, '/git/trees'),
    {
      token,
      method: 'POST',
      body: {
        base_tree: requireSha(baseTreeSha, 'base tree SHA'),
        tree: changes.map(({ path, sha }) => ({ path, mode: '100644', type: 'blob', sha })),
      },
    },
  );
  return requireSha(tree?.sha, 'tree SHA');
}

export async function createGitCommit(
  repository: RepositoryContext,
  treeSha: string,
  parentSha: string,
  token: string,
  message = 'cms: publish portfolio changes',
): Promise<{ sha: string; commitUrl: string }> {
  const commit = await githubJson<{ sha?: string; html_url?: string }>(
    repoPath(repository.owner, repository.name, '/git/commits'),
    {
      token,
      method: 'POST',
      body: {
        message,
        tree: requireSha(treeSha, 'tree SHA'),
        parents: [requireSha(parentSha, 'parent commit SHA')],
        author: cmsIdentity,
        committer: cmsIdentity,
      },
    },
  );
  const sha = requireSha(commit?.sha, 'commit SHA');
  if (typeof commit?.html_url !== 'string') {
    throw new CmsError('github', 'GitHub returned incomplete commit details.', 502);
  }
  return { sha, commitUrl: commit.html_url };
}

async function commitIsOnBranch(
  repository: RepositoryContext,
  commitSha: string,
  branchHeadSha: string,
  token: string,
): Promise<boolean> {
  if (branchHeadSha === commitSha) {
    return true;
  }
  const comparison = await githubJson<{ merge_base_commit?: { sha?: string } }>(
    repoPath(
      repository.owner,
      repository.name,
      `/compare/${encodeURIComponent(commitSha)}...${encodeURIComponent(branchHeadSha)}`,
    ),
    { token },
  );
  return comparison?.merge_base_commit?.sha === commitSha;
}

type GraphqlResponse = {
  data?: { updateRefs?: { clientMutationId?: string | null } | null } | null;
  errors?: unknown[];
};

async function getRepositoryNodeId(repository: RepositoryContext, token: string): Promise<string> {
  const metadata = await githubJson<{ node_id?: unknown }>(
    repoPath(repository.owner, repository.name, ''),
    { token },
  );
  if (
    typeof metadata?.node_id !== 'string' ||
    metadata.node_id.length === 0 ||
    metadata.node_id.trim() !== metadata.node_id
  ) {
    throw new CmsError('github', 'GitHub returned an invalid repository node ID.', 502);
  }
  return metadata.node_id;
}

async function updateGitHubRefs(
  repository: RepositoryContext,
  repositoryNodeId: string,
  beforeSha: string,
  afterSha: string,
  token: string,
): Promise<GraphqlResponse | null> {
  return githubJson<GraphqlResponse>('/graphql', {
    token,
    method: 'POST',
    body: {
      query: updateRefsMutation,
      variables: {
        input: {
          repositoryId: repositoryNodeId,
          refUpdates: [
            {
              name: `refs/heads/${repository.defaultBranch}`,
              beforeOid: beforeSha,
              afterOid: afterSha,
              force: false,
            },
          ],
          clientMutationId: afterSha,
        },
      },
    },
  });
}

function branchConflict(parentSha: string, currentSha: string): CmsError {
  return new CmsError(
    'conflict',
    'The content branch changed while you were submitting. Reload the latest content and review your draft before retrying.',
    409,
    { conflicts: [{ path: '@branch', expectedSha: parentSha, currentSha }] },
  );
}

async function confirmBranchUpdate(
  repository: RepositoryContext,
  parentSha: string,
  commit: { sha: string; commitUrl: string },
  token: string,
  mutationError: unknown,
): Promise<{ sha: string; commitUrl: string }> {
  try {
    const latest = await getGitBranchState(repository, token);
    if (await commitIsOnBranch(repository, commit.sha, latest.commitSha, token)) {
      return commit;
    }
    if (latest.commitSha !== parentSha) {
      throw branchConflict(parentSha, latest.commitSha);
    }
  } catch (error) {
    if (error instanceof CmsError && error.code === 'conflict') {
      throw error;
    }
    throw new CmsError(
      'unavailable',
      'GitHub could not confirm whether the final commit reached the content branch. Reload the repository before retrying.',
      503,
    );
  }

  if (mutationError instanceof CmsError && mutationError.code !== 'unavailable') {
    throw mutationError;
  }
  throw new CmsError(
    'unavailable',
    'GitHub could not confirm whether the final commit reached the content branch. Reload the repository before retrying.',
    503,
  );
}

export async function updateGitBranch(
  repository: RepositoryContext,
  parentSha: string,
  commit: { sha: string; commitUrl: string },
  token: string,
): Promise<{ sha: string; commitUrl: string }> {
  const commitSha = requireSha(commit.sha, 'commit SHA');
  const expectedSha = requireSha(parentSha, 'parent commit SHA');
  const repositoryNodeId = await getRepositoryNodeId(repository, token);
  let mutation: GraphqlResponse | null | undefined;
  let mutationError: unknown;
  try {
    mutation = await updateGitHubRefs(repository, repositoryNodeId, expectedSha, commitSha, token);
    if (
      mutation &&
      (!mutation.errors || mutation.errors.length === 0) &&
      mutation.data?.updateRefs?.clientMutationId === commitSha
    ) {
      return commit;
    }
  } catch (error) {
    mutationError = error;
  }

  mutationError ??= new CmsError(
    'github',
    'GitHub returned an incomplete or rejected branch update response.',
    502,
  );
  return confirmBranchUpdate(
    repository,
    expectedSha,
    { ...commit, sha: commitSha },
    token,
    mutationError,
  );
}
