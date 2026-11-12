import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { colliderAt, townColliders, validCollisionProfile } from '../src/features/adventure/collisionModel.mjs';
import { isPavedTile, tileSurface } from '../src/features/adventure/terrainModel.mjs';

const read = path => JSON.parse(readFileSync(path, 'utf8'));
const map = read('public/game/maps/town.json');
const props = read('src/content/props.json');
const npcs = read('src/content/npcs.json');
const world = read('src/content/world.json');
const groups = read('art/town-redesign/runtime/groups.json').groups;
const objects = name => map.layers.find(layer => layer.name === name).objects;
const layer = name => map.layers.find(item => item.name === name);
const decorations = objects('decorations');
const interactions = objects('interactions');
const manual = objects('collision');
const generated = townColliders(decorations, interactions, props, npcs);
const colliders = [...generated, ...manual];
const property = (object, name) => object.properties?.find(item => item.name === name)?.value;

function groupPart(partId) {
  for (const [groupId, group] of Object.entries(groups)) {
    const part = group.parts.find(item => item.id === partId);
    if (part) return { groupId, group, part, base: decorations.find(item => item.name === group.base.prop) };
  }
  assert.fail(`missing group part ${partId}`);
}

function photoQuadBounds(interaction) {
  const { group, part, base } = groupPart(property(interaction, 'districtPart'));
  assert.ok(base, `missing rendered base for ${part.id}`);
  assert.ok(part.photoQuad?.length === 4, `${part.id} needs an authored photo quad`);
  const points = part.photoQuad.map(point => ({
    x: base.x + (part.localAnchor.x + point.x) * group.placementScale,
    y: base.y + (part.localAnchor.y + point.y) * group.placementScale,
  }));
  return { left: Math.min(...points.map(point => point.x)), right: Math.max(...points.map(point => point.x)), top: Math.min(...points.map(point => point.y)), bottom: Math.max(...points.map(point => point.y)) };
}

function groupFootRects(partId) {
  const { group, part, base } = groupPart(partId);
  assert.ok(base, `missing rendered base for ${partId}`);
  const scale = group.placementScale ?? 1;
  return (part.footcolliders ?? []).map(foot => {
    const centerX = base.x + (part.localAnchor.x + foot.offsetX) * scale;
    const centerY = base.y + (part.localAnchor.y + foot.offsetY) * scale;
    return { x: centerX - foot.width * scale / 2, y: centerY - foot.height * scale / 2, width: foot.width * scale, height: foot.height * scale };
  });
}

function groupBoundaryRects(groupId) {
  const group = groups[groupId];
  const base = decorations.find(item => item.name === group.base.prop);
  assert.ok(base, `missing rendered base for ${groupId}`);
  const scale = group.placementScale ?? 1;
  return (group.boundaryColliders ?? []).map(boundary => ({ id: boundary.id,
    x: base.x + (boundary.offsetX - boundary.width / 2) * scale,
    y: base.y + (boundary.offsetY - boundary.height / 2) * scale,
    width: boundary.width * scale, height: boundary.height * scale,
  }));
}

function sameRect(a, b) {
  return ['x', 'y', 'width', 'height'].every(key => Math.abs(a[key] - b[key]) < 1e-6);
}
globalThis.window = { devicePixelRatio: 1 };
globalThis.document = {};
globalThis.navigator ??= { userAgent: '', maxTouchPoints: 0 };
globalThis.importScripts = () => {};
const Phaser = (await import('phaser')).default;
const require = createRequire(import.meta.url);
const parseTiled = require('../node_modules/phaser/src/tilemaps/parsers/tiled/ParseJSONTiled.js');
const World = require('../node_modules/phaser/src/physics/arcade/World.js');
const Body = require('../node_modules/phaser/src/physics/arcade/Body.js');
const Zone = require('../node_modules/phaser/src/gameobjects/zone/Zone.js');

