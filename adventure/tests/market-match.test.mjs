import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import * as model from '../src/features/adventure/marketMatch.mjs';
import { MARKET_ITEMS, chooseMarketCard, hideMarketPair, newMarketRound } from '../src/features/adventure/marketMatch.mjs';

test('each new market round contains a shuffled pair of every item', () => {
  const round = newMarketRound(() => 0.35);
  assert.equal(round.cards.length, MARKET_ITEMS.length * 2);
  for (const item of MARKET_ITEMS) assert.equal(round.cards.filter(card => card.id === item.id).length, 2);
  assert.notDeepEqual(round.cards.map(card => card.id), MARKET_ITEMS.flatMap(item => [item.id, item.id]));
});

test('mismatched cards lock until hidden and repeated or invalid choices do nothing', () => {
  const round = newMarketRound(() => 0.5);
  const first = 0, second = round.cards.findIndex(card => card.id !== round.cards[first].id);
  const picked = chooseMarketCard(round, first);
  assert.equal(chooseMarketCard(picked, first), picked);
  assert.equal(chooseMarketCard(picked, -1), picked);
  const missed = chooseMarketCard(picked, second);
  assert.deepEqual(missed.revealed, [first, second]);
  assert.equal(missed.attempts, 1);
  assert.equal(chooseMarketCard(missed, 3), missed);
  const cleared = hideMarketPair(missed);
  assert.deepEqual(cleared.revealed, []);
  assert.equal(cleared.attempts, 1);
});

test('matching all six pairs wins and a fresh round resets progress', () => {
  let round = newMarketRound(() => 0.25);
  for (const item of MARKET_ITEMS) {
    const pair = round.cards.flatMap((card, index) => card.id === item.id ? [index] : []);
    round = chooseMarketCard(chooseMarketCard(round, pair[0]), pair[1]);
    assert.equal(chooseMarketCard(round, pair[0]), round);
  }
  assert.equal(round.matched.length, round.cards.length);
  assert.equal(round.attempts, MARKET_ITEMS.length);
  assert.match(round.message, /All pairs found/);
  const next = newMarketRound(() => 0.8);
  assert.equal(next.attempts, 0);
  assert.deepEqual(next.matched, []);
});

test('the game starts with twelve hidden, keyboard-accessible cards and no timer', () => {
  const source = readFileSync('src/features/adventure/MarketMatch.tsx', 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const require = createRequire(import.meta.url);
  const localRequire = name => name === './marketMatch.mjs' ? model : name === './market-match.css' ? {} : require(name);
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(localRequire, module, module.exports);
  const html = renderToStaticMarkup(React.createElement(module.exports.default));
  assert.equal((html.match(/hidden card/g) ?? []).length, 12);
  assert.match(html, /role="grid"/);
  assert.match(html, /no rush/i);
  assert.match(html, /New game/);
});
