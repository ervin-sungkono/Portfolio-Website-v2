import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const read = path => JSON.parse(readFileSync(path, 'utf8'));
const residents = read('src/content/residents.json');
const require = createRequire(import.meta.url);
const source = readFileSync('src/features/adventure/ambientResidents.ts', 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
const module = { exports: {} };
new Function('require', 'module', 'exports', code)(name => name === '@/content/residents.json' ? residents : require(name), module, module.exports);
const { preloadResidents, createResidents } = module.exports;

function fakeScene() {
  const images = [], containers = [], tweens = [], chains = [], loaded = [], colliders = [], animations = [];
  function object(kind, x = 0, y = 0) {
    return {
      kind, x, y, scaleX: 1, scaleY: 1, children: [],
      setDepth(value) { this.depth = value; return this; },
      setSize(width, height) { this.width = width; this.height = height; return this; },
      setOrigin(x, y) { this.origin = [x, y]; return this; },
      setCrop(x, y, width, height) { this.crop = [x, y, width, height]; return this; },
      setScale(x, y) { this.scaleX = x; this.scaleY = y; return this; },
      setAlpha(value) { this.alpha = value; return this; },
      setFlipX(value) { this.flipX = value; return this; },
      play(key) { this.animation = key; return this; },
      stop() { this.stopped = true; return this; },
      setFrame(frame) { this.frame = frame; return this; },
      fillStyle() { return this; }, fillRect() { return this; },
      add(items) { this.children.push(...(Array.isArray(items) ? items : [items])); return this; },
    };
  }
  return { images, containers, tweens, chains, loaded, colliders, animations, scene: {
    load: { image(key, url) { loaded.push({ key, url }); }, spritesheet(key, url, config) { loaded.push({ key, url, config }); } },
    add: {
      image(x, y, key) { const image = object('image', x, y); image.key = key; images.push(image); return image; },
      sprite(x, y, key) { const sprite = object('sprite', x, y); sprite.key = key; images.push(sprite); return sprite; },
      container(x, y, children) { const container = object('container', x, y); if (children) container.add(children); containers.push(container); return container; },
      graphics() { return object('graphics'); },
    },
    physics: { add: {
      existing(actor) { actor.body = {
        setAllowGravity(value) { this.gravity = value; return this; }, setImmovable(value) { this.immovable = value; return this; },
        setSize(width, height) { this.width = width; this.height = height; return this; }, setOffset(x, y) { this.offset = [x, y]; return this; },
        setDirectControl(value) { this.direct = value; return this; },
      }; },
      collider(player, actor) { colliders.push({ player, actor }); },
    } },
    anims: { exists(key) { return animations.some(animation => animation.key === key); }, create(config) { animations.push(config); } },
    tweens: { add(config) { tweens.push(config); }, chain(config) { chains.push(config); } },
  } };
}

test('residents animate without prompts, keep solid feet, and walkers pause and turn along their routes', () => {
  const normal = fakeScene();
  preloadResidents(normal.scene);
  assert.equal(normal.loaded.length, residents.length);
  for (const { url, config } of normal.loaded) {
    assert.ok(existsSync(`public${url}`), url);
    const image = readFileSync(`public${url}`);
    assert.deepEqual([image.readUInt32BE(16), image.readUInt32BE(20)], [config ? 268 : 67, 90], `runtime dimensions for ${url}`);
  }
  const player = {};
  createResidents(normal.scene, player, false); // The scene intentionally has no input API.
  const actors = normal.containers.filter(container => container.depth !== undefined);
  assert.equal(actors.length, residents.length);
  for (const [index, resident] of residents.entries()) {
    const actor = actors[index];
    assert.equal(actor.depth, resident.y);
    assert.deepEqual([actor.body.width, actor.body.height, actor.body.offset, actor.body.immovable, actor.body.direct], [24, 12, [0, -6], true, true]);
    assert.ok(normal.colliders.some(collider => collider.player === player && collider.actor === actor));
    if (resident.mode === 'walk') {
      assert.equal(actor.children.length, 1);
      const sprite = actor.children[0];
      const animation = normal.animations.find(item => item.key === `resident-${resident.id}-walk`);
      assert.ok(animation);
      assert.deepEqual(animation.frames.map(frame => frame.frame), [0, 1, 2, 3], 'a stride includes both passing poses');
      assert.equal(animation.frameRate, 5);
      const route = [...resident.route, { x: resident.x, y: resident.y }];
      const walk = normal.chains.find(chain => chain.targets === actor);
      assert.ok(walk);
      assert.equal(walk.loop, -1);
      assert.equal(walk.loopDelay, 900);
      assert.equal(walk.tweens.length, route.length);
      for (const [routeIndex, point] of route.entries()) {
        const from = routeIndex === 0 ? resident : route[routeIndex - 1];
        const segment = walk.tweens[routeIndex];
        assert.deepEqual([segment.x, segment.y], [point.x, point.y]);
        assert.equal(segment.duration, Math.max(1000, Math.hypot(point.x - from.x, point.y - from.y) / 48 * 1000), 'movement speed should stay gentle');
        assert.equal(segment.delay, from.pauseMs ?? 0, 'each landmark pause happens before the next leg');
        actor.y = point.y;
        segment.onUpdate();
        assert.equal(actor.depth, point.y, 'rendering depth follows the resident across the map');
        segment.onStart();
        if (point.x !== from.x) assert.equal(sprite.flipX, point.x < from.x, 'horizontal turns update facing');
        assert.equal(sprite.animation, `resident-${resident.id}-walk`);
        segment.onComplete();
        assert.equal(sprite.stopped, true, 'the sprite rests at a waypoint');
        assert.equal(sprite.frame, 0, 'the paused sprite uses a settled pose');
        if (point.face) assert.equal(sprite.flipX, point.face === 'left', 'the resident faces the landmark while stopped');
        sprite.stopped = false;
      }
      assert.equal(actor.scaleX, 1, 'body remains centered when the sprite turns');
    } else {
      const figure = actor.children[0];
      assert.ok(normal.tweens.some(tween => tween.targets === figure && tween.scaleY > 1), 'idle breathing');
      assert.ok(normal.tweens.some(tween => tween.targets === figure.children[1] && tween.alpha === 1), 'idle blinking');
    }
  }
  const reduced = fakeScene();
  createResidents(reduced.scene, player, true);
  assert.equal(reduced.tweens.length, 0, 'reduced motion leaves the background still');
  assert.equal(reduced.colliders.length, residents.length, 'collision remains available with reduced motion');
});
