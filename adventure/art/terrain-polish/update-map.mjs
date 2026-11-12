// Refresh transition overlays in the editable Tiled map from its ground surfaces.
import { readFileSync, writeFileSync } from 'node:fs';
import { isPavedTile, tileSurface } from '../../src/features/adventure/terrainModel.mjs';

const path = 'art/maps/town.tmj';
const map = JSON.parse(readFileSync(path, 'utf8'));
const terrain = JSON.parse(readFileSync('art/town-redesign/runtime/terrain.json', 'utf8'));
const ground = map.layers.find(layer => layer.name === 'ground' && layer.type === 'tilelayer');
if (!ground || ground.width !== map.width || ground.height !== map.height || ground.data.length !== map.width * map.height)
  throw new Error('Expected a complete ground layer on the town grid');
if (!terrain.transitionFamilies?.length || !terrain.transitionPlacement?.variants?.length)
  throw new Error('Town terrain metadata is missing transition families');

const requiredTilesets = new Map(terrain.tilesets.map(item => [item.name, item]));
for (const item of terrain.tilesets) {
  const existing = map.tilesets.find(tileset => tileset.name === item.name);
  if (existing && existing.firstgid !== item.firstgid) throw new Error(`Unexpected ${item.name} firstgid`);
  if (!existing && map.tilesets.some(tileset => tileset.firstgid >= item.firstgid && tileset.firstgid < item.firstgid + item.tilecount))
    throw new Error(`Tile IDs for ${item.name} overlap an existing tileset`);
}
const tiledTilesets = terrain.tilesets.map(item => ({
  firstgid: item.firstgid,
  name: item.name,
  tilewidth: terrain.tileWidth,
  tileheight: terrain.tileHeight,
  tilecount: item.tilecount,
  columns: item.columns,
  margin: 0,
  spacing: 0,
  image: `../../public${item.path}`,
  imagewidth: item.imageWidth,
  imageheight: item.imageHeight,
}));
const knownNames = new Set(requiredTilesets.keys());
map.tilesets = [...tiledTilesets, ...map.tilesets.filter(item => !knownNames.has(item.name))].sort((a, b) => a.firstgid - b.firstgid);

const directions = [
  { id: 'north', dx: 0, dy: -1, variant: 'north-edge' },
  { id: 'east', dx: 1, dy: 0, variant: 'east-edge' },
  { id: 'south', dx: 0, dy: 1, variant: 'south-edge' },
  { id: 'west', dx: -1, dy: 0, variant: 'west-edge' },
];
const corners = [
  { directions: ['north', 'west'], variant: 'northwest-corner' },
  { directions: ['north', 'east'], variant: 'northeast-corner' },
  { directions: ['south', 'west'], variant: 'southwest-corner' },
  { directions: ['south', 'east'], variant: 'southeast-corner' },
];
const variantIndex = new Map(terrain.transitionPlacement.variants.map((name, index) => [name, index]));
const familyIndex = new Map(terrain.transitionFamilies.map(family => [`${family.baseSurface}:${family.overlaySurface}`, family]));
const preferredMaterials = terrain.transitionPlacement.materialPriority;
const surfaceAt = (x, y) => x < 0 || y < 0 || x >= map.width || y >= map.height
  ? null
  : tileSurface(ground.data[y * map.width + x]);
const transitions = Array(map.width * map.height).fill(0);

for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
  const base = surfaceAt(x, y);
  if (!base) continue;
  const neighbors = directions.map(direction => ({ ...direction, surface: surfaceAt(x + direction.dx, y + direction.dy) }));
  const counts = new Map();
  for (const neighbor of neighbors) if (neighbor.surface && neighbor.surface !== base)
    counts.set(neighbor.surface, (counts.get(neighbor.surface) ?? 0) + 1);
  if (!counts.size) continue;

  const overlay = [...counts.keys()].sort((a, b) => counts.get(b) - counts.get(a) || preferredMaterials.indexOf(a) - preferredMaterials.indexOf(b))[0];
  const matching = neighbors.filter(neighbor => neighbor.surface === overlay).map(neighbor => neighbor.id);
  const corner = corners.find(item => item.directions.every(direction => matching.includes(direction)));
  const variant = corner?.variant ?? neighbors.find(neighbor => matching.includes(neighbor.id))?.variant;
  const family = familyIndex.get(`${base}:${overlay}`);
  const index = variantIndex.get(variant);
  if (!family || !Number.isInteger(index) || family.tileIds.length !== terrain.transitionPlacement.variants.length)
    throw new Error(`Missing transition for ${base} to ${overlay} (${variant})`);
  transitions[y * map.width + x] = family.tileIds[index];
}

let layer = map.layers.find(item => item.name === 'ground-edges');
if (!layer) {
  layer = { id: map.nextlayerid++, name: 'ground-edges', type: 'tilelayer', x: 0, y: 0,
    width: map.width, height: map.height, opacity: 1, visible: true, data: transitions };
  map.layers.splice(map.layers.indexOf(ground) + 1, 0, layer);
} else {
  if (layer.type !== 'tilelayer') throw new Error('ground-edges already exists and is not a tile layer');
  layer.width = map.width;
  layer.height = map.height;
  layer.data = transitions;
}
if (transitions.some(gid => gid !== 0 && (gid < 84 || gid > 179))) throw new Error('Invalid transition tile ID');
if (ground.data.some(gid => !isPavedTile(gid) && tileSurface(gid) !== 'grass')) throw new Error('Unknown ground surface tile ID');

writeFileSync(path, JSON.stringify(map, null, 2) + '\n');
console.log(`Updated terrain transitions: ${transitions.filter(Boolean).length} overlays on ${map.width}×${map.height} map.`);
