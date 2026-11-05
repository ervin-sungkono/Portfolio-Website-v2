import assert from 'node:assert/strict';
import { test } from 'vitest';
import { encode, getToken } from 'next-auth/jwt';
import {
  createAuthCallbacks,
  isGitHubUserId,
  ownerSessionId,
} from '../../src/lib/cms/auth-policy.ts';

const owner = '43065067';
const callbacks = createAuthCallbacks(async () => owner);
const account = {
  provider: 'github',
  providerAccountId: owner,
  access_token: 'fixture-oauth-credential',
  type: 'oauth',
};

test('sign-in matches the OAuth account to the live PAT identity', async () => {
  for (const [candidate, allowed] of [
    [account, true],
    [{ ...account, providerAccountId: '99999999' }, false],
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
  assert.equal(isGitHubUserId(owner), true);
  assert.equal(isGitHubUserId('043065067'), false);
  assert.equal(isGitHubUserId('not-a-user-id'), false);

  const unavailable = createAuthCallbacks(async () => {
    throw new Error('PAT unavailable');
  });
  assert.equal(
    await unavailable.signIn!({ account } as Parameters<NonNullable<typeof unavailable.signIn>>[0]),
    false,
  );
});

test('JWT callback does not store provider credentials and ignores session updates', async () => {
  const token = await callbacks.jwt!({ token: {}, account } as Parameters<
    NonNullable<typeof callbacks.jwt>
  >[0]);
  assert.equal(token?.githubId, owner);
  assert.equal(JSON.stringify(token).includes(account.access_token), false);

  const updated = await callbacks.jwt!({
    token,
    user: { id: owner },
    trigger: 'update',
    session: { githubId: '99999999', access_token: 'injected' },
  } as Parameters<NonNullable<typeof callbacks.jwt>>[0]);
  assert.equal(updated?.githubId, owner);
  assert.equal(JSON.stringify(updated).includes('injected'), false);

  assert.equal(
    await callbacks.jwt!({
      token: {},
      account: { ...account, provider: 'credentials' },
    } as Parameters<NonNullable<typeof callbacks.jwt>>[0]),
    null,
  );

  const mismatchedPat = createAuthCallbacks(async () => '99999999');
  assert.equal(
    await mismatchedPat.jwt!({ token: {}, account } as Parameters<
      NonNullable<typeof mismatchedPat.jwt>
    >[0]),
    null,
  );
});

test('session JSON never exposes GitHub tokens or arbitrary JWT/session fields', async () => {
  const session = await callbacks.session!({
    session: {
      expires: '2099-01-01',
      user: { name: 'Owner', email: 'fixture@example.com' },
      access_token: 'must-not-leak',
    },
    token: {
      githubId: owner,
      access_token: account.access_token,
      otherSecret: 'must-not-leak',
    },
  } as unknown as Parameters<NonNullable<typeof callbacks.session>>[0]);
  assert.deepEqual(session, {
    expires: '2099-01-01',
    user: { id: owner, name: 'Owner', email: 'fixture@example.com', image: undefined },
  });
  assert.equal(JSON.stringify(session).includes('must-not-leak'), false);
  assert.equal(JSON.stringify(session).includes(account.access_token), false);
});

test('owner guard reads only the authenticated GitHub ID from the session', () => {
  assert.throws(() => ownerSessionId(null), { status: 401 });
  assert.throws(() => ownerSessionId({}), { status: 401 });
  assert.throws(() => ownerSessionId({ githubId: '0' }), { status: 401 });
  assert.equal(ownerSessionId({ githubId: owner }), owner);
});

test('Auth.js encrypts a credential-free session and supports server-only cookie retrieval', async () => {
  const secret = 'isolated-test-secret-not-a-production-credential';
  const salt = 'authjs.session-token';
  const encrypted = await encode({
    token: { githubId: owner },
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
  assert.equal(ownerSessionId(token), owner);

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
