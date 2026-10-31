// Loss surfaces f(x, z) with analytic gradients, and the optimizers that walk on them.
// Pure functions only, so they can be unit-tested in Node.

export const SURFACES = {
  bowl: {
    name: 'Round bowl (convex)',
    f: (x, z) => 0.25 * (x * x + z * z),
    grad: (x, z) => [0.5 * x, 0.5 * z],
    // For a quadratic, plain gradient descent is stable only when lr < 2 / L,
    // where L is the largest curvature (second derivative).
    maxCurvature: 0.5,
    yScale: 0.6,
    start: [2.5, 2],
    lr: 0.5,
  },
  valley: {
    name: 'Narrow valley (ill-conditioned)',
    // Curvatures 0.02 vs 1.2: a condition number of 60, enough for Momentum to clearly beat plain descent.
    f: (x, z) => 0.01 * x * x + 0.6 * z * z,
    grad: (x, z) => [0.02 * x, 1.2 * z],
    maxCurvature: 1.2,
    yScale: 0.45,
    start: [-2.8, 2.5],
    lr: 1.2,
  },
  saddle: {
    name: 'Saddle point',
    f: (x, z) => 0.1 * x * x - 0.3 * z * z + 0.04 * z ** 4 + 0.5625,
    grad: (x, z) => [0.2 * x, -0.6 * z + 0.16 * z ** 3],
    yScale: 1.2,
    start: [2.5, 0.02],
    lr: 0.5,
  },
  himmelblau: {
    // Himmelblau's function: a standard optimization benchmark with four equal minima. Scaled by 1/60.
    name: 'Four minima (Himmelblau)',
    f: (x, z) => ((x * x + z - 11) ** 2 + (x + z * z - 7) ** 2) / 60,
    grad: (x, z) => {
      const a = x * x + z - 11;
      const b = x + z * z - 7;
      return [(4 * x * a + 2 * b) / 60, (2 * a + 4 * z * b) / 60];
    },
    yScale: 0.8,
    start: [-0.3, -0.6],
    lr: 0.3,
  },
};

export const DOMAIN = 3; // surfaces are drawn on [-3, 3]²

export const OPTIMIZERS = {
  gd: { name: 'Gradient descent' },
  momentum: { name: 'Momentum (β = 0.9)' },
  adam: { name: 'Adam' },
};

export function createOptimizer(kind, start) {
  return { kind, p: [...start], v: [0, 0], m: [0, 0], s: [0, 0], t: 0, status: 'running' };
}

/** One update step. Mutates and returns the optimizer state. */
export function step(opt, grad, lr) {
  if (opt.status !== 'running') return opt;
  const g = grad(opt.p[0], opt.p[1]);
  opt.t += 1;

  if (opt.kind === 'gd') {
    opt.p = opt.p.map((p, i) => p - lr * g[i]);
  } else if (opt.kind === 'momentum') {
    // Velocity accumulates past gradients, so it builds speed along consistent directions
    // and cancels out back-and-forth zig-zags.
    opt.v = opt.v.map((v, i) => 0.9 * v + g[i]);
    opt.p = opt.p.map((p, i) => p - lr * opt.v[i]);
  } else if (opt.kind === 'adam') {
    const b1 = 0.9, b2 = 0.999, eps = 1e-8;
    opt.m = opt.m.map((m, i) => b1 * m + (1 - b1) * g[i]);
    opt.s = opt.s.map((s, i) => b2 * s + (1 - b2) * g[i] * g[i]);
    const mHat = opt.m.map((m) => m / (1 - b1 ** opt.t));
    const sHat = opt.s.map((s) => s / (1 - b2 ** opt.t));
    // Dividing by √(s) rescales each coordinate, so steps are about lr in size whatever the slope.
    opt.p = opt.p.map((p, i) => p - (lr * mHat[i]) / (Math.sqrt(sHat[i]) + eps));
  }

  const [x, z] = opt.p;
  if (!Number.isFinite(x) || !Number.isFinite(z) || Math.abs(x) > DOMAIN * 1.5 || Math.abs(z) > DOMAIN * 1.5) {
    opt.status = 'diverged';
  } else {
    const gNew = grad(x, z);
    const stepSize = Math.hypot(x - (opt.prev?.[0] ?? Infinity), z - (opt.prev?.[1] ?? Infinity));
    if (Math.hypot(...gNew) < 1e-4 && stepSize < 1e-4) opt.status = 'converged';
  }
  opt.prev = [x, z];
  return opt;
}
