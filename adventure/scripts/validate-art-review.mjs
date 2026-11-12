import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const directory = 'public/art-review';
const manifest = JSON.parse(readFileSync(`${directory}/manifest.json`, 'utf8'));
assert.equal(manifest.status, 'approved-for-integration');
assert.equal(manifest.approvedBy, 'site owner');
assert.match(manifest.approvedOn, /^\d{4}-\d{2}-\d{2}$/);
assert.match(manifest.approvalRecord, /explicitly approved/i);
assert.match(manifest.approvalScope, /approved for gameplay integration/i);
assert.ok(['pending', 'in-progress', 'integrated'].includes(manifest.integrationStatus));
assert.match(manifest.reviewedMapSha256, /^[a-f\d]{64}$/i);
if (manifest.integrationStatus === 'integrated') {
  assert.match(manifest.integratedMapSha256, /^[a-f\d]{64}$/i);
  assert.match(manifest.integratedOn, /^\d{4}-\d{2}-\d{2}$/);
}
const ids = new Set();
for (const entry of [...manifest.animations, ...manifest.statics]) {
  assert.ok(!ids.has(entry.id), `Duplicate review item: ${entry.id}`);
  ids.add(entry.id);
  assert.match(entry.file, /^[a-z0-9-]+\.png$/);
  assert.ok(Number.isInteger(entry.width) && entry.width > 0);
  assert.ok(Number.isInteger(entry.height) && entry.height > 0);
  if (entry.frames !== undefined) assert.equal(entry.frames, 4);
  const source = readFileSync(`${directory}/assets/${entry.file}`);
  assert.equal(source.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(source[25], 6, `${entry.file} must retain its RGBA channel`);
  assert.equal(source.readUInt32BE(16), entry.width * (entry.frames ?? 1), `Width of ${entry.file}`);
  assert.equal(source.readUInt32BE(20), entry.height, `Height of ${entry.file}`);
}

const html = readFileSync(`${directory}/index.html`, 'utf8');
for (const [, value] of html.matchAll(/(?:src|href)="(\.\/[^"#?]+)"/g)) {
  assert.ok(existsSync(`${directory}/${value.slice(2)}`), `Missing review resource: ${value}`);
}
const map = readFileSync('public/game/maps/town.json');
const mapHash = createHash('sha256').update(map).digest('hex');
if (manifest.integrationStatus === 'integrated') {
  assert.equal(mapHash, manifest.integratedMapSha256, 'Update the integration record after changing the final map');
}
const runtimeRoots = ['src/content', 'src/features/adventure', 'public/game/maps'];
function runtimeFiles(directoryPath) {
  return readdirSync(directoryPath, { withFileTypes: true }).flatMap(entry => {
    const path = `${directoryPath}/${entry.name}`;
    if (entry.isDirectory()) return runtimeFiles(path);
    return /\.(?:js|mjs|ts|tsx|json|svg)$/.test(entry.name) ? [path] : [];
  });
}
for (const path of runtimeRoots.flatMap(runtimeFiles)) {
  assert.ok(!readFileSync(path, 'utf8').includes('art-review'), `Review URL leaked into gameplay: ${path}`);
}
console.log(`Approved pack valid: ${manifest.animations.length} four-frame loops, ${manifest.statics.length} static studies; integration ${manifest.integrationStatus}.`);
