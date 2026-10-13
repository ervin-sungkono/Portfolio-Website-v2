import { spawn } from 'node:child_process';

const requiredRuntimeVariables = [
  'DATABASE_URL_PUBLIC',
  'DATABASE_URL_CMS',
  'DATABASE_URL_AUTH',
  'BETTER_AUTH_SECRET',
];

const runtime = {};
for (const variable of requiredRuntimeVariables) {
  const value = process.env[variable];
  if (!value) throw new Error(`${variable} is required to start the CMS browser target.`);
  runtime[variable] = value;
}

for (const variable of ['DATABASE_URL_PUBLIC', 'DATABASE_URL_CMS', 'DATABASE_URL_AUTH']) {
  let url;
  try {
    url = new URL(runtime[variable]);
  } catch {
    throw new Error(`${variable} must be a valid local PostgreSQL URL for the CMS browser target.`);
  }
  if (
    !['127.0.0.1', 'localhost', '::1', '[::1]'].includes(url.hostname) ||
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    url.pathname !== '/portfolio_cms_test' ||
    url.search.length > 0 ||
    url.hash.length > 0
  ) {
    throw new Error(
      `${variable} must target the isolated portfolio_cms_test database on loopback.`,
    );
  }
}

const childEnvironment = {
  PATH: process.env.PATH ?? '',
  NODE_ENV: 'production',
  HOSTNAME: '127.0.0.1',
  PORT: '3105',
  CMS_CONTENT_SOURCE: 'database',
  CMS_ENVIRONMENT: 'development',
  BETTER_AUTH_URL: 'http://127.0.0.1:3105',
  ...runtime,
};

const child = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3105'],
  { stdio: 'inherit', env: childEnvironment },
);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}

child.on('error', () => {
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  process.exitCode = typeof code === 'number' ? code : signal ? 1 : 0;
});
