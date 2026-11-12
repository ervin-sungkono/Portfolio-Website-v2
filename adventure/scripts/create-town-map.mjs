// Rebuild the editable town map from authored world, terrain, and district metadata.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const world = JSON.parse(readFileSync('src/content/world.json', 'utf8'));
const terrain = JSON.parse(readFileSync('art/town-redesign/runtime/terrain.json', 'utf8'));
const { groups } = JSON.parse(readFileSync('art/town-redesign/runtime/groups.json', 'utf8'));
const tileSize = terrain.tileWidth, width = world.width / tileSize, height = world.height / tileSize;
if (!Number.isInteger(width) || !Number.isInteger(height)) throw new Error('World dimensions must be a multiple of 32');

const placements = {
  'photo-garden': { x: 1244, y: 430 },
  'cafe-patio': { x: 1620, y: 110 },
  'arcade-nook': { x: 250, y: 670 },
};
const scale = groupId => groups[groupId].placementScale ?? 1;
const interactionParts = new Map();
for (const [groupId, group] of Object.entries(groups)) for (const interaction of group.suggestedInteractions)
  interactionParts.set(interaction.id, { groupId, partId: interaction.partId, x: placements[groupId].x + interaction.x * scale(groupId), y: placements[groupId].y + interaction.y * scale(groupId), photoIndex: interaction.photoIndex });
for (const interaction of world.interactions) {
  const linked = interactionParts.get(interaction.id);
  if (!linked) continue;
  interaction.x = linked.x; interaction.y = linked.y; interaction.districtPart = linked.partId;
}
world.spawn = { x: 1196, y: 888 };
writeFileSync('src/content/world.json', JSON.stringify(world, null, 2) + '\n');

const walkways = [
  { id: 'west-street-to-arcade', surface: 'plaza', width: 128, minClearWidth: 96, points: [[210,492],[380,454],[570,430],[730,454],[840,520],[900,610],[860,660],[860,760],[760,840],[650,930],[650,1060],[418,1060],[418,1000],[418,945]] },
  { id: 'fountain-garden-passage', surface: 'plaza', width: 128, minClearWidth: 96, points: [[1196,528],[1196,930]] },
  { id: 'spawn-photo-garden-spur', surface: 'plaza', width: 128, classification: 'local', minClearWidth: 0, points: [[1336,920],[1336,862]] },
  { id: 'photo-garden-south-steps', surface: 'plaza', width: 128, classification: 'entrance', minClearWidth: 66, points: [[1334,920],[1334,862],[1334,820],[1334,780],[1334,744]] },
  { id: 'photo-garden-to-plaza', surface: 'plaza', width: 128, minClearWidth: 96, points: [[1336,930],[1196,930],[1060,900],[1000,860],[930,810]] },
  { id: 'photo-cafe-orchard-loop', surface: 'garden-path', width: 128, minClearWidth: 96, points: [[1336,930],[1580,930],[1800,930],[1872,930],[1872,850],[1872,760],[1872,650],[1872,464],[1788,464]] },
  { id: 'north-shop-street', surface: 'plaza', width: 128, minClearWidth: 96, points: [[900,610],[950,560],[1000,490],[1020,420],[1120,420],[1380,420],[1560,420],[1653,464],[1788,464]] },
  { id: 'cafe-stair-approach', surface: 'plaza', width: 128, classification: 'entrance', minClearWidth: 78, points: [[1788,464],[1788,410],[1788,350]] },
  { id: 'gallery-courtyard', surface: 'garden-path', width: 96, classification: 'local', minClearWidth: 0, points: [[1476.5,640],[1506.5,628.75],[1476.5,617.5],[1446.5,628.75],[1476.5,640]] },
  { id: 'arcade-cabinet-forecourt', surface: 'plaza', width: 128, classification: 'local', minClearWidth: 0, points: [[390,905],[444,889],[386,889],[426,905],[390,905]] },
  { id: 'riverside-promenade', surface: 'promenade', width: 128, minClearWidth: 96, points: [[280,1128],[560,1128],[780,1128],[1008,1128],[1420,1128],[1920,1128]] },
  { id: 'bridge-approach', surface: 'promenade', width: 96, minClearWidth: 96, points: [[1008,1128],[1008,1192],[1008,1264],[1008,1336],[1008,1400]] },
];
const nearSegment = (x, y, [ax, ay], [bx, by]) => {
  const dx = bx - ax, dy = by - ay, lengthSq = dx * dx + dy * dy;
  const t = lengthSq ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / lengthSq)) : 0;
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
};
const nearPath = (x, y, path, radius = path.width / 2) => path.points.slice(1).some((point, index) => nearSegment(x, y, path.points[index], point) <= radius);
const ellipse = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
const surfaceData = Object.fromEntries(terrain.surfaces.map(surface => [surface.id, surface.tileIds]));
const surfaceTile = (surface, x, y) => {
  const variants = surfaceData[surface];
  if (!variants) throw new Error(`Missing terrain surface ${surface}`);
  return variants[(y % 4) * 4 + (x % 4)];
};
// Forecourts meet the courtyard art instead of leaving single-tile grass ribbons.
const forecourts = [
  { surface: 'plaza', x: 896, y: 352, right: 1968, bottom: 528 },
  { surface: 'plaza', x: 896, y: 528, right: 1376, bottom: 944 },
  { surface: 'plaza', x: 256, y: 928, right: 576, bottom: 1056 },
];
const ground = [], water = [], riverBanks = [];
for (let ty = 0; ty < height; ty++) for (let tx = 0; tx < width; tx++) {
  const px = tx * tileSize + tileSize / 2, py = ty * tileSize + tileSize / 2;
  let surface = 'grass';
  if (ellipse(px, py, 1010, 700, 228, 190) || ellipse(px, py, 420, 920, 225, 145)) surface = 'plaza';
  for (const path of walkways) if (nearPath(px, py, path)) surface = path.surface;
  for (const court of forecourts) if (px >= court.x && px < court.right && py >= court.y && py < court.bottom) surface = court.surface;
  ground.push(surfaceTile(surface, tx, ty));
  const inRiver = py >= 1216 && py < 1312;
  water.push(inRiver && !(px >= 944 && px < 1072) ? 49 : 0);
  riverBanks.push(py === 1200 ? 50 : py === 1328 ? 51 : 0);
}

