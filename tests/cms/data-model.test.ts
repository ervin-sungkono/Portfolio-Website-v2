import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { profile, skills } from '../../src/content/profile.ts';
import { validatePayload } from '../../src/lib/cms/model.ts';

const contentDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../src/content',
);

async function readSnapshot(filename: string): Promise<unknown[]> {
  return JSON.parse(await readFile(path.join(contentDirectory, filename), 'utf8')) as unknown[];
}

test('the current project, design, and profile snapshots satisfy CMS payload schemas', async () => {
  const projects = await readSnapshot('projects.json');
  const designs = await readSnapshot('designs.json');

  for (const project of projects) validatePayload('project', project);
  for (const design of designs) validatePayload('design', design);
  validatePayload('profile', { ...profile, skills });
});

test('project payload validation rejects extra fields, unsafe URLs, and unapproved images', async () => {
  const projects = await readSnapshot('projects.json');
  const source = projects[0];
  assert.ok(source && typeof source === 'object' && !Array.isArray(source));

  assert.throws(() =>
    validatePayload('project', { ...source, rawHtml: '<script>alert(1)</script>' }),
  );
  assert.throws(() => validatePayload('project', { ...source, source: 'javascript:alert(1)' }));
  assert.throws(() =>
    validatePayload('project', { ...source, image: 'https://unapproved.example/image.png' }),
  );
});

test('published media references are restricted to immutable UUID and SHA-256 paths', async () => {
  const projects = await readSnapshot('projects.json');
  const source = projects[0];
  assert.ok(source && typeof source === 'object' && !Array.isArray(source));

  const approved = {
    ...source,
    image:
      '/media/published/3e6f8b3a-1b7a-4a4a-9a2d-a4ec1fca6634/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  };
  assert.equal(validatePayload('project', approved).image, approved.image);

  for (const image of [
    '/media/published/3e6f8b3a-1b7a-4a4a-9a2d-a4ec1fca6634/not-a-hash',
    '/media/published/3e6f8b3a-1b7a-4a4a-9a2d-a4ec1fca6634/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef?download=1',
    '//media.published.example/asset.png',
  ]) {
    assert.throws(() => validatePayload('project', { ...source, image }));
  }
});

test('profile identity is fixed to the current portfolio owner', () => {
  const payload = { ...profile, skills };
  assert.throws(() => validatePayload('profile', { ...payload, name: 'Different Owner' }));
});
