import { test } from 'node:test';
import assert from 'node:assert/strict';
import { townColliders } from '../src/features/adventure/collisionModel.mjs';

const props = {
  'painting-frame': { collision: { offsetX: 0, offsetY: -6, width: 60, height: 12 } },
  'garden-easel': { collision: { offsetX: 2, offsetY: -8, width: 84, height: 16 } },
};
const frame = { id: 4, name: 'moments-frame-1', type: 'moments', x: 1200, y: 700 };

test('an interaction uses the same custom prop footprint as its district artwork', () => {
  const [original] = townColliders([], [frame], props, []);
  const [custom] = townColliders([], [{ ...frame, properties: [{ name: 'prop', value: 'garden-easel' }] }], props, []);
  assert.deepEqual([original.x, original.y, original.width, original.height], [1170, 688, 60, 12]);
  assert.deepEqual([custom.x, custom.y, custom.width, custom.height], [1160, 684, 84, 16]);
  assert.equal(custom.sourceId, frame.id);
});

test('a malformed or missing interaction prop cannot silently remove a solid footprint', () => {
  for (const value of ['missing-prop', 17, null]) {
    assert.throws(() => townColliders([], [{ ...frame, properties: [{ name: 'prop', value }] }], props, []), /Unknown interaction prop/);
  }
});

test('a linked district target relies on its exported furniture footprint without adding a legacy blocker', () => {
  const linked = { ...frame, properties: [{ name: 'districtPart', value: 'photo-garden/easel-left' }] };
  assert.deepEqual(townColliders([], [linked], props, []), []);
  assert.throws(() => townColliders([], [{ ...linked, properties: [{ name: 'districtPart', value: '' }] }], props, []), /Invalid district part/);
});
