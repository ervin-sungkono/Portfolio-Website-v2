import assert from 'node:assert/strict';
import test from 'node:test';
import { publishAndRevalidate } from '../src/lib/cms/publishing.ts';
import { contentInvalidation } from '../src/lib/cms/cache-policy.ts';
import { cmsErrorResponse, readCmsJson, requireSameOrigin } from '../src/lib/cms/http.ts';
import { CmsError } from '../src/lib/cms/errors.ts';

test('publication invalidates only after GitHub accepts the commit', async () => {
  const calls: string[] = [];
  const result = await publishAndRevalidate(
    async () => {
      calls.push('commit');
      return { commitUrl: 'https://github.com/fixture/content/commit/abc' };
    },
    () => {
      calls.push('invalidate');
    },
  );
  assert.deepEqual(calls, ['commit', 'invalidate']);
  assert.equal(result.cache, 'refreshed');
  await assert.rejects(
    publishAndRevalidate(
      async () => {
        throw new Error('GitHub failed');
      },
      () => {
        calls.push('bad-invalidation');
      },
    ),
  );
  assert.equal(calls.includes('bad-invalidation'), false);
});

test('cache failures preserve a successful commit for safe invalidation-only retry', async () => {
  let writes = 0;
  const result = await publishAndRevalidate(
    async () => {
      writes++;
      return { contentSha: 'saved-blob' };
    },
    () => {
      throw new Error('cache unavailable');
    },
  );
  assert.equal(writes, 1);
  assert.deepEqual(result, { contentSha: 'saved-blob', cache: 'pending' });
});

test('invalidation covers new/deleted project routes, catalog, homepage, and sitemap', () => {
  assert.deepEqual(contentInvalidation('project', 'new-project'), {
    tags: ['projects', 'project:new-project'],
    paths: ['/', '/project', '/project/new-project', '/sitemap.xml'],
  });
  assert.deepEqual(contentInvalidation('site'), { tags: ['site'], paths: ['/'] });
  assert.ok(contentInvalidation('taxonomy').paths.includes('/project/[slug]'));
  assert.deepEqual(contentInvalidation('post', 'example-post'), {
    tags: ['posts', 'post:example-post'],
    paths: ['/blog', '/blog/example-post', '/sitemap.xml'],
  });
  assert.throws(() => contentInvalidation('post', '../escape'));
  const all = contentInvalidation('all');
  assert.ok(all.tags.includes('posts'));
  assert.ok(all.paths.includes('/blog'));
  assert.ok(all.paths.includes('/blog/[slug]'));
  assert.ok(!contentInvalidation('taxonomy').paths.includes('/blog'));
  assert.throws(() => contentInvalidation('project', '../../api/auth'));
});

test('CMS mutations reject foreign/missing origins and non-JSON requests', async () => {
  assert.throws(
    () =>
      requireSameOrigin(
        new Request('https://portfolio.example/api/cms', {
          headers: { origin: 'https://other.example' },
        }),
      ),
    { status: 403 },
  );
  assert.throws(() => requireSameOrigin(new Request('https://portfolio.example/api/cms')), {
    status: 403,
  });
  requireSameOrigin(
    new Request('https://portfolio.example/api/cms', {
      headers: { origin: 'https://portfolio.example' },
    }),
  );
  await assert.rejects(
    readCmsJson(new Request('https://portfolio.example', { method: 'POST', body: 'hello' })),
    { status: 415 },
  );
});

test('bounded streaming rejects oversized bodies before JSON parsing', async () => {
  let cancelled = false;
  const body = new ReadableStream({
    pull(controller) {
      controller.enqueue(new Uint8Array(65_537));
    },
    cancel() {
      cancelled = true;
    },
  });
  const request = new Request('https://portfolio.example', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    duplex: 'half',
  } as RequestInit);
  await assert.rejects(readCmsJson(request), { status: 413 });
  assert.equal(cancelled, true);
  const response = cmsErrorResponse(new CmsError('conflict', 'Reload the latest version.', 409));
  assert.equal(response.status, 409);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(
    (await cmsErrorResponse(new Error('secret provider details')).text()).includes('secret'),
    false,
  );
});

test('CMS post requests allow the escaped maximum Markdown body while the default reader stays bounded', async () => {
  const escapedBody = '\\u0061'.repeat(30_000);
  const body = `{"kind":"post","slug":"long-post","expectedSha":null,"data":{"schemaVersion":1,"title":"Long post","summary":"Long post summary","body":"${escapedBody}","published":false,"publishedAt":"2026-10-28"}}`;
  assert.ok(Buffer.byteLength(body) > 65_536);
  assert.ok(Buffer.byteLength(body) < 196_608);

  await assert.rejects(
    readCmsJson(
      new Request('https://portfolio.example/api/cms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      }),
    ),
    { status: 413 },
  );
  const parsed = (await readCmsJson(
    new Request('https://portfolio.example/api/cms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    }),
    196_608,
  )) as { data: { body: string } };
  assert.equal(parsed.data.body.length, 30_000);
});
