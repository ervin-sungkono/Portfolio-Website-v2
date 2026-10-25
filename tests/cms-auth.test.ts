import assert from 'node:assert/strict';
import test from 'node:test';
import { encode, getToken } from 'next-auth/jwt';
import { createAuthCallbacks, isOwnerId, ownerCredential } from '../src/lib/cms/auth-policy.ts';

const owner = '43065067';
const callbacks = createAuthCallbacks(owner);
const account = {
  provider: 'github',
  providerAccountId: owner,
  access_token: 'fixture-oauth-credential',
  type: 'oauth',
};

test('sign-in authorizes only the immutable GitHub ID and provider', async () => {
  for (const [candidate, allowed] of [
    [account, true],
    [{ ...account, providerAccountId: 'other' }, false],
    [{ ...account, provider: 'credentials' }, false],
    [null, false],
  ] as const) {
    assert.equal(
      await callbacks.signIn!({ account: candidate } as Parameters<
        NonNullable<typeof callbacks.signIn>
      >[0]),
      allowed,
    );
  }
  assert.equal(isOwnerId(owner, undefined), false);
  assert.equal(isOwnerId(owner, '043065067'), false);
});

test('JWT callback accepts credentials only from the OAuth account, never a session update', async () => {
  const token = await callbacks.jwt!({ token: {}, account } as Parameters<
    NonNullable<typeof callbacks.jwt>
  >[0]);
  assert.equal(token?.githubAccessToken, account.access_token);
  const updated = await callbacks.jwt!({
    token,
    trigger: 'update',
    session: { githubId: 'other', githubAccessToken: 'injected' },
  } as Parameters<NonNullable<typeof callbacks.jwt>>[0]);
  assert.equal(updated?.githubId, owner);
  assert.equal(updated?.githubAccessToken, account.access_token);
  assert.equal(
    await callbacks.jwt!({
      token: {},
      account: { ...account, providerAccountId: 'other' },
    } as Parameters<NonNullable<typeof callbacks.jwt>>[0]),
    null,
  );
});

test('session JSON never exposes GitHub tokens or arbitrary JWT/session fields', async () => {
  const session = await callbacks.session!({
    session: {
      expires: '2099-01-01',
      user: { name: 'Owner', email: 'fixture@example.com' },
      githubAccessToken: 'must-not-leak',
    },
    token: {
      githubId: owner,
      githubAccessToken: account.access_token,
      otherSecret: 'must-not-leak',
    },
  } as Parameters<NonNullable<typeof callbacks.session>>[0]);
  assert.deepEqual(session, {
    expires: '2099-01-01',
    user: { id: owner, name: 'Owner', email: 'fixture@example.com', image: undefined },
  });
  assert.equal(JSON.stringify(session).includes('must-not-leak'), false);
  assert.equal(JSON.stringify(session).includes(account.access_token), false);
});

test('owner guard rejects missing, expired, and wrong-owner sessions', () => {
  assert.throws(() => ownerCredential(null, owner), { status: 401 });
  assert.throws(() => ownerCredential({ githubId: 'other', githubAccessToken: 'fixture' }, owner), {
    status: 403,
  });
  assert.throws(
    () =>
      ownerCredential({ githubId: owner, githubAccessToken: 'fixture', githubExpiresAt: 1 }, owner),
    { status: 401 },
  );
  assert.equal(
    ownerCredential({ githubId: owner, githubAccessToken: 'fixture' }, owner),
    'fixture',
  );
});

test('Auth.js encrypts the OAuth token and supports server-only cookie retrieval', async () => {
  const secret = 'isolated-test-secret-not-a-production-credential';
  const salt = 'authjs.session-token';
  const encrypted = await encode({
    token: { githubId: owner, githubAccessToken: account.access_token },
    secret,
    salt,
    maxAge: 60,
  });
  assert.equal(encrypted.includes(account.access_token), false);
  const token = await getToken({
    req: { headers: new Headers({ cookie: `${salt}=${encrypted}` }) },
    secret,
    salt,
    cookieName: salt,
  });
  assert.equal(ownerCredential(token, owner), account.access_token);
  assert.equal(
    await getToken({
      req: { headers: new Headers({ cookie: `${salt}=${encrypted}` }) },
      secret: 'wrong-secret',
      salt,
      cookieName: salt,
    }),
    null,
  );
});
