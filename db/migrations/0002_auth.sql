CREATE SCHEMA IF NOT EXISTS auth;

DO $ownership$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_namespace AS namespace
    WHERE namespace.nspname = 'auth'
      AND namespace.nspowner IN (
        SELECT oid FROM pg_catalog.pg_roles
        WHERE rolname IN ('portfolio_public', 'portfolio_cms', 'portfolio_auth')
      )
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class AS relation
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'auth'
      AND relation.relowner IN (
        SELECT oid FROM pg_catalog.pg_roles
        WHERE rolname IN ('portfolio_public', 'portfolio_cms', 'portfolio_auth')
      )
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS routine
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = routine.pronamespace
    WHERE namespace.nspname = 'auth'
      AND routine.proowner IN (
        SELECT oid FROM pg_catalog.pg_roles
        WHERE rolname IN ('portfolio_public', 'portfolio_cms', 'portfolio_auth')
      )
  ) THEN
    RAISE EXCEPTION 'An application runtime role owns a managed auth object; migrate ownership offline first.';
  END IF;
END
$ownership$;

REVOKE ALL ON SCHEMA auth FROM PUBLIC, portfolio_public, portfolio_cms, portfolio_auth;
GRANT USAGE ON SCHEMA auth TO portfolio_auth;
ALTER ROLE portfolio_auth SET search_path = auth;

CREATE TABLE IF NOT EXISTS auth."user" (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  "emailVerified" boolean NOT NULL DEFAULT false,
  image text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "twoFactorEnabled" boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS auth."session" (
  id text PRIMARY KEY,
  "expiresAt" timestamptz NOT NULL,
  token text NOT NULL UNIQUE,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "ipAddress" text,
  "userAgent" text,
  "userId" text NOT NULL REFERENCES auth."user"(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS auth_session_user_id_idx ON auth."session"("userId");
CREATE INDEX IF NOT EXISTS auth_session_expires_at_idx ON auth."session"("expiresAt");

CREATE TABLE IF NOT EXISTS auth."account" (
  id text PRIMARY KEY,
  "accountId" text NOT NULL,
  "providerId" text NOT NULL,
  "userId" text NOT NULL REFERENCES auth."user"(id) ON DELETE CASCADE,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  scope text,
  password text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_account_user_id_idx ON auth."account"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS auth_account_provider_account_uidx
  ON auth."account"("providerId", "accountId");

CREATE TABLE IF NOT EXISTS auth."verification" (
  id text PRIMARY KEY,
  identifier text NOT NULL,
  value text NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_verification_identifier_idx ON auth."verification"(identifier);
CREATE INDEX IF NOT EXISTS auth_verification_expires_at_idx ON auth."verification"("expiresAt");

CREATE TABLE IF NOT EXISTS auth."twoFactor" (
  id text PRIMARY KEY,
  secret text NOT NULL,
  "backupCodes" text NOT NULL,
  "userId" text NOT NULL UNIQUE REFERENCES auth."user"(id) ON DELETE CASCADE,
  verified boolean NOT NULL DEFAULT true,
  "failedVerificationCount" integer NOT NULL DEFAULT 0,
  "lockedUntil" timestamptz
);

CREATE INDEX IF NOT EXISTS auth_two_factor_user_id_idx ON auth."twoFactor"("userId");

CREATE TABLE IF NOT EXISTS auth."rateLimit" (
  id text PRIMARY KEY,
  key text NOT NULL UNIQUE,
  count integer NOT NULL DEFAULT 0,
  "lastRequest" bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS auth.admin_memberships (
  user_id text PRIMARY KEY REFERENCES auth."user"(id) ON DELETE RESTRICT,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CONSTRAINT admin_memberships_active_revoked_check
    CHECK ((active AND revoked_at IS NULL) OR (NOT active AND revoked_at IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS admin_memberships_single_active_owner_uidx
  ON auth.admin_memberships ((active)) WHERE active;

REVOKE ALL ON ALL TABLES IN SCHEMA auth FROM PUBLIC, portfolio_public, portfolio_cms, portfolio_auth;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA auth FROM PUBLIC, portfolio_public, portfolio_cms, portfolio_auth;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA auth FROM PUBLIC, portfolio_public, portfolio_cms, portfolio_auth;

DO $$
DECLARE
  auth_table record;
  auth_columns text;
BEGIN
  FOR auth_table IN
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_schema = 'auth' AND table_type = 'BASE TABLE'
  LOOP
    SELECT string_agg(format('%I', column_name), ', ' ORDER BY ordinal_position)
      INTO auth_columns
    FROM information_schema.columns
    WHERE table_schema = auth_table.table_schema AND table_name = auth_table.table_name;

    IF auth_columns IS NOT NULL THEN
      EXECUTE format(
        'REVOKE ALL PRIVILEGES (%s) ON TABLE %I.%I FROM PUBLIC, portfolio_public, portfolio_cms, portfolio_auth',
        auth_columns,
        auth_table.table_schema,
        auth_table.table_name
      );
    END IF;
  END LOOP;
END;
$$;

GRANT SELECT, INSERT, UPDATE ON auth."user" TO portfolio_auth;
GRANT SELECT, INSERT, UPDATE, DELETE ON auth."session" TO portfolio_auth;
GRANT SELECT, INSERT, UPDATE ON auth."account" TO portfolio_auth;
GRANT SELECT, INSERT, UPDATE, DELETE ON auth."verification" TO portfolio_auth;
GRANT SELECT, INSERT, UPDATE, DELETE ON auth."twoFactor" TO portfolio_auth;
GRANT SELECT, INSERT, UPDATE, DELETE ON auth."rateLimit" TO portfolio_auth;
GRANT SELECT ON auth.admin_memberships TO portfolio_auth;
