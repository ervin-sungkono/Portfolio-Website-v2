import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decorationDepth, districtBaseDepth, districtPartLayout, districtPhotoDepth, nameplateLayout, RIVER_BANK_DEPTH, RIVER_SURFACE_DEPTH } from '../src/features/adventure/worldLayering.mjs';
import { propTextureKeys } from '../src/features/adventure/propTextureKeys.mjs';

const read = path => JSON.parse(readFileSync(path, 'utf8'));
const map = read('public/game/maps/town.json');
const world = read('src/content/world.json');
const props = read('src/content/props.json');
const districts = read('art/town-redesign/runtime/groups.json').groups;
const decorations = map.layers.find(layer => layer.name === 'decorations').objects;
const interactions = map.layers.find(layer => layer.name === 'interactions').objects;

test('district markers resolve to shared prop textures and interactive parts use those same visuals', () => {
  for (const [groupId, group] of Object.entries(districts)) {
    const markers = decorations.filter(object => object.name === group.base.prop);
    assert.equal(markers.length, 1, `${groupId} has one base marker named by its base prop`);
    assert.equal(props[group.base.prop]?.url, group.base.url);
    for (const part of group.parts) assert.equal(props[part.prop]?.url, part.url, `${part.id} shares its prop texture`);
    for (const part of group.parts.filter(part => part.interactionId)) {
      const targets = interactions.filter(object => object.name === part.interactionId);
      assert.equal(targets.length, 1, `${part.id} has one map interaction`);
      assert.equal(targets[0].properties?.find(property => property.name === 'districtPart')?.value, part.id, `${part.id} is the interaction's render target`);
    }
  }
});

test('prop profiles with the same image and frame layout reuse one Phaser texture key', () => {
  const keys = propTextureKeys(props);
  const distinctSources = new Set(Object.values(props).map(style => JSON.stringify([style.url, style.frameWidth ?? null, style.frameHeight ?? null, style.frameCount ?? null])));
  assert.equal(new Set(Object.values(keys)).size, distinctSources.size);
  assert.equal(keys['river-wall'], keys['raised-wall']);
});

test('district canopy depth sorts actors behind and in front at its feet', () => {
  const group = districts['arcade-nook'];
  const marker = decorations.find(object => object.name === group.base.prop);
  const canopy = group.parts.find(part => part.id === 'arcade-nook/canopy');
  assert.ok(marker && canopy);
  const layout = districtPartLayout(marker.x, marker.y, group.placementScale, canopy);
  const visualTop = marker.y + canopy.localAnchor.y * group.placementScale;
  const visualBottom = visualTop + canopy.height * layout.scale;
  assert.ok(layout.depth > visualTop, 'the canopy covers explorers behind its upper half');
  assert.ok(layout.depth < visualBottom, 'explorers past the canopy feet render in front');
  assert.equal(decorationDepth('river-bridge', 1264, 144, 0.5), 1, 'the bridge deck stays below a walking explorer');
  assert.equal(decorationDepth('stairs', 1264, 144, 1), 1, 'walkable v2 stairs stay below a walking explorer');
});

test('nameplates clear the subject and remain above the explorer anywhere in town', () => {
  for (const top of [90, 333, 750, 1400]) {
    const plate = nameplateLayout(top, world.height);
    assert.ok(plate.y + 32 <= top - 8, 'the whole plate sits above the visual bounds');
    assert.ok(plate.depth > world.height, 'the plate remains in front of the explorer at the south edge');
  }
  const wrapped = nameplateLayout(333, world.height, 48);
  assert.ok(wrapped.y + 48 <= 333 - 8, 'a taller wrapped nameplate still clears the subject');
});

test('district floors stay under actors while cropped parts and photo windows share scaled anchors', () => {
  const part = { localAnchor: { x: 48, y: 96 }, depthAnchorY: 132, scale: 1 };
  const layout = districtPartLayout(400, 250, 0.75, part);
  assert.equal(districtBaseDepth(), 1);
  assert.ok(decorationDepth('plaza-medallion', 646, 256, 0.5) < districtBaseDepth(), 'the fountain paving cannot paint over the garden landing');
  assert.deepEqual(layout, { x: 436, y: 322, depth: 349, scale: 0.75 });
  assert.equal(districtPhotoDepth(layout.depth), layout.depth - 0.01);
  assert.ok(RIVER_SURFACE_DEPTH < RIVER_BANK_DEPTH && RIVER_BANK_DEPTH < districtBaseDepth());
});

test('district metadata keeps unique interactive parts and photo quads inside their crop', () => {
  const ids = new Set();
  for (const [groupId, group] of Object.entries(districts)) {
    assert.ok(group.placementScale > 0);
    assert.equal(props[group.base.prop]?.url, group.base.url, `${groupId} base uses its shared prop texture`);
    for (const part of group.parts) {
      assert.ok(part.id.startsWith(`${groupId}/`), `${part.id} is namespaced to its group`);
      assert.equal(ids.has(part.id), false, `${part.id} is unique`);
      ids.add(part.id);
      assert.equal(props[part.prop]?.url, part.url, `${part.id} uses its shared prop texture`);
      assert.ok(part.localAnchor.x >= 0 && part.localAnchor.y >= 0, `${part.id} starts inside its base`);
      assert.ok(part.localAnchor.x + part.width <= group.nativeSize.width && part.localAnchor.y + part.height <= group.nativeSize.height, `${part.id} crop stays within its base`);
      if (part.interactionId) assert.ok(world.interactions.some(item => item.id === part.interactionId), `${part.id} links to a world interaction`);
      for (const collider of part.footcolliders ?? []) {
        assert.ok(collider.offsetX - collider.width / 2 >= 0 && collider.offsetX + collider.width / 2 <= part.width, `${part.id} collider fits horizontally`);
        assert.ok(collider.offsetY - collider.height / 2 >= 0 && collider.offsetY + collider.height / 2 <= part.height, `${part.id} collider fits vertically`);
      }
      if (part.photoQuad) {
        assert.equal(part.photoQuad.length, 4);
        assert.ok(part.photoQuad.every(({ x, y }) => x >= 0 && x <= part.width && y >= 0 && y <= part.height), `${part.id} photo quad fits its crop`);
        for (let index = 0; index < 4; index++) {
          const [a, b, c] = [part.photoQuad[index], part.photoQuad[(index + 1) % 4], part.photoQuad[(index + 2) % 4]];
          assert.ok((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x) > 0, `${part.id} photo quad is convex and clockwise`);
        }
      }
    }
  }
});

test('district runtime PNGs match the native dimensions recorded for every part', () => {
  const dimensions = path => {
    const png = readFileSync(`public${path}`);
    assert.equal(png.toString('hex', 0, 8), '89504e470d0a1a0a', `${path} is a PNG`);
    return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
  };
  for (const group of Object.values(districts)) {
    assert.deepEqual(dimensions(group.base.url), group.nativeSize);
    assert.deepEqual({ width: group.base.width, height: group.base.height }, group.nativeSize);
    for (const part of group.parts) assert.deepEqual(dimensions(part.url), { width: part.width, height: part.height }, part.id);
  }
});
