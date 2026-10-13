export class CmsCredentialConfigError extends Error {}

export type ParsedPostgresURL = {
  hostname: string;
  port: number;
  database: string;
  username: string;
  password: string;
  local: boolean;
  sslmode?: string;
  channelBinding?: string;
  endpointOption?: string;
  url: URL;
};

export type RuntimeTarget = Pick<
  ParsedPostgresURL,
  'hostname' | 'port' | 'database' | 'local' | 'channelBinding' | 'endpointOption'
>;

const supportedQueryKeys = new Set(['sslmode', 'channel_binding', 'options']);

function isLoopback(hostname: string) {
  return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname.toLowerCase());
}

function decodePart(value: string, variable: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new CmsCredentialConfigError(`${variable} contains invalid URL encoding.`);
  }
}

function readConnectionParameters(url: URL, variable: string) {
  const values = new Map<string, string[]>();
  for (const [key, value] of url.searchParams) {
    if (!supportedQueryKeys.has(key)) {
      throw new CmsCredentialConfigError(
        `${variable} contains an unsupported connection parameter.`,
      );
    }
    const entries = values.get(key) ?? [];
    entries.push(value);
    values.set(key, entries);
  }

  if ([...values.values()].some((entries) => entries.length !== 1)) {
    throw new CmsCredentialConfigError(`${variable} contains duplicate connection parameters.`);
  }

  const hostname = url.hostname;
  const local = isLoopback(hostname);
  const sslmode = values.get('sslmode')?.[0];
  const validSSLMode = local
    ? sslmode === undefined || sslmode === 'disable'
    : ['require', 'verify-ca', 'verify-full'].includes(sslmode ?? '');
  if (!validSSLMode) {
    throw new CmsCredentialConfigError(`${variable} has an invalid TLS configuration.`);
  }

  const channelBinding = values.get('channel_binding')?.[0];
  if (
    (channelBinding !== undefined && !['disable', 'prefer', 'require'].includes(channelBinding)) ||
    (local && channelBinding === 'require')
  ) {
    throw new CmsCredentialConfigError(`${variable} has an invalid channel binding configuration.`);
  }

  const endpointOption = values.get('options')?.[0];
  if (
    endpointOption !== undefined &&
    !/^endpoint=[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(endpointOption)
  ) {
    throw new CmsCredentialConfigError(`${variable} has an unsupported PostgreSQL routing option.`);
  }

  return { local, sslmode, channelBinding, endpointOption };
}

export function parsePostgresURL(
  value: string | undefined,
  variable: string,
  options: { credentialsRequired: boolean },
): ParsedPostgresURL {
  if (!value) throw new CmsCredentialConfigError(`Set ${variable} in the process environment.`);

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new CmsCredentialConfigError(`${variable} must be a valid PostgreSQL URL.`);
  }

  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname) {
    throw new CmsCredentialConfigError(`${variable} must be a valid PostgreSQL URL.`);
  }
  if (url.hash || !url.pathname.startsWith('/') || url.pathname.length < 2) {
    throw new CmsCredentialConfigError(`${variable} must identify one PostgreSQL database.`);
  }

  const database = decodePart(url.pathname.slice(1), variable);
  const port = url.port ? Number(url.port) : 5432;
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new CmsCredentialConfigError(`${variable} must use a valid PostgreSQL port.`);
  }

  const { local, sslmode, channelBinding, endpointOption } = readConnectionParameters(
    url,
    variable,
  );
  const username = decodePart(url.username, variable);
  const password = decodePart(url.password, variable);
  if (options.credentialsRequired && (!username || !password)) {
    throw new CmsCredentialConfigError(`${variable} must include migration credentials.`);
  }

  return {
    hostname: url.hostname,
    port,
    database,
    username,
    password,
    local,
    sslmode,
    channelBinding,
    endpointOption,
    url,
  };
}

type NeonEndpoint = {
  provider: 'aws' | 'azure';
  endpoint: string;
  region: string;
  pooled: boolean;
};

