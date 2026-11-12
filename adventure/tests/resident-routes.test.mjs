import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { townColliders } from '../src/features/adventure/collisionModel.mjs';
import { isPavedTile } from '../src/features/adventure/terrainModel.mjs';

const read = path => JSON.parse(readFileSync(path, 'utf8'));
const residents = read('src/content/residents.json');
const map = read('public/game/maps/town.json');
const groups = read('art/town-redesign/runtime/groups.json').groups;
const props = read('src/content/props.json');
const layer = name => map.layers.find(item => item.name === name);
const objects = name => layer(name).objects;
const colliders = [
  ...townColliders(objects('decorations'), objects('interactions'), props, read('src/content/npcs.json')),
  ...objects('collision'),
];

function landmark(id) {
  return objects('interactions').find(object => object.name === id);
}

function closeToLandmark(point, id, maximumDistance) {
  const object = landmark(id);
  assert.ok(object, `missing map landmark ${id}`);
  assert.ok(Math.hypot(point.x - object.x, point.y - object.y) <= maximumDistance, `${id} is too far from ${point.x},${point.y}`);
}

function partFootCenter(partId) {
  for (const [groupId, group] of Object.entries(groups)) {
    const part = group.parts.find(item => item.id === partId);
    if (!part) continue;
    const base = objects('decorations').find(item => item.name === group.base.prop);
    assert.ok(base, `missing rendered group ${groupId}`);
    const foot = part.footcolliders?.[0];
    assert.ok(foot, `${partId} needs a foot collider`);
    const scale = group.placementScale ?? 1;
    return {
      x: base.x + (part.localAnchor.x + foot.offsetX) * scale,
      y: base.y + (part.localAnchor.y + foot.offsetY) * scale,
    };
  }
  assert.fail(`missing group part ${partId}`);
}

test('resident trips follow the paved paths and stay clear of water and town obstacles', () => {
  const ground = layer('ground').data;
  const water = layer('water').data;

  for (const resident of residents.filter(item => item.mode === 'walk')) {
    assert.ok(resident.route?.length, `${resident.id} needs authored route points`);
    const points = [{ x: resident.x, y: resident.y }, ...resident.route, { x: resident.x, y: resident.y }];
    for (let index = 0; index < points.length - 1; index++) {
      const from = points[index], to = points[index + 1];
      const dx = to.x - from.x, dy = to.y - from.y;
      assert.notEqual(dx, 0, `${resident.id} should not slide vertically in side-facing art`);
      assert.ok(Math.abs(dy) <= Math.abs(dx) * 0.4, `${resident.id} has a steep side-facing leg: ${JSON.stringify({ from, to })}`);

      const samples = Math.ceil(Math.hypot(dx, dy) / 8);
      for (let step = 0; step <= samples; step++) {
        const progress = step / samples;
        const x = from.x + dx * progress, y = from.y + dy * progress;
        const cell = Math.floor(y / 32) * map.width + Math.floor(x / 32);
        assert.ok(isPavedTile(ground[cell]), `${resident.id} leaves the paved route at ${x},${y} (GID ${ground[cell]})`);
        assert.equal(water[cell], 0, `${resident.id} enters water at ${x},${y}`);
        const obstacle = colliders.find(rect => x > rect.x - 14 && x < rect.x + rect.width + 14 && y > rect.y - 14 && y < rect.y + rect.height + 14);
        assert.ok(!obstacle, `${resident.id} intersects ${obstacle?.source} at ${x},${y}`);
      }
    }
  }
});

test('walker circuits visit their authored moments, bench, and arcade landmarks', () => {
  const artist = residents.find(item => item.id === 'artist');
  const traveler = residents.find(item => item.id === 'traveler');
  const artistStops = artist.route.filter(point => point.pauseMs);
  const travelerStops = traveler.route.filter(point => point.pauseMs);

  assert.equal(artistStops.length, 2);
  closeToLandmark(artistStops[0], 'moments-frame-2', 64);
  assert.ok(Math.hypot(artistStops[1].x - partFootCenter('photo-garden/bench-west').x, artistStops[1].y - partFootCenter('photo-garden/bench-west').y) <= 72);
  assert.equal(artistStops[0].face, 'right');
  assert.equal(artistStops[1].face, 'left');

  assert.equal(travelerStops.length, 2);
  closeToLandmark(travelerStops[0], 'garden-arcade', 64);
  closeToLandmark(travelerStops[1], 'market-match', 64);
  assert.equal(traveler.route.at(-1).pauseMs, undefined, 'the open forecourt waypoint should not stop the traveler');
});
