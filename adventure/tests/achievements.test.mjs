import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVisitClock, mergeProgress, normalizeProgress, unlockedIds, updateProgress } from '../src/features/adventure/achievementModel.mjs';

test('best score unlocks the two flight milestones without adding scores from different runs', () => {
  let progress = normalizeProgress(null);
  progress = updateProgress(progress, { score: 9 });
  assert.deepEqual(unlockedIds(progress), []);
  progress = updateProgress(progress, { score: 10 });
  progress = updateProgress(progress, { score: 4 });
  assert.deepEqual(unlockedIds(progress), ['glide-10']);
  progress = updateProgress(progress, { score: 100 });
  assert.deepEqual(unlockedIds(progress), ['glide-10', 'glide-100']);
});

test('foreground time carries over between visits and excludes hidden time without double-counting', () => {
  const first = createVisitClock(0, true);
  let saved = updateProgress(normalizeProgress(null), { elapsedMs: first.tick(125000, false) });
  saved = updateProgress(saved, { elapsedMs: first.tick(200000, false) });
  saved = normalizeProgress(JSON.parse(JSON.stringify(saved)));
  const second = createVisitClock(300000, true);
  saved = updateProgress(saved, { elapsedMs: second.tick(475000, false) });
  saved = updateProgress(saved, { elapsedMs: second.tick(475000, false) });
  assert.equal(saved.visibleMs, 300000);
  assert.deepEqual(unlockedIds(saved), ['visit-5-minutes']);
});

test('previous high score migrates and stale progress cannot remove an unlock', () => {
  const previous = normalizeProgress(null, 100);
  const merged = mergeProgress(previous, normalizeProgress({ bestScore: 2, visibleMs: 120000 }));
  assert.deepEqual(unlockedIds(merged), ['glide-10', 'glide-100']);
  assert.equal(merged.visibleMs, 120000);
  assert.deepEqual(normalizeProgress({ bestScore: -2, visibleMs: 'bad' }), normalizeProgress(null));
});
