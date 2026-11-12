import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { townColliders } from '../src/features/adventure/collisionModel.mjs';

const require = createRequire(import.meta.url);
globalThis.window = { devicePixelRatio: 1 };
globalThis.document = {};
globalThis.navigator ??= { userAgent: '', maxTouchPoints: 0 };
globalThis.importScripts = () => {};
const Phaser = require('phaser');
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const map = read('public/game/maps/town.json');
const world = read('src/content/world.json');
const props = read('src/content/props.json');
const npcs = read('src/content/npcs.json');
const layer = name => map.layers.find(item => item.name === name).objects;
const generated = townColliders(layer('decorations'), layer('interactions'), props, npcs);
const manual = layer('collision');
const property = (object, name) => object.properties?.find(item => item.name === name)?.value;
const river = manual.filter(item => item.type === 'water' || item.type === 'bridge-rail');

function simulate(rects, groupMode, startX, startY, vx, vy, frames = 80) {
  const scene = { sys: { scale: { width: world.width, height: world.height }, events: new Phaser.Events.EventEmitter(), queueDepthSort() {}, updateList: { add() {}, remove() {} } } };
  const physics = new Phaser.Physics.Arcade.World(scene, { debug: false });
  physics.setBounds(36, 36, world.width - 72, world.height - 72);
  const player = { x: startX, y: startY, angle: 0, scaleX: 0.55, scaleY: 0.55, displayOriginX: 48, displayOriginY: 108.8, displayWidth: 52.8, displayHeight: 70.4, width: 96, height: 128 };
  const body = new Phaser.Physics.Arcade.Body(physics, player);
  player.body = body;
  body.setSize(42, 30, false).setOffset(27, 86); body.setCollideWorldBounds(true); physics.add(body);
  const group = groupMode ? new Phaser.Physics.Arcade.StaticGroup(physics, scene) : null;
  let hits = 0;
  for (const rect of rects) {
    const zone = new Phaser.GameObjects.Zone(scene, rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width, rect.height);
    physics.enableBody(zone, Phaser.Physics.Arcade.STATIC_BODY);
    if (group) group.add(zone);
    else physics.addCollider(player, zone, () => { hits++; });
  }
  if (group) physics.addCollider(player, group, () => { hits++; });
  for (let frame = 0; frame < frames; frame++) { body.setVelocity(vx, vy); physics.update(frame * 1000 / 60, 1000 / 60); physics.postUpdate(); }
  return { x: body.x, y: body.y, right: body.right, bottom: body.bottom, playerX: player.x, playerY: player.y, hits, colliders: physics.colliders._active.length };
}

// Native points are traced against the approved source art, independently of collision metadata.
function walkDistrict(groupId, points) {
  const district = read('art/town-redesign/runtime/groups.json').groups[groupId];
  const base = layer('decorations').find(item => item.name === district.base.prop);
  const worldPoints = points.map(([x, y]) => [base.x + x * district.placementScale, base.y + y * district.placementScale]);
  let [x, y] = worldPoints[0];
  let result;
  for (const [targetX, targetY] of worldPoints.slice(1)) {
    const dx = targetX - x, dy = targetY - y, distance = Math.hypot(dx, dy);
    result = simulate([...generated, ...manual], true, x, y, dx / distance * 175, dy / distance * 175, Math.ceil(distance / 175 * 60));
    x = result.playerX; y = result.playerY;
    if (result.hits) break;
  }
  const [endX, endY] = worldPoints.at(-1);
  return { ...result, remaining: Math.hypot(x - endX, y - endY) };
}

test('the garden art clears the fountain paving by three tiles and the passage stays walkable', () => {
  const garden = read('art/town-redesign/runtime/groups.json').groups['photo-garden'];
  const base = layer('decorations').find(item => item.name === garden.base.prop);
  const medallion = layer('decorations').find(item => item.name === 'plaza-medallion');
  const style = props['plaza-medallion'];
  const imageWidth = readFileSync(`public${style.url}`).readUInt32BE(16);
  const plazaRight = medallion.x + imageWidth * style.scale * (1 - style.originX);
  const gardenLeft = base.x - garden.base.width * garden.placementScale * garden.base.scale * garden.base.originX;
  assert.ok(gardenLeft - plazaRight >= 96, 'the visible garden must clear the complete circular plaza, including its landing');
  const center = (gardenLeft + plazaRight) / 2;
  const walk = simulate([...generated, ...manual], true, center, 544, 0, 175, 132);
  assert.equal(walk.hits, 0, 'the passage between the fountain and garden must stay open');
  assert.ok(walk.playerY > 920, 'the explorer can walk the full length of the passage');
});

