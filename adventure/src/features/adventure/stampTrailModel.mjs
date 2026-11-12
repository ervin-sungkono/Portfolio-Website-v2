/** @typedef {{version:1, active:boolean, stamps:string[]}} TrailProgress */

export const TRAIL_STOPS = Object.freeze([
  { id: 'background-guide', name: 'Milo', clue: 'Say hello to the town navigator.' },
  { id: 'skills-guide', name: 'Ivy', clue: 'Meet the maker in the workshop.' },
  { id: 'moments-frame-1', name: 'Park gallery', clue: 'Visit the first picture frame in the park.' },
  { id: 'cafe-corner', name: 'The café', clue: 'Stop by the café for a little chat.' },
]);

/** @param {unknown} value @returns {TrailProgress} */
export function normalizeTrail(value) {
  const data = value && typeof value === 'object' ? /** @type {Record<string, unknown>} */ (value) : {};
  const known = new Set(TRAIL_STOPS.map(stop => stop.id));
  const stamps = Array.isArray(data.stamps) ? [...new Set(data.stamps.filter(id => typeof id === 'string' && known.has(id)))] : [];
  return { version: 1, active: data.active === true && stamps.length < TRAIL_STOPS.length, stamps };
}

/** @param {TrailProgress} progress */
export function trailComplete(progress) { return progress.stamps.length === TRAIL_STOPS.length; }

/** @param {TrailProgress} progress @param {string | undefined} id @returns {TrailProgress} */
export function visitTrailStop(progress, id) {
  if (!progress.active || !TRAIL_STOPS.some(stop => stop.id === id) || progress.stamps.includes(id ?? '')) return progress;
  const stamps = [...progress.stamps, /** @type {string} */ (id)];
  return { version: 1, active: stamps.length < TRAIL_STOPS.length, stamps };
}

/** @param {TrailProgress} progress @param {string | undefined} [firstId] @returns {TrailProgress} */
export function startTrail(progress, firstId) {
  if (trailComplete(progress)) return progress;
  return visitTrailStop({ ...progress, active: true }, firstId);
}

/** @param {TrailProgress} progress @returns {TrailProgress} */
export function pauseTrail(progress) { return progress.active ? { ...progress, active: false } : progress; }
