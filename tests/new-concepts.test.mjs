import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SORTS, sortSteps } from '../js/algo/sort.js';
import { schedule } from '../js/os/schedule.js';
import { potential, field, traceLine } from '../js/phys/field.js';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`);

test('every sort ends sorted, and each step is a permutation of the input', () => {
  const inputs = [[], [1], [3, 1, 2], [5, 4, 3, 2, 1], [1, 2, 3, 4], [4, 1, 4, 2, 2, 9, 0, 7, 7, 3]];
  for (let k = 0; k < 20; k++) inputs.push(Array.from({ length: 15 }, () => Math.floor(Math.random() * 30)));
  for (const name of Object.keys(SORTS)) {
    for (const input of inputs) {
      const { steps } = sortSteps(name, input);
      const expected = [...input].sort((a, b) => a - b);
      assert.deepEqual(steps.at(-1).a, expected, `${name} on ${input}`);
      for (const s of steps) assert.deepEqual([...s.a].sort((a, b) => a - b), expected);
    }
  }
});

test('bubble and insertion sort need n − 1 comparisons on sorted input, merge sort needs fewer than n² on reversed', () => {
  const sorted = Array.from({ length: 20 }, (_, i) => i);
  assert.equal(sortSteps('bubble', sorted).compares, 19);
  assert.equal(sortSteps('insertion', sorted).compares, 19);
  assert.equal(sortSteps('bubble', sorted).writes, 0);
  const reversed = [...sorted].reverse();
  assert.equal(sortSteps('selection', reversed).compares, (20 * 19) / 2);
  assert.ok(sortSteps('merge', reversed).compares < 20 * Math.log2(20));
});

// Textbook example (Silberschatz-style): P1 24, P2 3, P3 3, all at t = 0.
const convoy = [
  { id: 'P1', arrival: 0, burst: 24, priority: 3 },
  { id: 'P2', arrival: 0, burst: 3, priority: 1 },
  { id: 'P3', arrival: 0, burst: 3, priority: 2 },
];

test('FCFS convoy effect: average waiting (0 + 24 + 27) / 3 = 17', () => {
  near(schedule(convoy, 'fcfs').avgWaiting, 17);
});

test('SJF on the same jobs: (6 + 0 + 3) / 3 = 3', () => {
  near(schedule(convoy, 'sjf').avgWaiting, 3);
});

test('Round Robin q = 4: P1 waits 6, P2 waits 4, P3 waits 7', () => {
  const r = schedule(convoy, 'rr', 4);
  assert.deepEqual(r.results.map((x) => x.waiting), [6, 4, 7]);
  assert.deepEqual(r.slices.map((s) => s.id), ['P1', 'P2', 'P3', 'P1']);
});

test('SRTF preempts when a shorter job arrives (average waiting 6.5)', () => {
  const procs = [
    { id: 'P1', arrival: 0, burst: 8, priority: 1 },
    { id: 'P2', arrival: 1, burst: 4, priority: 1 },
    { id: 'P3', arrival: 2, burst: 9, priority: 1 },
    { id: 'P4', arrival: 3, burst: 5, priority: 1 },
  ];
  const r = schedule(procs, 'srtf');
  near(r.avgWaiting, 6.5);
  assert.deepEqual(r.slices.map((s) => s.id), ['P1', 'P2', 'P4', 'P1', 'P3']);
});

test('priority scheduling and idle gaps', () => {
  near(schedule(convoy, 'priority').avgWaiting, (0 + 3 + 6) / 3);
  const gap = schedule([{ id: 'A', arrival: 2, burst: 1, priority: 1 }], 'fcfs');
  assert.deepEqual(gap.slices, [{ id: null, start: 0, end: 2 }, { id: 'A', start: 2, end: 3 }]);
  for (const algo of ['fcfs', 'sjf', 'srtf', 'rr', 'priority']) {
    const r = schedule(convoy, algo, 3);
    const busy = r.slices.filter((s) => s.id).reduce((t, s) => t + s.end - s.start, 0);
    assert.equal(busy, 30, algo); // the CPU does exactly the total burst time of work
  }
});

test('electric field: dipole midpoint has zero potential, single charge follows 1/r and 1/r²', () => {
  const dipole = [{ x: -1, z: 0, q: 1 }, { x: 1, z: 0, q: -1 }];
  near(potential(0, 0, dipole), 0);
  near(potential(0, 3, dipole), 0);
  const one = [{ x: 0, z: 0, q: 2 }];
  near(potential(4, 0, one), 2 / Math.sqrt(16 + 0.0025));
  const [ex, ez] = field(0, 3, one);
  near(ez, 2 / 9, 1e-3);
  near(ex, 0);
});

test('a field line from a + charge ends on the − charge of a dipole', () => {
  const dipole = [{ x: -1, z: 0, q: 1 }, { x: 1, z: 0, q: -1 }];
  const pts = traceLine(-0.9, 0.05, dipole);
  const [x, z] = pts.at(-1);
  assert.ok(Math.hypot(x - 1, z) < 0.1, `ended at ${x}, ${z}`);
});
