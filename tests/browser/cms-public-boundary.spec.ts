import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { expect, test, type Page } from '@playwright/test';
import { cmsTestDatabaseUrl } from '../cms/test-db.ts';

const baseURL = 'http://127.0.0.1:3105';
const sha256 = 'a'.repeat(64);

test.use({ javaScriptEnabled: false });

async function assertDoesNotContain(response: { text(): Promise<string> }, marker: string) {
  const body = await response.text();
  if (body.includes(marker)) {
    throw new Error('A private CMS draft value appeared in a public response.');
  }
}

async function assertFlightResponseDoesNotContain(page: Page, pathname: string, marker: string) {
  const response = await page.request.get(pathname, {
    headers: { RSC: '1', Accept: 'text/x-component' },
  });
  if (response.status() >= 500) throw new Error('The public Flight request failed unexpectedly.');
  const contentType = response.headers()['content-type'] ?? '';
  if (!contentType.includes('text/x-component') && !contentType.includes('text/html')) {
    throw new Error('The public project request returned an unexpected response format.');
  }
  await assertDoesNotContain(response, marker);
}

test('draft projects and verified media stay out of public HTML, metadata, Flight, and media delivery', async ({
  page,
}) => {
  const pool = new Pool({
    connectionString: cmsTestDatabaseUrl('migrations'),
    max: 2,
    connectionTimeoutMillis: 5_000,
    ssl: false,
  });
  const entryId = randomUUID();
  const mediaId = randomUUID();
  const slug = `qa-private-${randomUUID()}`;
  const marker = `CMS-PRIVATE-DRAFT-${randomUUID()}`;
  const image = `/media/published/${mediaId}/${sha256}`;
  const payload = {
    id: slug,
    slug,
    name: marker,
    description: `Unpublished content marker ${marker}`,
    image,
    topics: ['private QA content'],
    category: 'Private QA draft',
    source: 'https://example.test/private-source',
    demo: null,
  };

  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO cms.entries
           (id, kind, slug, title, position, draft_revision, published_revision, has_published, archived)
         VALUES ($1::uuid, 'project', $2, $3, 0, 1, NULL, false, false)`,
        [entryId, slug, marker],
      );
      await client.query(
        `INSERT INTO cms.entry_revisions (entry_id, version, kind, slug, actor_id, payload)
         VALUES ($1::uuid, 1, 'project', $2, 'cms-qa-browser-fixture', $3::jsonb)`,
        [entryId, slug, JSON.stringify(payload)],
      );
      await client.query(
        `INSERT INTO cms.media_assets
           (id, version, state, private_key, mime, width, height, byte_size, alt, created_by)
         VALUES ($1::uuid, $2, 'verified', $3, 'image/png', 1, 1, 68, 'Private QA image', 'cms-qa-browser-fixture')`,
        [mediaId, sha256, `verified/${mediaId}/${sha256}`],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }

    const publicRole = new Pool({
      connectionString: cmsTestDatabaseUrl('public'),
      max: 1,
      connectionTimeoutMillis: 5_000,
      ssl: false,
    });
    try {
      const rows = await publicRole.query(
        'SELECT 1 FROM cms.published_content WHERE slug = $1 LIMIT 1',
        [slug],
      );
      expect(rows.rowCount).toBe(0);
    } finally {
      await publicRole.end();
    }

    const projectResponse = await page.goto(`/project/${slug}`);
    expect(projectResponse?.status()).toBe(404);
    expect(projectResponse?.headers()['x-robots-tag']).toContain('noindex');
    expect(projectResponse?.headers()['cache-control']).toContain('no-store');
    await expect(page).toHaveTitle(/Ervin Cahyadinata Sungkono/u);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/u);
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'This Page Isn’t Here.' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Explore Projects' })).toHaveAttribute(
      'href',
      '/project',
    );
    if (projectResponse) await assertDoesNotContain(projectResponse, marker);
    await assertFlightResponseDoesNotContain(page, `/project/${slug}`, marker);

    const catalog = await page.request.get('/project');
    expect(catalog.status()).toBe(200);
    await assertDoesNotContain(catalog, marker);
    const sitemap = await page.request.get('/sitemap.xml');
    expect(sitemap.status()).toBe(200);
    await assertDoesNotContain(sitemap, slug);
    await assertDoesNotContain(sitemap, marker);

    await page.goto(`/admin/preview/${entryId}`);
    await expect(page).toHaveURL(/\/admin\/login/u);
    await expect(page.locator('body')).not.toContainText(marker);

    const mediaPath = `/media/published/${mediaId}/${sha256}`;
    const privateMedia = await page.request.get(mediaPath);
    expect(privateMedia.status()).toBe(404);
    expect(privateMedia.headers()['cache-control']).toContain('no-store');
    const queriedMedia = await page.request.get(`${mediaPath}?download=1`);
    expect(queriedMedia.status()).toBe(404);
    const uppercaseMedia = await page.request.get(
      `/media/published/${mediaId.toUpperCase()}/${sha256}`,
    );
    expect(uppercaseMedia.status()).toBe(404);
    const privatePreview = await page.request.get(`/api/admin/media/${mediaId}`);
    expect(privatePreview.status()).toBe(401);
  } finally {
    await pool.query('DELETE FROM cms.publish_outbox WHERE entry_id = $1::uuid', [entryId]);
    await pool.query('DELETE FROM cms.save_requests WHERE entry_id = $1::uuid', [entryId]);
    await pool.query('DELETE FROM cms.published_content WHERE entry_id = $1::uuid', [entryId]);
    await pool.query('DELETE FROM cms.entry_revisions WHERE entry_id = $1::uuid', [entryId]);
    await pool.query('DELETE FROM cms.audit_events WHERE entry_id = $1::uuid', [entryId]);
    await pool.query('DELETE FROM cms.entries WHERE id = $1::uuid', [entryId]);
    await pool.query('DELETE FROM cms.published_media WHERE asset_id = $1::uuid', [mediaId]);
    await pool.query('DELETE FROM cms.media_assets WHERE id = $1::uuid', [mediaId]);
    await pool.end();
  }
});