test('visible raised beds and retaining faces block entry from courtyard floors', () => {
  const attempts = [
    ['photo-garden', [[200, 220], [110, 220]]],
    ['photo-garden', [[400, 450], [400, 540]]],
    ['cafe-patio', [[224, 300], [80, 300]]],
    ['cafe-patio', [[224, 300], [368, 300]]],
    ['arcade-nook', [[224, 360], [224, 240], [76, 240], [52, 268]]],
    ['arcade-nook', [[224, 360], [224, 240], [372, 240], [396, 268]]],
  ];
  for (const [groupId, points] of attempts) {
    const result = walkDistrict(groupId, points);
    assert.ok(result.hits > 0 && result.remaining > 12, `${groupId}: explorer entered visible solid art at ${points.at(-1)}`);
  }
});

test('drawn stairs and the garden arch stay passable after the raised beds are blocked', () => {
  for (const [groupId, points] of [
    ['photo-garden', [[122, 600], [122, 450]]],
    ['photo-garden', [[545, 70], [545, 240]]],
    ['cafe-patio', [[224, 460], [224, 280]]],
    ['arcade-nook', [[224, 460], [224, 300]]],
  ]) {
    const result = walkDistrict(groupId, points);
    assert.equal(result.hits, 0, `${groupId}: a visible opening was blocked`);
    assert.ok(result.remaining < 3, `${groupId}: explorer could not traverse the opening`);
  }
});

test('one static-group collider blocks the same object footprints from each side', () => {
  const groupFoot = manual.find(item => property(item, 'districtPart') === 'photo-garden/easel-2');
  const boundary = manual.find(item => property(item, 'districtPart') === 'photo-garden/west-outer-wall');
  const sources = [
    generated.find(item => item.source === 'decoration:workshop'),
    generated.find(item => item.source === 'decoration:bench'),
    generated.find(item => item.source === 'interaction:background-guide'),
    { ...groupFoot, source: 'districtPart:photo-garden/easel-2' },
    { ...boundary, source: 'districtPart:photo-garden/west-outer-wall' },
  ];
  for (const rect of sources) {
    const source = rect?.source;
    assert.ok(rect, `${source} exists in the current map`);
    const probes = [
      [rect.x - 60, rect.y + rect.height / 2 + 4.3, 175, 0],
      [rect.x + rect.width + 60, rect.y + rect.height / 2 + 4.3, -175, 0],
      [rect.x + rect.width / 2, rect.y - 60, 0, 175],
      [rect.x + rect.width / 2, rect.y + rect.height + 60, 0, -175],
    ];
    // Remote bodies exercise the spatial tree without changing the local obstacle.
    const noise = Array.from({ length: 130 }, (_, i) => ({ x: 1900 + (i % 10) * 8, y: 60 + Math.floor(i / 10) * 8, width: 4, height: 4 }));
    for (const probe of probes) {
      const plain = simulate([rect, ...noise], false, ...probe);
      const grouped = simulate([rect, ...noise], true, ...probe);
      assert.ok(plain.hits > 0 && grouped.hits > 0, `${source} did not collide`);
      assert.ok(Math.abs(plain.x - grouped.x) < 1e-6 && Math.abs(plain.y - grouped.y) < 1e-6, `${source} produced different separation`);
      assert.equal(plain.colliders, 131);
      assert.equal(grouped.colliders, 1);
    }
  }
});

