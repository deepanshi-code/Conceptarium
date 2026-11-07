import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solveCircuit } from '../js/elec/circuits.js';
import { flux, emf, transformer, rotatingField } from '../js/elec/machines.js';
import { solveTruss, prattTruss, solveLinear } from '../js/civil/truss.js';
import { venturi, flowFromDrop } from '../js/civil/fluid.js';
import { MATERIALS, stressAt, toughness } from '../js/mech/material.js';
import { stepResponse, GRAVITY } from '../js/elec/pid.js';
import { aliasFrequency, apparentRotation, diodeCurrent, depletionWidth } from '../js/ece/signals.js';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`);

test('DC circuits: equivalent resistance, Kirchhoff’s laws', () => {
  const s = solveCircuit('series', 12, [2, 4, 6]);
  near(s.Req, 12);
  near(s.parts.reduce((a, p) => a + p.V, 0), 12); // KVL
  const p = solveCircuit('parallel', 12, [2, 4, 6]);
  near(p.Req, 12 / 11);
  near(p.parts.reduce((a, q) => a + q.I, 0), p.I); // KCL
  const m = solveCircuit('mixed', 10, [2, 6, 3]);
  near(m.Req, 4); // 2 + (6 ∥ 3) = 2 + 2
  near(m.parts[1].I + m.parts[2].I, m.parts[0].I);
  near(m.parts[0].V + m.parts[1].V, 10);
});

test('induction: emf flips sign as the magnet passes the coil; transformer ratios', () => {
  assert.ok(emf(-1, 1, 100) * emf(1, 1, 100) < 0);
  near(emf(0, 1, 100), 0);
  assert.ok(flux(0) > flux(1));
  const t = transformer(230, 1000, 50, 10);
  near(t.Vs, 11.5);
  assert.equal(t.kind, 'step-down');
  near(t.Vs * t.Is, 230 * t.Ip); // power in = power out
});

test('three-phase field: constant size 1.5, rotating with ωt; one phase off makes it pulse', () => {
  for (const wt of [0, 0.7, 2, 4, 5.5]) {
    const f = rotatingField(wt);
    near(f.magnitude, 1.5);
    near(Math.cos(f.angle), Math.cos(wt));
  }
  const two = [0, 1, 2, 3].map((wt) => rotatingField(wt, [true, true, false]).magnitude);
  assert.ok(Math.max(...two) - Math.min(...two) > 0.3);
});

test('linear solver and a simple triangle truss', () => {
  near(solveLinear([[2, 1], [1, 3]], [3, 5])[1], 1.4);
  // Apex load P on an isosceles triangle: rafters in compression P/(2 sin θ), tie in tension P/(2 tan θ).
  const L = 4;
  const h = 1.5;
  const r = solveTruss({ nodes: [[0, 0], [L, 0], [L / 2, h]], members: [[0, 1], [0, 2], [1, 2]], supports: [{ node: 0, x: true, y: true }, { node: 1, x: false, y: true }], loads: [{ node: 2, fy: -10 }] });
  const th = Math.atan2(h, L / 2);
  near(r.forces[1], -10 / (2 * Math.sin(th)), 1e-9);
  near(r.forces[0], 10 / (2 * Math.tan(th)), 1e-9);
});

test('Pratt truss: reactions balance the load; bottom chord in tension, top chord in compression', () => {
  const t = prattTruss(6, 2, 2);
  const r = solveTruss({ ...t, loads: [{ node: 3, fy: -60 }] });
  const ry = r.reactions.filter((x) => x.dir === 'y').reduce((s, x) => s + x.value, 0);
  near(ry, 60, 1e-9);
  t.members.forEach(([i, j], k) => {
    if (t.nodes[i][1] === 0 && t.nodes[j][1] === 0) assert.ok(r.forces[k] >= -1e-9, 'bottom chord');
    if (t.nodes[i][1] > 0 && t.nodes[j][1] > 0) assert.ok(r.forces[k] <= 1e-9, 'top chord');
  });
});

test('Venturi: continuity, Bernoulli, and the meter equation round-trips', () => {
  const v = venturi(0.01, 0.1, 0.05);
  near(v.v2 / v.v1, 4); // half the diameter = a quarter of the area
  assert.ok(v.dp > 0);
  near(flowFromDrop(v.dp, 0.1, 0.05), 0.01, 1e-9);
});

test('stress–strain: Hooke’s law slope is E; brittle cast iron has no yield and little strain', () => {
  const e = 0.0005;
  near(stressAt('steel', e) / e, MATERIALS.steel.E * 1000, 1e-6);
  assert.equal(stressAt('steel', 0.31), null); // fractured
  assert.ok(Math.max(...Array.from({ length: 100 }, (_, i) => stressAt('steel', (i / 100) * 0.3))) <= MATERIALS.steel.uts + 1e-9);
  assert.ok(toughness('steel') > 20 * toughness('castiron'));
});

test('PID: P-only leaves a steady error of g/Kp; adding I removes it', () => {
  const p = stepResponse({ Kp: 4, Ki: 0, Kd: 3 });
  near(p.steadyError, GRAVITY / 4, 0.02);
  const pid = stepResponse({ Kp: 4, Ki: 2, Kd: 3 }, 5, 40);
  assert.ok(Math.abs(pid.steadyError) < 0.02);
});

test('aliasing and the diode', () => {
  near(aliasFrequency(7, 10), 3);
  near(aliasFrequency(3, 10), 3);
  near(aliasFrequency(10, 10), 0);
  near(apparentRotation(9, 10), -1); // a wheel at 9 rev/s filmed at 10 fps seems to turn backwards slowly
  near(diodeCurrent(0), 0);
  assert.ok(diodeCurrent(-5) < 0 && diodeCurrent(-5) > -2e-12); // reverse: tiny leakage
  assert.ok(diodeCurrent(0.7) > 1e-3); // forward: milliamps and more
  assert.ok(depletionWidth(-5) > depletionWidth(0) && depletionWidth(0.5) < depletionWidth(0));
});
