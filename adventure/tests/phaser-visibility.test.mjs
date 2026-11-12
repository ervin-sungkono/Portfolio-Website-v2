import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createOverlayPauseController } from '../src/features/adventure/overlayPause.mjs';

const listeners = new Map();
const key = (target, name) => `${target}:${name}`;
function add(target, name, listener) {
  const id = key(target, name);
  if (!listeners.has(id)) listeners.set(id, new Set());
  listeners.get(id).add(listener);
}
function remove(target, name, listener) { listeners.get(key(target, name))?.delete(listener); }
function count(target, name) { return listeners.get(key(target, name))?.size ?? 0; }
function fire(target, name) { for (const listener of [...(listeners.get(key(target, name)) ?? [])]) listener({ type: name }); }

const hostBlur = () => 'host blur';
const hostFocus = () => 'host focus';
globalThis.window = {
  devicePixelRatio: 1, onblur: hostBlur, onfocus: hostFocus,
  addEventListener: (name, fn) => add('window', name, fn),
  removeEventListener: (name, fn) => remove('window', name, fn),
};
globalThis.document = {
  hidden: false,
  addEventListener: (name, fn) => add('document', name, fn),
  removeEventListener: (name, fn) => remove('document', name, fn),
};
globalThis.navigator ??= { userAgent: '', maxTouchPoints: 0 };
globalThis.importScripts = () => {};
const Phaser = (await import('phaser')).default;
const require = createRequire(import.meta.url);

function makeGame() {
  let scheduled;
  const calls = { hidden: 0, visible: 0, blur: 0, focus: 0, destroyed: 0, updates: 0, reset: 0 };
  const game = Object.assign(Object.create(Phaser.Game.prototype), {
    events: new Phaser.Events.EventEmitter(), config: { autoFocus: false, postBoot() {} },
    scene: { destroy() { calls.destroyed++; }, update() { calls.updates++; }, getScene() { return { input: { keyboard: { resetKeys() { calls.reset++; } } } }; } }, renderer: null, removeCanvas: false,
    input: { keyboard: { enabled: true } },
    canvas: null, domContainer: null, pendingDestroy: false, isPaused: false,
    loop: { start(fn) { scheduled = fn; }, destroy() {}, pause() { calls.hidden++; }, resume() { calls.visible++; }, blur() { calls.blur++; }, focus() { calls.focus++; } },
  });
  return { game, frame: () => scheduled(0, 0), calls };
}

function assertHostIntact() {
  assert.equal(window.onblur, hostBlur);
  assert.equal(window.onfocus, hostFocus);
}

test('the actual imported Phaser build cleans up across repeated starts, destroys and early cancellation', () => {
  assert.equal(Phaser.VERSION, '4.2.1');
  for (let i = 0; i < 3; i++) {
    const { game, frame, calls } = makeGame();
    if (i === 0) game.destroy(true); // Cancel after construction, before Phaser starts.
    game.start();
    assert.equal(count('document', 'visibilitychange'), 1);
    assertHostIntact();
    document.hidden = true; fire('document', 'visibilitychange');
    document.hidden = false; fire('document', 'visibilitychange');
    fire('window', 'blur'); fire('window', 'focus');
    assert.deepEqual([calls.hidden, calls.visible, calls.blur, calls.focus], [1, 1, 1, 1]);
    if (i !== 0) game.destroy(true);
    frame();
    assert.equal(calls.destroyed, 1);
    assert.equal(count('document', 'visibilitychange'), 0);
    assert.equal(count('window', 'blur'), 0);
    assert.equal(count('window', 'focus'), 0);
    assertHostIntact();
  }
});

test('a paused Phaser game skips scene updates and still honors deferred destruction', () => {
  const { game, frame, calls } = makeGame();
  game.start(); game.pause(); frame();
  assert.equal(calls.updates, 0);
  assert.equal(calls.destroyed, 0);
  game.destroy(true); frame();
  assert.equal(calls.destroyed, 1);
  assert.equal(count('document', 'visibilitychange'), 0);
  assertHostIntact();
});

