import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isPavedTile } from '../src/features/adventure/terrainModel.mjs';

const source = readFileSync('art/maps/town.tmj', 'utf8');
const map = JSON.parse(source);
const layer = map.layers?.find(item => item.name === 'ground' && item.type === 'tilelayer');
if (map.orientation !== 'orthogonal' || map.tilewidth !== 32 || map.tileheight !== 32 ||
    !layer || layer.data?.length !== map.width * map.height ||
    !map.tilesets?.some(tileset => tileset.name === 'town')) {
  throw new Error('Invalid town map: expected orthogonal 32px tiles, a complete ground layer and the town tileset.');
}
mkdirSync('public/game/maps', { recursive: true });
writeFileSync('public/game/maps/town.json', source);
console.log(`Exported ${map.width}×${map.height} Tiled map.`);

// Build a small overview from the same Tiled layers used by the game.
const features = map.layers.find(item => item.name === 'interactions')?.objects ?? [];
const decorations = map.layers.find(item => item.name === 'decorations')?.objects ?? [];
const props = JSON.parse(readFileSync('src/content/props.json', 'utf8'));
const width = map.width * map.tilewidth, height = map.height * map.tileheight;
const routes = [];
for (let y = 0; y < map.height; y++) {
  let start = -1;
  for (let x = 0; x <= map.width; x++) {
    const gid = x < map.width ? layer.data[y * map.width + x] : 0;
    const paved = isPavedTile(gid);
    if (paved && start < 0) start = x;
    if (!paved && start >= 0) {
      routes.push(`M${start * map.tilewidth} ${y * map.tileheight}h${(x - start) * map.tilewidth}v${map.tileheight}h-${(x - start) * map.tilewidth}z`);
      start = -1;
    }
  }
}
const buildings = decorations.filter(item => ['workshop', 'cafe'].includes(item.name)).map(item => {
  const bounds = props[item.name]?.collision;
  if (!bounds) return '';
  return `<rect x="${item.x - bounds.width / 2}" y="${item.y - 100}" width="${bounds.width}" height="${100 + bounds.offsetY + bounds.height / 2}" rx="14"/>`;
}).join('');
const waterLayer = map.layers.find(item => item.name === 'water' && item.type === 'tilelayer');
const water = [];
if (waterLayer) for (let y = 0; y < map.height; y++) {
  let start = -1;
  for (let x = 0; x <= map.width; x++) {
    const isWater = x < map.width && waterLayer.data[y * map.width + x] !== 0;
    if (isWater && start < 0) start = x;
    if (!isWater && start >= 0) {
      water.push(`M${start * map.tilewidth} ${y * map.tileheight}h${(x - start) * map.tilewidth}v${map.tileheight}h-${(x - start) * map.tilewidth}z`);
      start = -1;
    }
  }
}
const bridges = decorations.filter(item => item.name === 'river-bridge').map(item => `<rect x="${item.x - 64}" y="${item.y - 72}" width="128" height="144" rx="8"/>`).join('');
const places = features.map(item => `<circle cx="${item.x}" cy="${item.y}" r="25"/>`).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#a6c58c"/><path d="${routes.join('')}" fill="#efd3a6"/><path d="${water.join('')}" fill="#58b9b5"/><g fill="#bf9365">${bridges}</g><g fill="#b17959" stroke="#f8e6c6" stroke-width="12">${buildings}</g><g fill="#e4a748" stroke="#fff9e5" stroke-width="14">${places}</g></svg>\n`;
writeFileSync('public/game/maps/town-minimap.svg', svg);
console.log('Exported town minimap from the same map layers.');