test('the phone view shows the separated fountain and garden entrance; all photos fit desktop', () => {
  const ground = layer('ground');
  const col = Math.floor(world.spawn.x / map.tilewidth), row = Math.floor(world.spawn.y / map.tileheight);
  assert.ok(isPavedTile(ground.data[row * map.width + col]), 'spawn should be on a paved plaza path');
  const mobile = { left: world.spawn.x - 160, right: world.spawn.x + 160, top: world.spawn.y - 240, bottom: world.spawn.y + 240 };
  const entrance = objects('entrances').find(item => item.name === 'photo-garden/southwest-steps');
  const entranceWidth = Math.min(mobile.right, entrance.x + entrance.width) - Math.max(mobile.left, entrance.x);
  assert.ok(entranceWidth >= 50 && entrance.y >= mobile.top && entrance.y + entrance.height <= mobile.bottom, 'the garden steps remain visible without squeezing the garden onto the fountain');

  const fountain = decorations.find(item => item.name === 'fountain');
  const style = props.fountain;
  const fountainBounds = {
    left: fountain.x - style.frameWidth * style.scale * style.originX,
    right: fountain.x + style.frameWidth * style.scale * (1 - style.originX),
    top: fountain.y - style.frameHeight * style.scale * style.originY,
    bottom: fountain.y + style.frameHeight * style.scale * (1 - style.originY),
  };
  const visibleWidth = Math.max(0, Math.min(mobile.right, fountainBounds.right) - Math.max(mobile.left, fountainBounds.left));
  const visibleHeight = Math.max(0, Math.min(mobile.bottom, fountainBounds.bottom) - Math.max(mobile.top, fountainBounds.top));
  assert.ok(visibleWidth >= 60 && visibleHeight >= 60, 'the phone crop retains a visible section of the fountain basin');

  const desktop = { left: world.spawn.x - 480, right: world.spawn.x + 480, top: world.spawn.y - 320, bottom: world.spawn.y + 320 };
  for (const frame of interactions.filter(item => item.type === 'moments')) {
    const quad = photoQuadBounds(frame);
    assert.ok(quad.left >= desktop.left && quad.right <= desktop.right && quad.top >= desktop.top && quad.bottom <= desktop.bottom, `${frame.name} should fit wholly in the 960×640 desktop spawn view`);
  }
});

test('solid decorations and interactions have blockers linked to their anchors', () => {
  const solidDecorations = decorations.filter(item => props[item.name]?.collision != null);
  const ordinaryInteractions = interactions.filter(item => !property(item, 'districtPart'));
  for (const object of [...solidDecorations, ...ordinaryInteractions]) {
    const collider = generated.find(item => item.sourceId === object.id);
    assert.ok(collider, `Missing collider for ${object.name} #${object.id}`);
    assert.ok(collider.width > 0 && collider.height > 0);
  }
  for (const name of ['workshop', 'fountain', 'bench']) assert.ok(generated.some(item => item.source === `decoration:${name}`));
  for (const name of ['background-guide', 'skills-guide']) assert.ok(generated.some(item => item.source === `interaction:${name}`));

  const districtParts = new Set(Object.values(groups).flatMap(group => group.parts.map(part => part.id)));
  const districtBoundaries = new Set(Object.values(groups).flatMap(group => (group.boundaryColliders ?? []).map(item => item.id)));
  for (const interaction of interactions.filter(item => property(item, 'districtPart'))) {
    const partId = property(interaction, 'districtPart');
    const { part } = groupPart(partId);
    assert.equal(part.interactionId, interaction.name, `${interaction.name} must point to its authored group part`);
    assert.ok(districtParts.has(partId), `missing group metadata for ${partId}`);
    assert.ok(groupFootRects(partId).length > 0, `${partId} needs a furniture footprint`);
    assert.equal(generated.some(item => item.source === `interaction:${interaction.name}`), false, `${interaction.name} must not also get a legacy blocker`);
  }
  const manualDistrict = manual.filter(item => property(item, 'districtPart'));
  for (const [partId, expected] of Object.entries(Object.fromEntries([...districtParts].map(id => [id, groupFootRects(id)])))) {
    const actual = manualDistrict.filter(item => property(item, 'districtPart') === partId);
    assert.equal(actual.length, expected.length, `${partId} Tiled footcolliders must match groups.json`);
    for (const rect of expected) assert.ok(actual.some(item => sameRect(item, rect)), `${partId} footcollider is misaligned`);
  }
  for (const groupId of Object.keys(groups)) {
    for (const expected of groupBoundaryRects(groupId)) {
      const actual = manualDistrict.filter(item => property(item, 'districtPart') === expected.id);
      assert.equal(actual.length, 1, `${expected.id} boundary must be exported once`);
      assert.ok(sameRect(actual[0], expected), `${expected.id} boundary is misaligned`);
    }
  }
  for (const item of manualDistrict) {
    const partId = property(item, 'districtPart');
    assert.ok(districtParts.has(partId) || districtBoundaries.has(partId), `unknown district collider ${partId}`);
  }
});

