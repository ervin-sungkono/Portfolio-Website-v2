import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import typescript from 'typescript';

const props = JSON.parse(readFileSync('src/content/props.json', 'utf8'));
const terrain = JSON.parse(readFileSync('art/town-redesign/runtime/terrain.json', 'utf8'));
const imports = `
const npcs = [];
const portfolio = { projects: [] };
const moments = { photos: [] };
const residents = [];
const props = ${JSON.stringify(props)};
const terrain = ${JSON.stringify(terrain)};
`;
const expectedInitialUrls = [...new Set([
  ...terrain.tilesets.map(tileset => tileset.path),
  '/game/sheets/male.png', '/game/sheets/female.png',
  ...Object.values(props).map(prop => prop.url),
])];
const source = readFileSync('src/features/adventure/preloadAdventure.ts', 'utf8').replace(/^import .*;\s*$/gm, '');
const compiled = typescript.transpileModule(imports + source, {
  compilerOptions: { module: typescript.ModuleKind.ESNext, target: typescript.ScriptTarget.ES2020 },
}).outputText;
const { preloadAdventure } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

function mockPage() {
  const previous = new Map();
  const restore = name => {
    const entry = previous.get(name);
    if (entry.had) globalThis[name] = entry.value;
    else delete globalThis[name];
  };
  const replace = (name, value) => {
    previous.set(name, { had: Object.prototype.hasOwnProperty.call(globalThis, name), value: globalThis[name] });
    globalThis[name] = value;
  };

  const listeners = new Map();
  const timers = new Map();
  const images = [];
  const fetches = [];
  let nextTimer = 0;
  const hero = {
    complete: false,
    addEventListener: (type, listener) => listeners.set(type, listener),
    removeEventListener: (type, listener) => { if (listeners.get(type) === listener) listeners.delete(type); },
  };
  class FakeImage {
    constructor() { this.onload = null; this.onerror = null; this.src = ''; this.decoded = 0; images.push(this); }
    decode() { this.decoded++; return Promise.resolve(); }
  }

  replace('window', {
    setTimeout(callback) { const id = ++nextTimer; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); },
  });
  replace('document', { querySelector: () => hero });
  replace('Image', FakeImage);
  replace('fetch', (url, options) => { fetches.push({ url, signal: options.signal }); return new Promise(() => {}); });

  return {
    images, fetches, timers,
    fireHeroLoad() { listeners.get('load')?.(); },
    runNextTimer() { const [id, callback] = timers.entries().next().value ?? []; if (callback) { timers.delete(id); callback(); } },
    restore() { for (const name of previous.keys()) restore(name); },
  };
}

test('prewarm releases image refs and handlers after load or error, while decoding secondary images', async () => {
  const page = mockPage();
  try {
    const cancel = preloadAdventure();
    page.fireHeroLoad();
    assert.equal(page.images.length, expectedInitialUrls.length);
    assert.deepEqual(page.images.map(image => image.src), expectedInitialUrls);
    for (const image of page.images) {
      assert.equal(image.fetchPriority, 'low');
      assert.equal(typeof image.onload, 'function');
      assert.equal(typeof image.onerror, 'function');
    }

    page.images[0].onload();
    assert.equal(page.images[0].onload, null);
    assert.equal(page.images[0].onerror, null);
    page.images[1].onerror();
    assert.equal(page.images[1].onload, null);
    assert.equal(page.images[1].onerror, null);

    page.runNextTimer();
    const secondary = page.images.slice(expectedInitialUrls.length);
    assert.equal(secondary.length, 4);
    secondary[0].onload();
    await Promise.resolve();
    assert.equal(secondary[0].decoded, 1);
    assert.equal(secondary[0].onload, null);
    assert.equal(secondary[0].onerror, null);
    secondary[1].onerror();
    assert.equal(secondary[1].onload, null);
    assert.equal(secondary[1].onerror, null);
    cancel();
  } finally { page.restore(); }
});

test('unmount detaches handlers from pending images and aborts the map request', () => {
  const page = mockPage();
  try {
    const cancel = preloadAdventure();
    page.fireHeroLoad();
    assert.equal(page.fetches.length, 1);
    const pending = [...page.images];
    cancel();
    assert.equal(page.fetches[0].signal.aborted, true);
    for (const image of pending) {
      assert.equal(image.onload, null);
      assert.equal(image.onerror, null);
    }
    assert.equal(page.timers.size, 0);
  } finally { page.restore(); }
});
