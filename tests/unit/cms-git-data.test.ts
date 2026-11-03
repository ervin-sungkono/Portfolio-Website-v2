import assert from 'node:assert/strict';
import { afterEach, test } from 'vitest';
import { CmsError } from '../../src/lib/cms/errors.ts';
import { createGitCommit, updateGitBranch } from '../../src/lib/cms/git-data.ts';

const originalFetch = globalThis.fetch;
const repository = { owner: 'owner', name: 'content', defaultBranch: 'release/2026' };

type GraphqlBody = {
  query: string;
  variables: {
    input: {
      repositoryId: string;
      clientMutationId: string;
      refUpdates: Array<{
        name: string;
        beforeOid: string;
        afterOid: string;
        force: boolean;
      }>;
    };
  };
};

type CapturedRequest = { url: URL; init: RequestInit };
type GitHubFixtureOptions = {
  headSha: string;
  mergeBaseSha: string;
  onGraphql?: (body: GraphqlBody, setHead: (sha: string) => void) => Response | Promise<Response>;
};

function mockGitHub({ headSha, mergeBaseSha, onGraphql }: GitHubFixtureOptions) {
  const requests: CapturedRequest[] = [];
  let currentHeadSha = headSha;
  globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    );
    requests.push({ url, init });

    if (url.pathname === '/repos/owner/content') {
      return Response.json({ node_id: 'R_kgDOFixtureRepository' });
    }
    if (url.pathname === '/graphql' && init.method === 'POST') {
      const body = JSON.parse(String(init.body)) as GraphqlBody;
      return (
        (await onGraphql?.(body, (sha) => {
          currentHeadSha = sha;
        })) ??
        Response.json({
          data: { updateRefs: { clientMutationId: body.variables.input.clientMutationId } },
        })
      );
    }
    if (url.pathname.startsWith('/repos/owner/content/git/ref/heads/')) {
      return Response.json({ object: { sha: currentHeadSha, type: 'commit' } });
    }
    if (url.pathname === `/repos/owner/content/git/commits/${currentHeadSha}`) {
      return Response.json({ tree: { sha: '5'.repeat(40) } });
    }
    if (url.pathname.startsWith('/repos/owner/content/compare/')) {
      return Response.json({ merge_base_commit: { sha: mergeBaseSha } });
    }
    return Response.json({ message: 'Unexpected GitHub request.' }, { status: 500 });
  }) as typeof fetch;
  return {
    requests,
    setHead(sha: string) {
      currentHeadSha = sha;
    },
  };
}

