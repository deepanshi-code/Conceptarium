import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linearSteps, binarySteps, worstBinary } from '../js/algo/search.js';
import { springPeriod, smallAnglePeriod, truePeriod } from '../js/phys/shm.js';
import { predict, mistakes, train } from '../js/ml/perceptron.js';
import { simulate } from '../js/os/paging.js';

const near = (a, b, rel) => assert.ok(Math.abs(a - b) <= rel * Math.abs(b), `${a} vs ${b}`);

test('binary search finds every value within ⌈log₂(n+1)⌉ steps; linear search takes index + 1', () => {
  const arr = Array.from({ length: 100 }, (_, i) => i * 3 + 1);
  for (const [i, v] of arr.entries()) {
    const b = binarySteps(arr, v);
    assert.equal(arr[b.at(-1).i], v);
    assert.ok(b.at(-1).found);
    assert.ok(b.length <= worstBinary(arr.length));
    assert.equal(linearSteps(arr, v).length, i + 1);
  }
  assert.equal(worstBinary(100), 7);
  assert.ok(!binarySteps(arr, 2).at(-1).found); // missing value
});

test('spring and small-swing pendulum periods; big swings are slower than the formula', () => {
  near(springPeriod(1, 4 * Math.PI ** 2), 1, 1e-12);
  const L = 1;
  const g = 9.81;
  near(truePeriod(L, g, 0.05), smallAnglePeriod(L, g), 0.001);
  // Known result: at 60° amplitude the period is about 7.3% longer than 2π√(L/g).
  near(truePeriod(L, g, Math.PI / 3) / smallAnglePeriod(L, g), 1.0732, 0.002);
});

test('perceptron converges on separable data and never on XOR', () => {
  const pts = [];
  for (let i = 0; i < 40; i++) {
    const x = Math.cos(i * 2.4) * 3;
    const z = Math.sin(i * 1.7) * 3;
    if (Math.abs(x + z - 0.5) > 0.3) pts.push({ x, z, y: x + z > 0.5 ? 1 : -1 });
  }
  const r = train(pts);
  assert.ok(r.converged);
  assert.equal(mistakes(r.w, pts).length, 0);
  const xor = [{ x: -1, z: -1, y: -1 }, { x: 1, z: 1, y: -1 }, { x: -1, z: 1, y: 1 }, { x: 1, z: -1, y: 1 }];
  const rx = train(xor, { maxSteps: 2000 });
  assert.ok(!rx.converged);
  assert.ok(mistakes(rx.w, xor).length >= 1);
  assert.equal(predict([1, 0, 0], { x: 2, z: 0 }), 1);
});

test('page replacement: textbook string gives FIFO 15, LRU 12, Optimal 9 faults with 3 frames', () => {
  const refs = [7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2, 1, 2, 0, 1, 7, 0, 1];
  assert.equal(simulate(refs, 3, 'fifo').faults, 15);
  assert.equal(simulate(refs, 3, 'lru').faults, 12);
  assert.equal(simulate(refs, 3, 'opt').faults, 9);
});

test("Belady's anomaly: FIFO gets more faults with 4 frames than with 3", () => {
  const refs = [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5];
  assert.equal(simulate(refs, 3, 'fifo').faults, 9);
  assert.equal(simulate(refs, 4, 'fifo').faults, 10);
  assert.ok(simulate(refs, 4, 'lru').faults <= simulate(refs, 3, 'lru').faults);
});