export function neonEndpoint(hostname: string): NeonEndpoint | undefined {
  const labels = hostname.toLowerCase().split('.');
  if (
    labels.length !== 5 ||
    !['aws', 'azure'].includes(labels[2] ?? '') ||
    labels[3] !== 'neon' ||
    labels[4] !== 'tech'
  ) {
    return undefined;
  }

  const [endpointLabel, region, providerLabel] = labels;
  if (!endpointLabel || !region || (providerLabel !== 'aws' && providerLabel !== 'azure')) {
    return undefined;
  }

  const pooled = endpointLabel.endsWith('-pooler');
  const endpoint = pooled ? endpointLabel.slice(0, -'-pooler'.length) : endpointLabel;
  if (!/^ep-[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(endpoint)) return undefined;
  return { endpoint, region, provider: providerLabel, pooled };
}

export function getRuntimeTarget(
  migration: ParsedPostgresURL,
  templateValue: string | undefined,
): RuntimeTarget {
  const migrationNeon = neonEndpoint(migration.hostname);
  if (!templateValue) {
    if (migrationNeon?.pooled) {
      throw new CmsCredentialConfigError(
        'DATABASE_URL_MIGRATIONS must use the direct Neon endpoint.',
      );
    }
    return {
      hostname: migration.hostname,
      port: migration.port,
      database: migration.database,
      local: migration.local,
      channelBinding: migration.channelBinding,
      endpointOption: migration.endpointOption,
    };
  }

  const template = parsePostgresURL(templateValue, 'DATABASE_URL_RUNTIME_ENDPOINT', {
    credentialsRequired: false,
  });
  if (template.username || template.password) {
    throw new CmsCredentialConfigError(
      'DATABASE_URL_RUNTIME_ENDPOINT must not contain credentials.',
    );
  }
  if (template.database !== migration.database) {
    throw new CmsCredentialConfigError(
      'DATABASE_URL_RUNTIME_ENDPOINT must use the migration database.',
    );
  }

  const runtimeNeon = neonEndpoint(template.hostname);
  const expectedEndpointOption = migration.endpointOption;
  const templateEndpointOption = template.endpointOption;
  const effectiveEndpointOption = expectedEndpointOption ?? templateEndpointOption;
  const migrationRoutingEndpoint = expectedEndpointOption?.slice('endpoint='.length);
  const hostEndpointMatchesOption =
    !templateEndpointOption ||
    (migrationRoutingEndpoint !== undefined && templateEndpointOption === expectedEndpointOption) ||
    (expectedEndpointOption === undefined &&
      migrationNeon?.endpoint === templateEndpointOption.slice('endpoint='.length));

  if (
    !migrationNeon ||
    migrationNeon.pooled ||
    !runtimeNeon?.pooled ||
    migrationNeon.endpoint !== runtimeNeon.endpoint ||
    migrationNeon.region !== runtimeNeon.region ||
    migrationNeon.provider !== runtimeNeon.provider ||
    template.port !== migration.port ||
    !hostEndpointMatchesOption
  ) {
    throw new CmsCredentialConfigError(
      'DATABASE_URL_RUNTIME_ENDPOINT must be the matching Neon pooler endpoint, provider, region, port, and route.',
    );
  }

  return {
    hostname: template.hostname,
    port: template.port,
    database: template.database,
    local: false,
    channelBinding: template.channelBinding ?? migration.channelBinding,
    endpointOption: effectiveEndpointOption,
  };
}

export function makeRuntimeURL(role: string, password: string, target: RuntimeTarget) {
  const hostname = target.hostname.includes(':')
    ? `[${target.hostname.replace(/^\[|\]$/gu, '')}]`
    : target.hostname;
  const url = new URL(
    `postgresql://${encodeURIComponent(role)}:${encodeURIComponent(password)}@${hostname}:${target.port}/${encodeURIComponent(target.database)}`,
  );
  if (!target.local) url.searchParams.set('sslmode', 'require');
  if (target.channelBinding) url.searchParams.set('channel_binding', target.channelBinding);
  if (target.endpointOption) url.searchParams.set('options', target.endpointOption);
  return url.toString();
}

export function makeMigrationConnectionString(connection: ParsedPostgresURL) {
  const url = new URL(connection.url);
  // TLS is enforced by the Pool's explicit SSL option. Keep validated routing
  // and channel-binding parameters so Node Postgres receives them as intended.
  url.searchParams.delete('sslmode');
  return url.toString();
}
