import { describe, expect, test } from 'vitest';
import {
  cacheState,
  errorFrom,
  parseSnapshot,
  readJson,
} from '@/components/admin/CmsEditor/response';
import { safeCommitUrl } from '@/components/admin/CmsEditor/utils';

const snapshot = {
  repository: { owner: 'owner', name: 'content', defaultBranch: 'main' },
  site: {
    sha: 'site-sha',
    data: {
      schemaVersion: 1,
      siteTitle: 'Portfolio',
      headline: 'Hello',
      introduction: 'Introduction',
      socialLinks: [],
    },
  },
  categories: { sha: 'category-sha', data: {} },
  technologies: { sha: 'technology-sha', data: {} },
  projects: [],
};

describe('CMS editor responses', () => {
  test('accepts a complete snapshot and rejects incomplete or invalid entries', () => {
    expect(parseSnapshot(snapshot)).toEqual(snapshot);
    expect(() => parseSnapshot({ ...snapshot, repository: null })).toThrow(/incomplete/);
    expect(() =>
      parseSnapshot({ ...snapshot, projects: [{ slug: '../bad', sha: 'sha', data: {} }] }),
    ).toThrow(/invalid project/);
    expect(() => parseSnapshot({ ...snapshot, site: { sha: 'sha', data: {} } })).toThrow();
  });

  test('handles non-object and malformed JSON safely', async () => {
    expect(await readJson(new Response('{invalid'))).toEqual({});
    expect(await readJson(Response.json(['not an object']))).toEqual({});
    expect(await readJson(Response.json({ error: 'conflict' }))).toEqual({ error: 'conflict' });
    expect(errorFrom({ error: 'conflict' })).toBe('conflict');
    expect(errorFrom(null)).toBe('');
    expect(cacheState('pending')).toBe('pending');
    expect(cacheState('refreshed')).toBe('refreshed');
    expect(cacheState('unknown')).toBeUndefined();
  });

  test('only exposes valid HTTPS commit links', () => {
    expect(safeCommitUrl('https://github.com/owner/content/commit/abc')).toBe(
      'https://github.com/owner/content/commit/abc',
    );
    for (const value of ['http://example.com', 'javascript:alert(1)', 'not a URL', null]) {
      expect(safeCommitUrl(value)).toBeUndefined();
    }
  });
});
