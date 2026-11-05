import type { NextAuthConfig } from 'next-auth';
import { CmsError } from './errors.ts';

export function isGitHubUserId(value: unknown): value is string {
  return typeof value === 'string' && /^[1-9]\d*$/.test(value);
}

// GitHub OAuth is used only to establish which account signed in. The OAuth token is discarded.
export function createAuthCallbacks(
  resolveOwnerId: () => Promise<string>,
): NonNullable<NextAuthConfig['callbacks']> {
  return {
    async signIn({ account }) {
      if (account?.provider !== 'github' || !isGitHubUserId(account.providerAccountId)) {
        return false;
      }
      try {
        return account.providerAccountId === (await resolveOwnerId());
      } catch {
        return false;
      }
    },
    async jwt({ token, account }) {
      if (account) {
        if (account.provider !== 'github' || !isGitHubUserId(account.providerAccountId)) {
          return null;
        }
        try {
          const ownerId = await resolveOwnerId();
          if (!isGitHubUserId(ownerId) || account.providerAccountId !== ownerId) {
            return null;
          }
        } catch {
          return null;
        }
        token.githubId = account.providerAccountId;
      }
      // Ignore client-supplied session updates; they cannot change identity or credentials.
      return isGitHubUserId(token.githubId) ? token : null;
    },
    session({ session, token }) {
      return {
        expires: session.expires,
        user: {
          id: isGitHubUserId(token.githubId) ? token.githubId : '',
          name: session.user?.name,
          email: session.user?.email,
          image: session.user?.image,
        },
      };
    },
  };
}

export function ownerSessionId(token: Record<string, unknown> | null): string {
  if (!token || !isGitHubUserId(token.githubId)) {
    throw new CmsError('unauthorized', 'Sign in with GitHub again to continue.', 401);
  }
  return token.githubId;
}