test('the grouped river collision blocks water but keeps the bridge open', () => {
  const water = river.filter(item => item.type === 'water');
  const rails = river.filter(item => item.type === 'bridge-rail');
  assert.equal(water.length, 2, 'current map has blockers over the two visible banks');
  assert.equal(rails.length, 2, 'current map has side rails for the central bridge deck');
  const leftRail = rails.reduce((left, item) => item.x < left.x ? item : left);
  const rightRail = rails.reduce((right, item) => item.x > right.x ? item : right);
  const bridgeX = (leftRail.x + rightRail.x + rightRail.width) / 2;
  const probes = water.flatMap((rect, index) => [
    [rect.x + rect.width / 2, rect.y - 56, 175, `north bank ${index}`],
    [rect.x + rect.width / 2, rect.y + rect.height + 56, -175, `south bank ${index}`],
  ]).concat([
    [bridgeX, water[0].y - 56, 175, 'bridge south'],
    [bridgeX, water[0].y + water[0].height + 56, -175, 'bridge north'],
  ]);
  for (const [x, y, vy, expectation] of probes) {
    const plain = simulate(river, false, x, y, 0, vy);
    const grouped = simulate(river, true, x, y, 0, vy);
    assert.ok(Math.abs(plain.y - grouped.y) < 1e-6, `${expectation} produced different separation`);
    if (expectation.startsWith('north bank')) assert.ok(grouped.bottom <= water[0].y + 0.001, `${expectation} did not block`);
    if (expectation.startsWith('south bank')) assert.ok(grouped.y >= water[0].y + water[0].height - 0.001, `${expectation} did not block`);
    if (expectation === 'bridge south') assert.ok(grouped.y > water[0].y + water[0].height);
    if (expectation === 'bridge north') assert.ok(grouped.bottom < water[0].y);
    assert.equal(grouped.colliders, 1);
  }
});

test('the bridge approaches stay passable with the riverside railings and stairs', () => {
  const rects = [...generated, ...layer('collision')];
  const water = river.find(item => item.type === 'water');
  const rails = river.filter(item => item.type === 'bridge-rail');
  const west = rails.reduce((left, item) => item.x < left.x ? item : left);
  const east = rails.reduce((right, item) => item.x > right.x ? item : right);
  const x = (west.x + east.x + east.width) / 2;
  const south = simulate(rects, true, x, water.y - 56, 0, 175, 100);
  const north = simulate(rects, true, x, water.y + water.height + 56, 0, -175, 100);
  assert.ok(south.y > water.y + water.height, 'the full town collision set must allow walking south over the bridge');
  assert.ok(north.bottom < water.y, 'the full town collision set must allow walking north over the bridge');
});

test('grouped colliders follow the same initial routes through the current town', () => {
  const rects = [...generated, ...layer('collision')];
  for (const [vx, vy] of [[175, 0], [-175, 0], [0, 175], [0, -175]]) {
    const plain = simulate(rects, false, world.spawn.x, world.spawn.y, vx, vy, 140);
    const grouped = simulate(rects, true, world.spawn.x, world.spawn.y, vx, vy, 140);
    assert.ok(Math.abs(plain.x - grouped.x) < 1e-6 && Math.abs(plain.y - grouped.y) < 1e-6, `route ${vx},${vy} differs`);
    assert.equal(grouped.colliders, 1);
  }
});

test('detached static-group zones keep blocking without staying on the display list', () => {
  const events = new Phaser.Events.EventEmitter();
  const scene = { sys: { scale: { width: 500, height: 500 }, events, queueDepthSort() {}, updateList: { add() {}, remove() {} } } };
  scene.sys.displayList = new Phaser.GameObjects.DisplayList(scene);
  const physics = new Phaser.Physics.Arcade.World(scene, { debug: false });
  physics.setBounds(0, 0, 500, 500);

  const rect = { x: 200, y: 200, width: 40, height: 40 };
  const zone = new Phaser.GameObjects.Zone(scene, rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width, rect.height);
  zone.addToDisplayList();
  assert.equal(scene.sys.displayList.exists(zone), true);
  zone.removeFromDisplayList();
  physics.enableBody(zone, Phaser.Physics.Arcade.STATIC_BODY);
  const group = new Phaser.Physics.Arcade.StaticGroup(physics, scene);
  group.add(zone);
  assert.equal(zone.body.physicsType, Phaser.Physics.Arcade.STATIC_BODY);
  assert.equal(scene.sys.displayList.exists(zone), false, 'adding the zone to a static group must not restore it to the display list');

  const player = { x: 130, y: 214, angle: 0, scaleX: 1, scaleY: 1, displayOriginX: 12, displayOriginY: 6, displayWidth: 24, displayHeight: 12, width: 24, height: 12 };
  const body = new Phaser.Physics.Arcade.Body(physics, player);
  player.body = body;
  body.setSize(24, 12, false);
  physics.add(body);
  physics.addCollider(player, group);
  for (let frame = 0; frame < 60; frame++) { body.setVelocity(80, 0); physics.update(frame * 1000 / 60, 1000 / 60); physics.postUpdate(); }

  assert.ok(body.right <= zone.body.left + 0.01, 'the detached Zone must still block the player');
  assert.equal(scene.sys.displayList.exists(zone), false);
});
