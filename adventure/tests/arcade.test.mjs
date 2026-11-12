import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SKY, activateFlight, difficultyAt, flap, newFlight, stepFlight } from '../src/features/adventure/arcadeModel.mjs';
import { impactFeedback } from '../src/features/adventure/arcadeImpact.mjs';

test('a flap starts a flight and a paused or finished flight cannot move', () => {
  const started = flap(newFlight());
  assert.equal(started.status, 'playing');
  assert.ok(started.velocity < 0);
  const paused = { ...started, status: 'paused' };
  assert.strictEqual(stepFlight(paused), paused);
  assert.strictEqual(flap(paused), paused);
  assert.equal(newFlight().score, 0);
});

test('the play surface starts, flaps, resumes, and restarts at the appropriate time', () => {
  const started = activateFlight(newFlight());
  assert.equal(started.status, 'playing');
  assert.equal(activateFlight({ ...started, velocity: 2 }).velocity, SKY.flap);
  const paused = { ...started, status: 'paused', score: 4, birdY: 190, velocity: 2 };
  const resumed = activateFlight(paused);
  assert.equal(resumed.status, 'playing');
  assert.equal(resumed.score, 4);
  assert.equal(resumed.birdY, 190);
  assert.equal(resumed.velocity, 2);
  const ended = { ...paused, status: 'over', score: 11 };
  assert.deepEqual(activateFlight(ended), flap(newFlight()));
  const crashing = { ...started, status: 'crashing' };
  assert.strictEqual(activateFlight(crashing), crashing);
});

test('clearing a gate scores once; collision starts a short death animation and ends the run', () => {
  const gate = { x: SKY.birdX - SKY.gateWidth - 1, center: 175, gap: 120, scored: false };
  const flying = { ...flap(newFlight()), birdY: 175, velocity: 0, gates: [gate] };
  const passed = stepFlight(flying, () => 0.5);
  assert.equal(passed.score, 1);
  assert.equal(stepFlight(passed, () => 0.5).score, 1);
  let collision = stepFlight({ ...flying, birdY: 30, gates: [{ ...gate, x: SKY.birdX }] }, () => 0.5);
  assert.equal(collision.status, 'crashing');
  assert.equal(collision.score, 0);
  for (let i = 0; i < SKY.crashDuration; i++) collision = stepFlight(collision);
  assert.equal(collision.status, 'over');
  assert.equal(collision.score, 0);
  assert.equal(collision.birdY, SKY.ground - SKY.birdRadius);
});

test('a crash has one brief flash and decaying shake, with reduced motion respected', () => {
  const impact = impactFeedback('crashing', 0, false);
  assert.equal(impact.flash, true);
  assert.ok(Math.abs(impact.x) > 0 || Math.abs(impact.y) > 0);
  assert.equal(impactFeedback('crashing', 6, false).flash, false);
  assert.deepEqual(impactFeedback('crashing', 12, false), { x: 0, y: 0, flash: false });
  assert.deepEqual(impactFeedback('crashing', 0, true), { x: 0, y: 0, flash: false });
  assert.deepEqual(impactFeedback('playing', 0, false), { x: 0, y: 0, flash: false });
});

test('difficulty rises gradually and caps at score 100; spawned gate gaps stay fixed', () => {
  let prior = difficultyAt(0);
  assert.deepEqual(prior, { speed: 1.45, gap: 120 });
  for (let score = 1; score <= 120; score++) {
    const next = difficultyAt(score);
    assert.ok(next.speed >= prior.speed && next.gap <= prior.gap);
    assert.ok(next.speed <= 1.9 && next.gap >= 110);
    prior = next;
  }
  assert.deepEqual(difficultyAt(100), difficultyAt(1000));
  const gate = { x: 200, center: 180, gap: 120, scored: false };
  const state = { ...flap(newFlight()), score: 90, birdY: 180, velocity: 0, gates: [gate] };
  assert.equal(stepFlight(state, () => 0.5).gates[0].gap, 120);
});

test('successive openings stay within a reachable vertical range', () => {
  const state = { ...flap(newFlight()), birdY: 180, velocity: 0, gates: [{ x: SKY.width - SKY.gateSpacing, center: 110, gap: 120, scored: false }] };
  const next = stepFlight(state, () => 1).gates.at(-1);
  assert.equal(next.center, 155);
  assert.ok(next.center - next.gap / 2 > 0);
  assert.ok(next.center + next.gap / 2 < SKY.ground);
});

test('a simple controller can clear 100 gates through the full difficulty curve', () => {
  for (const initialSeed of [1, 42, 12345]) {
    let seed = initialSeed;
    const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    let flight = flap(newFlight()), lastFlap = 0;
    for (let frame = 0; frame < 16000 && flight.status === 'playing' && flight.score < 100; frame++) {
      const gate = flight.gates.find(item => item.x + SKY.gateWidth >= SKY.birdX - SKY.birdRadius);
      const target = gate?.center ?? 175;
      if (flight.birdY > target && frame - lastFlap > 12) { flight = flap(flight); lastFlap = frame; }
      flight = stepFlight(flight, random);
    }
    assert.equal(flight.score, 100, `Seed ${initialSeed} reached only ${flight.score}`);
  }
});
