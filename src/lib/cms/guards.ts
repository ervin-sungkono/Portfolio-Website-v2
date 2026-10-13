import 'server-only';

import { headers } from 'next/headers';
import { getAuth } from './auth';
import { getPool } from './db';
import { CmsForbiddenError, CmsSetupError, CmsUnauthorizedError } from './errors';

export { CmsForbiddenError, CmsSetupError, CmsUnauthorizedError } from './errors';

const MAX_RECENT_AUTH_AGE_MS = 30 * 60 * 1000;
const MAX_FUTURE_SESSION_SKEW_MS = 2 * 60 * 1000;

export type OwnerSession = {
  userId: string;
  email: string;
  name: string;
  twoFactorEnabled: boolean;
};

type AuthenticatedUser = {
  id: string;
  email: string;
  name: string;
  twoFactorEnabled?: boolean;
};

function serviceUnavailable(): CmsSetupError {
  return new CmsSetupError([], 'The CMS authentication service is temporarily unavailable.');
}

async function currentSession() {
  try {
    return await getAuth().api.getSession({ headers: await headers() });
  } catch (error) {
    if (error instanceof CmsSetupError) throw error;
    throw serviceUnavailable();
  }
}

async function hasActiveMembership(userId: string): Promise<boolean> {
  try {
    const result = await getPool('auth').query<{ active: boolean }>(
      'SELECT active FROM auth.admin_memberships WHERE user_id = $1 LIMIT 1',
      [userId],
    );
    return result.rows[0]?.active === true;
  } catch (error) {
    if (error instanceof CmsSetupError) throw error;
    throw serviceUnavailable();
  }
}

async function getActiveOwnerSession() {
  const session = await currentSession();
  if (!session?.user?.id) throw new CmsUnauthorizedError();
  if (!(await hasActiveMembership(session.user.id))) throw new CmsForbiddenError();
  return session;
}

function projectUser(user: AuthenticatedUser): OwnerSession {
  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    twoFactorEnabled: user.twoFactorEnabled === true,
  };
}

export async function requireAuthenticatedOwner(): Promise<OwnerSession> {
  const session = await getActiveOwnerSession();
  return projectUser(session.user as AuthenticatedUser);
}

export async function requireOwner(): Promise<{ userId: string }> {
  const owner = await requireAuthenticatedOwner();
  if (!owner.twoFactorEnabled) {
    throw new CmsForbiddenError(
      'A verified authenticator factor is required to manage CMS content.',
    );
  }
  return { userId: owner.userId };
}

/** Require a newly authenticated password+factor session for sensitive actions. */
export async function requireRecentOwner(): Promise<{ userId: string }> {
  const session = await getActiveOwnerSession();
  if (session.user.twoFactorEnabled !== true) {
    throw new CmsForbiddenError(
      'A verified authenticator factor is required to manage CMS content.',
    );
  }

  const createdAt = new Date(session.session.createdAt).getTime();
  const age = Date.now() - createdAt;
  if (
    !Number.isFinite(createdAt) ||
    age > MAX_RECENT_AUTH_AGE_MS ||
    age < -MAX_FUTURE_SESSION_SKEW_MS
  ) {
    throw new CmsUnauthorizedError(
      'Sign in again with your password and authenticator code before this sensitive action.',
    );
  }

  return { userId: session.user.id };
}

export async function getOwnerSession(): Promise<OwnerSession | null> {
  try {
    return await requireAuthenticatedOwner();
  } catch (error) {
    if (error instanceof CmsUnauthorizedError || error instanceof CmsForbiddenError) return null;
    throw error;
  }
}
