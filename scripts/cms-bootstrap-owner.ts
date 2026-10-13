import 'server-only';

import { getPool } from '../src/lib/cms/db';
import { createBootstrapAuth } from '../src/lib/cms/auth';

const DEFAULT_OWNER_NAME = 'Ervin Cahyadinata Sungkono';

async function main() {
  if (process.argv.length > 2) {
    throw new Error('This command accepts credentials only through its environment.');
  }

  const email = process.env.CMS_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  const password = process.env.CMS_BOOTSTRAP_PASSWORD;
  const name = process.env.CMS_BOOTSTRAP_NAME?.trim() || DEFAULT_OWNER_NAME;
  if (!email || !password || name.length > 120) {
    throw new Error('Owner bootstrap environment is incomplete.');
  }

  const auth = createBootstrapAuth();
  const authPool = getPool('auth');
  const migrationPool = getPool('migration');
  const client = await migrationPool.connect();
  let transactionOpen = false;
  let createdUserId: string | undefined;

  try {
    await client.query('BEGIN');
    transactionOpen = true;
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended('portfolio-cms-owner-bootstrap', 0))",
    );

    const memberships = await client.query<{ user_id: string }>(
      'SELECT user_id FROM auth.admin_memberships LIMIT 1',
    );
    if (memberships.rowCount)
      throw new Error('The CMS owner account has already been bootstrapped.');

    const existingUsers = await client.query<{ id: string }>(
      'SELECT id FROM auth."user" WHERE email = $1 LIMIT 1',
      [email],
    );
    if (existingUsers.rowCount) throw new Error('The bootstrap email already has an auth account.');

    const result = await auth.api.signUpEmail({
      body: { email, password, name },
      headers: new Headers({ origin: new URL(process.env.BETTER_AUTH_URL!).origin }),
    });
    const userId = result.user?.id;
    if (!userId) throw new Error('The auth library did not create an owner account.');
    createdUserId = userId;

    await client.query(
      `INSERT INTO auth.admin_memberships (user_id, active)
       VALUES ($1, true)`,
      [userId],
    );
    await client.query('COMMIT');
    transactionOpen = false;
    createdUserId = undefined;
    process.stdout.write(
      'Owner account bootstrapped. Sign in at /admin/login and complete TOTP enrollment.\n',
    );
  } finally {
    if (transactionOpen) await client.query('ROLLBACK').catch(() => undefined);
    if (createdUserId) {
      // Better Auth creates the user on its own pooled connection. If the
      // membership insert or commit fails, remove that unprivileged partial
      // account so a later bootstrap attempt can start cleanly. A committed
      // owner is protected by the membership FK and cannot be deleted here.
      await client
        .query('DELETE FROM auth."user" WHERE id = $1', [createdUserId])
        .catch(() => undefined);
    }
    client.release();
    await Promise.allSettled([authPool.end(), migrationPool.end()]);
  }
}

main().catch(() => {
  process.stderr.write(
    'Owner bootstrap failed. Check private setup values and database privileges.\n',
  );
  process.exitCode = 1;
});
