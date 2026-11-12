// Static size/lazy-loading checks. Device FPS and memory still require a real browser.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { gzipSync } from 'node:zlib';

function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(item => {
    const path = join(dir, item.name);
    return item.isDirectory() ? files(path) : [path];
  });
}
const all = files('out');
const js = all.filter(path => path.endsWith('.js'));
const engine = js.filter(path => readFileSync(path, 'utf8').includes('Phaser v'));
if (engine.length !== 1) throw new Error(`Expected one identifiable Phaser chunk, found ${engine.length}`);
const htmlSource = readFileSync('out/index.html');
const html = htmlSource.toString('utf8');
if (html.includes(basename(engine[0]))) throw new Error('The initial page references the Phaser chunk directly');
for (const pose of ['up', 'mid', 'down', 'dazed']) {
  if (!all.includes(`out/game/arcade/bird-animation/${pose}.png`)) throw new Error(`Missing exported bird pose ${pose}`);
}
const npcs = JSON.parse(readFileSync('src/content/npcs.json', 'utf8'));
for (const sheet of ['male', 'female', ...new Set(npcs.map(npc => `${npc.sprite}-display`))]) {
  if (!all.includes(`out/game/sheets/${sheet}.png`)) throw new Error(`Missing exported sprite sheet ${sheet}`);
}
if (!all.includes('out/game/town-proof-lossless.webp')) throw new Error('Missing lossless entry artwork');
const sum = paths => paths.reduce((total, path) => total + statSync(path).size, 0);
const mb = bytes => `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
const kb = bytes => `${Math.round(bytes / 1024)} KiB`;
const gzip = paths => paths.reduce((total, path) => total + gzipSync(readFileSync(path)).length, 0);
const initialResources = [...new Set([...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css)(?:[?#][^"]*)?)"/g)].map(match => {
  const url = new URL(match[1], 'https://export.invalid');
  if (url.origin !== 'https://export.invalid') return null;
  return `out/${decodeURIComponent(url.pathname).replace(/^\/+/, '')}`;
}).filter(Boolean))];
for (const path of initialResources) {
  if (!all.includes(path)) throw new Error(`Initial HTML references a missing JS/CSS file: ${path}`);
}
const engineSource = readFileSync(engine[0]);
console.log(`Initial HTML: ${kb(htmlSource.length)} raw, ${kb(gzipSync(htmlSource).length)} gzip.`);
console.log(`Directly referenced entry JS/CSS (${initialResources.length} files): ${kb(sum(initialResources))} raw, ${kb(gzip(initialResources))} gzip.`);
console.log(`Entry HTML plus direct JS/CSS: ${kb(htmlSource.length + sum(initialResources))} raw, ${kb(gzipSync(htmlSource).length + gzip(initialResources))} gzip.`);
console.log(`Complete static export: ${mb(sum(all))} across ${all.length} files (not an initial-download size).`);
console.log(`Phaser chunk: ${mb(engineSource.length)} raw, ${kb(gzipSync(engineSource).length)} gzip; not referenced directly by the initial HTML.`);
console.log(`Entry artwork: ${mb(statSync('out/game/town-proof-lossless.webp').size)} lossless WebP; ${mb(statSync('out/game/town-proof.png').size)} PNG fallback.`);
console.log('Browser/device performance remains to be measured.');
