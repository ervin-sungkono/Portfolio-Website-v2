import assert from 'node:assert/strict';
import test from 'node:test';
import { contentExistsResponse } from '../src/lib/content-response.ts';

test('content checks validate slugs, use published lookups, and distinguish unavailable content', async () => {
  const request = (slug: string) =>
    new Request(`https://portfolio.example/api/content/post?slug=${encodeURIComponent(slug)}`);
  let calls = 0;
  const lookup = async (slug: string) => {
    calls++;
    return slug === 'published-post' ? { slug } : undefined;
  };
  assert.deepEqual(await (await contentExistsResponse(request('../escape'), lookup)).json(), {
    exists: false,
  });
  assert.equal(calls, 0);
  assert.deepEqual(await (await contentExistsResponse(request('published-post'), lookup)).json(), {
    exists: true,
  });
  assert.deepEqual(
    await (await contentExistsResponse(request('unpublished-post'), lookup)).json(),
    { exists: false },
  );
  const unavailable = await contentExistsResponse(request('published-post'), async () => {
    throw new Error('upstream failure');
  });
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.headers.get('cache-control'), 'no-store');
  assert.equal((await unavailable.text()).includes('upstream failure'), false);
});
