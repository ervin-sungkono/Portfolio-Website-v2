import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import typescript from 'typescript';

const source = readFileSync('src/features/adventure/ambientAudio.ts', 'utf8');
const compiled = typescript.transpileModule(source, { compilerOptions: { module: typescript.ModuleKind.ESNext, target: typescript.ScriptTarget.ES2020 } }).outputText;
const { createAmbientAudio } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

function mockAudio() {
  const previousWindow = globalThis.window, previousAudio = globalThis.Audio, tracks = [];
  class FakeAudio {
    constructor(src) { this.src = src; this.paused = true; this.plays = 0; this.loads = 0; this.currentTime = 0; tracks.push(this); }
    play() {
      this.plays++;
      if (this.blockNext) { this.blockNext = false; return Promise.reject(new Error('autoplay blocked')); }
      this.paused = false;
      if (this.deferNext) return new Promise(resolve => { this.resolvePlay = () => { this.paused = false; resolve(); }; });
      return Promise.resolve();
    }
    pause() { this.paused = true; }
    removeAttribute(name) { if (name === 'src') this.src = ''; }
    load() { this.loads++; }
  }
  globalThis.window = {};
  globalThis.Audio = FakeAudio;
  return { tracks, restore() {
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
    if (previousAudio === undefined) delete globalThis.Audio; else globalThis.Audio = previousAudio;
  } };
}

test('town music loops on request, pauses, resumes, and releases its track on exit', async () => {
  const mock = mockAudio();
  try {
    const audio = createAmbientAudio();
    assert.equal(mock.tracks.length, 0, 'creating the controller is silent');
    audio.start();
    const [track] = mock.tracks;
    assert.equal(track.src, '/game/audio/pixelland-loop.mp3');
    assert.equal(track.loop, true);
    assert.equal(track.paused, false);
    audio.start();
    assert.equal(track.plays, 1, 'repeated gestures do not restart a playing track');
    track.currentTime = 6;
    audio.suspend();
    assert.equal(track.paused, true);
    audio.resume();
    assert.equal(track.paused, false);
    assert.equal(track.currentTime, 6, 'returning to the tab resumes at the previous position');
    audio.dispose();
    assert.equal(track.paused, true);
    assert.equal(track.src, '');
    assert.equal(track.loads, 1, 'disposing releases the media resource');
    audio.start();
    assert.equal(mock.tracks.length, 1, 'disposed controllers cannot create another track');
    await Promise.resolve();
  } finally { mock.restore(); }
});

test('a blocked play attempt can be retried on a later gesture', async () => {
  const mock = mockAudio();
  try {
    const audio = createAmbientAudio();
    audio.start();
    const [track] = mock.tracks;
    audio.suspend();
    track.blockNext = true;
    audio.start();
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(track.paused, true);
    audio.start();
    assert.equal(track.plays, 3);
    assert.equal(track.paused, false);
    audio.dispose();
    await Promise.resolve();
  } finally { mock.restore(); }
});

test('a late play resolution cannot restart music after the tab is hidden or the game exits', async () => {
  const mock = mockAudio();
  try {
    for (const stop of ['suspend', 'dispose']) {
      const audio = createAmbientAudio();
      audio.start();
      const track = mock.tracks.at(-1);
      audio.suspend();
      track.deferNext = true;
      audio.start();
      audio[stop]();
      track.resolvePlay();
      await Promise.resolve();
      assert.equal(track.paused, true, `late playback after ${stop} must be paused`);
      audio.dispose();
    }
  } finally { mock.restore(); }
});
