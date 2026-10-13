import assert from 'node:assert/strict';
import test from 'node:test';
import { CmsSetupError } from '../../src/lib/cms/errors.ts';
import { getPublishedCacheScope } from '../../src/lib/cms/cache-scope.ts';

const environmentKeys = [
  'DATABASE_URL_PUBLIC',
  'VERCEL_ENV',
  'CMS_ENVIRONMENT',
  'VERCEL_GIT_COMMIT_REF',
  'NODE_ENV',
] as const;

function withEnvironment<T>(values: Record<string, string | undefined>, work: () => T): T {
  const environment: Record<string, string | undefined> = process.env;
  const previous = new Map(environmentKeys.map((key) => [key, process.env[key]] as const));
  try {
    for (const key of environmentKeys) {
      const value = values[key];
      if (value === undefined) delete environment[key];
      else environment[key] = value;
    }
    return work();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete environment[key];
      else environment[key] = value;
    }
  }
}

function publicDatabaseUrl({
  host = 'db-a.example.test',
  port = '5432',
  database = 'portfolio',
  username = 'portfolio_public',
  password = 'password-marker-alpha',
}: {
  host?: string;
  port?: string;
  database?: string;
  username?: string;
  password?: string;
} = {}) {
  return `postgresql://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${database}?sslmode=require`;
}

const previewEnvironment = {
  VERCEL_ENV: 'preview',
  CMS_ENVIRONMENT: 'preview',
  VERCEL_GIT_COMMIT_REF: 'feature/cms-cache-scope',
};

test('published cache namespaces separate database endpoints and credentials', () => {
  withEnvironment(
    {
      DATABASE_URL_PUBLIC: publicDatabaseUrl(),
      ...previewEnvironment,
    },
    () => {
      const baseline = getPublishedCacheScope();
      for (const url of [
        publicDatabaseUrl({ host: 'db-b.example.test' }),
        publicDatabaseUrl({ port: '6432' }),
        publicDatabaseUrl({ database: 'portfolio_preview' }),
        `${publicDatabaseUrl()}&options=endpoint%3Dep-another-branch`,
      ]) {
        process.env.DATABASE_URL_PUBLIC = url;
        assert.notEqual(getPublishedCacheScope(), baseline);
      }
    },
  );
});

test('published cache namespaces separate deployment environments and preview branches', () => {
  withEnvironment(
    {
      DATABASE_URL_PUBLIC: publicDatabaseUrl(),
      ...previewEnvironment,
    },
    () => {
      const baseline = getPublishedCacheScope();
      process.env.VERCEL_ENV = 'production';
      process.env.CMS_ENVIRONMENT = 'production';
      delete process.env.VERCEL_GIT_COMMIT_REF;
      assert.notEqual(getPublishedCacheScope(), baseline);

      process.env.VERCEL_ENV = 'preview';
      process.env.CMS_ENVIRONMENT = 'preview';
      process.env.VERCEL_GIT_COMMIT_REF = 'another-preview-branch';
      assert.notEqual(getPublishedCacheScope(), baseline);

      process.env.VERCEL_ENV = 'development';
      process.env.CMS_ENVIRONMENT = 'development';
      delete process.env.VERCEL_GIT_COMMIT_REF;
      assert.notEqual(getPublishedCacheScope(), baseline);
    },
  );
});

test('password rotation does not change or expose the cache namespace', () => {
  withEnvironment(
    {
      DATABASE_URL_PUBLIC: publicDatabaseUrl({ password: 'sensitive-password-one' }),
      ...previewEnvironment,
    },
    () => {
      const beforeRotation = getPublishedCacheScope();
      process.env.DATABASE_URL_PUBLIC = publicDatabaseUrl({ password: 'sensitive-password-two' });
      const afterRotation = getPublishedCacheScope();
      assert.equal(afterRotation, beforeRotation);
      assert.match(afterRotation, /^cms-published-v3:[a-f0-9]{64}$/u);
      for (const sensitiveValue of [
        'sensitive-password-one',
        'sensitive-password-two',
        'portfolio_public',
        'db-a.example.test',
        'portfolio',
      ]) {
        assert.equal(afterRotation.includes(sensitiveValue), false);
      }
    },
  );
});

test('cache scope rejects invalid database URLs and routing overrides', () => {
  withEnvironment({ ...previewEnvironment }, () => {
    assert.throws(() => getPublishedCacheScope(), CmsSetupError);
    process.env.DATABASE_URL_PUBLIC = publicDatabaseUrl({ username: 'portfolio_preview_reader' });
    assert.throws(() => getPublishedCacheScope(), CmsSetupError);

    for (const override of [
      'host=other.example.test',
      'hostaddr=127.0.0.1',
      'port=6543',
      'user=portfolio_cms',
      'dbname=other',
      'options=-c%20search_path%3Dprivate',
      'options=endpoint%3Dep-one&options=endpoint%3Dep-two',
      'sslmode=disable',
      'sslmode=require&channel_binding=invalid',
    ]) {
      process.env.DATABASE_URL_PUBLIC = `postgresql://portfolio_public:secret@db.example.test/portfolio?${override}`;
      assert.throws(() => getPublishedCacheScope(), CmsSetupError, override);
    }
  });
});

test('preview cache scope requires a stable branch identifier', () => {
  withEnvironment(
    {
      DATABASE_URL_PUBLIC: publicDatabaseUrl(),
      VERCEL_ENV: 'preview',
      CMS_ENVIRONMENT: 'preview',
    },
    () => assert.throws(() => getPublishedCacheScope(), CmsSetupError),
  );
});
