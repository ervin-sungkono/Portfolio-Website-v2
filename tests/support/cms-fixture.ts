import { encode } from 'next-auth/jwt';

export const cmsBaseUrl = 'http://localhost:3104';
export const cmsAdminId = '42424242';
export const cmsOwnerToken = 'fixture-owner-token';
export const cmsAuthSecret = 'cms-browser-fixture-secret-with-at-least-thirty-two-characters';
export const cmsCookieName = '__Secure-authjs.session-token';
export const fixturePng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/L8kAAAAASUVORK5CYII=',
  'base64',
);

export async function cmsSessionCookie(
  cookieName = cmsCookieName,
  githubId = cmsAdminId,
  accessToken = cmsOwnerToken,
) {
  return encode({
    secret: cmsAuthSecret,
    salt: cookieName,
    maxAge: 60 * 60,
    token: {
      sub: githubId,
      githubId,
      githubAccessToken: accessToken,
      githubExpiresAt: Math.floor(Date.now() / 1000) + 60 * 60,
      name: 'Fixture Owner',
    },
  });
}
