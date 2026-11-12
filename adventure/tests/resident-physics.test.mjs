import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = { devicePixelRatio: 1 };
globalThis.document = {};
globalThis.navigator ??= { userAgent: '', maxTouchPoints: 0 };
globalThis.importScripts = () => {};
const Phaser = (await import('phaser')).default;

test('actual Phaser physics blocks the player at a resident’s feet and follows their stroll', () => {
  const scene = { sys: { scale: { width: 500, height: 500 }, events: new Phaser.Events.EventEmitter(), queueDepthSort() {} } };
  const physics = new Phaser.Physics.Arcade.World(scene, { debug: false });
  physics.setBounds(0, 0, 500, 500);
  const resident = new Phaser.GameObjects.Container(scene, 200, 300).setSize(24, 12);
  physics.enableBody(resident, Phaser.Physics.Arcade.DYNAMIC_BODY);
  resident.body.setAllowGravity(false).setImmovable(true).setSize(24, 12, false).setOffset(0, -6).setDirectControl(true);

  const player = { x: 130, y: 300, angle: 0, scaleX: 1, scaleY: 1, displayOriginX: 12, displayOriginY: 6, displayWidth: 24, displayHeight: 12, width: 24, height: 12 };
  const body = new Phaser.Physics.Arcade.Body(physics, player);
  player.body = body;
  body.setSize(24, 12, false).setOffset(0, -6);
  physics.add(body);
  let hits = 0;
  physics.addCollider(player, resident, () => hits++);
  for (let frame = 0; frame < 60; frame++) {
    body.setVelocity(80, 0);
    physics.update(frame * 1000 / 60, 1000 / 60);
    physics.postUpdate();
  }
  assert.ok(hits > 0);
  assert.ok(body.right <= resident.body.left + 0.01, 'player cannot pass through the resident');
  assert.deepEqual([resident.body.x, resident.body.y, resident.body.width, resident.body.height], [188, 288, 24, 12]);

  resident.x = 260; // A walking tween changes the game object’s position.
  physics.update(1000, 1000 / 60); physics.postUpdate();
  assert.deepEqual([resident.body.x, resident.body.y], [248, 288], 'the collider follows the walker');
});