test('collision follows the object anchor and rejects invalid footprints', () => {
  const workshop = decorations.find(item => item.name === 'workshop');
  const original = colliderAt(workshop, props.workshop.collision, 'workshop');
  const moved = colliderAt({ ...workshop, x: workshop.x + 42, y: workshop.y - 17 }, props.workshop.collision, 'workshop');
  assert.equal(moved.x - original.x, 42); assert.equal(moved.y - original.y, -17);
  assert.equal(moved.width, original.width); assert.equal(moved.height, original.height);
  assert.equal(colliderAt(workshop, null, 'passable decoration'), null);
  assert.equal(validCollisionProfile({ offsetX: 0, offsetY: 0, width: -1, height: 4 }), false);
  assert.throws(() => colliderAt(workshop, { offsetX: 0, offsetY: 0, width: -1, height: 4 }, 'bad'));
});

test('Phaser parses the same object anchors used to generate collision', () => {
  const parsed = parseTiled('town', map, false);
  const layer = name => parsed.objects.find(item => item.name === name).objects;
  assert.deepEqual(townColliders(layer('decorations'), layer('interactions'), props, npcs), generated);
});

test('Phaser Arcade physics stops the player at buildings, props, NPCs, and grouped furniture feet', () => {
  const groupFoot = manual.find(item => property(item, 'districtPart') === 'photo-garden/easel-2');
  const outerWall = manual.find(item => property(item, 'districtPart') === 'photo-garden/west-outer-wall');
  assert.ok(groupFoot, 'gallery easel foot collider is exported from the group metadata');
  assert.ok(outerWall, 'gallery outer wall collider is exported from the group metadata');
  for (const source of ['decoration:workshop', 'decoration:bench', 'interaction:background-guide', 'photo-garden/easel-2', 'photo-garden/west-outer-wall']) {
    const rect = generated.find(item => item.source === source) ?? (source === 'photo-garden/easel-2' ? groupFoot : source === 'photo-garden/west-outer-wall' ? outerWall : manual.find(item => item.name === source));
    for (const side of ['left', 'right', 'above', 'below']) {
      const scene = { sys: { scale: { width: world.width, height: world.height }, queueDepthSort() {} } };
      const physics = new World(scene, {});
      const zone = new Zone(scene, rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width, rect.height);
      physics.enableBody(zone, 1); // Static Arcade body, as in the scene.
      assert.deepEqual([zone.body.x, zone.body.y, zone.body.width, zone.body.height], [rect.x, rect.y, rect.width, rect.height]);
      const player = new Body(physics);
      player.setSize(23.1, 16.5, false); // 42×30 body at the explorer's 0.55 scale.
      if (side === 'left' || side === 'right') {
        const dx = side === 'left' ? 3 : -3;
        player.position.set(side === 'left' ? rect.x - player.width + 1 : rect.x + rect.width - 1, rect.y - 2);
        player.prev.set(player.x - dx, player.y); player._dx = dx; player._dy = 0; player.velocity.set(Math.sign(dx) * 175, 0);
      } else {
        const dy = side === 'above' ? 3 : -3;
        player.position.set(rect.x + rect.width / 2 - player.width / 2, side === 'above' ? rect.y - player.height + 1 : rect.y + rect.height - 1);
        player.prev.set(player.x, player.y - dy); player._dx = 0; player._dy = dy; player.velocity.set(0, Math.sign(dy) * 175);
      }
      player.updateCenter();
      assert.equal(physics.separate(player, zone.body, undefined, undefined, false), true, `${source} did not collide from ${side}`);
      if (side === 'left') assert.ok(player.right <= rect.x + 0.001);
      if (side === 'right') assert.ok(player.x >= rect.x + rect.width - 0.001);
      if (side === 'above') assert.ok(player.bottom <= rect.y + 0.001);
      if (side === 'below') assert.ok(player.y >= rect.y + rect.height - 0.001);
    }
  }
});