function submittedCommit(sha: string) {
  return { sha, commitUrl: `https://github.com/owner/content/commit/${sha}` };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('allows initialization to set a commit message while retaining the CMS identity', async () => {
  const commitSha = '2'.repeat(40);
  let requestBody: Record<string, unknown> | undefined;
  globalThis.fetch = (async (_input: RequestInfo | URL, init: RequestInit = {}) => {
    requestBody = JSON.parse(String(init.body)) as Record<string, unknown>;
    return Response.json({
      sha: commitSha,
      html_url: `https://github.com/owner/content/commit/${commitSha}`,
    });
  }) as typeof fetch;

  const result = await createGitCommit(
    repository,
    '3'.repeat(40),
    '1'.repeat(40),
    'fixture-token',
    'cms: initialize portfolio content',
  );

  assert.deepEqual(result, submittedCommit(commitSha));
  assert.equal(requestBody?.message, 'cms: initialize portfolio content');
  assert.deepEqual(requestBody?.author, { name: 'Portfolio CMS', email: 'cms@portfolio.local' });
  assert.deepEqual(requestBody?.committer, {
    name: 'Portfolio CMS',
    email: 'cms@portfolio.local',
  });
});

test('updates the branch with an exact non-force expected-head GraphQL mutation', async () => {
  const parentSha = '1'.repeat(40);
  const submittedSha = '2'.repeat(40);
  const fixture = mockGitHub({ headSha: parentSha, mergeBaseSha: parentSha });

  const result = await updateGitBranch(
    repository,
    parentSha,
    submittedCommit(submittedSha),
    'fixture-token',
  );

  assert.deepEqual(result, submittedCommit(submittedSha));
  const request = fixture.requests.find(({ url }) => url.pathname === '/graphql');
  assert.ok(request);
  assert.equal(
    request.init.headers && new Headers(request.init.headers).get('authorization'),
    'Bearer fixture-token',
  );
  const body = JSON.parse(String(request.init.body)) as GraphqlBody;
  assert.match(body.query, /updateRefs\(input: \$input\)/);
  assert.deepEqual(body.variables.input, {
    repositoryId: 'R_kgDOFixtureRepository',
    clientMutationId: submittedSha,
    refUpdates: [
      {
        name: 'refs/heads/release/2026',
        beforeOid: parentSha,
        afterOid: submittedSha,
        force: false,
      },
    ],
  });
  assert.equal(
    fixture.requests.some(({ init }) => init.method === 'PATCH'),
    false,
  );
});

test('a branch advance before the CAS returns a conflict', async () => {
  const parentSha = '1'.repeat(40);
  const submittedSha = '2'.repeat(40);
  const currentSha = '3'.repeat(40);
  const fixture = mockGitHub({
    headSha: currentSha,
    mergeBaseSha: parentSha,
    onGraphql: async () =>
      Response.json({ errors: [{ message: 'The ref no longer points to beforeOid.' }] }),
  });

  await assert.rejects(
    updateGitBranch(repository, parentSha, submittedCommit(submittedSha), 'fixture-token'),
    (error: unknown) => {
      assert.ok(error instanceof CmsError);
      assert.equal(error.code, 'conflict');
      assert.equal(error.status, 409);
      assert.deepEqual(error.details, {
        conflicts: [{ path: '@branch', expectedSha: parentSha, currentSha }],
      });
      return true;
    },
  );
  assert.equal(
    fixture.requests.some(({ init }) => init.method === 'PATCH'),
    false,
  );
});

test('a force reset to an ancestor of the expected head is still a conflict', async () => {
  const parentSha = '2'.repeat(40);
  const submittedSha = '3'.repeat(40);
  const resetHeadSha = '1'.repeat(40);
  const fixture = mockGitHub({
    headSha: resetHeadSha,
    mergeBaseSha: resetHeadSha,
    onGraphql: async () =>
      Response.json({ errors: [{ message: 'The ref no longer points to beforeOid.' }] }),
  });

  await assert.rejects(
    updateGitBranch(repository, parentSha, submittedCommit(submittedSha), 'fixture-token'),
    (error: unknown) => {
      assert.ok(error instanceof CmsError);
      assert.equal(error.code, 'conflict');
      assert.deepEqual(error.details, {
        conflicts: [{ path: '@branch', expectedSha: parentSha, currentSha: resetHeadSha }],
      });
      return true;
    },
  );
  assert.equal(
    fixture.requests.some(({ init }) => init.method === 'PATCH'),
    false,
  );
});

test('a GraphQL error is treated as success when ancestry proves the commit reached the branch', async () => {
  const parentSha = '1'.repeat(40);
  const submittedSha = '2'.repeat(40);
  const descendantSha = '3'.repeat(40);
  const fixture = mockGitHub({
    headSha: parentSha,
    mergeBaseSha: submittedSha,
    onGraphql: async (_body, setHead) => {
      setHead(descendantSha);
      return Response.json({ errors: [{ message: 'The response was interrupted.' }] });
    },
  });

  const result = await updateGitBranch(
    repository,
    parentSha,
    submittedCommit(submittedSha),
    'fixture-token',
  );

  assert.deepEqual(result, submittedCommit(submittedSha));
  assert.ok(
    fixture.requests.some(({ url }) =>
      url.pathname.endsWith(`/compare/${submittedSha}...${descendantSha}`),
    ),
  );
  assert.equal(
    fixture.requests.some(({ init }) => init.method === 'PATCH'),
    false,
  );
});

test('an unreadable outcome with the old head still visible returns unavailable', async () => {
  const parentSha = '1'.repeat(40);
  const submittedSha = '2'.repeat(40);
  const fixture = mockGitHub({
    headSha: parentSha,
    mergeBaseSha: parentSha,
    onGraphql: async () =>
      Response.json({ errors: [{ message: 'The update could not be confirmed.' }] }),
  });

  await assert.rejects(
    updateGitBranch(repository, parentSha, submittedCommit(submittedSha), 'fixture-token'),
    (error: unknown) => {
      assert.ok(error instanceof CmsError);
      assert.equal(error.code, 'github');
      assert.equal(error.status, 502);
      return true;
    },
  );
  assert.equal(
    fixture.requests.some(({ init }) => init.method === 'PATCH'),
    false,
  );
});
