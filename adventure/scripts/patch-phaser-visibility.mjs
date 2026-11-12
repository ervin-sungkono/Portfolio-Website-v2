// Phaser 4.2.1 leaves global visibility handlers installed after Game.destroy().
// Patch both shipped distributions and the source copy, and fail on unfamiliar versions.
import { readFileSync, statSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';

const root = 'node_modules/phaser';
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
if (version !== '4.2.1') throw new Error(`Review the visibility patch before using Phaser ${version}`);

const original = `    window.onblur = function ()
    {
        eventEmitter.emit(Events.BLUR);
    };

    window.onfocus = function ()
    {
        eventEmitter.emit(Events.FOCUS);
    };`;
const replacement = `    // Ervin's Little World: release browser listeners on Phaser destruction.
    var onBlur = function ()
    {
        eventEmitter.emit(Events.BLUR);
    };
    var onFocus = function ()
    {
        eventEmitter.emit(Events.FOCUS);
    };

    window.addEventListener('blur', onBlur, false);
    window.addEventListener('focus', onFocus, false);
    eventEmitter.once(Events.DESTROY, function ()
    {
        if (hiddenVar)
        {
            document.removeEventListener(hiddenVar, onChange, false);
        }
        window.removeEventListener('blur', onBlur, false);
        window.removeEventListener('focus', onFocus, false);
    });`;
const marker = "// Ervin's Little World: release browser listeners on Phaser destruction.";
const paths = ['src/core/VisibilityHandler.js', 'dist/phaser.esm.js', 'dist/phaser.js'];
const changes = paths.map(relative => {
  const path = join(root, relative);
  const content = readFileSync(path, 'utf8');
  const newline = content.includes('\r\n') ? '\r\n' : '\n';
  const oldText = original.replaceAll('\n', newline);
  const newText = replacement.replaceAll('\n', newline);
  const markerCount = content.split(marker).length - 1;
  const oldCount = content.split(oldText).length - 1;
  const patchedCount = content.split(newText).length - 1;
  if (markerCount === 1 && oldCount === 0 && patchedCount === 1) return null;
  if (markerCount !== 0 || oldCount !== 1) throw new Error(`Unexpected Phaser visibility handler in ${relative}; patch not applied`);
  return { path, content: content.replace(oldText, newText), mode: statSync(path).mode };
}).filter(Boolean);
for (const change of changes) {
  // Atomic replacement avoids modifying other checkouts that share hard-linked files.
  const temporary = `${change.path}.visibility-patch-${process.pid}`;
  writeFileSync(temporary, change.content, { mode: change.mode });
  renameSync(temporary, change.path);
}
console.log(`Phaser ${version} visibility cleanup ${changes.length ? 'patched' : 'already patched'}.`);
