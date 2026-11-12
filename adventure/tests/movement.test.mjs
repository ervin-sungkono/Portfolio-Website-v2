import { test } from 'node:test';
import assert from 'node:assert/strict';
import { movementFacing, movementVector, thumbstickVector } from '../src/features/adventure/movementModel.mjs';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} should be close to ${expected}`);

test('the joystick keeps a small radial deadzone while its knob follows the thumb', () => {
  assert.deepEqual(thumbstickVector(0, 0, 40), { x: 0, y: 0, knobX: 0, knobY: 0 });
  const input = thumbstickVector(3, 3, 40);
  assert.equal(input.x, 0);
  assert.equal(input.y, 0);
  close(input.knobX, 3);
  close(input.knobY, 3);
});

test('small touch movements walk promptly, with controlled speed up to the edge', () => {
  const speeds = [0.13, 0.25, 0.5, 1, 2].map(reach => thumbstickVector(reach * 40, 0, 40).x);
  assert.ok(speeds[0] >= 0.3);
  assert.ok(speeds[1] > speeds[0] && speeds[2] > speeds[1] && speeds[3] > speeds[2]);
  close(speeds[3], 1);
  close(speeds[4], 1);
  close(thumbstickVector(80, 0, 40).knobX, 40);
});

test('diagonal joystick input preserves its direction and stays within the normal speed', () => {
  const input = thumbstickVector(-60, 80, 40);
  close(input.x, -0.6);
  close(input.y, 0.8);
  close(input.knobX, -24);
  close(input.knobY, 32);
  close(Math.hypot(input.x, input.y), 1);
});

test('walking and blinking use the same movement state even for small diagonal inputs', () => {
  const movement = movementVector(0.1, 0.1);
  assert.equal(movement.moving, true);
  close(movement.speed, Math.hypot(0.1, 0.1));
  assert.equal(movementVector(0, 0).moving, false);
});

test('keyboard and combined inputs preserve their intended speed and direction', () => {
  assert.deepEqual(movementVector(1, 0), { x: 1, y: 0, speed: 1, moving: true });
  const diagonal = movementVector(1, -1);
  close(diagonal.x, Math.SQRT1_2);
  close(diagonal.y, -Math.SQRT1_2);
  close(diagonal.speed, 1);
  close(Math.hypot(movementVector(1.5, 0.5).x, movementVector(1.5, 0.5).y), 1);
});

test('touch direction stays steady near a diagonal but changes promptly when intended', () => {
  assert.equal(movementFacing(0.7, 0.71, 'right', true), 'right');
  assert.equal(movementFacing(0.71, 0.7, 'down', true), 'down');
  assert.equal(movementFacing(0.5, 0.8, 'right', true), 'down');
  assert.equal(movementFacing(-0.8, 0.7, 'right', true), 'left');
  assert.equal(movementFacing(0.7, 0.71, 'right', false), 'down');
});
