import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tileSurface, isPavedTile } from '../src/features/adventure/terrainModel.mjs';

test('all four swatch families retain their 4×4 material layouts', () => {
  for (let row = 0; row < 4; row++) for (let column = 0; column < 4; column++) {
    const cell = row * 8 + column;
    assert.equal(tileSurface(1 + cell), 'grass');
    assert.equal(tileSurface(5 + cell), 'plaza');
    assert.equal(tileSurface(52 + cell), 'garden-path');
    assert.equal(tileSurface(56 + cell), 'promenade');
  }
});

test('map summaries and route checks recognize every walking surface and exclude overlays', () => {
  for (const gid of [1, 4, 9, 28, 0, 33, 49, 50, 51, 84, 179]) assert.equal(isPavedTile(gid), false, String(gid));
  for (const gid of [5, 8, 13, 32, 52, 55, 56, 59, 83]) assert.equal(isPavedTile(gid), true, String(gid));
});

test('the shared classifier agrees with the exported terrain contract', () => {
  const terrain = JSON.parse(readFileSync('art/town-redesign/runtime/terrain.json', 'utf8'));
  for (const surface of terrain.surfaces) for (const gid of surface.tileIds) {
    assert.equal(tileSurface(gid), surface.id, `${surface.id} / ${gid}`);
    assert.equal(isPavedTile(gid), surface.isPaved, `${surface.id} / ${gid}`);
  }
});
