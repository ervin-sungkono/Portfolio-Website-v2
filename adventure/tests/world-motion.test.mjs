import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hairSlices, hairSway } from '../src/features/adventure/worldMotion.mjs';

test('hair and body slices cover every pixel of each explorer frame exactly once', () => {
  for (const character of ['male', 'female']) {
    for (const direction of ['down', 'left', 'up', 'right']) {
      const pixels = new Uint8Array(96 * 128);
      const slices = hairSlices(character, direction);
      assert.equal(slices.length, 5);
      for (const { x, y, width, height } of slices) {
        assert.ok(x >= 0 && y >= 0 && x + width <= 96 && y + height <= 128);
        for (let row = y; row < y + height; row++) {
          for (let column = x; column < x + width; column++) pixels[row * 96 + column]++;
        }
      }
      assert.ok(pixels.every(value => value === 1), `${character} ${direction} frame has a gap or overlap`);
    }
  }
});

test('hair sway follows the walk cycle and is stronger for the ponytail', () => {
  assert.deepEqual([1, 2, 3, 4].map(index => hairSway(index, 'female')), [0, 1.1, 0, -1.1]);
  assert.deepEqual([1, 2, 3, 4].map(index => hairSway(index, 'male')), [0, 0.55, 0, -0.55]);
});