let objectId = 1;
const property = (name, value) => ({ name, type: typeof value === 'number' ? 'float' : typeof value === 'boolean' ? 'bool' : 'string', value });
const object = (name, type, x, y, extra = {}) => ({ id: objectId++, name, type, x, y, rotation: 0, visible: true, ...extra });
const props = [];
const addProp = (name, x, y, caption) => props.push(object(name, 'prop', x, y, { point: true, width: 0, height: 0, ...(caption ? { properties: [property('caption', caption)] } : {}) }));

const interactions = world.interactions.map(item => {
  const linked = interactionParts.get(item.id);
  return object(item.id, item.kind, item.x, item.y, { point: true, width: 0, height: 0,
    properties: [property('label', item.label), ...(item.prop ? [property('prop', item.prop)] : []), ...(item.districtPart ? [property('districtPart', item.districtPart)] : []), ...(Number.isInteger(item.photoIndex) ? [property('photoIndex', item.photoIndex)] : [])] });
});

// One base marker per grouped scene; the runtime adds its authored depth-sorted parts.
for (const [groupId, group] of Object.entries(groups)) addProp(group.base.prop, placements[groupId].x, placements[groupId].y);

addProp('workshop', 640, 260);
addProp('cafe', 1380, 290);
addProp('plaza-medallion', 1020, 646);
addProp('fountain', 1020, 720);
addProp('sign', 690, 350, 'WORKSHOP');
addProp('sign', 1420, 300, 'PARK GALLERY →');
addProp('flowerbed', 480, 330); addProp('flowerbed', 760, 330); addProp('flowerbed', 1050, 320); addProp('flowerbed', 1520, 330);
addProp('lantern', 850, 355); addProp('lantern', 1210, 320); addProp('bunting', 1290, 320); addProp('flowerpot', 1580, 365);
addProp('mailbox', 720, 1080);
addProp('willow', 580, 610);
addProp('blossom-tree', 680, 665);
addProp('garden-corner', 2040, 610);
addProp('raised-wall', 570, 750);
addProp('flowerbed', 620, 545); addProp('flower-bush', 715, 575); addProp('flowerpot', 540, 610);
addProp('flowerbed', 520, 700); addProp('flower-bush', 750, 690); addProp('lantern', 820, 610);
addProp('bench', 780, 720); addProp('flowerbed', 700, 650);
addProp('blossom-tree', 2010, 560); addProp('willow', 2020, 750);
addProp('flowerbed', 2040, 635); addProp('flowerbed', 2030, 780); addProp('flower-bush', 1980, 840);
addProp('raised-wall', 2040, 910); addProp('garden-corner', 2020, 980);
addProp('waterside-planting', 850, 1000); addProp('waterside-planting', 1450, 1040); addProp('waterside-planting', 1800, 1040);
addProp('bench', 650, 1380); addProp('bench', 1380, 1380);
addProp('lantern', 200, 1090); addProp('lantern', 880, 1040); addProp('lantern', 1200, 1020); addProp('lantern', 1600, 1080);
for (let x = 96; x < world.width; x += 192) addProp('river-wall', x, 1272);
addProp('river-waterfall', 840, 1312); addProp('stairs', 1008, 1200); addProp('river-bridge', 1008, 1264); addProp('stairs', 1008, 1472);
addProp('willow', 260, 1400); addProp('blossom-tree', 1900, 1430);
for (const [x, y] of [[110,140],[230,165],[350,135],[890,200],[1080,180],[1190,220],[1450,150],[2070,180],[2050,420],[125,860],[150,1000],[2050,1030],[160,1280],[430,1450],[820,1450],[1320,1470],[1700,1470],[2070,1400]]) addProp('tree', x, y);
for (const [x, y] of [[225,610],[320,580],[2030,620],[2040,700],[185,1170],[2050,1170],[880,1000],[1280,1030]]) addProp('flower-bush', x, y);
for (const [x, y] of [[170,730],[205,760],[180,1000],[220,1000],[1880,1060],[1990,1120],[1100,1450],[1240,1450]]) addProp('flowerbed', x, y);

