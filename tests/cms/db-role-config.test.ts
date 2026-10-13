import assert from 'node:assert/strict';
import test from 'node:test';
import { CmsSetupError } from '../../src/lib/cms/errors.ts';
import { getPool } from '../../src/lib/cms/db.ts';

test('a public-role URL cannot replace its login role through a pg query option', () => {
  const previous = process.env.DATABASE_URL_PUBLIC;
  process.env.DATABASE_URL_PUBLIC =
    'postgresql://portfolio_public:qa-only@127.0.0.1:55432/portfolio_cms_test?user=portfolio_cms';

  try {
    assert.throws(() => getPool('public'), CmsSetupError);
  } finally {
    if (previous === undefined) delete process.env.DATABASE_URL_PUBLIC;
    else process.env.DATABASE_URL_PUBLIC = previous;
  }
});