test('the real Phaser loop blocks the photo easel and keeps the courtyard floor corridor open', () => {
  function simulate(x, y) {
    const scene = { sys: { scale: { width: world.width, height: world.height }, events: new Phaser.Events.EventEmitter(), queueDepthSort() {} } };
    const physics = new Phaser.Physics.Arcade.World(scene, { debug: false });
    physics.setBounds(36, 36, world.width - 72, world.height - 72);
    const player = { x, y, angle: 0, scaleX: 0.55, scaleY: 0.55, displayOriginX: 48, displayOriginY: 108.8, displayWidth: 52.8, displayHeight: 70.4, width: 96, height: 128 };
    const body = new Phaser.Physics.Arcade.Body(physics, player);
    player.body = body;
    body.setSize(42, 30, false).setOffset(27, 86); body.setCollideWorldBounds(true); physics.add(body);
    const hits = [];
    for (const rect of colliders) {
      const zone = new Phaser.GameObjects.Zone(scene, rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width, rect.height);
      physics.enableBody(zone, Phaser.Physics.Arcade.STATIC_BODY);
      physics.addCollider(player, zone, () => hits.push(rect));
    }
    for (let i = 0; i < 60; i++) { body.setVelocity(175, 0); physics.update(i * 1000 / 60, 1000 / 60); physics.postUpdate(); }
    return { player, body, hits };
  }
  const workshop = generated.find(rect => rect.source === 'decoration:workshop');
  assert.ok(workshop);
  const blocked = simulate(400, 180);
  assert.ok(blocked.hits.includes(workshop));
  assert.ok(Math.abs(blocked.body.right - workshop.x) < 0.001);

  const easelFoot = manual.find(item => property(item, 'districtPart') === 'photo-garden/easel-1');
  const garden = decorations.find(item => item.name === groups['photo-garden'].base.prop);
  const gardenScale = groups['photo-garden'].placementScale;
  assert.ok(easelFoot, 'the old route now meets the visible second-frame easel footprint');
  const easelBlocked = simulate(garden.x + 200 * gardenScale, garden.y + 294 * gardenScale);
  assert.ok(easelBlocked.hits.includes(easelFoot));
  assert.equal(easelBlocked.body.right, easelFoot.x, 'the player should stop at the authored furniture feet');

  const floorX = garden.x + 278 * gardenScale;
  const grass = simulate(floorX, garden.y + 280 * gardenScale);
  assert.ok(grass.player.x >= floorX + 174 && grass.player.x <= floorX + 176);
  assert.equal(grass.hits.length, 0);
});

