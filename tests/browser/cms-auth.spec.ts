import { createHmac, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { expect, test, type Page } from '@playwright/test';
import { createNonOwnerFixture, deleteAuthFixture } from '../cms/auth-fixtures.ts';
import { cmsTestDatabaseUrl } from '../cms/test-db.ts';

const baseURL = 'http://127.0.0.1:3105';
const origin = baseURL;

function decodeBase32(secret: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const character of secret.toUpperCase().replace(/=+$/u, '')) {
    const digit = alphabet.indexOf(character);
    if (digit < 0) throw new Error('The authenticator setup key is malformed.');
    value = (value << 5) | digit;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function currentTotp(secret: string): string {
  const counter = BigInt(Math.floor(Date.now() / 30_000));
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(counter);
  const digest = createHmac('sha1', decodeBase32(secret)).update(message).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
}

async function codeAfterSettlingWindow(page: Page, secret: string): Promise<string> {
  const elapsed = Date.now() % 30_000;
  if (elapsed > 22_000) await page.waitForTimeout(30_000 - elapsed + 250);
  return currentTotp(secret);
}

async function postAuth(page: Page, pathname: string, data: Record<string, unknown> = {}) {
  return page.request.post(pathname, {
    headers: { Origin: origin },
    data,
  });
}

async function postUploadToken(
  page: Page,
  id: string,
  pathname: string,
  fetchSite = 'same-origin',
) {
  return page.request.post('/api/admin/media/upload', {
    headers: { Origin: origin, 'sec-fetch-site': fetchSite },
    data: {
      type: 'blob.generate-client-token',
      payload: {
        pathname,
        multipart: false,
        clientPayload: JSON.stringify({ id }),
      },
    },
  });
}

async function getSession(page: Page) {
  const response = await page.request.get('/api/auth/get-session');
  expect(response.status()).toBe(200);
  return response.json() as Promise<{
    session: { token: string };
    user: { id: string; email: string; twoFactorEnabled: boolean };
  } | null>;
}

async function assertNoSession(page: Page, headers?: Record<string, string>) {
  const response = await page.request.get('/api/auth/get-session', { headers });
  if (response.status() !== 200 || (await response.json()) !== null) {
    throw new Error('The CMS unexpectedly accepted a request without an active session.');
  }
}

async function ageCurrentOwnerSession(page: Page, pool: Pool, ownerId: string): Promise<void> {
  const session = await getSession(page);
  if (!session || session.user.id !== ownerId) {
    throw new Error('The active owner session could not be aged for the freshness regression.');
  }
  const aged = await pool.query(
    `UPDATE auth."session"
        SET "createdAt" = now() - interval '31 minutes'
      WHERE token = $1 AND "userId" = $2
      RETURNING token`,
    [session.session.token, ownerId],
  );
  if (aged.rowCount !== 1) {
    throw new Error(
      'The isolated owner session row could not be aged for the freshness regression.',
    );
  }
}

async function reauthenticateOwner(
  page: Page,
  email: string,
  password: string,
  secret: string,
  ownerId: string,
): Promise<void> {
  await postAuth(page, '/api/auth/sign-out');
  await assertNoSession(page);
  const signIn = await postAuth(page, '/api/auth/sign-in/email', { email, password });
  expect(signIn.status()).toBe(200);
  const challenge = (await signIn.json()) as { twoFactorRedirect?: boolean };
  if (challenge.twoFactorRedirect !== true) {
    throw new Error('Password sign-in did not require the configured TOTP challenge.');
  }
  const verification = await postAuth(page, '/api/auth/two-factor/verify-totp', {
    code: await codeAfterSettlingWindow(page, secret),
    trustDevice: false,
  });
  expect(verification.status()).toBe(200);
  const result = (await verification.json()) as { token?: unknown; user?: { id?: unknown } };
  expect(
    typeof result.token === 'string' && result.token.length > 0 && result.user?.id === ownerId,
  ).toBe(true);
  expect((await getSession(page))?.user).toMatchObject({ id: ownerId, twoFactorEnabled: true });
}

type LifecycleFixture = { id: string; slug: string; originalName: string };

async function createDraftProjectFixture(pool: Pool): Promise<LifecycleFixture> {
  const legacyImage = await pool.query<{ image: string }>(
    `SELECT payload->>'image' AS image
       FROM cms.entry_revisions
      WHERE kind = 'project'
        AND actor_id = 'system:cms-seed'
        AND payload->>'image' NOT LIKE '/media/published/%'
      ORDER BY slug
      LIMIT 1`,
  );
  if (!legacyImage.rows[0]?.image) {
    throw new Error('The CMS browser lifecycle needs a seeded legacy project image fixture.');
  }

  const id = randomUUID();
  const slug = `cms-qa-lifecycle-${id}`;
  const originalName = `CMS QA lifecycle original ${id}`;
  const payload = {
    id: `cms-qa-${id.slice(0, 12)}`,
    slug,
    name: originalName,
    description: `Published lifecycle fixture ${id}.`,
    image: legacyImage.rows[0].image,
    topics: ['CMS QA'],
    category: 'Integration test',
    source: 'https://example.test/source',
    demo: null,
  };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO cms.entries
         (id, kind, slug, title, position, draft_revision, published_revision, has_published, archived)
       VALUES ($1::uuid, 'project', $2, $3, 1000000, 1, NULL, false, false)`,
      [id, slug, originalName],
    );
    await client.query(
      `INSERT INTO cms.entry_revisions (entry_id, version, kind, slug, actor_id, payload)
       VALUES ($1::uuid, 1, 'project', $2, 'cms-qa-browser-fixture', $3::jsonb)`,
      [id, slug, JSON.stringify(payload)],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  return { id, slug, originalName };
}

async function deleteProjectFixture(pool: Pool, id: string): Promise<void> {
  await pool.query('DELETE FROM cms.publish_outbox WHERE entry_id = $1::uuid', [id]);
  await pool.query('DELETE FROM cms.save_requests WHERE entry_id = $1::uuid', [id]);
  await pool.query('DELETE FROM cms.published_content WHERE entry_id = $1::uuid', [id]);
  await pool.query('DELETE FROM cms.entry_revisions WHERE entry_id = $1::uuid', [id]);
  await pool.query('DELETE FROM cms.audit_events WHERE entry_id = $1::uuid', [id]);
  await pool.query('DELETE FROM cms.entries WHERE id = $1::uuid', [id]);
}

async function unpublishFixtureBeforeCleanup(page: Page, pool: Pool, id: string) {
  const result = await pool.query('SELECT 1 FROM cms.published_content WHERE entry_id = $1::uuid', [
    id,
  ]);
  if (!result.rowCount) return;

  try {
    await page.goto(`/admin/editor/${id}`);
    await page.getByRole('button', { name: 'Unpublish current entry', exact: true }).click();
    await expect(page.locator('p[role="status"]')).toContainText(
      'This entry is no longer published.',
    );
  } catch {
    // Keep the test's original failure visible; deleting the disposable fixture
    // below still prevents it from affecting later database assertions.
  }
}

async function exercisePublishedContentLifecycle(
  page: Page,
  migration: Pool,
  owner: { id: string; email: string; password: string; secret: string },
) {
  const fixture = await createDraftProjectFixture(migration);
  const draftMarker = `CMS-PRIVATE-DRAFT-${randomUUID()}`;

  try {
    const initialResponse = await page.request.get(`/project/${fixture.slug}`);
    expect(initialResponse.status()).toBe(404);
    const initialHtml = await initialResponse.text();
    expect(initialHtml).not.toContain(fixture.originalName);
    expect(initialHtml).toContain(
      '<title>Ervin Cahyadinata Sungkono | Frontend Software Engineer</title>',
    );

    // Keep this test independent of remote legacy image availability. The
    // image is a display-only fixture; all tested state comes from the CMS.
    await page.route('https://raw.githubusercontent.com/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/F9sAAAAASUVORK5CYII=',
          'base64',
        ),
      }),
    );
    await page.route('**/_next/image**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/F9sAAAAASUVORK5CYII=',
          'base64',
        ),
      }),
    );
    await page.goto(`/admin/editor/${fixture.id}`);
    await page.getByLabel('Project name').fill(draftMarker);
    await page.getByRole('button', { name: 'Save draft', exact: true }).click();
    await expect(page.getByText('Draft saved as revision 2.', { exact: true })).toBeVisible();

    const stillOriginal = await page.request.get(`/project/${fixture.slug}`);
    expect(stillOriginal.status()).toBe(404);
    expect(await stillOriginal.text()).not.toContain(draftMarker);

    const preview = await page.request.get(`/admin/preview/${fixture.id}`);
    expect(preview.status()).toBe(200);
    expect(await preview.text()).toContain(draftMarker);

    await ageCurrentOwnerSession(page, migration, owner.id);
    await page.getByRole('button', { name: 'Publish entry', exact: true }).click();
    await expect(page.locator('p[role="alert"]')).toContainText(
      'Publishing and unpublishing require a password and authenticator sign-in within the last 30 minutes.',
    );
    const stalePublish = await page.request.get(`/project/${fixture.slug}`);
    expect(stalePublish.status()).toBe(404);
    expect(await stalePublish.text()).not.toContain(draftMarker);

    await reauthenticateOwner(page, owner.email, owner.password, owner.secret, owner.id);
    await page.goto(`/admin/editor/${fixture.id}`);
    await page.getByRole('button', { name: 'Publish entry', exact: true }).click();
    await expect(page.locator('p[role="status"]')).toContainText(
      'The saved revision is published.',
    );

    const published = await page.request.get(`/project/${fixture.slug}`);
    expect(published.status()).toBe(200);
    const publishedHtml = await published.text();
    expect(publishedHtml).toContain(draftMarker);
    expect(publishedHtml).toContain(`<title>${draftMarker}`);

    await page.goto(`/admin/editor/${fixture.id}`);
    await ageCurrentOwnerSession(page, migration, owner.id);
    await page.getByRole('button', { name: 'Unpublish current entry', exact: true }).click();
    await expect(page.locator('p[role="alert"]')).toContainText(
      'Publishing and unpublishing require a password and authenticator sign-in within the last 30 minutes.',
    );
    const staleUnpublish = await page.request.get(`/project/${fixture.slug}`);
    expect(staleUnpublish.status()).toBe(200);
    expect(await staleUnpublish.text()).toContain(draftMarker);

    await reauthenticateOwner(page, owner.email, owner.password, owner.secret, owner.id);
    await page.goto(`/admin/editor/${fixture.id}`);
    await page
      .getByRole('listitem')
      .filter({ hasText: /^Revision 1/u })
      .getByRole('button', { name: 'Restore as draft', exact: true })
      .click();
    await expect(page.locator('p[role="status"]')).toContainText(
      'Revision 1 is restored and ready to preview or publish as draft revision 3.',
    );
    await expect(page.getByLabel('Project name')).toHaveValue(fixture.originalName);
    await expect(page.getByText('Current draft revision 3', { exact: true })).toBeVisible();
    const remainsPublished = await page.request.get(`/project/${fixture.slug}`);
    expect(remainsPublished.status()).toBe(200);
    expect(await remainsPublished.text()).toContain(draftMarker);

    await page.getByRole('button', { name: 'Publish saved changes', exact: true }).click();
    await expect(page.locator('p[role="status"]')).toContainText(
      'The saved revision is published.',
    );
    const restored = await page.request.get(`/project/${fixture.slug}`);
    expect(restored.status()).toBe(200);
    const restoredHtml = await restored.text();
    expect(restoredHtml).toContain(fixture.originalName);
    expect(restoredHtml).not.toContain(draftMarker);

    await page.goto(`/admin/editor/${fixture.id}`);
    await page.getByRole('button', { name: 'Unpublish current entry', exact: true }).click();
    await expect(page.locator('p[role="status"]')).toContainText(
      'This entry is no longer published.',
    );
    const unpublished = await page.request.get(`/project/${fixture.slug}`);
    expect(unpublished.status()).toBe(404);
    const unpublishedHtml = await unpublished.text();
    expect(unpublishedHtml).toContain(
      '<title>Ervin Cahyadinata Sungkono | Frontend Software Engineer</title>',
    );
    expect(unpublishedHtml).toMatch(/name="robots"[^>]*noindex/u);
    expect(unpublishedHtml).not.toContain(draftMarker);
  } finally {
    await unpublishFixtureBeforeCleanup(page, migration, fixture.id);
    await deleteProjectFixture(migration, fixture.id);
  }
}

async function exerciseAdminReflow(page: Page, migration: Pool): Promise<void> {
  const profile = await migration.query<{ id: string }>(
    `SELECT id FROM cms.entries WHERE kind = 'profile' AND archived = false ORDER BY position LIMIT 1`,
  );
  const profileId = profile.rows[0]?.id;
  if (!profileId) throw new Error('The CMS browser reflow check needs a seeded profile entry.');

  const paths = [
    '/admin',
    '/admin/content/project',
    '/admin/new/project',
    `/admin/editor/${profileId}`,
  ];
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['light', 'dark']) {
      for (const path of paths) {
        await page.goto(path);
        await page.evaluate((selectedTheme) => {
          document.documentElement.dataset.theme = selectedTheme;
        }, theme);
        const structure = await page.evaluate(() => ({
          mainCount: document.querySelectorAll('main').length,
          headingCount: document.querySelectorAll('main h1').length,
          fitsViewport: document.documentElement.scrollWidth <= window.innerWidth,
        }));
        expect(structure).toEqual({ mainCount: 1, headingCount: 1, fitsViewport: true });
      }
    }
  }
}

test('closed signup, owner MFA, content lifecycle, non-owner denial, and server-side revocation', async ({
  page,
}) => {
  test.setTimeout(180_000);
  page.setDefaultTimeout(15_000);
  page.setDefaultNavigationTimeout(15_000);
  const email = process.env.CMS_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  const password = process.env.CMS_BOOTSTRAP_PASSWORD;
  if (!email || !password) {
    throw new Error('The isolated browser suite needs a seeded QA owner account.');
  }

  const migration = new Pool({
    connectionString: cmsTestDatabaseUrl('migrations'),
    max: 2,
    connectionTimeoutMillis: 5_000,
    ssl: false,
  });
  let ownerId: string | undefined;
  let nonOwnerId: string | undefined;
  try {
    await page.goto('/admin/login');

    const ownerRows = await migration.query<{ id: string }>(
      `SELECT u.id
         FROM auth."user" AS u
         JOIN auth.admin_memberships AS m ON m.user_id = u.id
        WHERE lower(u.email) = $1 AND m.active = true AND m.revoked_at IS NULL`,
      [email],
    );
    expect(ownerRows.rowCount, 'The QA owner must be bootstrapped with an active membership.').toBe(
      1,
    );
    ownerId = ownerRows.rows[0]!.id;

    // The test database is disposable. Clear only this account’s prior factor
    // and sessions plus isolated limiter counters left by interrupted runs.
    const client = await migration.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM auth."session" WHERE "userId" = $1', [ownerId]);
      await client.query('DELETE FROM auth."twoFactor" WHERE "userId" = $1', [ownerId]);
      await client.query('DELETE FROM auth."rateLimit"');
      await client.query(
        'UPDATE auth."user" SET "twoFactorEnabled" = false, "updatedAt" = now() WHERE id = $1',
        [ownerId],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }

    const attemptedEmail = `cms-registration-${randomUUID()}@example.test`;
    const signup = await postAuth(page, '/api/auth/sign-up/email', {
      name: 'Unapproved CMS account',
      email: attemptedEmail,
      password: `Rejected-${randomUUID()}-Password!`,
    });
    expect(signup.status()).toBeGreaterThanOrEqual(400);
    expect(signup.status()).toBeLessThan(500);
    const unregistered = await migration.query(
      'SELECT 1 FROM auth."user" WHERE lower(email) = $1',
      [attemptedEmail],
    );
    expect(unregistered.rowCount).toBe(0);

    const anonymousMedia = await page.request.get('/api/admin/media');
    expect(anonymousMedia.status()).toBe(401);
    const missingOrigin = await page.request.post('/api/admin/media', {
      data: { alt: 'unauthenticated request' },
    });
    expect(missingOrigin.status()).toBe(403);
    const foreignOrigin = await page.request.post('/api/admin/media', {
      headers: { Origin: 'https://attacker.example' },
      data: { alt: 'cross-origin request' },
    });
    expect(foreignOrigin.status()).toBe(403);

    const nonOwner = await createNonOwnerFixture(migration);
    nonOwnerId = nonOwner.userId;
    const nonOwnerSignIn = await postAuth(page, '/api/auth/sign-in/email', {
      email: nonOwner.email,
      password: nonOwner.password,
    });
    expect(nonOwnerSignIn.status()).toBe(200);
    const nonOwnerSession = await getSession(page);
    expect(nonOwnerSession?.user.id).toBe(nonOwner.userId);
    const deniedMediaList = await page.request.get('/api/admin/media');
    expect(deniedMediaList.status()).toBe(403);
    const deniedMediaCreate = await postAuth(page, '/api/admin/media', {
      alt: 'non-owner must not create media',
    });
    expect(deniedMediaCreate.status()).toBe(403);
    await postAuth(page, '/api/auth/sign-out');
    await assertNoSession(page);

    const ownerSignIn = await postAuth(page, '/api/auth/sign-in/email', {
      email,
      password,
    });
    expect(ownerSignIn.status()).toBe(200);
    expect((await getSession(page))?.user).toMatchObject({ id: ownerId, twoFactorEnabled: false });
    expect((await page.request.get('/api/admin/media')).status()).toBe(403);

    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/security$/u);
    await expect(
      page.getByRole('heading', { name: 'Add a second factor before editing.' }),
    ).toBeVisible();
    await page.getByLabel('Confirm owner password').fill(password);
    await page.getByRole('button', { name: 'Set up authenticator', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Connect your authenticator app.' }),
    ).toBeVisible();
    const secretText = await page.locator('[class*="secret-card"] code').textContent();
    const secret = secretText?.trim();
    if (!secret) throw new Error('The owner TOTP setup key was not visible in the enrollment UI.');
    const recoveryCodeNodes = page
      .getByRole('list', { name: 'One-time recovery codes' })
      .getByRole('listitem')
      .locator('code');
    const recoveryCodesVisible = async () => {
      const codes = await recoveryCodeNodes.count();
      return (
        codes === 10 &&
        (await recoveryCodeNodes.evaluateAll((nodes) =>
          nodes.every((node) => Boolean(node.textContent?.trim())),
        ))
      );
    };
    expect(await recoveryCodesVisible()).toBe(true);
    await page
      .getByLabel('Step 2 of 2 · Verify a six-digit code')
      .fill(await codeAfterSettlingWindow(page, secret));
    await page.getByRole('button', { name: 'Verify and finish setup', exact: true }).click();
    await expect(page.locator('p[role="status"]')).toContainText(
      'Two-factor verification is complete.',
    );
    expect(await recoveryCodesVisible()).toBe(true);
    await page.getByLabel('I saved the recovery codes somewhere private.').check();
    await page.getByRole('button', { name: 'Continue to the editor', exact: true }).click();
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin$/u);
    await expect(page.getByRole('heading', { name: 'Good work starts here.' })).toBeVisible();
    expect((await getSession(page))?.user).toMatchObject({ id: ownerId, twoFactorEnabled: true });

    await postAuth(page, '/api/auth/sign-out');
    await assertNoSession(page);
    const secondFactorSignIn = await postAuth(page, '/api/auth/sign-in/email', {
      email,
      password,
    });
    expect(secondFactorSignIn.status()).toBe(200);
    const challenge = (await secondFactorSignIn.json()) as {
      twoFactorRedirect?: boolean;
      twoFactorMethods?: string[];
    };
    if (challenge.twoFactorRedirect !== true || challenge.twoFactorMethods?.join(',') !== 'totp') {
      throw new Error('Password sign-in did not require the configured TOTP challenge.');
    }
    await assertNoSession(page);

    const verified = await postAuth(page, '/api/auth/two-factor/verify-totp', {
      code: await codeAfterSettlingWindow(page, secret),
      trustDevice: false,
    });
    expect(verified.status()).toBe(200);
    const verificationResult = (await verified.json()) as {
      token?: unknown;
      user?: { id?: unknown };
    };
    expect(
      typeof verificationResult.token === 'string' &&
        verificationResult.token.length > 0 &&
        verificationResult.user?.id === ownerId,
    ).toBe(true);
    expect((await getSession(page))?.user).toMatchObject({ id: ownerId, twoFactorEnabled: true });
    const ownerMediaList = await page.request.get('/api/admin/media');
    expect(ownerMediaList.status()).toBe(200);
    expect(await ownerMediaList.json()).toMatchObject({ media: expect.any(Array) });

    await exercisePublishedContentLifecycle(page, migration, {
      id: ownerId,
      email,
      password,
      secret,
    });
    await exerciseAdminReflow(page, migration);

    const ownerMissingOrigin = await page.request.post('/api/admin/media', {
      data: { alt: 'missing origin' },
    });
    expect(ownerMissingOrigin.status()).toBe(403);
    const ownerForeignOrigin = await page.request.post('/api/admin/media', {
      headers: { Origin: 'https://attacker.example' },
      data: { alt: 'foreign origin' },
    });
    expect(ownerForeignOrigin.status()).toBe(403);
    const ownerSameOrigin = await postAuth(page, '/api/admin/media', {
      alt: 'same origin request passes the request boundary',
    });
    expect(ownerSameOrigin.status()).toBe(503);
    expect(await ownerSameOrigin.json()).toMatchObject({
      missing: expect.arrayContaining(['BLOB_PRIVATE_READ_WRITE_TOKEN']),
    });

    const stagingId = randomUUID();
    const stagingPath = `staging/${stagingId}`;
    await migration.query(
      `INSERT INTO cms.media_assets (id, version, state, private_key, alt, created_by)
       VALUES ($1::uuid, $2, 'staging', $3, 'CMS QA upload boundary image', $4)`,
      [stagingId, '0'.repeat(64), stagingPath, ownerId],
    );
    try {
      const crossSiteUpload = await postUploadToken(page, stagingId, stagingPath, 'cross-site');
      expect(crossSiteUpload.status()).toBe(403);

      const wrongPath = await postUploadToken(page, stagingId, `staging/${randomUUID()}`);
      expect(wrongPath.status()).toBe(400);

      const validPathWithoutProviderToken = await postUploadToken(page, stagingId, stagingPath);
      expect(validPathWithoutProviderToken.status()).toBe(503);
      expect(await validPathWithoutProviderToken.json()).toMatchObject({
        missing: expect.arrayContaining(['BLOB_PRIVATE_READ_WRITE_TOKEN']),
      });
    } finally {
      await migration.query('DELETE FROM cms.media_assets WHERE id = $1::uuid', [stagingId]);
    }

    const issuedCookies = await page.context().cookies(baseURL);
    const staleCookie = issuedCookies
      .filter((cookie) => cookie.name.includes('session_token'))
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join('; ');
    if (!staleCookie.includes('='))
      throw new Error('The verified owner session cookie was not issued.');
    const revoke = await postAuth(page, '/api/auth/revoke-sessions');
    expect(revoke.status()).toBe(200);
    expect(await revoke.json()).toMatchObject({ status: true });
    await assertNoSession(page, { Cookie: staleCookie });
    const revokedMedia = await page.request.get('/api/admin/media', {
      headers: { Cookie: staleCookie },
    });
    expect(revokedMedia.status()).toBe(401);
  } finally {
    if (nonOwnerId) await deleteAuthFixture(migration, nonOwnerId);
    if (ownerId) {
      await migration.query('DELETE FROM auth."session" WHERE "userId" = $1', [ownerId]);
      await migration.query('DELETE FROM auth."twoFactor" WHERE "userId" = $1', [ownerId]);
      await migration.query(
        'UPDATE auth."user" SET "twoFactorEnabled" = false, "updatedAt" = now() WHERE id = $1',
        [ownerId],
      );
    }
    await migration.query('DELETE FROM auth."rateLimit"');
    await migration.end();
  }
});
