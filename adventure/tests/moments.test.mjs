import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = readFileSync('src/features/adventure/MomentsGallery.tsx', 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;

function render(photos, initialIndex = null) {
  const module = { exports: {} };
  const localRequire = name => name === '@/content/moments.json' ? { photos } : name === './moments.css' ? {} : require(name);
  new Function('require', 'module', 'exports', code)(localRequire, module, module.exports);
  return renderToStaticMarkup(React.createElement(module.exports.default, { close() {}, dialog: { current: null }, trap() {}, initialIndex }));
}

test('an empty album honestly invites visitors to return later', () => {
  const html = render([]);
  assert.match(html, /waiting for its first moment/i);
  assert.doesNotMatch(html, /moments-tile-image/);
});

test('a park frame opens its corresponding photo or falls back to the album', () => {
  const photos = [{ image: '/moments/first.webp', alt: 'A mountain view', caption: 'First adventure' }, { image: '/moments/second.webp', alt: 'A lake', caption: 'At the lake' }];
  const detail = render(photos, 1);
  assert.match(detail, /alt="A lake"/);
  assert.match(detail, /At the lake/);
  assert.match(render(photos, 2), /Moments worth keeping/);
  assert.match(render([], 0), /waiting for its first moment/i);
});

test('added moments render accessible gallery buttons in the supplied order', () => {
  const html = render([
    { image: '/moments/first.webp', alt: 'A mountain view', caption: 'First adventure', date: '2025' },
    { image: '/moments/second.webp', alt: 'A lakeside view', caption: 'Weekend by the lake' },
  ]);
  assert.ok(html.indexOf('First adventure') < html.indexOf('Weekend by the lake'));
  assert.match(html, /aria-label="View photo: First adventure"/);
  assert.match(html, /src="\/moments\/first.webp"/);
  assert.match(html, /2025/);
});
