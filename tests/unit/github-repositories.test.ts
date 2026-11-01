import assert from 'node:assert/strict';
import { afterEach, test } from 'vitest';
import {
  getOwnerRepository,
  listOwnerRepositories,
} from '../../src/lib/cms/github-repositories.ts';

const ownerId = 43_065_067;
const originalFetch = globalThis.fetch;
const originalPat = process.env.GITHUB_PAT;

function repository(id: number, owner: { id: number; login: string }) {
  return {
    id,
    name: `repo-${id}`,
    full_name: `${owner.login}/repo-${id}`,
    private: id % 2 === 0,
    html_url: `https://github.com/${owner.login}/repo-${id}`,
    description: null,
    homepage: null,
    topics: ['react'],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
    default_branch: 'main',
    language: 'TypeScript',
    archived: false,
    fork: false,
    owner,
  };
}

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalPat === undefined) {
    delete process.env.GITHUB_PAT;
  } else {
    process.env.GITHUB_PAT = originalPat;
  }
});

test('lists all accessible public and private repositories with numeric IDs and access ownership', async () => {
  process.env.GITHUB_PAT = 'fixture-github-pat';
  const requests: Array<{ url: string; authorization: string | null }> = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    requests.push({ url, authorization: new Headers(init?.headers).get('Authorization') });
    if (url.endsWith('/user')) {
      return jsonResponse({ id: ownerId, login: 'fixture-owner' });
    }
    if (url.includes('/user/repos?')) {
      return jsonResponse([
        repository(310_001, { id: ownerId, login: 'fixture-owner' }),
        repository(310_002, { id: 91_000, login: 'partner' }),
      ]);
    }
    return jsonResponse({ message: 'Not Found' }, 404);
  };

  const repositories = await listOwnerRepositories('fixture-github-pat');
  assert.equal(repositories.length, 2);
  assert.equal(repositories[0]?.id, 310_001);
  assert.equal(repositories[0]?.ownedByPatOwner, true);
  assert.equal(repositories[0]?.private, false);
  assert.equal(repositories[1]?.id, 310_002);
  assert.equal(repositories[1]?.ownedByPatOwner, false);
  assert.equal(repositories[1]?.private, true);
  assert.ok(requests.every((request) => request.authorization === 'Bearer fixture-github-pat'));
  assert.ok(
    requests.some((request) =>
      request.url.includes('affiliation=owner%2Ccollaborator%2Corganization_member'),
    ),
  );
});

test('resolves a repository only when it remains accessible to the configured PAT', async () => {
  process.env.GITHUB_PAT = 'fixture-github-pat';
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith('/user')) {
      return jsonResponse({ id: ownerId, login: 'fixture-owner' });
    }
    if (url.includes('/user/repos?')) {
      return jsonResponse([repository(310_002, { id: 91_000, login: 'partner' })]);
    }
    return jsonResponse({ message: 'Not Found' }, 404);
  };

  const accessible = await getOwnerRepository('fixture-github-pat', 310_002);
  assert.equal(accessible.owner, 'partner');
  assert.equal(accessible.ownedByPatOwner, false);
  await assert.rejects(getOwnerRepository('fixture-github-pat', 310_003), {
    code: 'forbidden',
    status: 403,
  });
});
