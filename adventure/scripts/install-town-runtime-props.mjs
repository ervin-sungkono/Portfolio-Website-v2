import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

const read = path => JSON.parse(readFileSync(path, 'utf8'));
const props = read('src/content/props.json');
const runtime = read('art/town-redesign/runtime/runtime-props.json');
const districts = read('art/town-redesign/runtime/groups.json');
const footprints = {
  tree: { offsetX: 0, offsetY: -14, width: 42, height: 26 },
  fountain: { offsetX: 0, offsetY: -22, width: 132, height: 40 },
  willow: { offsetX: 0, offsetY: -10, width: 34, height: 18 },
  'blossom-tree': { offsetX: 0, offsetY: -11, width: 48, height: 22 },
  'waterside-planting': { offsetX: 0, offsetY: -12, width: 136, height: 24 },
  'raised-wall': { offsetX: 0, offsetY: -41, width: 240, height: 74 },
  'garden-corner': { offsetX: 0, offsetY: -44, width: 146, height: 80 },
};
for (const [id, style] of Object.entries(runtime.props)) {
  assert.ok(style.url.startsWith('/game/town-v2/'));
  const { url, originX, originY, scale, kind, displayMode, frameWidth, frameHeight, frameCount, frameRate, repeat } = style;
  props[id] = { url, originX, originY, scale, collision: footprints[id] ?? null, kind, displayMode,
    ...(frameCount > 1 ? { frameWidth, frameHeight, frameCount, frameRate, repeat } : {}) };
}
// A shorter, repeating retaining face aligns the river cap with the water boundary.
props['river-wall'] = { ...props['raised-wall'], scale: 0.75, collision: null };
for (const group of Object.values(districts.groups)) {
  for (const part of [group.base, ...group.parts]) {
    assert.ok(part.prop && part.url.startsWith('/game/town-v2/'));
    props[part.prop] = { url: part.url, originX: part.originX, originY: part.originY, scale: part.scale, collision: null };
  }
}
writeFileSync('src/content/props.json', JSON.stringify(props, null, 2) + '\n');
console.log(`Installed approved environment styles: ${Object.keys(runtime.props).length} props and ${Object.keys(districts.groups).length} layered districts.`);
