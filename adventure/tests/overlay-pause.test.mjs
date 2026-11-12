import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createOverlayPauseController } from '../src/features/adventure/overlayPause.mjs';

function setup(initiallyPaused = false, initiallyEnabled = true) {
  const calls = { stop: 0, reset: 0, pause: 0, resume: 0, destroy: 0 };
  const keyboard = { enabled: initiallyEnabled };
  const game = {
    isPaused: initiallyPaused, input: { keyboard },
    events: new EventEmitter(),
    scene: { getScene: () => ({ input: { keyboard: { resetKeys() { calls.reset++; } } } }) },
    pause() { calls.pause++; this.isPaused = true; },
    resume() { calls.resume++; this.isPaused = false; },
    destroy(removeCanvas) { assert.equal(removeCanvas, true); calls.destroy++; },
  };
  const bridge = { x: 1, y: -1, interact: true };
  const controller = createOverlayPauseController(game, bridge, () => { calls.stop++; });
  return { game, keyboard, bridge, calls, controller };
}

test('canvas blur clears keyboard state without interrupting an active touch', () => {
  const { bridge, calls, controller } = setup();
  controller.resetKeyboard();
  assert.deepEqual(bridge, { x: 1, y: -1, interact: true });
  assert.equal(calls.stop, 1);
  assert.equal(calls.reset, 1);
  controller.setActive(true);
  assert.deepEqual(bridge, { x: 0, y: 0, interact: false }, 'opening a dialog still clears all input');
});

test('opening a dialog pauses town and keyboard capture; closing restores both', () => {
  const { game, keyboard, bridge, calls, controller } = setup();
  controller.setActive(true); controller.setActive(true);
  assert.deepEqual(bridge, { x: 0, y: 0, interact: false });
  assert.equal(keyboard.enabled, false);
  assert.equal(game.isPaused, true);
  assert.equal(calls.pause, 1);
  controller.setActive(false);
  assert.equal(keyboard.enabled, false, 'capture remains disabled until Phaser flushes its queue');
  assert.equal(game.isPaused, false);
  game.events.emit('poststep');
  assert.equal(keyboard.enabled, true);
  assert.deepEqual(calls, { stop: 1, reset: 2, pause: 1, resume: 1, destroy: 0 });
});

test('reopening or destroying before the next frame cancels stale keyboard restoration', () => {
  const { game, keyboard, controller } = setup();
  controller.setActive(true); controller.setActive(false);
  assert.equal(game.events.listenerCount('poststep'), 1);
  controller.setActive(true);
  assert.equal(game.events.listenerCount('poststep'), 0);
  game.events.emit('poststep');
  assert.equal(keyboard.enabled, false);
  controller.setActive(false);
  controller.destroy();
  assert.equal(game.events.listenerCount('poststep'), 0);
  assert.equal(keyboard.enabled, true);
});

test('an already paused game and a disabled keyboard keep their previous state', () => {
  const { game, keyboard, calls, controller } = setup(true, false);
  controller.setActive(true); controller.setActive(false);
  assert.equal(game.isPaused, true);
  assert.equal(keyboard.enabled, false);
  assert.equal(calls.pause, 0);
  assert.equal(calls.resume, 0);
});

test('destroy while paused restores keyboard and remains idempotent', () => {
  const { keyboard, calls, controller } = setup();
  controller.setActive(true); controller.destroy(); controller.destroy(); controller.setActive(false);
  assert.equal(keyboard.enabled, true);
  assert.equal(calls.resume, 0);
  assert.equal(calls.destroy, 1);
});