const decorations = props;
const groupCollisions = [];
for (const [groupId, group] of Object.entries(groups)) {
  const { x: gx, y: gy } = placements[groupId], s = scale(groupId);
  for (const part of group.parts) for (const foot of part.footcolliders ?? []) {
    const cx = gx + (part.localAnchor.x + foot.offsetX) * s, cy = gy + (part.localAnchor.y + foot.offsetY) * s;
    groupCollisions.push(object(part.id, 'district-part-foot', cx - foot.width * s / 2, cy - foot.height * s / 2,
      { width: foot.width * s, height: foot.height * s, properties: [property('districtPart', part.id)] }));
  }
  for (const barrier of group.boundaryColliders ?? []) {
    const cx = gx + barrier.offsetX * s, cy = gy + barrier.offsetY * s;
    groupCollisions.push(object(barrier.id, 'district-boundary', cx - barrier.width * s / 2, cy - barrier.height * s / 2,
      { width: barrier.width * s, height: barrier.height * s, properties: [property('districtPart', barrier.id)] }));
  }
}
const collision = [
  object('river-west', 'water', 0, 1216, { width: 944, height: 96 }),
  object('river-east', 'water', 1072, 1216, { width: world.width - 1072, height: 96 }),
  object('bridge-west-rail', 'bridge-rail', 944, 1192, { width: 16, height: 144 }),
  object('bridge-east-rail', 'bridge-rail', 1056, 1192, { width: 16, height: 144 }),
  ...groupCollisions,
];

const walkwayObjects = walkways.map(path => object(path.id, 'main-walkway', 0, 0, {
  width: 0, height: 0, polyline: path.points.map(([x, y]) => ({ x, y })),
  properties: [property('widthPx', path.width), property('minClearWidth', path.minClearWidth ?? 96), property('surface', path.surface), property('classification', path.classification ?? 'primary')],
}));
const entranceObjects = [];
for (const [groupId, group] of Object.entries(groups)) for (const entrance of group.walkEntrances ?? []) {
  const s = scale(groupId), origin = placements[groupId];
  const x = origin.x + entrance.x * s, y = origin.y + entrance.y * s, w = entrance.width * s, h = entrance.height * s;
  const linkedIds = group.suggestedInteractions.map(item => item.id);
  entranceObjects.push(object(`${groupId}/${entrance.id}`, 'entrance', x, y, { width: w, height: h,
    properties: [property('groupId', groupId), property('approachFrom', entrance.approachFrom),
      property('classification', entrance.classification ?? 'primary'), property('worldClearWidth', entrance.worldClearWidth ?? entrance.minClearWidth * s),
      property('minClearWidth', entrance.classification === 'secondary' ? 0 : entrance.minClearWidth * s), property('interactionIds', linkedIds.join(',')),
      ...(linkedIds.length === 1 ? [property('interactionId', linkedIds[0])] : [])] }));
}

const map = {
  compressionlevel: -1, height, infinite: false, nextlayerid: 9, nextobjectid: objectId,
  orientation: 'orthogonal', renderorder: 'right-down', tiledversion: '1.11.0',
  tileheight: tileSize, tilewidth: tileSize, type: 'map', version: '1.10', width,
  layers: [
    { id: 1, name: 'ground', type: 'tilelayer', x: 0, y: 0, width, height, opacity: 1, visible: true, data: ground },
    { id: 2, name: 'interactions', type: 'objectgroup', draworder: 'topdown', x: 0, y: 0, opacity: 1, visible: true, objects: interactions },
    { id: 3, name: 'collision', type: 'objectgroup', draworder: 'topdown', x: 0, y: 0, opacity: 1, visible: true, objects: collision },
    { id: 4, name: 'decorations', type: 'objectgroup', draworder: 'topdown', x: 0, y: 0, opacity: 1, visible: true, objects: decorations },
    { id: 5, name: 'water', type: 'tilelayer', x: 0, y: 0, width, height, opacity: 1, visible: true, data: water },
    { id: 6, name: 'river-banks', type: 'tilelayer', x: 0, y: 0, width, height, opacity: 1, visible: true, data: riverBanks },
    { id: 7, name: 'main-walkways', type: 'objectgroup', draworder: 'topdown', x: 0, y: 0, opacity: 1, visible: true, objects: walkwayObjects },
    { id: 8, name: 'entrances', type: 'objectgroup', draworder: 'topdown', x: 0, y: 0, opacity: 1, visible: true, objects: entranceObjects },
  ],
  tilesets: [],
};
mkdirSync('art/maps', { recursive: true });
writeFileSync('art/maps/town.tmj', JSON.stringify(map, null, 2) + '\n');
console.log(`Created ${width}×${height} town map with ${interactions.length} linked interactions, ${walkwayObjects.length} walkway paths, and ${groupCollisions.length} district colliders.`);
await import('../art/terrain-polish/update-map.mjs');
