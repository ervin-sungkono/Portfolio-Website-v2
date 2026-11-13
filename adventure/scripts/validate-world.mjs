import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { townColliders, validCollisionProfile } from '../src/features/adventure/collisionModel.mjs';
import { tileSurface } from '../src/features/adventure/terrainModel.mjs';

const world = JSON.parse(readFileSync('src/content/world.json', 'utf8'));
const portfolio = JSON.parse(readFileSync('src/content/portfolio.json', 'utf8'));
const npcs = JSON.parse(readFileSync('src/content/npcs.json', 'utf8'));
const personal = JSON.parse(readFileSync('src/content/personal.json', 'utf8'));
const moments = JSON.parse(readFileSync('src/content/moments.json', 'utf8'));
const dialogues = JSON.parse(readFileSync('src/content/dialogues.json', 'utf8'));
const props = JSON.parse(readFileSync('src/content/props.json', 'utf8'));
const terrain = JSON.parse(readFileSync('art/town-redesign/runtime/terrain.json', 'utf8'));
const districts = JSON.parse(readFileSync('art/town-redesign/runtime/groups.json', 'utf8')).groups;
const animation = JSON.parse(readFileSync('art/animation-work/manifest.json', 'utf8'));
const mapSource = readFileSync('art/maps/town.tmj', 'utf8');
const map = JSON.parse(mapSource);
const errors = [];
const ids = new Set();
if (readFileSync('public/game/maps/town.json', 'utf8') !== mapSource) errors.push('Runtime map differs from the editable Tiled map; run node scripts/export-town-map.mjs');
if (map.orientation !== 'orthogonal' || map.tilewidth !== 32 || map.tileheight !== 32 || map.width * 32 !== world.width || map.height * 32 !== world.height) errors.push('Tiled map dimensions or orientation do not match the world');
const ground = map.layers.find(layer => layer.name === 'ground' && layer.type === 'tilelayer');
const edges = map.layers.find(layer => layer.name === 'ground-edges' && layer.type === 'tilelayer');
const water = map.layers.find(layer => layer.name === 'water' && layer.type === 'tilelayer');
const riverBanks = map.layers.find(layer => layer.name === 'river-banks' && layer.type === 'tilelayer');
const mapInteractions = map.layers.find(layer => layer.name === 'interactions' && layer.type === 'objectgroup')?.objects;
const mapObstacles = map.layers.find(layer => layer.name === 'collision' && layer.type === 'objectgroup')?.objects;
const mapDecorations = map.layers.find(layer => layer.name === 'decorations' && layer.type === 'objectgroup')?.objects;
const transitionIds = new Set(terrain.transitionFamilies.flatMap(family => family.tileIds));
if (!ground || ground.data.length !== map.width * map.height || ground.data.some(gid => !Number.isInteger(gid) || !tileSurface(gid))) errors.push('Invalid ground layer or tile ID');
if (!edges || edges.data.length !== map.width * map.height || edges.data.some(gid => !Number.isInteger(gid) || (gid !== 0 && !transitionIds.has(gid)))) errors.push('Invalid ground edge layer or tile ID');
if (!water || water.data.length !== map.width * map.height || water.data.some(gid => gid !== 0 && gid !== 49)) errors.push('Invalid river water layer');
if (!riverBanks || riverBanks.data.length !== map.width * map.height || riverBanks.data.some(gid => gid !== 0 && gid !== 50 && gid !== 51)) errors.push('Invalid river bank layer');
if (!Array.isArray(mapInteractions) || !Array.isArray(mapObstacles) || !Array.isArray(mapDecorations)) errors.push('Map needs interactions, collision and decorations object layers');
for (const [id, prop] of Object.entries(props)) {
  if (typeof prop.url !== 'string' || !prop.url.startsWith('/game/') || prop.url.includes('..') || !existsSync(join('public', prop.url)) || !Number.isFinite(prop.scale) || prop.scale <= 0 || !Number.isFinite(prop.originX) || !Number.isFinite(prop.originY)) errors.push(`Invalid or missing prop: ${id}`);
  if (!('collision' in prop) || (prop.collision !== null && !validCollisionProfile(prop.collision))) errors.push(`Invalid or missing prop collision profile: ${id}`);
  if (prop.collisionParts !== undefined && (!Array.isArray(prop.collisionParts) || prop.collisionParts.some(part => !validCollisionProfile(part)))) errors.push(`Invalid additional prop collision profile: ${id}`);
  if (prop.frameCount !== undefined) {
    if (![prop.frameCount, prop.frameWidth, prop.frameHeight].every(value => Number.isInteger(value) && value > 0) || !Number.isFinite(prop.frameRate) || prop.frameRate <= 0) errors.push(`Invalid prop animation: ${id}`);
    else if (existsSync(join('public', prop.url))) {
      const image = readFileSync(join('public', prop.url));
      if (image.readUInt32BE(16) !== prop.frameWidth * prop.frameCount || image.readUInt32BE(20) !== prop.frameHeight) errors.push(`Prop sheet dimensions differ from its frame layout: ${id}`);
    }
  }
}
for (const object of mapDecorations || []) {
  if (!props[object.name] || !Number.isFinite(object.x) || !Number.isFinite(object.y)) errors.push(`Unknown or invalid decoration: ${object.name}`);
}
for (const tileset of terrain.tilesets) {
  const path = join('public', tileset.path);
  if (!existsSync(path)) { errors.push(`Missing tileset: ${path}`); continue; }
  const image = readFileSync(path);
  if (image.toString('hex', 0, 8) !== '89504e470d0a1a0a' || image.readUInt32BE(16) !== tileset.imageWidth || image.readUInt32BE(20) !== tileset.imageHeight) errors.push(`Invalid tileset: ${path}`);
  const authored = map.tilesets.find(item => item.name === tileset.name);
  if (!authored || ['firstgid', 'tilecount', 'columns'].some(key => authored[key] !== tileset[key])) errors.push(`Tiled atlas differs from terrain metadata: ${tileset.name}`);
}
for (const [name, width, height] of [['male', 576, 512], ['female', 576, 512], ...[...new Set(npcs.map(npc => npc.sprite))].map(sprite => [`${sprite}-display`, 268, 90])]) {
  const path = `public/game/sheets/${name}.png`;
  if (!existsSync(path)) { errors.push(`Missing runtime sheet: ${name}`); continue; }
  const image = readFileSync(path);
  if (image.toString('hex', 0, 8) !== '89504e470d0a1a0a' || image.readUInt32BE(16) !== width || image.readUInt32BE(20) !== height) errors.push(`Invalid runtime sheet: ${name}`);
}
if (!existsSync('public/game/arcade/bird.png')) errors.push('Missing the Garden Glide bird sprite');
for (const pose of ['up', 'mid', 'down', 'dazed']) if (!existsSync(`public/game/arcade/bird-animation/${pose}.png`)) errors.push(`Missing Garden Glide bird pose: ${pose}`);
// Exercise the exact Phaser 4 Tiled parser without starting a browser or renderer.
globalThis.window = { devicePixelRatio: 1 };
globalThis.navigator ??= { userAgent: '', maxTouchPoints: 0 };
globalThis.importScripts = () => {};
const require = createRequire(import.meta.url);
const parseTiled = require('../node_modules/phaser/src/tilemaps/parsers/tiled/ParseJSONTiled.js');
const parsed = parseTiled('town', map, false);
if (!parsed || !['ground', 'ground-edges', 'water', 'river-banks'].every(name => parsed.layers.some(layer => layer.name === name)) || !terrain.tilesets.every(tileset => parsed.tilesets.some(item => item.name === tileset.name))) errors.push('Phaser could not parse the town ground, water, bank and edge layers');
const npcIds = new Set();
for (const npc of npcs) {
  if (npcIds.has(npc.id)) errors.push(`Duplicate NPC: ${npc.id}`);
  npcIds.add(npc.id);
  if (typeof npc.sprite !== 'string' || !/^[a-z0-9-]+$/.test(npc.sprite)) errors.push(`Invalid NPC sprite ID: ${npc.id}`);
  for (const frame of [0, 1, 2, 3]) if (!existsSync(`public/game/npcs/${npc.sprite}/idle-${frame}.png`)) errors.push(`Missing NPC idle frame: ${npc.id}/${frame}`);
  if (!Number.isFinite(npc.originY) || npc.originY < 0 || npc.originY > 1 || !Number.isFinite(npc.scale) || npc.scale <= 0) errors.push(`Invalid NPC origin or scale: ${npc.id}`);
  if (!validCollisionProfile(npc.collision)) errors.push(`Invalid NPC collision profile: ${npc.id}`);
  if (typeof npc.title !== 'string' || !npc.title.trim()) errors.push(`Missing NPC title: ${npc.id}`);
  const conversation = dialogues[npc.id];
  if (!conversation || !conversation.nodes?.[conversation.start]) { errors.push(`Missing dialogue start: ${npc.id}`); continue; }
  const seenNodes = new Set();
  const pendingNodes = [conversation.start];
  while (pendingNodes.length) {
    const id = pendingNodes.pop();
    if (seenNodes.has(id)) continue;
    seenNodes.add(id);
    const node = conversation.nodes[id];
    if (!node || typeof node.text !== 'string' || !node.text.trim() || !Array.isArray(node.options)) { errors.push(`Invalid dialogue node: ${npc.id}/${id}`); continue; }
    if (node.content && !['skills', 'hobbies'].includes(node.content)) errors.push(`Invalid dialogue content: ${npc.id}/${id}`);
    for (const option of node.options) {
      if (typeof option.label !== 'string' || !option.label.trim() || !conversation.nodes[option.next]) errors.push(`Invalid dialogue choice: ${npc.id}/${id}`);
      else pendingNodes.push(option.next);
      if (option.requires && option.requires !== 'hobbies') errors.push(`Invalid dialogue requirement: ${npc.id}/${id}`);
    }
  }
  for (const id of Object.keys(conversation.nodes)) if (!seenNodes.has(id)) errors.push(`Unreachable dialogue node: ${npc.id}/${id}`);
}
if (!Array.isArray(personal.hobbies) || personal.hobbies.some(hobby => typeof hobby !== 'string' || !hobby.trim())) errors.push('Hobbies must be non-empty strings');
if (!Array.isArray(moments.photos)) errors.push('Moments photos must be an array');
else for (const [index, photo] of moments.photos.entries()) {
  if (!photo || typeof photo.image !== 'string' || !photo.image.startsWith('/moments/') || photo.image.includes('..') || !existsSync(join('public', photo.image)) || ![photo.alt, photo.caption].every(text => typeof text === 'string' && text.trim()) || ['date', 'story'].some(key => photo[key] != null && typeof photo[key] !== 'string')) errors.push(`Invalid or missing Moments photo: ${index + 1}`);
}
for (const item of world.interactions) {
  if (ids.has(item.id)) errors.push(`Duplicate interaction: ${item.id}`);
  ids.add(item.id);
  if (!['project', 'collection', 'npc', 'contact', 'arcade', 'match', 'cafe', 'moments'].includes(item.kind)) errors.push(`Unknown interaction kind: ${item.kind}`);
  if (item.kind === 'moments' && (!Number.isInteger(item.photoIndex) || item.photoIndex < 0)) errors.push(`Invalid gallery frame index: ${item.id}`);
  if (![item.displayName, item.role].every(value => typeof value === 'string' && value.trim())) errors.push(`Missing name or role: ${item.id}`);
  if (item.kind === 'project' && !portfolio.projects.some(project => project.id === item.id)) errors.push(`Missing project content: ${item.id}`);
  if (item.kind === 'npc' && !npcs.some(npc => npc.id === item.id)) errors.push(`Missing NPC content: ${item.id}`);
}
const positions = (mapInteractions || []).map(object => {
  const definition = world.interactions.find(item => item.id === object.name && item.kind === object.type);
  if (!definition || !Number.isFinite(object.x) || !Number.isFinite(object.y)) { errors.push(`Unknown or invalid map interaction: ${object.name}`); return null; }
  return { ...definition, x: object.x, y: object.y };
}).filter(Boolean);
if (positions.length !== world.interactions.length || new Set(positions.map(item => item.id)).size !== world.interactions.length) errors.push('Map interaction IDs must match world definitions exactly');
let objectColliders = [];
try { objectColliders = townColliders(mapDecorations || [], mapInteractions || [], props, npcs); }
catch (error) { errors.push(`Invalid object collision: ${error.message}`); }
const districtParts = new Map();
for (const [groupId, group] of Object.entries(districts)) {
  const bases = (mapDecorations || []).filter(item => item.name === group.base.prop);
  if (bases.length !== 1) { errors.push(`District needs exactly one base marker: ${groupId}`); continue; }
  const scale = group.placementScale ?? 1;
  for (const part of group.parts) {
    if (districtParts.has(part.id)) errors.push(`Duplicate district part: ${part.id}`);
    districtParts.set(part.id, part);
    for (const foot of part.footcolliders ?? []) {
      const expected = {
        x: bases[0].x + (part.localAnchor.x + foot.offsetX - foot.width / 2) * scale,
        y: bases[0].y + (part.localAnchor.y + foot.offsetY - foot.height / 2) * scale,
        width: foot.width * scale, height: foot.height * scale,
      };
      if (!(mapObstacles || []).some(rect => rect.properties?.some(property => property.name === 'districtPart' && property.value === part.id) && ['x', 'y', 'width', 'height'].every(key => Math.abs(rect[key] - expected[key]) < 1e-6))) errors.push(`Missing or misplaced district foot collision: ${part.id}`);
    }
  }
}
for (const item of positions) {
  const point = mapInteractions.find(object => object.name === item.id);
  const partId = point.properties?.find(property => property.name === 'districtPart')?.value;
  if (partId !== undefined) {
    const part = districtParts.get(partId);
    if (!part || part.interactionId !== item.id || !part.footcolliders?.length || item.districtPart !== partId) errors.push(`Invalid interactive district part: ${item.id}`);
  } else if (!objectColliders.some(rect => rect.source === `interaction:${item.id}`)) errors.push(`Missing interaction collision: ${item.id}`);
}
for (const object of mapObstacles || []) {
  if (![object.x, object.y, object.width, object.height].every(Number.isFinite) || object.width <= 0 || object.height <= 0) errors.push(`Invalid hand-authored collision rectangle: ${object.id}`);
}
for (const project of portfolio.projects) {
  if (!ids.has(project.id) && !world.interactions.some(item => item.kind === 'collection')) errors.push(`Project has no world placement: ${project.id}`);
  if (!existsSync(join('public', project.cover))) errors.push(`Project cover missing: ${project.cover}`);
}
for (const variant of ['male', 'female']) {
  for (const direction of ['down', 'left', 'up', 'right']) {
    for (const name of [`idle-${direction}`, ...[0, 1, 2, 3].map(i => `walk-${direction}-${i}`)]) {
      if (!existsSync(`public/game/characters/${variant}/${name}.png`)) errors.push(`Missing character frame: ${variant}/${name}`);
    }
  }
  for (const name of ['blink-idle-down', 'blink-walk-down-1']) {
    if (!existsSync(`public/game/characters/${variant}/${name}.png`)) errors.push(`Missing blink frame: ${variant}/${name}`);
  }
}
for (const [path, expected] of Object.entries(animation.files)) {
  if (!existsSync(path)) { errors.push(`Missing animation file: ${path}`); continue; }
  if (createHash('sha256').update(readFileSync(path)).digest('hex') !== expected) errors.push(`Animation checksum mismatch: ${path}`);
}

