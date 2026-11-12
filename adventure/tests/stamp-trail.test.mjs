import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRAIL_STOPS, normalizeTrail, pauseTrail, startTrail, trailComplete, visitTrailStop } from '../src/features/adventure/stampTrailModel.mjs';

test('the trail collects each known stop once only while active', () => {
  let progress = normalizeTrail(null);
  progress = visitTrailStop(progress, 'background-guide');
  assert.deepEqual(progress.stamps, []);
  progress = startTrail(progress, 'background-guide');
  progress = visitTrailStop(progress, 'background-guide');
  progress = visitTrailStop(progress, 'not-a-stop');
  assert.deepEqual(progress.stamps, ['background-guide']);
  progress = pauseTrail(progress);
  progress = visitTrailStop(progress, 'skills-guide');
  assert.deepEqual(progress.stamps, ['background-guide']);
  progress = startTrail(progress);
  for (const stop of TRAIL_STOPS) progress = visitTrailStop(progress, stop.id);
  assert.equal(trailComplete(progress), true);
  assert.equal(progress.active, false);
  assert.equal(progress.stamps.length, TRAIL_STOPS.length);
});

test('saved progress ignores malformed, unknown and duplicate stamps', () => {
  const saved = normalizeTrail({ active: true, stamps: ['skills-guide', 'skills-guide', 'unknown', null] });
  assert.deepEqual(saved, { version: 1, active: true, stamps: ['skills-guide'] });
  assert.deepEqual(normalizeTrail(JSON.parse(JSON.stringify(saved))), saved);
  assert.deepEqual(normalizeTrail(null), { version: 1, active: false, stamps: [] });
  const finished = normalizeTrail({ active: true, stamps: TRAIL_STOPS.map(stop => stop.id) });
  assert.equal(trailComplete(finished), true);
  assert.equal(finished.active, false);
});

test('resuming at the last stop completes the trail without discarding progress', () => {
  const ids = TRAIL_STOPS.map(stop => stop.id);
  const paused = normalizeTrail({ active: false, stamps: ids.slice(0, -1) });
  const finished = startTrail(paused, ids.at(-1));
  assert.equal(trailComplete(finished), true);
  assert.deepEqual(finished.stamps, ids);
  assert.equal(finished.active, false);
});
