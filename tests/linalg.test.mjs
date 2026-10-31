// Run with: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eigen3, det3, lerpFromIdentity, mulVec3 } from '../js/linalg.js';

const close = (a, b, tol = 1e-6) => Math.abs(a - b) < tol;

const assertValues = (spaces, expected) =>
  assert.ok(spaces.length === expected.length && spaces.every((s, i) => close(s.lambda, expected[i])), `got ${spaces.map((s) => s.lambda)}`);

// For every reported eigenvector v: A·v must equal λ·v.
function assertEigenPairs(A) {
  const { spaces } = eigen3(A);
  for (const s of spaces) {
    for (const v of s.basis) {
      const Av = mulVec3(A, v);
      Av.forEach((x, i) => assert.ok(close(x, s.lambda * v[i]), `A·v ≠ λv for λ=${s.lambda}`));
    }
  }
  return spaces;
}

test('diagonal matrix: eigenvalues are the diagonal entries', () => {
  const spaces = assertEigenPairs([[2, 0, 0], [0, 1, 0], [0, 0, 0.5]]);
  assertValues(spaces, [2, 1, 0.5]);
});

test('symmetric matrix: eigenvectors are perpendicular', () => {
  const spaces = assertEigenPairs([[2, 1, 0], [1, 2, 0], [0, 0, 0.5]]);
  assertValues(spaces, [3, 1, 0.5]);
  const [a, b] = spaces.map((s) => s.basis[0]);
  assert.ok(close(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], 0));
});

test('shear is defective: triple eigenvalue, only a plane of eigenvectors', () => {
  const [s] = assertEigenPairs([[1, 1, 0], [0, 1, 0], [0, 0, 1]]);
  assert.equal(s.lambda, 1);
  assert.equal(s.multiplicity, 3);
  assert.equal(s.kind, 'plane');
});

test('rotation: one real eigenvalue (the axis) and a complex pair', () => {
  const c = 0.5, s = Math.sqrt(3) / 2;
  const { values, spaces } = eigen3([[c, -s, 0], [s, c, 0], [0, 0, 1]]);
  assert.equal(spaces.length, 1);
  assert.equal(spaces[0].lambda, 1);
  assert.ok(close(Math.abs(spaces[0].basis[0][2]), 1));
  assert.equal(values.filter((v) => Math.abs(v.im) > 1e-7).length, 2);
});

test('identity: every vector is an eigenvector', () => {
  const { spaces } = eigen3([[1, 0, 0], [0, 1, 0], [0, 0, 1]]);
  assert.equal(spaces.length, 1);
  assert.equal(spaces[0].kind, 'all');
});

test('projection: det is 0 and λ = 0 is the squashed direction', () => {
  const A = [[1, 0, 0], [0, 1, 0], [0, 0, 0]];
  assert.equal(det3(A), 0);
  const spaces = assertEigenPairs(A);
  const zero = spaces.find((s) => close(s.lambda, 0));
  assert.equal(zero.kind, 'line');
});

test('random matrices: every reported eigenpair satisfies A·v = λv', () => {
  for (let k = 0; k < 200; k++) {
    const A = [0, 1, 2].map(() => [0, 1, 2].map(() => Math.round((Math.random() * 6 - 3) * 10) / 10));
    assertEigenPairs(A);
  }
});

test('blend (1-t)I + tA keeps eigenvectors of A', () => {
  const A = [[1, 1, 0], [0, 2, 0], [0, 0, 1.5]];
  const v = [1, 1, 0];
  const M = lerpFromIdentity(A, 0.3);
  const Mv = mulVec3(M, v);
  const factor = 0.7 + 0.3 * 2;
  Mv.forEach((x, i) => assert.ok(close(x, factor * v[i])));
});
