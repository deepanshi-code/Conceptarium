import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeBeam } from '../js/mech/beam.js';
import { coefficients, partialSum } from '../js/maths/fourier.js';

const near = (actual, expected, rel = 0.005) => assert.ok(Math.abs(actual - expected) <= rel * Math.abs(expected), `${actual} vs ${expected}`);
const EI = 10000;

// Standard results from strength-of-materials tables.
test('simply supported, central point load: M = PL/4, δ = PL³/48EI', () => {
  const r = analyzeBeam({ type: 'simply', L: 6, EI, N: 2000, loads: [{ kind: 'point', a: 3, P: 10 }] });
  near(r.reactions.RA, 5);
  near(r.maxMoment.value, (10 * 6) / 4);
  near(-r.maxDeflection.value, (10 * 6 ** 3) / (48 * EI));
  near(r.maxMoment.x, 3, 0.01);
});

test('simply supported, full UDL: M = wL²/8, δ = 5wL⁴/384EI', () => {
  const r = analyzeBeam({ type: 'simply', L: 8, EI, N: 2000, loads: [{ kind: 'udl', start: 0, end: 8, w: 4 }] });
  near(r.maxMoment.value, (4 * 8 ** 2) / 8);
  near(-r.maxDeflection.value, (5 * 4 * 8 ** 4) / (384 * EI));
  near(r.zeroShear[0], 4, 0.01);
});

test('cantilever, end point load: M = −PL at the wall, δ = PL³/3EI', () => {
  const r = analyzeBeam({ type: 'cantilever', L: 5, EI, N: 2000, loads: [{ kind: 'point', a: 5, P: 6 }] });
  near(r.reactions.MA, -30);
  near(r.maxMoment.value, -30);
  near(-r.maxDeflection.value, (6 * 5 ** 3) / (3 * EI));
  near(r.maxDeflection.x, 5, 0.001);
});

test('cantilever, full UDL: δ = wL⁴/8EI', () => {
  const r = analyzeBeam({ type: 'cantilever', L: 4, EI, N: 2000, loads: [{ kind: 'udl', start: 0, end: 4, w: 3 }] });
  near(-r.maxDeflection.value, (3 * 4 ** 4) / (8 * EI));
});

test('off-centre point load: reactions satisfy equilibrium', () => {
  const r = analyzeBeam({ type: 'simply', L: 10, EI, loads: [{ kind: 'point', a: 2, P: 20 }] });
  near(r.reactions.RA, 16);
  near(r.reactions.RB, 4);
  near(r.maxMoment.value, 16 * 2, 0.01);
});

// --- Fourier --------------------------------------------------------------------

test('square-wave coefficients are 4/(πn) on odd harmonics only', () => {
  const c = coefficients('square', 7);
  assert.deepEqual(c.map((t) => t.n), [1, 3, 5, 7]);
  c.forEach((t) => near(t.amp, 4 / (Math.PI * t.n), 1e-9));
});

test('partial sums converge to the wave away from jumps, but overshoot ~9% at the jump (Gibbs)', () => {
  const many = coefficients('square', 401);
  near(partialSum(many, Math.PI / 2), 1, 0.01);
  near(partialSum(coefficients('sawtooth', 401), Math.PI / 2), 0.5, 0.02);
  near(partialSum(coefficients('triangle', 41), 0), 1, 0.02);
  // Peak of the partial sum next to the jump at t = 0 stays ≈ 1.179 (≈ 9% of the jump of 2) however many terms.
  let peak = 0;
  for (let k = 1; k < 400; k++) peak = Math.max(peak, partialSum(many, (k / 400) * 0.05));
  near(peak, 1.179, 0.01);
});
