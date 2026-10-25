import 'server-only';

import NextAuth, { AuthError } from 'next-auth';
import GitHub from 'next-auth/providers/github';
import { getToken } from 'next-auth/jwt';
import { createAuthCallbacks, ownerCredential } from './auth-policy.ts';
import { CmsError } from './errors.ts';

export const sessionCookieName =
  process.env.NODE_ENV === 'production' ? '__Secure-authjs.session-token' : 'authjs.session-token';

export function cmsAuthConfigured() {
  return [
    'AUTH_SECRET',
    'AUTH_GITHUB_ID',
    'AUTH_GITHUB_SECRET',
    'GITHUB_ADMIN_ID',
    'GITHUB_REPO',
  ].every((name) => Boolean(process.env[name]?.trim()));
}

export const { auth, handlers, signIn, signOut } = NextAuth(() => ({
  providers: [GitHub({ authorization: { params: { scope: 'read:user repo' } } })],
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
  callbacks: createAuthCallbacks(process.env.GITHUB_ADMIN_ID?.trim()),
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
      'Configure the five CMS environment variables before signing in.',
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
  return ownerCredential(token, process.env.GITHUB_ADMIN_ID?.trim());
}
