import assert from 'node:assert/strict';
import { test } from 'vitest';
import { githubBytes, githubJson } from '../../src/lib/cms/github.ts';

test('GitHub API and raw-content requests use abort signals', async () => {
  const originalFetch = globalThis.fetch;
  const signals: Array<AbortSignal | null | undefined> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    signals.push(init.signal);
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    );
    return url.hostname === 'api.github.com'
      ? Response.json({ id: 1, login: 'owner' })
      : new Response(new Uint8Array([1, 2, 3]));
  }) as typeof fetch;

  try {
    await githubJson('/user', { token: 'fixture-pat' });
    assert.deepEqual(
      await githubBytes('https://raw.githubusercontent.com/owner/repo/main/image.png'),
      new Uint8Array([1, 2, 3]),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(signals.length, 2);
  assert.ok(signals.every((signal) => signal instanceof AbortSignal));
});
