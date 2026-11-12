import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawPixelPhotoPreview, drawPixelPhotoToQuad, drawPhotoQuadSample } from '../src/features/adventure/pixelPhotoPreview.mjs';

function canvasPair() {
  const calls = [];
  const low = { fillRect(...args) { calls.push(['fill', ...args]); }, drawImage(...args) { calls.push(['sample', this.imageSmoothingEnabled, ...args]); } };
  const sample = { width: 0, height: 0, getContext: () => low };
  const output = { drawImage(...args) { calls.push(['upscale', this.imageSmoothingEnabled, ...args]); } };
  return { calls, low, sample, output };
}

test('landscape photo is fitted into a 35×17 sample and enlarged without smoothing', () => {
  const { calls, sample, output } = canvasPair();
  const photo = { naturalWidth: 400, naturalHeight: 200 };
  assert.equal(drawPixelPhotoPreview(output, photo, () => sample), true);
  assert.deepEqual([sample.width, sample.height], [35, 17]);
  assert.deepEqual(calls, [
    ['fill', 0, 0, 35, 17],
    ['sample', false, photo, 0, 0, 34, 17],
    ['upscale', false, sample, 0, 0, 70, 34],
  ]);
});

test('portrait photo stays uncropped, centered, and fits within the frame', () => {
  const { calls, sample, output } = canvasPair();
  const photo = { naturalWidth: 800, naturalHeight: 1600 };
  assert.equal(drawPixelPhotoPreview(output, photo, () => sample), true);
  assert.deepEqual(calls[1], ['sample', false, photo, 13, 0, 9, 17]);
});

test('invalid photos and unavailable canvas contexts are ignored safely', () => {
  const { calls, output } = canvasPair();
  assert.equal(drawPixelPhotoPreview(output, { naturalWidth: 0, naturalHeight: 8 }, () => { throw new Error('should not create a canvas'); }), false);
  assert.equal(drawPixelPhotoPreview(output, { naturalWidth: 8, naturalHeight: 8 }, () => ({ getContext: () => null })), false);
  assert.deepEqual(calls, []);
});

test('a differently sized frame keeps the same two-pixel mosaic scale', () => {
  const { sample, output, calls } = canvasPair();
  output.canvas = { width: 96, height: 64 };
  assert.equal(drawPixelPhotoPreview(output, { naturalWidth: 400, naturalHeight: 200 }, () => sample), true);
  assert.deepEqual([sample.width, sample.height], [48, 32]);
  assert.deepEqual(calls.at(-1).slice(-4), [0, 0, 96, 64]);
});

test('two canvas triangles map a preview to every corner of a tilted easel window', () => {
  const quads = [[{ x: 10, y: 10 }, { x: 80, y: 8 }, { x: 85, y: 50 }, { x: 8, y: 52 }], [{ x: 2, y: 3 }, { x: 72, y: 3 }, { x: 72, y: 37 }, { x: 2, y: 37 }]];
  for (const quad of quads) {
    const transforms = [], draws = [];
    const output = { save() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, clip() {}, restore() {}, transform(...matrix) { transforms.push(matrix); }, drawImage(image) { draws.push(image); } };
    const makeCanvas = () => {
      const canvas = { width: 0, height: 0 };
      canvas.getContext = () => ({ canvas, fillRect() {}, drawImage() {} });
      return canvas;
    };
    assert.equal(drawPixelPhotoToQuad(output, { naturalWidth: 1000, naturalHeight: 600 }, quad, makeCanvas), true);
    assert.equal(draws.length, 2);
    assert.equal(draws[0], draws[1], 'both triangles use the same pixelated source');
    assert.equal(output.imageSmoothingEnabled, false);
    const { width, height } = draws[0];
    const map = ([a, b, c, d, e, f], x, y) => ({ x: a * x + c * y + e, y: b * x + d * y + f });
    const points = [map(transforms[0], 0, 0), map(transforms[0], width, 0), map(transforms[0], 0, height), map(transforms[1], width, 0), map(transforms[1], width, height), map(transforms[1], 0, height)];
    for (const [index, expected] of [quad[0], quad[1], quad[3], quad[1], quad[2], quad[3]].entries()) {
      assert.ok(Math.abs(points[index].x - expected.x) < 1e-8 && Math.abs(points[index].y - expected.y) < 1e-8);
    }
  }
});

test('invalid easel quadrilaterals are rejected before drawing', () => {
  const bad = [[{ x: 0, y: 0 }], [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]];
  for (const quad of bad) assert.equal(drawPixelPhotoToQuad({}, {}, quad, () => { throw new Error('should not allocate'); }), false);
});

test('sample art is copied from the matching group crop and clipped to the frame window', () => {
  const calls = [];
  const output = {
    save() { calls.push('save'); }, beginPath() { calls.push('begin'); }, moveTo(...point) { calls.push(['move', ...point]); },
    lineTo(...point) { calls.push(['line', ...point]); }, closePath() { calls.push('close'); }, clip() { calls.push('clip'); },
    drawImage(...args) { calls.push(['draw', ...args]); }, restore() { calls.push('restore'); },
  };
  const quad = [{ x: 10, y: 10 }, { x: 80, y: 8 }, { x: 85, y: 50 }, { x: 8, y: 52 }];
  const source = { id: 'photo-garden-base' };
  assert.equal(drawPhotoQuadSample(output, source, { x: 350, y: 175 }, 120, 137, quad), true);
  assert.deepEqual(calls[0], 'save');
  assert.deepEqual(calls[1], 'begin');
  assert.deepEqual(calls[2], ['move', 10, 10]);
  assert.equal(calls[7], 'clip');
  assert.deepEqual(calls[8], ['draw', source, 350, 175, 120, 137, 0, 0, 120, 137]);
  assert.equal(calls[9], 'restore');
});
