import 'server-only';

import { betterAuth } from 'better-auth';
import { twoFactor } from 'better-auth/plugins/two-factor';
import { getPool } from './db';
import { CmsSetupError } from './errors';

const REQUIRED_AUTH_ENV = ['DATABASE_URL_AUTH', 'BETTER_AUTH_URL', 'BETTER_AUTH_SECRET'] as const;
const MIN_SECRET_LENGTH = 32;
const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 128;
const AUTH_APP_NAME = 'Ervin Cahyadinata Sungkono Portfolio CMS';

type AuthConfiguration = {
  baseURL: string;
  origin: string;
  secret: string;
  secureCookies: boolean;
};

function isLoopback(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

function getAuthConfiguration(): { configuration?: AuthConfiguration; missing: string[] } {
  const missing: string[] = REQUIRED_AUTH_ENV.filter((name) => !process.env[name]);
  const urlValue = process.env.BETTER_AUTH_URL;
  const databaseURL = process.env.DATABASE_URL_AUTH;
  const secret = process.env.BETTER_AUTH_SECRET;
  const environmentValue = process.env.CMS_ENVIRONMENT;
  const environment =
    environmentValue ?? (process.env.NODE_ENV === 'development' ? 'development' : 'production');

  if (environment !== 'development' && environment !== 'preview' && environment !== 'production') {
    missing.push('CMS_ENVIRONMENT');
  }

  if (databaseURL) {
    try {
      const candidate = new URL(databaseURL);
      const validProtocol =
        candidate.protocol === 'postgres:' || candidate.protocol === 'postgresql:';
      const local = isLoopback(candidate.hostname);
      const sslMode = candidate.searchParams.get('sslmode');
      const validTLS = local || ['require', 'verify-ca', 'verify-full'].includes(sslMode ?? '');
      if (!validProtocol || !candidate.hostname || !validTLS) missing.push('DATABASE_URL_AUTH');
    } catch {
      missing.push('DATABASE_URL_AUTH');
    }
  }

  let baseURL: URL | undefined;
  if (urlValue) {
    try {
      const candidate = new URL(urlValue);
      const validProtocol =
        candidate.protocol === 'https:' ||
        (environment === 'development' &&
          candidate.protocol === 'http:' &&
          isLoopback(candidate.hostname));
      const validPath = candidate.pathname === '/' && !candidate.search && !candidate.hash;
      const noUserInfo = !candidate.username && !candidate.password;
      if (validProtocol && validPath && noUserInfo) baseURL = candidate;
      else missing.push('BETTER_AUTH_URL');
    } catch {
      missing.push('BETTER_AUTH_URL');
    }
  }

  if (secret && secret.length < MIN_SECRET_LENGTH) missing.push('BETTER_AUTH_SECRET');
  if (missing.length > 0 || !baseURL || !secret) {
    return { missing: [...new Set(missing)] };
  }

  return {
    missing: [],
    configuration: {
      baseURL: baseURL.origin,
      origin: baseURL.origin,
      secret,
      secureCookies: baseURL.protocol === 'https:',
    },
  };
}

export async function getCmsSetupStatus(): Promise<{ ready: boolean; missing: string[] }> {
  const { configuration, missing } = getAuthConfiguration();
  if (!configuration) return { ready: false, missing };
  return { ready: true, missing: [] };
}

function createCmsAuth(bootstrapEmail?: string) {
  const result = getAuthConfiguration();
  if (!result.configuration) throw new CmsSetupError(result.missing);

  const configuration = result.configuration;
  const bootstrapEnabled = bootstrapEmail !== undefined;

  return betterAuth({
    appName: AUTH_APP_NAME,
    baseURL: configuration.baseURL,
    secret: configuration.secret,
    database: getPool('auth'),
    logger: { disabled: true },
    trustedOrigins: [configuration.origin],
    emailAndPassword: {
      enabled: true,
      disableSignUp: !bootstrapEnabled,
      autoSignIn: false,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      maxPasswordLength: MAX_PASSWORD_LENGTH,
      requireEmailVerification: false,
      revokeSessionsOnPasswordReset: true,
    },
    user: {
      changeEmail: { enabled: false },
      deleteUser: { enabled: false },
    },
    session: {
      expiresIn: 60 * 60 * 12,
      updateAge: 60 * 60,
      cookieCache: { enabled: false },
    },
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 60,
      max: 60,
      customRules: {
        '/sign-in/email': { window: 300, max: 5 },
        '/sign-up/email': { window: 3600, max: 2 },
        '/two-factor/enable': { window: 300, max: 5 },
        '/two-factor/verify-totp': { window: 300, max: 5 },
        '/two-factor/verify-backup-code': { window: 3600, max: 10 },
      },
    },
    advanced: {
      useSecureCookies: configuration.secureCookies,
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            if (bootstrapEmail && user.email.toLowerCase() === bootstrapEmail) return;
            return false;
          },
        },
      },
      session: {
        create: {
          after: async (session, context) => {
            if (
              !session ||
              !context ||
              !['/two-factor/verify-totp', '/two-factor/verify-backup-code'].includes(context.path)
            ) {
              return;
            }

            // A user can enroll their first factor from an existing password
            // session. Revoke any older sessions when Better Auth creates the
            // session that follows a successful TOTP or recovery-code check.
            // This prevents a pre-enrollment session from inheriting access
            // merely because the shared user row now has twoFactorEnabled set.
            const oldSessions = await context.context.internalAdapter.listSessions(session.userId);
            await Promise.all(
              oldSessions
                .filter((candidate) => candidate.token !== session.token)
                .map((candidate) => context.context.internalAdapter.deleteSession(candidate.token)),
            );
          },
        },
      },
    },
    plugins: [
      twoFactor({
        issuer: AUTH_APP_NAME,
        skipVerificationOnEnable: false,
        allowPasswordless: false,
        backupCodeOptions: { storeBackupCodes: 'encrypted', amount: 10 },
        accountLockout: { enabled: true, maxFailedAttempts: 5, durationSeconds: 900 },
        twoFactorCookieMaxAge: 5 * 60,
      }),
    ],
  });
}

type CmsAuth = ReturnType<typeof createCmsAuth>;
let authInstance: CmsAuth | undefined;

/** Lazily initialize Better Auth only after runtime configuration has been checked. */
export function getAuth(): CmsAuth {
  authInstance ??= createCmsAuth();
  return authInstance;
}

/**
 * Used only by the offline owner-bootstrap CLI. It creates a separate library
 * instance whose only permitted new user is the email supplied in the private
 * bootstrap environment. No route imports this instance.
 */
export function createBootstrapAuth(): CmsAuth {
  const email = process.env.CMS_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  if (!email || email.length > 254 || !/^\S+@\S+\.\S+$/.test(email)) {
    throw new CmsSetupError(['CMS_BOOTSTRAP_EMAIL']);
  }

  const password = process.env.CMS_BOOTSTRAP_PASSWORD;
  if (!password || password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    throw new CmsSetupError(['CMS_BOOTSTRAP_PASSWORD']);
  }

  return createCmsAuth(email);
}

export const cmsAuthPolicy = {
  passwordMinLength: MIN_PASSWORD_LENGTH,
  passwordMaxLength: MAX_PASSWORD_LENGTH,
} as const;
