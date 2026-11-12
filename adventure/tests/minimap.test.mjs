import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isPavedTile } from '../src/features/adventure/terrainModel.mjs';

const map = JSON.parse(readFileSync('public/game/maps/town.json', 'utf8'));
const svg = readFileSync('public/game/maps/town-minimap.svg', 'utf8');

test('the minimap roads match every paved tile in the actual town', () => {
  const ground = map.layers.find(layer => layer.name === 'ground').data;
  const path = svg.match(/<path d="([^"]*)"/)?.[1];
  assert.ok(path, 'minimap has a road path');
  const drawn = new Set();
  for (const match of path.matchAll(/M(\d+) (\d+)h(\d+)v(\d+)h-\d+z/g)) {
    const [, x, y, width, height] = match.map(Number);
    assert.equal(height, map.tileheight);
    for (let px = x; px < x + width; px += map.tilewidth) drawn.add(`${px},${y}`);
  }
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
    const gid = ground[y * map.width + x];
    assert.equal(drawn.has(`${x * map.tilewidth},${y * map.tileheight}`), isPavedTile(gid), `tile ${x},${y}`);
  }
});

test('every interactable is marked at its actual map position', () => {
  const interactions = map.layers.find(layer => layer.name === 'interactions').objects;
  for (const item of interactions) assert.ok(svg.includes(`<circle cx="${item.x}" cy="${item.y}"`), item.name);
});

test('the minimap shows the river and the bridge at their map positions', () => {
  const water = map.layers.find(layer => layer.name === 'water');
  const paths = [...svg.matchAll(/<path d="([^"]*)"/g)].map(match => match[1]);
  assert.ok(water && paths[1], 'water layer and minimap path exist');
  const drawn = new Set();
  for (const match of paths[1].matchAll(/M(\d+) (\d+)h(\d+)v(\d+)h-\d+z/g)) {
    const [, x, y, width] = match.map(Number);
    for (let px = x; px < x + width; px += map.tilewidth) drawn.add(`${px},${y}`);
  }
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
    assert.equal(drawn.has(`${x * map.tilewidth},${y * map.tileheight}`), water.data[y * map.width + x] !== 0, `water tile ${x},${y}`);
  }
  const bridge = map.layers.find(layer => layer.name === 'decorations').objects.find(item => item.name === 'river-bridge');
  assert.ok(bridge);
  assert.ok(svg.includes(`<rect x="${bridge.x - 64}" y="${bridge.y - 72}" width="128" height="144"`));
});
