// Small 3x3 linear-algebra helpers. Matrices are arrays of rows: [[a, b, c], [d, e, f], [g, h, i]].
// Kept dependency-free so the maths can be unit-tested without a browser.

const EPS = 1e-9;

export const identity3 = () => [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

export function det3(m) {
  const [[a, b, c], [d, e, f], [g, h, i]] = m;
  return a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
}

export function trace3(m) {
  return m[0][0] + m[1][1] + m[2][2];
}

export function mulVec3(m, v) {
  return m.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);
}

// (1 - t) I + t A. Any eigenvector of A with eigenvalue λ is also an eigenvector of this blend,
// with eigenvalue (1 - t) + tλ, so eigenvectors stay on their span for the whole animation.
export function lerpFromIdentity(m, t) {
  return m.map((row, r) => row.map((val, c) => (r === c ? 1 - t : 0) + t * val));
}

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (v) => Math.hypot(v[0], v[1], v[2]);
const scale = (v, s) => v.map((x) => x * s);
const normalize = (v) => scale(v, 1 / norm(v));

/**
 * Roots of λ³ + aλ² + bλ + c = 0 using the depressed-cubic (Cardano / trigonometric) method.
 * Returns three roots as {re, im}.
 */
export function solveCubic(a, b, c) {
  const shift = -a / 3;
  const p = b - (a * a) / 3;
  const q = (2 * a * a * a) / 27 - (a * b) / 3 + c;
  // Scale the tolerance with the coefficients so "zero discriminant" works for big and small matrices.
  const tol = 1e-10 * Math.max(1, Math.abs(p) ** 3, q * q);
  const disc = (q / 2) ** 2 + (p / 3) ** 3;

  if (Math.abs(p) < 1e-12 && Math.abs(q) < 1e-12) {
    return [0, 1, 2].map(() => ({ re: shift, im: 0 }));
  }
  if (disc > tol) {
    const s = Math.sqrt(disc);
    const u = Math.cbrt(-q / 2 + s);
    const v = Math.cbrt(-q / 2 - s);
    const re = -(u + v) / 2 + shift;
    const im = (Math.sqrt(3) / 2) * (u - v);
    return [{ re: u + v + shift, im: 0 }, { re, im }, { re, im: -im }];
  }
  if (disc >= -tol) {
    // Repeated root.
    const x1 = (3 * q) / p;
    const x2 = (-3 * q) / (2 * p);
    return [{ re: x1 + shift, im: 0 }, { re: x2 + shift, im: 0 }, { re: x2 + shift, im: 0 }];
  }
  const r = 2 * Math.sqrt(-p / 3);
  const arg = Math.min(1, Math.max(-1, ((3 * q) / (2 * p)) * Math.sqrt(-3 / p)));
  const phi = Math.acos(arg) / 3;
  return [0, 1, 2].map((k) => ({ re: r * Math.cos(phi - (2 * Math.PI * k) / 3) + shift, im: 0 }));
}

/**
 * Null space of a 3x3 matrix B, classified by dimension.
 * kind: 'line' (rank 2), 'plane' (rank 1) or 'all' (B ≈ 0).
 */
export function nullSpace(B, tol = 1e-6) {
  const rowNorms = B.map(norm);
  const maxRow = Math.max(...rowNorms);
  if (maxRow < tol) return { kind: 'all', basis: [[1, 0, 0], [0, 1, 0], [0, 0, 1]] };

  // Rank 2: the null space is perpendicular to every row, so it is the cross product of two rows.
  const crosses = [cross(B[0], B[1]), cross(B[0], B[2]), cross(B[1], B[2])];
  const best = crosses.reduce((m, v) => (norm(v) > norm(m) ? v : m));
  if (norm(best) > tol * maxRow * maxRow) return { kind: 'line', basis: [normalize(best)] };

  // Rank 1: everything perpendicular to the (single independent) row.
  const r = normalize(B[rowNorms.indexOf(maxRow)]);
  const helper = Math.abs(r[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = normalize(cross(r, helper));
  const w = normalize(cross(r, u));
  return { kind: 'plane', basis: [u, w] };
}

/**
 * Eigen-decomposition of a real 3x3 matrix.
 * Returns {values, spaces}:
 *  - values: all three eigenvalues as {re, im} (complex ones come in conjugate pairs)
 *  - spaces: one entry per distinct REAL eigenvalue: {lambda, multiplicity, kind, basis}
 */
export function eigen3(m) {
  const tr = trace3(m);
  const minors =
    m[0][0] * m[1][1] - m[0][1] * m[1][0] +
    m[0][0] * m[2][2] - m[0][2] * m[2][0] +
    m[1][1] * m[2][2] - m[1][2] * m[2][1];
  const det = det3(m);
  // Characteristic polynomial: λ³ − tr·λ² + minors·λ − det = 0
  const values = solveCubic(-tr, minors, -det).map(({ re, im }) => ({ re: clean(re), im: clean(im) }));

  const spaces = [];
  for (const { re, im } of values) {
    if (Math.abs(im) > 1e-7) continue;
    const existing = spaces.find((s) => Math.abs(s.lambda - re) < 1e-5);
    if (existing) {
      existing.multiplicity += 1;
      continue;
    }
    const B = m.map((row, r) => row.map((val, c) => val - (r === c ? re : 0)));
    spaces.push({ lambda: re, multiplicity: 1, ...nullSpace(B, 1e-5) });
  }
  spaces.sort((a, b) => b.lambda - a.lambda);
  return { values, spaces };
}

// Snap floating-point noise like 2.0000000001 or 1e-17 so the UI shows clean numbers.
function clean(x) {
  const rounded = Math.round(x);
  if (Math.abs(x - rounded) < 1e-8) return rounded;
  return Math.abs(x) < EPS ? 0 : x;
}
