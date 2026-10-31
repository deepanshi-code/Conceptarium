import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SURFACES, createOptimizer, step } from '../js/optim.js';

const run = (kind, surface, lr, start = surface.start, maxSteps = 2000) => {
  const opt = createOptimizer(kind, start);
  for (let i = 0; i < maxSteps && opt.status === 'running'; i++) step(opt, surface.grad, lr);
  return opt;
};

test('analytic gradients match finite differences on every surface', () => {
  const h = 1e-5;
  for (const [name, s] of Object.entries(SURFACES)) {
    for (const [x, z] of [[0.3, -1.2], [2, 2], [-2.5, 0.7], [1, 0]]) {
      const [gx, gz] = s.grad(x, z);
      const nx = (s.f(x + h, z) - s.f(x - h, z)) / (2 * h);
      const nz = (s.f(x, z + h) - s.f(x, z - h)) / (2 * h);
      assert.ok(Math.abs(gx - nx) < 1e-5 && Math.abs(gz - nz) < 1e-5, `${name} gradient wrong at (${x}, ${z})`);
    }
  }
});

test('every optimizer converges to the minimum of the bowl', () => {
  for (const [kind, lr] of [['gd', 0.5], ['momentum', 0.1], ['adam', 0.1]]) {
    const opt = run(kind, SURFACES.bowl, lr);
    assert.equal(opt.status, 'converged', kind);
    assert.ok(Math.hypot(...opt.p) < 1e-3, `${kind} ended at ${opt.p}`);
  }
});

test('gradient descent diverges when lr > 2 / L', () => {
  const s = SURFACES.valley;
  assert.equal(run('gd', s, 2 / s.maxCurvature + 0.05).status, 'diverged');
  assert.equal(run('gd', s, 2 / s.maxCurvature - 0.05).status, 'converged');
});

test('narrow valley at its default lr: Momentum converges in fewer steps than plain descent', () => {
  const s = SURFACES.valley;
  const gd = run('gd', s, s.lr);
  const momentum = run('momentum', s, s.lr);
  assert.equal(gd.status, 'converged');
  assert.equal(momentum.status, 'converged');
  assert.ok(momentum.t < gd.t, `momentum ${momentum.t} vs gd ${gd.t}`);
});

test('gradient descent started exactly on the saddle ridge gets stuck at the saddle', () => {
  const opt = run('gd', SURFACES.saddle, 0.5, [2, 0]);
  assert.equal(opt.status, 'converged');
  assert.ok(Math.hypot(...opt.p) < 1e-3);
});

test('a tiny nudge off the ridge escapes to a real minimum', () => {
  const opt = run('gd', SURFACES.saddle, 0.5, [2, 0.02]);
  assert.equal(opt.status, 'converged');
  assert.ok(SURFACES.saddle.f(...opt.p) < 0.01);
});

test('Himmelblau: the starting point decides which of the four minima you reach', () => {
  const ends = [[2, 2], [-2, 2], [-2, -2], [2, -2]].map((start) => run('gd', SURFACES.himmelblau, 0.3, start).p);
  for (const p of ends) assert.ok(SURFACES.himmelblau.f(...p) < 1e-6);
  const distinct = new Set(ends.map((p) => p.map((v) => v.toFixed(2)).join(',')));
  assert.equal(distinct.size, 4);
});
