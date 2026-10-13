CREATE SCHEMA IF NOT EXISTS cms;

DO $roles$
DECLARE
  role_info record;
  current_role_oid oid;
BEGIN
  SELECT oid INTO current_role_oid
  FROM pg_catalog.pg_roles
  WHERE rolname = current_user;
  IF current_user IN ('portfolio_public', 'portfolio_cms', 'portfolio_auth') THEN
    RAISE EXCEPTION 'CMS migrations must run with the offline migration principal.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'portfolio_public') THEN
    CREATE ROLE portfolio_public LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'portfolio_cms') THEN
    CREATE ROLE portfolio_cms LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'portfolio_auth') THEN
    CREATE ROLE portfolio_auth LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  END IF;

  SELECT * INTO role_info FROM pg_catalog.pg_roles WHERE rolname = 'portfolio_public';
  IF NOT role_info.rolcanlogin OR role_info.rolsuper OR role_info.rolcreatedb OR
     role_info.rolcreaterole OR role_info.rolinherit OR role_info.rolreplication OR
     role_info.rolbypassrls OR EXISTS (
       SELECT 1
       FROM pg_catalog.pg_auth_members AS membership
       WHERE membership.member = role_info.oid
          OR (
            membership.roleid = role_info.oid
            AND NOT (
              membership.member = current_role_oid
              AND membership.admin_option
              AND NOT membership.inherit_option
              AND NOT membership.set_option
            )
          )
     ) THEN
    RAISE EXCEPTION 'Existing portfolio_public role has unsafe attributes or memberships.';
  END IF;

  SELECT * INTO role_info FROM pg_catalog.pg_roles WHERE rolname = 'portfolio_cms';
  IF NOT role_info.rolcanlogin OR role_info.rolsuper OR role_info.rolcreatedb OR
     role_info.rolcreaterole OR role_info.rolinherit OR role_info.rolreplication OR
     role_info.rolbypassrls OR EXISTS (
       SELECT 1
       FROM pg_catalog.pg_auth_members AS membership
       WHERE membership.member = role_info.oid
          OR (
            membership.roleid = role_info.oid
            AND NOT (
              membership.member = current_role_oid
              AND membership.admin_option
              AND NOT membership.inherit_option
              AND NOT membership.set_option
            )
          )
     ) THEN
    RAISE EXCEPTION 'Existing portfolio_cms role has unsafe attributes or memberships.';
  END IF;

  SELECT * INTO role_info FROM pg_catalog.pg_roles WHERE rolname = 'portfolio_auth';
  IF NOT role_info.rolcanlogin OR role_info.rolsuper OR role_info.rolcreatedb OR
     role_info.rolcreaterole OR role_info.rolinherit OR role_info.rolreplication OR
     role_info.rolbypassrls OR EXISTS (
       SELECT 1
       FROM pg_catalog.pg_auth_members AS membership
       WHERE membership.member = role_info.oid
          OR (
            membership.roleid = role_info.oid
            AND NOT (
              membership.member = current_role_oid
              AND membership.admin_option
              AND NOT membership.inherit_option
              AND NOT membership.set_option
            )
          )
     ) THEN
    RAISE EXCEPTION 'Existing portfolio_auth role has unsafe attributes or memberships.';
  END IF;
END
$roles$;

DO $ownership$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_namespace AS namespace
    WHERE namespace.nspname IN ('cms', 'auth', 'public')
      AND namespace.nspowner IN (
        SELECT oid FROM pg_catalog.pg_roles
        WHERE rolname IN ('portfolio_public', 'portfolio_cms', 'portfolio_auth')
      )
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class AS relation
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname IN ('cms', 'auth', 'public')
      AND relation.relowner IN (
        SELECT oid FROM pg_catalog.pg_roles
        WHERE rolname IN ('portfolio_public', 'portfolio_cms', 'portfolio_auth')
      )
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS routine
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = routine.pronamespace
    WHERE namespace.nspname IN ('cms', 'auth', 'public')
      AND routine.proowner IN (
        SELECT oid FROM pg_catalog.pg_roles
        WHERE rolname IN ('portfolio_public', 'portfolio_cms', 'portfolio_auth')
      )
  ) THEN
    RAISE EXCEPTION 'A runtime role owns a managed shared object; migrate ownership offline first.';
  END IF;
END
$ownership$;

DO $public_schema_privileges$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname = 'public') THEN
    EXECUTE 'REVOKE CREATE ON SCHEMA public FROM PUBLIC, portfolio_public, portfolio_cms, portfolio_auth';
  END IF;
END
$public_schema_privileges$;

