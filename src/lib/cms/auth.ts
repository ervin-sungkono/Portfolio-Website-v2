import 'server-only';

import NextAuth, { AuthError } from 'next-auth';
import GitHub from 'next-auth/providers/github';
import { getToken } from 'next-auth/jwt';
import { createAuthCallbacks, isGitHubUserId, ownerSessionId } from './auth-policy.ts';
import { CmsError } from './errors.ts';
import { getGitHubPat, getGitHubUser } from './github.ts';

export const sessionCookieName =
  process.env.NODE_ENV === 'production' ? '__Secure-authjs.session-token' : 'authjs.session-token';

export function cmsAuthConfigured() {
  return ['AUTH_SECRET', 'AUTH_GITHUB_ID', 'AUTH_GITHUB_SECRET', 'GITHUB_PAT', 'GITHUB_REPO'].every(
    (name) => Boolean(process.env[name]?.trim()),
  );
}

export const { auth, handlers, signIn, signOut } = NextAuth(() => ({
  providers: [GitHub({ authorization: { params: { scope: 'read:user' } } })],
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
  cookies: {
    sessionToken: {
      name: sessionCookieName,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  callbacks: createAuthCallbacks(async () => String((await getGitHubUser()).id)),
  // Provider errors can contain request details; expose only Auth.js's safe error type.
  logger: {
    error(error) {
      console.error(
        'CMS authentication:',
        error instanceof AuthError ? error.type : 'Configuration',
      );
    },
  },
}));

export async function requireOwner(request: Request): Promise<string> {
  const secret = process.env.AUTH_SECRET;
  if (!secret || !cmsAuthConfigured()) {
    throw new CmsError(
      'configuration',
      'Configure AUTH_SECRET, AUTH_GITHUB_ID, AUTH_GITHUB_SECRET, GITHUB_PAT, and GITHUB_REPO before signing in.',
      503,
    );
  }
  // Accept the HttpOnly cookie only, never bearer credentials supplied by browser code.
  const token = await getToken({
    req: { headers: new Headers({ cookie: request.headers.get('cookie') ?? '' }) },
    secret,
    cookieName: sessionCookieName,
    salt: sessionCookieName,
  });
  const sessionId = ownerSessionId(token);
  const credential = getGitHubPat();
  const owner = await getGitHubUser(credential);
  if (sessionId !== String(owner.id)) {
    throw new CmsError('forbidden', 'Only the GitHub account for GITHUB_PAT can use the CMS.', 403);
  }
  return credential;
}

export async function isCurrentOwner(sessionId: unknown): Promise<boolean> {
  if (!isGitHubUserId(sessionId) || !cmsAuthConfigured()) {
    return false;
  }
  try {
    return sessionId === String((await getGitHubUser()).id);
  } catch {
    return false;
  }
}