test('visible water cells alone are blocked, while the rail-bounded bridge stays passable', () => {
  const water = layer('water');
  assert.ok(water, 'water layer is present');
  const waterRects = manual.filter(item => item.type === 'water');
  const rails = manual.filter(item => item.type === 'bridge-rail');
  assert.equal(waterRects.length, 2);
  assert.equal(rails.length, 2);
  for (let row = 0; row < map.height; row++) {
    for (let col = 0; col < map.width; col++) {
      const x = col * map.tilewidth + map.tilewidth / 2, y = row * map.tileheight + map.tileheight / 2;
      const visuallyWet = water.data[row * map.width + col] !== 0;
      const blockedByWater = waterRects.some(rect => x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height);
      assert.equal(blockedByWater, visuallyWet, `water collider coverage at tile ${col},${row}`);
    }
  }
  const decorationsByName = name => decorations.filter(item => item.name === name);
  const bridge = decorationsByName('river-bridge')[0];
  const bridgeStyle = props['river-bridge'];
  const bridgeWidth = readFileSync(`public${bridgeStyle.url}`).readUInt32BE(16) * bridgeStyle.scale;
  const bridgeHeight = readFileSync(`public${bridgeStyle.url}`).readUInt32BE(20) * bridgeStyle.scale;
  const bridgeLeft = bridge.x - bridgeWidth * bridgeStyle.originX, bridgeTop = bridge.y - bridgeHeight * bridgeStyle.originY;
  const westRail = rails.find(item => item.x < bridge.x), eastRail = rails.find(item => item.x > bridge.x);
  assert.ok(westRail && eastRail);
  assert.equal(westRail.x, bridgeLeft);
  assert.equal(eastRail.x + eastRail.width, bridgeLeft + bridgeWidth);
  assert.equal(westRail.y, bridgeTop);
  assert.equal(eastRail.y + eastRail.height, bridgeTop + bridgeHeight);
  assert.equal(waterRects.find(item => item.x < bridge.x).x + waterRects.find(item => item.x < bridge.x).width, westRail.x, 'west water stops at the visible bridge rail');
  assert.equal(waterRects.find(item => item.x > bridge.x).x, eastRail.x + eastRail.width, 'east water starts at the visible bridge rail');
  assert.equal(waterRects[0].y, waterRects[1].y);
  assert.equal(waterRects[0].height, waterRects[1].height);
  const barriers = [...waterRects, ...rails];
  function cross(x, y, direction) {
    const scene = { sys: { scale: { width: world.width, height: world.height }, events: new Phaser.Events.EventEmitter(), queueDepthSort() {} } };
    const physics = new Phaser.Physics.Arcade.World(scene, { debug: false });
    physics.setBounds(36, 36, world.width - 72, world.height - 72);
    const player = { x, y, angle: 0, scaleX: 0.55, scaleY: 0.55, displayOriginX: 48, displayOriginY: 108.8, displayWidth: 52.8, displayHeight: 70.4, width: 96, height: 128 };
    const body = new Phaser.Physics.Arcade.Body(physics, player);
    player.body = body;
    body.setSize(42, 30, false).setOffset(27, 86); body.setCollideWorldBounds(true); physics.add(body);
    for (const rect of barriers) {
      const zone = new Phaser.GameObjects.Zone(scene, rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width, rect.height);
      physics.enableBody(zone, Phaser.Physics.Arcade.STATIC_BODY);
      physics.addCollider(player, zone);
    }
    for (let frame = 0; frame < 80; frame++) { body.setVelocity(0, direction * 175); physics.update(frame * 1000 / 60, 1000 / 60); physics.postUpdate(); }
    return body;
  }
  for (const rect of waterRects) {
    const x = rect.x + rect.width / 2;
    assert.ok(cross(x, rect.y - 56, 1).bottom <= rect.y + 0.001, `water did not stop north approach at ${x}`);
    assert.ok(cross(x, rect.y + rect.height + 56, -1).y >= rect.y + rect.height - 0.001, `water did not stop south approach at ${x}`);
  }
  const bridgeX = (westRail.x + eastRail.x + eastRail.width) / 2;
  assert.ok(cross(bridgeX, waterRects[0].y - 56, 1).y > waterRects[0].y + waterRects[0].height, 'bridge should allow walking south across the stream');
  assert.ok(cross(bridgeX, waterRects[0].y + waterRects[0].height + 56, -1).bottom < waterRects[0].y, 'bridge should allow walking north across the stream');
});