REVOKE ALL ON SCHEMA cms FROM PUBLIC, portfolio_public, portfolio_cms, portfolio_auth;
GRANT USAGE ON SCHEMA cms TO portfolio_public, portfolio_cms;

CREATE TABLE IF NOT EXISTS cms.entries (
  id uuid PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('project', 'design', 'profile')),
  slug text NOT NULL,
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 240),
  position integer NOT NULL CHECK (position >= 0),
  draft_revision integer NOT NULL DEFAULT 0 CHECK (draft_revision >= 0),
  published_revision integer CHECK (published_revision IS NULL OR published_revision > 0),
  has_published boolean NOT NULL DEFAULT false,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT entries_slug_check CHECK (
    (kind = 'profile' AND slug = 'profile') OR
    (kind <> 'profile' AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
  ),
  CONSTRAINT entries_published_revision_order_check CHECK (
    published_revision IS NULL OR published_revision <= draft_revision
  ),
  UNIQUE (kind, slug)
);

CREATE UNIQUE INDEX IF NOT EXISTS entries_profile_singleton_uidx
  ON cms.entries (kind) WHERE kind = 'profile';

CREATE OR REPLACE FUNCTION cms.keep_published_slug_stable()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.kind <> OLD.kind THEN
    RAISE EXCEPTION 'CMS entry kind is immutable' USING ERRCODE = '23514';
  END IF;
  IF OLD.has_published AND (NEW.slug <> OLD.slug OR NOT NEW.has_published) THEN
    RAISE EXCEPTION 'A published slug cannot be changed' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS entries_keep_published_slug_stable ON cms.entries;
CREATE TRIGGER entries_keep_published_slug_stable
  BEFORE UPDATE OF kind, slug, has_published ON cms.entries
  FOR EACH ROW EXECUTE FUNCTION cms.keep_published_slug_stable();

CREATE TABLE IF NOT EXISTS cms.entry_revisions (
  entry_id uuid NOT NULL REFERENCES cms.entries(id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK (version > 0),
  kind text NOT NULL CHECK (kind IN ('project', 'design', 'profile')),
  slug text NOT NULL,
  actor_id text NOT NULL CHECK (length(actor_id) BETWEEN 1 AND 255),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entry_id, version)
);

CREATE INDEX IF NOT EXISTS entry_revisions_recent_idx
  ON cms.entry_revisions (entry_id, version DESC);

