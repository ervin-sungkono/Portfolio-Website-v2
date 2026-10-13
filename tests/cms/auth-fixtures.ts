import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import type { Pool } from 'pg';

export type NonOwnerFixture = {
  userId: string;
  email: string;
  password: string;
};

/**
 * Seeds a normal Better Auth credential account in the isolated QA database.
 * The live application handles password verification and session issuance.
 */
export async function createNonOwnerFixture(pool: Pool): Promise<NonOwnerFixture> {
  const userId = randomUUID();
  const email = `cms-non-owner-${userId}@example.test`;
  const password = `${randomUUID()}-${randomUUID()}-Qa!`;
  const passwordHash = await hashPassword(password);

  await pool.query(
    `INSERT INTO auth."user" (id, name, email, "emailVerified", "twoFactorEnabled")
     VALUES ($1, 'CMS QA Non-owner', $2, true, false)`,
    [userId, email],
  );
  try {
    await pool.query(
      `INSERT INTO auth."account" (id, "accountId", "providerId", "userId", password)
       VALUES ($1, $2, 'credential', $2, $3)`,
      [randomUUID(), userId, passwordHash],
    );
  } catch (error) {
    await pool.query('DELETE FROM auth."user" WHERE id = $1', [userId]);
    throw error;
  }

  return { userId, email, password };
}

export async function deleteAuthFixture(pool: Pool, userId: string): Promise<void> {
  await pool.query('DELETE FROM auth.admin_memberships WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM auth."user" WHERE id = $1', [userId]);
}