test('real Phaser resumes one frame before restoring keyboard capture', () => {
  const { game, frame, calls } = makeGame();
  const bridge = { x: 1, y: 0, interact: true };
  const controller = createOverlayPauseController(game, bridge, () => {});
  let flushedWithKeyboardDisabled = false;
  game.events.on('poststep', () => { flushedWithKeyboardDisabled = !game.input.keyboard.enabled; });
  game.start(); controller.setActive(true); frame();
  assert.equal(calls.updates, 0);
  controller.setActive(false);
  assert.equal(game.input.keyboard.enabled, false);
  frame();
  assert.equal(calls.updates, 1);
  assert.equal(flushedWithKeyboardDisabled, true);
  assert.equal(game.input.keyboard.enabled, true);
  controller.destroy(); frame();
  assert.equal(count('document', 'visibilitychange'), 0);
});

test('repeatedly leaving and returning pauses one game and releases input until resume', () => {
  const { game, frame, calls } = makeGame();
  const bridge = { x: 1, y: -1, interact: true };
  const controller = createOverlayPauseController(game, bridge, () => {});
  game.start();
  for (let visit = 0; visit < 3; visit++) {
    controller.setActive(true);
    assert.deepEqual(bridge, { x: 0, y: 0, interact: false });
    assert.equal(game.input.keyboard.enabled, false);
    frame();
    assert.equal(calls.updates, visit);
    controller.setActive(false);
    frame();
    assert.equal(game.input.keyboard.enabled, true);
    assert.equal(count('document', 'visibilitychange'), 1);
  }
  controller.destroy(); frame();
  assert.equal(calls.destroyed, 1);
  assert.equal(count('document', 'visibilitychange'), 0);
});

test('disabling Phaser keyboard capture lets arcade buttons receive Space', () => {
  const KeyboardManager = require('../node_modules/phaser/src/input/keyboard/KeyboardManager.js');
  const host = { addEventListener: (name, fn) => add('host', name, fn), removeEventListener: (name, fn) => remove('host', name, fn) };
  const manager = Object.assign(Object.create(KeyboardManager.prototype), {
    enabled: false, target: host, manager: { events: new Phaser.Events.EventEmitter() },
    queue: [], preventDefault: true, captures: [32],
  });
  manager.startListeners();
  assert.equal(count('host', 'keydown'), 1);
  assert.equal(count('window', 'keydown'), 0);
  manager.enabled = false;
  let prevented = false;
  const event = { keyCode: 32, defaultPrevented: false, preventDefault() { prevented = true; } };
  manager.onKeyDown(event);
  assert.equal(prevented, false);
  assert.equal(manager.queue.length, 0);
  manager.enabled = true;
  manager.onKeyDown(event);
  assert.equal(prevented, true);
  assert.equal(manager.queue.length, 1);
  host.removeEventListener('keydown', manager.onKeyDown);
  host.removeEventListener('keyup', manager.onKeyUp);
});

test('destroying one of two games preserves the other and host listeners', () => {
  const hostListener = () => {};
  window.addEventListener('blur', hostListener);
  const first = makeGame(), second = makeGame();
  first.game.start(); second.game.start();
  assert.equal(count('document', 'visibilitychange'), 2);
  first.game.destroy(true); first.frame();
  assert.equal(count('document', 'visibilitychange'), 1);
  assert.equal(count('window', 'blur'), 2); // host and second game
  fire('window', 'blur');
  assert.equal(first.calls.blur, 0);
  assert.equal(second.calls.blur, 1);
  second.game.destroy(true); second.frame();
  assert.equal(count('document', 'visibilitychange'), 0);
  assert.equal(count('window', 'blur'), 1);
  assertHostIntact();
  window.removeEventListener('blur', hostListener);
});
