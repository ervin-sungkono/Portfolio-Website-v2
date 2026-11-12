/** @typedef {'ready'|'playing'|'paused'|'crashing'|'over'} FlightStatus */
/** @typedef {{x:number, center:number, gap:number, scored:boolean}} Gate */
/** @typedef {{status:FlightStatus, birdY:number, velocity:number, gates:Gate[], score:number, frame:number, flapFrames:number, crashFrames:number}} Flight */
// The game advances at a fixed 60 steps per second, regardless of display refresh rate.
export const SKY = Object.freeze({
  width: 320, height: 400, ground: 354,
  birdX: 78, birdRadius: 10, gravity: 0.22, flap: -4.3, terminalVelocity: 5,
  gateWidth: 46, gap: 120, gateSpeed: 1.45, gateSpacing: 160, crashDuration: 45,
});

/** @param {number} score */
export function difficultyAt(score) {
  const progress = Math.max(0, Math.min(100, score)) / 100;
  return { speed: SKY.gateSpeed + 0.45 * progress, gap: SKY.gap - 10 * progress };
}

/** @returns {Flight} */
export function newFlight() {
  return { status: 'ready', birdY: 175, velocity: 0, gates: [], score: 0, frame: 0, flapFrames: 100, crashFrames: 0 };
}

/** @param {Flight} state @returns {Flight} */
export function flap(state) {
  if (state.status !== 'ready' && state.status !== 'playing') return state;
  return { ...state, status: 'playing', velocity: SKY.flap, flapFrames: 0 };
}

/** The game surface starts, flaps, resumes, or restarts the flight. @param {Flight} state @returns {Flight} */
export function activateFlight(state) {
  if (state.status === 'paused') return { ...state, status: 'playing' };
  if (state.status === 'over') return flap(newFlight());
  return flap(state);
}

/** Advance one frame; random may be supplied by a caller for repeatable tests.
 * @param {Flight} state @param {() => number} random @returns {Flight}
 */
export function stepFlight(state, random = Math.random) {
  if (state.status === 'crashing') {
    const crashFrames = state.crashFrames + 1;
    const velocity = Math.min(state.velocity + 0.5, 10);
    const birdY = Math.min(SKY.ground - SKY.birdRadius, Math.max(SKY.birdRadius, state.birdY + velocity));
    return { ...state, status: crashFrames >= SKY.crashDuration ? 'over' : 'crashing', birdY, velocity, crashFrames };
  }
  if (state.status !== 'playing') return state;
  const difficulty = difficultyAt(state.score);
  const velocity = Math.min(state.velocity + SKY.gravity, SKY.terminalVelocity);
  const birdY = state.birdY + velocity;
  let score = state.score;
  let gates = state.gates.map(gate => ({ ...gate, x: gate.x - difficulty.speed }));
  const last = gates.at(-1);
  if (!last || last.x <= SKY.width - SKY.gateSpacing) {
    const proposed = 110 + Math.max(0, Math.min(1, random())) * 140;
    // Nearby openings stay reachable instead of forcing an impossible jump.
    const center = last ? Math.max(last.center - 45, Math.min(last.center + 45, proposed)) : proposed;
    gates.push({ x: SKY.width + 10, center, gap: difficulty.gap, scored: false });
  }
  let hit = birdY - SKY.birdRadius <= 0 || birdY + SKY.birdRadius >= SKY.ground;
  for (const gate of gates) {
    const touching = SKY.birdX + SKY.birdRadius > gate.x && SKY.birdX - SKY.birdRadius < gate.x + SKY.gateWidth;
    if (touching && (birdY - SKY.birdRadius < gate.center - gate.gap / 2 || birdY + SKY.birdRadius > gate.center + gate.gap / 2)) hit = true;
    if (!hit && !gate.scored && gate.x + SKY.gateWidth < SKY.birdX) { gate.scored = true; score++; }
  }
  gates = gates.filter(gate => gate.x + SKY.gateWidth > -5);
  return { status: hit ? 'crashing' : 'playing', birdY, velocity: hit ? Math.max(0.8, velocity) : velocity, gates, score, frame: state.frame + 1, flapFrames: state.flapFrames + 1, crashFrames: 0 };
}