test('the fountain passage and open grass remain reachable and all interactions are selectable', () => {
  const step = 8, columns = Math.floor(world.width / step), rows = Math.floor(world.height / step);
  const blocked = (x, y) => x < 48 || y < 48 || x > world.width - 48 || y > world.height - 48 ||
    colliders.some(rect => x > rect.x - 12 && x < rect.x + rect.width + 12 && y > rect.y - 12 && y < rect.y + rect.height + 12);
  const start = [Math.round(world.spawn.x / step), Math.round(world.spawn.y / step)];
  assert.equal(blocked(start[0] * step, start[1] * step), false, 'spawn is blocked');
  const queue = [start], visited = new Set([start.join(',')]);
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, id = `${nx},${ny}`;
      if (nx < 0 || ny < 0 || nx >= columns || ny >= rows || visited.has(id) || blocked(nx * step, ny * step)) continue;
      visited.add(id); queue.push([nx, ny]);
    }
  }
  for (const [x, y, expectedSurface] of [[1192, 648, 'plaza'], [128, 608, 'grass']]) {
    const tile = layer('ground').data[Math.floor(y / map.tileheight) * map.width + Math.floor(x / map.tilewidth)];
    assert.equal(tileSurface(tile), expectedSurface, `surface at ${x},${y}`);
    assert.equal(blocked(x, y), false, `ground at ${x},${y} is blocked`);
    assert.ok(visited.has(`${x / step},${y / step}`), `ground at ${x},${y} is not reachable`);
  }
  assert.equal(interactions.length, 10, 'the map should expose all ten authored interactions');
  for (const item of interactions) assert.ok(queue.some(([x, y]) => Math.hypot(x * step - item.x, y * step - item.y) < world.interactionRadius - 12), `${item.name} is unreachable`);
  for (const item of interactions) {
    assert.ok(queue.some(([x, y]) => {
      const px = x * step, py = y * step;
      const distance = Math.hypot(px - item.x, py - item.y);
      return distance < world.interactionRadius - 12 && interactions.every(other => other === item || distance < Math.hypot(px - other.x, py - other.y));
    }), `${item.name} cannot be selected without another interaction being nearer`);
  }
});

test('streets join the courtyard fronts without narrow grass seams', () => {
  const ground = layer('ground').data;
  for (const [x, y] of [[1312, 496], [1504, 496], [1728, 448], [1120, 880], [1136, 848], [416, 1008]]) {
    assert.ok(isPavedTile(ground[Math.floor(y / map.tileheight) * map.width + Math.floor(x / map.tilewidth)]), `the forecourt has a grass seam at ${x},${y}`);
  }
});