// Conservative grid reachability check, allowing a 12-pixel player clearance.
const step = 16;
const cols = Math.floor(world.width / step), rows = Math.floor(world.height / step);
const allColliders = [...(mapObstacles || []), ...objectColliders];
const blocked = (x, y) => x < 48 || y < 48 || x > world.width - 48 || y > world.height - 48 ||
  allColliders.some(object => x > object.x - 12 && x < object.x + object.width + 12 && y > object.y - 12 && y < object.y + object.height + 12);
const start = [Math.round(world.spawn.x / step), Math.round(world.spawn.y / step)];
const queue = [start];
const seen = new Set([start.join(',')]);
for (let i = 0; i < queue.length; i++) {
  const [x, y] = queue[i];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + dx, ny = y + dy, key = `${nx},${ny}`;
    if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || seen.has(key) || blocked(nx * step, ny * step)) continue;
    seen.add(key); queue.push([nx, ny]);
  }
}
if (blocked(...[start[0] * step, start[1] * step])) errors.push('Spawn is blocked');
for (const item of positions) {
  if (!queue.some(([x, y]) => Math.hypot(x * step - item.x, y * step - item.y) < world.interactionRadius - 12)) {
    errors.push(`No reachable approach to ${item.id}`);
  }
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`World valid: Phaser parsed ${map.width}×${map.height} tiles; ${positions.length} reachable interactions, ${objectColliders.length} object-linked collision footprints, ${portfolio.projects.length} project records, character frames and covers present.`);
