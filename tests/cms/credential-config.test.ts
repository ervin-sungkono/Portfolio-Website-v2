import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CmsCredentialConfigError,
  getRuntimeTarget,
  makeMigrationConnectionString,
  makeRuntimeURL,
  neonEndpoint,
  parsePostgresURL,
} from '../../scripts/cms-credential-config.ts';

const migrationLocal = (suffix = '') =>
  parsePostgresURL(
    `postgresql://offline:secret@127.0.0.1:5432/portfolio_cms_test${suffix}`,
    'DATABASE_URL_MIGRATIONS',
    { credentialsRequired: true },
  );

const migrationNeon = (hostname = 'ep-content.us-east-2.aws.neon.tech', suffix = '') =>
  parsePostgresURL(
    `postgresql://offline:secret@${hostname}:5432/portfolio_cms${suffix}`,
    'DATABASE_URL_MIGRATIONS',
    { credentialsRequired: true },
  );

test('credential URL parser accepts only validated connection parameters', () => {
  assert.throws(
    () => migrationLocal('?application_name=unexpected'),
    /unsupported connection parameter/u,
  );
  assert.throws(
    () => migrationLocal('?sslmode=disable&sslmode=disable'),
    /duplicate connection parameters/u,
  );
  assert.throws(() => migrationLocal('?sslmode=require'), /invalid TLS configuration/u);
  assert.throws(
    () => migrationLocal('?channel_binding=always'),
    /invalid channel binding configuration/u,
  );
  assert.throws(
    () => migrationLocal('?channel_binding=require'),
    /invalid channel binding configuration/u,
  );
  assert.throws(
    () => migrationLocal('?options=endpoint%3Dep%2Funsafe'),
    /unsupported PostgreSQL routing option/u,
  );

  assert.equal(migrationLocal().local, true);
  assert.equal(migrationLocal('?sslmode=disable').sslmode, 'disable');
});

test('remote migration URLs require certificate-verified TLS and preserve approved routing', () => {
  const connection = migrationNeon(
    'ep-content.us-east-2.aws.neon.tech',
    '?sslmode=verify-full&channel_binding=require&options=endpoint%3Dep-content',
  );
  const connectionString = makeMigrationConnectionString(connection);
  const parsed = new URL(connectionString);

  assert.equal(parsed.searchParams.has('sslmode'), false);
  assert.equal(parsed.searchParams.get('channel_binding'), 'require');
  assert.equal(parsed.searchParams.get('options'), 'endpoint=ep-content');
  assert.throws(
    () => migrationNeon('ep-content.us-east-2.aws.neon.tech', '?sslmode=prefer'),
    /invalid TLS configuration/u,
  );
  assert.throws(
    () => migrationNeon('ep-content.us-east-2.aws.neon.tech'),
    /invalid TLS configuration/u,
  );
});

test('Neon endpoint parser recognizes direct and pooled AWS and Azure hosts', () => {
  assert.deepEqual(neonEndpoint('ep-abc.us-east-2.aws.neon.tech'), {
    endpoint: 'ep-abc',
    region: 'us-east-2',
    provider: 'aws',
    pooled: false,
  });
  assert.deepEqual(neonEndpoint('ep-abc-pooler.eastus2.azure.neon.tech'), {
    endpoint: 'ep-abc',
    region: 'eastus2',
    provider: 'azure',
    pooled: true,
  });
  assert.equal(neonEndpoint('ep-abc.us-east-2.gcp.neon.tech'), undefined);
  assert.equal(neonEndpoint('ep-abc.other.example.com'), undefined);
});

test('runtime pooler must match Neon provider, region, endpoint, port, database, and route', () => {
  const migration = migrationNeon(
    'ep-content.us-east-2.aws.neon.tech',
    '?sslmode=require&channel_binding=prefer&options=endpoint%3Dep-content',
  );
  const template =
    'postgresql://ep-content-pooler.us-east-2.aws.neon.tech:5432/portfolio_cms?sslmode=require';
  const target = getRuntimeTarget(migration, template);
  const runtimeURL = new URL(makeRuntimeURL('portfolio_cms', 'generated-secret', target));

  assert.equal(target.endpointOption, 'endpoint=ep-content');
  assert.equal(runtimeURL.hostname, 'ep-content-pooler.us-east-2.aws.neon.tech');
  assert.equal(runtimeURL.searchParams.get('sslmode'), 'require');
  assert.equal(runtimeURL.searchParams.get('channel_binding'), 'prefer');
  assert.equal(runtimeURL.searchParams.get('options'), 'endpoint=ep-content');
  assert.equal(runtimeURL.password, 'generated-secret');
  assert.equal(runtimeURL.searchParams.has('application_name'), false);

  const mismatches = [
    'postgresql://ep-content-pooler.eastus2.azure.neon.tech:5432/portfolio_cms?sslmode=require',
    'postgresql://ep-content-pooler.us-west-2.aws.neon.tech:5432/portfolio_cms?sslmode=require',
    'postgresql://ep-other-pooler.us-east-2.aws.neon.tech:5432/portfolio_cms?sslmode=require',
    'postgresql://ep-content-pooler.us-east-2.aws.neon.tech:6432/portfolio_cms?sslmode=require',
    'postgresql://ep-content-pooler.us-east-2.aws.neon.tech:5432/other?sslmode=require',
    'postgresql://ep-content-pooler.us-east-2.aws.neon.tech:5432/portfolio_cms?sslmode=require&options=endpoint%3Dep-other',
  ];
  for (const candidate of mismatches) {
    assert.throws(
      () => getRuntimeTarget(migration, candidate),
      CmsCredentialConfigError,
      candidate,
    );
  }
});

test('a supplied endpoint route cannot redirect a migration URL to another Neon endpoint', () => {
  const migration = migrationNeon('ep-content.us-east-2.aws.neon.tech', '?sslmode=require');
  assert.throws(
    () =>
      getRuntimeTarget(
        migration,
        'postgresql://ep-content-pooler.us-east-2.aws.neon.tech:5432/portfolio_cms?sslmode=require&options=endpoint%3Dep-other',
      ),
    /matching Neon pooler/u,
  );

  const sameRoute = getRuntimeTarget(
    migration,
    'postgresql://ep-content-pooler.us-east-2.aws.neon.tech:5432/portfolio_cms?sslmode=require&options=endpoint%3Dep-content',
  );
  assert.equal(sameRoute.endpointOption, 'endpoint=ep-content');
});

test('optional runtime target requires a credential-free Neon template and direct migration endpoint', () => {
  const migration = migrationNeon('ep-content.us-east-2.aws.neon.tech', '?sslmode=require');
  assert.throws(
    () =>
      getRuntimeTarget(
        migration,
        'postgresql://portfolio_cms:secret@ep-content-pooler.us-east-2.aws.neon.tech:5432/portfolio_cms?sslmode=require',
      ),
    /must not contain credentials/u,
  );
  assert.throws(
    () =>
      getRuntimeTarget(
        migrationNeon('ep-content-pooler.us-east-2.aws.neon.tech', '?sslmode=require'),
        'postgresql://ep-content-pooler.us-east-2.aws.neon.tech:5432/portfolio_cms?sslmode=require',
      ),
    /matching Neon pooler endpoint/u,
  );
});
