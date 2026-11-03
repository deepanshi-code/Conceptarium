import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trajectory } from '../js/phys/projectile.js';
import { CIRCUITS, truthTable, evaluate } from '../js/digital/logic.js';
import { hanoiMoves, applyMove } from '../js/algo/hanoi.js';
import { MODELS, journey } from '../js/net/packet.js';
import { checkBrackets } from '../js/ds/brackets.js';

const near = (a, b, rel = 0.002) => assert.ok(Math.abs(a - b) <= rel * Math.abs(b), `${a} vs ${b}`);

test('projectile without drag matches R = v² sin2θ / g, H = v² sin²θ / 2g, T = 2v sinθ / g', () => {
  for (const angle of [15, 30, 45, 60, 75]) {
    const v = 20;
    const g = 9.81;
    const a = (angle * Math.PI) / 180;
    const r = trajectory({ v, angle, g });
    near(r.range, (v * v * Math.sin(2 * a)) / g);
    near(r.peak, (v * v * Math.sin(a) ** 2) / (2 * g));
    near(r.time, (2 * v * Math.sin(a)) / g);
  }
});

test('projectile: 45° gives the longest range without drag, drag shortens it', () => {
  const best = [30, 40, 45, 50, 60].map((angle) => trajectory({ v: 25, angle }).range);
  assert.equal(Math.max(...best), best[2]);
  assert.ok(trajectory({ v: 25, angle: 45, k: 0.02 }).range < best[2]);
});

test('half and full adder truth tables add the bits', () => {
  for (const row of truthTable(CIRCUITS.half)) assert.equal(row.outs.Sum + 2 * row.outs.Carry, row.ins.A + row.ins.B);
  const rows = truthTable(CIRCUITS.full);
  assert.equal(rows.length, 8);
  for (const row of rows) assert.equal(row.outs.Sum + 2 * row.outs.Cout, row.ins.A + row.ins.B + row.ins.Cin);
});

test('basic gates', () => {
  const out = (c, A, B) => evaluate(CIRCUITS[c], { A, B }).g;
  assert.deepEqual([[0, 0], [0, 1], [1, 0], [1, 1]].map(([a, b]) => out('nand', a, b)), [1, 1, 1, 0]);
  assert.deepEqual([[0, 0], [0, 1], [1, 0], [1, 1]].map(([a, b]) => out('xor', a, b)), [0, 1, 1, 0]);
  assert.equal(out('not', 1), 0);
});

test('Tower of Hanoi: 2ⁿ − 1 legal moves end with every disk on C', () => {
  for (let n = 1; n <= 7; n++) {
    const moves = hanoiMoves(n);
    assert.equal(moves.length, 2 ** n - 1);
    const pegs = [Array.from({ length: n }, (_, i) => n - i), [], []];
    for (const m of moves) assert.equal(applyMove(pegs, m.from, m.to), null);
    assert.deepEqual(pegs[2], Array.from({ length: n }, (_, i) => n - i));
    assert.ok(moves.every((m) => m.stack.length <= n));
  }
  assert.match(applyMove([[1], [], [2]], 2, 0), /can't go/);
});

test('packet journey: headers wrap on the way down, unwrap fully at the receiver, router stops at the network layer', () => {
  for (const key of Object.keys(MODELS)) {
    const steps = journey(key);
    const { layers, networkLayer } = MODELS[key];
    assert.equal(steps.find((s) => s.node === 'wire1').headers.length, layers.length);
    assert.deepEqual(steps.at(-1).headers, []);
    assert.equal(Math.min(...steps.filter((s) => s.node === 'router').map((s) => s.layer)), networkLayer);
    // When the router decides where to send it, the outermost header is the one it reads: IP.
    assert.equal(steps.find((s) => s.action === 'route').headers.at(-1), 'IP');
  }
});

test('bracket checker', () => {
  assert.equal(checkBrackets('{[()()]}').ok, true);
  assert.equal(checkBrackets('a*(b+c)').ok, true);
  assert.equal(checkBrackets('([)]').ok, false);
  assert.equal(checkBrackets('((').ok, false);
  assert.equal(checkBrackets(')').ok, false);
});
