import type { NextAuthConfig } from 'next-auth';
import { CmsError } from './errors.ts';

export function isOwnerId(value: unknown, adminId: string | undefined): boolean {
  return Boolean(adminId && /^[1-9]\d*$/.test(adminId) && String(value) === adminId);
}

// Only the encrypted session contains GitHub credentials. Session JSON is an allowlist.
export function createAuthCallbacks(
  adminId: string | undefined,
): NonNullable<NextAuthConfig['callbacks']> {
  return {
    signIn({ account }) {
      return account?.provider === 'github' && isOwnerId(account.providerAccountId, adminId);
    },
    jwt({ token, account }) {
      if (account) {
        if (
          account.provider !== 'github' ||
          !isOwnerId(account.providerAccountId, adminId) ||
          !account.access_token
        ) {
          return null;
        }
        token.githubId = account.providerAccountId;
        token.githubAccessToken = account.access_token;
        token.githubExpiresAt = account.expires_at;
      }
      // Ignore client-supplied session updates; they cannot change identity or credentials.
      return isOwnerId(token.githubId, adminId) ? token : null;
    },
    session({ session, token }) {
      return {
        expires: session.expires,
        user: {
          id: isOwnerId(token.githubId, adminId) ? String(token.githubId) : '',
          name: session.user?.name,
          email: session.user?.email,
          image: session.user?.image,
        },
      };
    },
  };
}

export function ownerCredential(
  token: Record<string, unknown> | null,
  adminId: string | undefined,
): string {
  if (!token || typeof token.githubAccessToken !== 'string' || !token.githubAccessToken) {
    throw new CmsError('unauthorized', 'Sign in with GitHub to continue.', 401);
  }
  if (!isOwnerId(token.githubId, adminId)) {
    throw new CmsError('forbidden', 'Only the configured GitHub owner can use the CMS.', 403);
  }
  if (typeof token.githubExpiresAt === 'number' && token.githubExpiresAt * 1000 <= Date.now()) {
    throw new CmsError('unauthorized', 'Your GitHub authorization expired. Sign in again.', 401);
  }
  return token.githubAccessToken;
}
