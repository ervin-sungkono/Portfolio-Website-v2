/** @typedef {{version:1, bestScore:number, visibleMs:number}} AchievementProgress */

export const ACHIEVEMENTS = Object.freeze([
  { id: 'glide-10', title: 'Garden Glider', description: 'Score 10 in Garden Glide.', metric: 'bestScore', goal: 10 },
  { id: 'glide-100', title: 'Sky Legend', description: 'Score 100 in Garden Glide.', metric: 'bestScore', goal: 100 },
  { id: 'visit-5-minutes', title: 'A Little Longer', description: 'Spend a total of 5 minutes here.', metric: 'visibleMs', goal: 300000 },
]);

/** @param {unknown} value */
function positiveNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

/** @param {unknown} value @param {number} legacyBest @returns {AchievementProgress} */
export function normalizeProgress(value, legacyBest = 0) {
  const data = value && typeof value === 'object' ? /** @type {Record<string, unknown>} */ (value) : {};
  return { version: 1, bestScore: Math.floor(Math.max(positiveNumber(data.bestScore), positiveNumber(legacyBest))), visibleMs: Math.floor(positiveNumber(data.visibleMs)) };
}

/** @param {AchievementProgress} progress @param {{score?:number, elapsedMs?:number}} change @returns {AchievementProgress} */
export function updateProgress(progress, change) {
  return {
    version: 1,
    bestScore: Math.max(progress.bestScore, Math.floor(positiveNumber(change.score))),
    visibleMs: Math.min(Number.MAX_SAFE_INTEGER, progress.visibleMs + Math.floor(positiveNumber(change.elapsedMs))),
  };
}

/** @param {AchievementProgress} a @param {AchievementProgress} b @returns {AchievementProgress} */
export function mergeProgress(a, b) {
  return { version: 1, bestScore: Math.max(a.bestScore, b.bestScore), visibleMs: Math.max(a.visibleMs, b.visibleMs) };
}

/** @param {AchievementProgress} progress */
export function unlockedIds(progress) {
  return ACHIEVEMENTS.filter(item => progress[item.metric] >= item.goal).map(item => item.id);
}

/** A foreground clock; closing/hidden transitions can be flushed more than once safely. */
export function createVisitClock(now, visible) {
  let last = visible ? now : null;
  return {
    /** @param {number} timestamp @param {boolean} isVisible */
    tick(timestamp, isVisible) {
      const elapsed = last === null ? 0 : Math.max(0, timestamp - last);
      last = isVisible ? timestamp : null;
      return elapsed;
    },
  };
}