test('main streets and narrower stair approaches match the art and remain collider-clear', () => {
  const entrances = objects('entrances');
  const walkways = objects('main-walkways');
  const ground = layer('ground').data;
  const cell = (x, y) => ground[Math.floor(y / map.tileheight) * map.width + Math.floor(x / map.tilewidth)];
  const isBlocked = (x, y, clearance = 12) => colliders.some(rect => x > rect.x - clearance && x < rect.x + rect.width + clearance && y > rect.y - clearance && y < rect.y + rect.height + clearance);
  const byName = new Map(walkways.map(path => [path.name, path]));
  for (const path of walkways) {
    const widthPx = property(path, 'widthPx'), minimum = property(path, 'minClearWidth'), surface = property(path, 'surface');
    const classification = property(path, 'classification');
    assert.ok(Number.isFinite(widthPx) && widthPx > 0 && Number.isFinite(minimum) && minimum >= 0 && widthPx >= minimum, `${path.name} needs valid paved and clear-width metadata`);
    if (classification === 'local') assert.equal(minimum, 0, `${path.name} is a local visitor/resident circuit, not a primary 96px route`);
    else if (classification === 'entrance') assert.ok(minimum >= 48, `${path.name} must pass the explorer through the drawn stairs`);
    else assert.ok(minimum >= 96, `${path.name} must promise a 96px clear path`);
    assert.ok(['plaza', 'garden-path', 'promenade'].includes(surface), `${path.name} needs a named paved surface`);
    for (let index = 1; index < path.polyline.length; index++) {
      const from = path.polyline[index - 1], to = path.polyline[index];
      const dx = to.x - from.x, dy = to.y - from.y, length = Math.hypot(dx, dy), steps = Math.ceil(length / 8);
      const nx = length ? -dy / length : 0, ny = length ? dx / length : 0;
      for (let step = 0; step <= steps; step++) {
        const t = step / steps, x = from.x + dx * t, y = from.y + dy * t;
        assert.ok(isPavedTile(cell(x, y)), `${path.name} left paved ground at ${x},${y}`);
        if (['gallery-courtyard', 'arcade-cabinet-forecourt'].includes(path.name)) assert.equal(tileSurface(cell(x, y)), surface, `${path.name} lost its authored ${surface} paving`);
        assert.equal(layer('water').data[Math.floor(y / map.tileheight) * map.width + Math.floor(x / map.tilewidth)], 0, `${path.name} crosses water`);
        assert.ok(!isBlocked(x, y), `${path.name} centerline hits a collider at ${x},${y}`);
        if (minimum > 0) {
          const edgeOffset = minimum / 2 - 12;
          for (const side of [-1, 1]) {
            const edgeX = x + nx * edgeOffset * side, edgeY = y + ny * edgeOffset * side;
            assert.ok(isPavedTile(cell(edgeX, edgeY)), `${path.name} does not maintain its clear width across paving`);
            assert.ok(!isBlocked(edgeX, edgeY), `${path.name} has less than ${minimum}px of physical clearance at ${edgeX},${edgeY}`);
          }
        }
      }
    }
  }
  for (const name of ['gallery-courtyard', 'arcade-cabinet-forecourt']) assert.ok(byName.has(name), `missing semantic route ${name}`);

  const expected = Object.values(groups).flatMap(group => group.walkEntrances.map(entrance => ({ group, entrance })));
  assert.equal(entrances.length, expected.length);
  for (const { group, entrance } of expected) {
    const groupId = Object.keys(groups).find(id => groups[id] === group);
    const object = entrances.find(item => item.name === `${groupId}/${entrance.id}`);
    assert.ok(object, `missing entrance ${entrance.id}`);
    const base = decorations.find(item => item.name === group.base.prop), scale = group.placementScale ?? 1;
    assert.equal(object.x, base.x + entrance.x * scale);
    assert.equal(object.y, base.y + entrance.y * scale);
    assert.equal(object.width, entrance.width * scale);
    assert.equal(object.height, entrance.height * scale);
    assert.equal(property(object, 'groupId'), groupId);
    if (property(object, 'classification') === 'primary') {
      assert.equal(property(object, 'minClearWidth'), entrance.minClearWidth * scale);
      assert.ok(property(object, 'minClearWidth') >= 48 && property(object, 'worldClearWidth') >= property(object, 'minClearWidth'), `${object.name} must pass the explorer inside its visible stair opening`);
      assert.ok(walkways.some(path => path.polyline.some(point => point.x >= object.x && point.x <= object.x + object.width && point.y >= object.y && point.y <= object.y + object.height)), `${object.name} is disconnected from the main path network`);
    } else {
      assert.equal(property(object, 'classification'), 'secondary');
      assert.ok(property(object, 'worldClearWidth') >= 23.1 + 16, `${object.name} must pass the player body with margin`);
      assert.ok(!walkways.some(path => path.polyline.slice(1).some((point, index) => {
        const from = path.polyline[index], to = point, steps = Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 8);
        return Array.from({ length: steps + 1 }, (_, sample) => sample / steps).some(t => {
          const x = from.x + (to.x - from.x) * t, y = from.y + (to.y - from.y) * t;
          return x >= object.x && x <= object.x + object.width && y >= object.y && y <= object.y + object.height;
        });
      })), 'the secondary arch must not be used as a primary route');
    }
  }
});