CREATE TABLE IF NOT EXISTS cms.published_content (
  entry_id uuid PRIMARY KEY REFERENCES cms.entries(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('project', 'design', 'profile')),
  slug text NOT NULL,
  position integer NOT NULL CHECK (position >= 0),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  revision integer NOT NULL CHECK (revision > 0),
  published_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT published_content_kind_slug_key UNIQUE (kind, slug),
  CONSTRAINT published_content_slug_check CHECK (
    (kind = 'profile' AND slug = 'profile') OR
    (kind <> 'profile' AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS published_content_profile_singleton_uidx
  ON cms.published_content (kind) WHERE kind = 'profile';
CREATE INDEX IF NOT EXISTS published_content_order_idx
  ON cms.published_content (kind, position, slug);

CREATE TABLE IF NOT EXISTS cms.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id text NOT NULL CHECK (length(actor_id) BETWEEN 1 AND 255),
  action text NOT NULL CHECK (action IN ('created', 'saved', 'published', 'unpublished', 'restored', 'seeded')),
  entry_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_events_recent_idx
  ON cms.audit_events (created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS cms.publish_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN ('content.published', 'content.unpublished')),
  entry_id uuid NOT NULL REFERENCES cms.entries(id) ON DELETE RESTRICT,
  slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS publish_outbox_pending_idx
  ON cms.publish_outbox (created_at, id) WHERE completed_at IS NULL;

CREATE TABLE IF NOT EXISTS cms.save_requests (
  request_id uuid PRIMARY KEY,
  actor_id text NOT NULL CHECK (length(actor_id) BETWEEN 1 AND 255),
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[a-f0-9]{64}$'),
  entry_id uuid NOT NULL REFERENCES cms.entries(id) ON DELETE RESTRICT,
  revision integer NOT NULL CHECK (revision > 0),
  position integer NOT NULL CHECK (position >= 0),
  published_revision integer CHECK (published_revision IS NULL OR published_revision > 0),
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cms.media_assets (
  id uuid NOT NULL,
  version text NOT NULL CHECK (version ~ '^[a-f0-9]{64}$'),
  state text NOT NULL CHECK (state IN ('staging', 'verified', 'published', 'rejected')),
  private_key text NOT NULL CHECK (length(private_key) BETWEEN 1 AND 512),
  mime text,
  width integer CHECK (width IS NULL OR width > 0),
  height integer CHECK (height IS NULL OR height > 0),
  byte_size integer CHECK (byte_size IS NULL OR byte_size > 0),
  alt text NOT NULL CHECK (length(alt) <= 500),
  created_by text NOT NULL CHECK (length(created_by) BETWEEN 1 AND 255),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, version),
  CONSTRAINT media_assets_private_key_state_check CHECK (
    (state = 'staging' AND version = repeat('0', 64) AND private_key = 'staging/' || id::text) OR
    (state = 'rejected' AND version = repeat('0', 64) AND private_key = 'staging/' || id::text) OR
    (state = 'rejected' AND version <> repeat('0', 64) AND private_key = 'verified/' || id::text || '/' || version) OR
    (state IN ('verified', 'published') AND private_key = 'verified/' || id::text || '/' || version)
  )
);

CREATE INDEX IF NOT EXISTS media_assets_state_created_idx
  ON cms.media_assets (state, created_at DESC);

CREATE TABLE IF NOT EXISTS cms.published_media (
  asset_id uuid NOT NULL,
  version text NOT NULL,
  private_key text NOT NULL CHECK (
    private_key = 'verified/' || asset_id::text || '/' || version
  ),
  mime text NOT NULL CHECK (mime IN ('image/png', 'image/jpeg', 'image/webp')),
  width integer NOT NULL CHECK (width > 0),
  height integer NOT NULL CHECK (height > 0),
  alt text NOT NULL CHECK (length(alt) <= 500),
  PRIMARY KEY (asset_id, version),
  FOREIGN KEY (asset_id, version) REFERENCES cms.media_assets(id, version) ON DELETE RESTRICT,
  CHECK (version ~ '^[a-f0-9]{64}$')
);

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA cms FROM PUBLIC, portfolio_public, portfolio_cms, portfolio_auth;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA cms FROM PUBLIC, portfolio_public, portfolio_cms, portfolio_auth;
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA cms FROM PUBLIC, portfolio_public, portfolio_cms, portfolio_auth;

DO $column_privileges$
DECLARE
  cms_column record;
BEGIN
  FOR cms_column IN
    SELECT relation.relname AS table_name, attribute.attname AS column_name
    FROM pg_catalog.pg_class AS relation
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    JOIN pg_catalog.pg_attribute AS attribute ON attribute.attrelid = relation.oid
    WHERE namespace.nspname = 'cms'
      AND relation.relkind IN ('r', 'p', 'v', 'm', 'f')
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped
      AND attribute.attacl IS NOT NULL
  LOOP
    EXECUTE format(
      'REVOKE ALL (%I) ON TABLE cms.%I FROM PUBLIC, portfolio_public, portfolio_cms, portfolio_auth',
      cms_column.column_name,
      cms_column.table_name
    );
  END LOOP;
END
$column_privileges$;

GRANT SELECT, INSERT ON cms.entries TO portfolio_cms;
GRANT UPDATE (slug, title, position, draft_revision, published_revision, has_published, updated_at)
  ON cms.entries TO portfolio_cms;
GRANT SELECT, INSERT ON cms.entry_revisions TO portfolio_cms;
GRANT SELECT, INSERT, UPDATE, DELETE ON cms.published_content TO portfolio_cms;
GRANT SELECT, INSERT ON cms.audit_events TO portfolio_cms;
GRANT SELECT, INSERT ON cms.publish_outbox TO portfolio_cms;
GRANT UPDATE (completed_at) ON cms.publish_outbox TO portfolio_cms;
GRANT SELECT, INSERT ON cms.save_requests TO portfolio_cms;
GRANT SELECT, INSERT ON cms.media_assets TO portfolio_cms;
GRANT UPDATE (version, state, private_key, mime, width, height, byte_size, alt)
  ON cms.media_assets TO portfolio_cms;
GRANT SELECT, INSERT ON cms.published_media TO portfolio_cms;

GRANT SELECT (kind, slug, position, payload) ON cms.published_content TO portfolio_public;
GRANT SELECT (asset_id, version, private_key, mime, width, height, alt) ON cms.published_media TO portfolio_public;

GRANT EXECUTE ON FUNCTION cms.keep_published_slug_stable() TO portfolio_cms;

REVOKE ALL ON cms.entries, cms.entry_revisions, cms.published_content, cms.audit_events,
  cms.publish_outbox, cms.save_requests, cms.media_assets, cms.published_media
  FROM PUBLIC;
REVOKE ALL ON FUNCTION cms.keep_published_slug_stable() FROM PUBLIC;
