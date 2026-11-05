import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CIRCUITS, GROUPS, truthTable } from '../js/digital/logic.js';
import { NEXT, registerNext, shiftNext, counterNext, toNumber, toBits } from '../js/digital/sequential.js';

const rows = (key) => truthTable(CIRCUITS[key]);

test('every grouped circuit exists and evaluates every row to 0/1', () => {
  for (const { keys } of Object.values(GROUPS)) {
    for (const key of keys) {
      assert.ok(CIRCUITS[key], key);
      for (const r of rows(key)) for (const v of Object.values(r.outs)) assert.ok(v === 0 || v === 1, key);
    }
  }
});

test('XNOR is 1 when inputs are equal', () => {
  assert.deepEqual(rows('xnor').map((r) => r.outs.Y), [1, 0, 0, 1]);
});

test('subtractors: A − B (− Bin) = Diff − 2·Borrow', () => {
  for (const r of rows('halfsub')) assert.equal(r.ins.A - r.ins.B, r.outs.Diff - 2 * r.outs.Borrow);
  for (const r of rows('fullsub')) assert.equal(r.ins.A - r.ins.B - r.ins.Bin, r.outs.Diff - 2 * r.outs.Bout);
});

test('2-bit multiplier gives the product of A1A0 and B1B0', () => {
  for (const r of rows('multiplier')) {
    const a = 2 * r.ins.A1 + r.ins.A0;
    const b = 2 * r.ins.B1 + r.ins.B0;
    assert.equal(8 * r.outs.P3 + 4 * r.outs.P2 + 2 * r.outs.P1 + r.outs.P0, a * b);
  }
});

test('comparator: exactly one of >, =, < is on, and it is the right one', () => {
  for (const r of rows('comparator')) {
    const { A, B } = r.ins;
    assert.deepEqual([r.outs['A>B'], r.outs['A=B'], r.outs['A<B']], [Number(A > B), Number(A === B), Number(A < B)]);
  }
});

test('MUX passes the selected input, DEMUX routes D to the selected output', () => {
  for (const r of rows('mux2')) assert.equal(r.outs.Y, r.ins.S ? r.ins.I1 : r.ins.I0);
  for (const r of rows('mux4')) assert.equal(r.outs.Y, r.ins[`I${2 * r.ins.S1 + r.ins.S0}`]);
  for (const r of rows('demux')) {
    const sel = 2 * r.ins.S1 + r.ins.S0;
    for (let k = 0; k < 4; k++) assert.equal(r.outs[`Y${k}`], k === sel ? r.ins.D : 0);
  }
});

test('decoder turns on exactly output AB; priority encoder reports the highest active input', () => {
  for (const r of rows('decoder')) {
    const sel = 2 * r.ins.A + r.ins.B;
    for (let k = 0; k < 4; k++) assert.equal(r.outs[`D${k}`], Number(k === sel));
  }
  for (const r of rows('encoder')) {
    const active = [0, 1, 2, 3].filter((k) => r.ins[`I${k}`]);
    assert.equal(r.outs.V, Number(active.length > 0));
    if (active.length) assert.equal(2 * r.outs.Y1 + r.outs.Y0, Math.max(...active));
  }
});

test('flip-flops: D copies, T toggles, JK holds / resets / sets / toggles, SR forbids S = R = 1', () => {
  assert.equal(NEXT.D(0, { D: 1 }), 1);
  assert.equal(NEXT.T(1, { T: 1 }), 0);
  assert.equal(NEXT.T(1, { T: 0 }), 1);
  assert.deepEqual([[0, 0], [0, 1], [1, 0], [1, 1]].map(([J, K]) => NEXT.JK(1, { J, K })), [1, 0, 1, 0]);
  assert.equal(NEXT.SR(0, { S: 1, R: 1 }), null);
});

test('register, shift register and counter', () => {
  assert.deepEqual(registerNext([0, 0, 0, 0], [1, 0, 1, 1], 1), [1, 0, 1, 1]);
  assert.deepEqual(registerNext([0, 1, 1, 0], [1, 0, 1, 1], 0), [0, 1, 1, 0]);
  let q = [0, 0, 0, 0];
  for (const bit of [1, 0, 1, 1]) q = shiftNext(q, bit);
  assert.deepEqual(q, [1, 1, 0, 1]); // the first bit in has reached Q0
  q = [0, 0, 0, 0];
  for (let i = 0; i < 16; i++) q = counterNext(q);
  assert.deepEqual(q, [0, 0, 0, 0]); // wrapped after 16 clocks
  assert.equal(toNumber(counterNext(toBits(0), { down: 1 })), 15);
  assert.deepEqual(counterNext([0, 1, 0, 1], { enable: 0 }), [0, 1, 0, 1]);
});
