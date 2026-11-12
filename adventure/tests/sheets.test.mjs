import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { BLINK_IDLE, BLINK_WALK, DIRECTIONS, explorerFrame } from '../src/features/adventure/sheetFrames.mjs';
const require = createRequire(import.meta.url);
const parse = require('../node_modules/phaser/src/textures/parsers/SpriteSheet.js');

function frames(width, height, endFrame, frameWidth = 96, frameHeight = 128) {
  const result = new Map();
  const texture = { source: [{ width, height }], add(name, _source, x, y, w, h) { result.set(name, { x, y, w, h }); } };
  parse(texture, 0, 0, 0, width, height, { frameWidth, frameHeight, endFrame });
  return result;
}

test('Phaser parses the explorer sheets in the same order used by the animations', () => {
  const parsed = frames(576, 512, 21);
  assert.equal(parsed.size, 23); // 22 frames and the base texture.
  for (const [directionIndex, direction] of DIRECTIONS.entries()) {
    assert.equal(explorerFrame(direction), directionIndex * 5);
    for (let walk = 0; walk < 4; walk++) assert.equal(explorerFrame(direction, walk), directionIndex * 5 + walk + 1);
  }
  assert.equal(BLINK_IDLE, 20); assert.equal(BLINK_WALK, 21);
  for (let frame = 0; frame <= 21; frame++) assert.deepEqual(parsed.get(frame), { x: (frame % 6) * 96, y: Math.floor(frame / 6) * 128, w: 96, h: 128 });
  assert.throws(() => explorerFrame('diagonal'));
});

test('Phaser parses four intact idle frames for each NPC sheet', () => {
  const parsed = frames(268, 90, 3, 67, 90);
  assert.equal(parsed.size, 5);
  for (let frame = 0; frame < 4; frame++) assert.deepEqual(parsed.get(frame), { x: frame * 67, y: 0, w: 67, h: 90 });
});
