// One short flash and a decaying, deterministic camera shake at 60 simulation steps/second.
const SHAKE = Object.freeze([[4, 1], [-4, -1], [3, 2], [-3, -2], [3, 1], [-3, -1], [2, 1], [-2, -1], [1, 0], [-1, 0], [1, 0], [0, 0]]);

/** @param {string} status @param {number} crashFrames @param {boolean} reducedMotion */
export function impactFeedback(status, crashFrames, reducedMotion) {
  if (status !== 'crashing' || reducedMotion || !Number.isFinite(crashFrames) || crashFrames < 0 || crashFrames >= SHAKE.length) return { x: 0, y: 0, flash: false };
  const [x, y] = SHAKE[Math.floor(crashFrames)];
  return { x, y, flash: crashFrames < 6 };
}
