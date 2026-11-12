import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const world = JSON.parse(readFileSync('src/content/world.json', 'utf8'));
const source = readFileSync('src/features/adventure/Minimap.tsx', 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;

function render(selectedId) {
  let index = 0;
  const updates = [];
  const mockReact = { ...React, useState: () => { const key = index++; const current = key === 0 ? true : selectedId; return [current, value => { updates[key] = typeof value === 'function' ? value(current) : value; }]; }, useEffect: () => {}, useRef: () => ({ current: null }) };
  const localRequire = name => name === 'react' ? mockReact : name === '@/content/world.json' ? world : name === './minimap.css' ? {} : require(name);
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(localRequire, module, module.exports);
  const element = module.exports.default({ bridge: { x: 0, y: 0 }, guiding: false });
  return { element, updates, html: renderToStaticMarkup(element) };
}

function descendants(element) {
  if (!element || typeof element !== 'object') return [];
  return [element, ...React.Children.toArray(element.props?.children).flatMap(descendants)];
}

test('a place selection marks its own map location and remains keyboard accessible', () => {
  const initial = render(null);
  const rows = descendants(initial.element).filter(element => element.type === 'button' && element.props['aria-pressed'] !== undefined);
  assert.equal(rows.length, world.interactions.length);
  const arcadeIndex = world.interactions.findIndex(item => item.id === 'garden-arcade');
  rows[arcadeIndex].props.onClick();
  assert.equal(initial.updates[1], 'garden-arcade');

  const selected = render('garden-arcade');
  const arcade = world.interactions[arcadeIndex];
  assert.match(selected.html, /aria-pressed="true"/);
  assert.ok(selected.html.includes(`cx="${arcade.x}" cy="${arcade.y}" r="80"`));
  assert.match(selected.html, /Ring: Garden Glide/);
  assert.match(selected.html, /Southwest of the fountain/);
  assert.match(selected.html, /Photo garden, east of the fountain/);
  const selectedRows = descendants(selected.element).filter(element => element.type === 'button' && element.props['aria-pressed'] !== undefined);
  selectedRows[arcadeIndex].props.onClick();
  assert.equal(selected.updates[1], null, 'selecting the same place clears the marker');
});
