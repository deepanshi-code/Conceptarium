// Statically determinate beams: reactions, shear force V(x), bending moment M(x) and deflection y(x).
// Units: kN, m, kN·m. Loads act downwards. Sign convention: sagging moment positive, deflection positive upwards.
// Deflection comes from integrating EI·y'' = M(x) twice with the support boundary conditions.

/**
 * @param {object} beam
 * @param {'simply'|'cantilever'} beam.type  simply supported at x = 0 and x = L, or fixed at x = 0 and free at x = L
 * @param {number} beam.L                   span (m)
 * @param {Array} beam.loads                {kind: 'point', a, P} or {kind: 'udl', start, end, w}
 * @param {number} [beam.EI]                flexural rigidity (kN·m²)
 */
export function analyzeBeam({ type, L, loads, EI = 10000, N = 600 }) {
  const parts = loads.flatMap((l) => {
    if (l.kind === 'point') return l.P ? [{ F: l.P, a: l.a, kind: 'point' }] : [];
    const s = Math.max(0, Math.min(l.start, l.end));
    const e = Math.min(L, Math.max(l.start, l.end));
    return l.w && e > s ? [{ kind: 'udl', w: l.w, s, e, F: l.w * (e - s), a: (s + e) / 2 }] : [];
  });
  const total = parts.reduce((sum, p) => sum + p.F, 0);
  const momentAboutA = parts.reduce((sum, p) => sum + p.F * p.a, 0);

  let RA;
  let RB = 0;
  let MA = 0; // fixing moment at a cantilever's wall
  if (type === 'simply') {
    RB = momentAboutA / L;
    RA = total - RB;
  } else {
    RA = total;
    MA = -momentAboutA; // hogging
  }

  // Shear and moment just to the right of x, from everything on the left.
  const shear = (x) => {
    let v = RA;
    for (const p of parts) {
      if (p.kind === 'point') { if (p.a <= x) v -= p.F; } else v -= p.w * Math.max(0, Math.min(x, p.e) - p.s);
    }
    return v;
  };
  const moment = (x) => {
    let m = MA + RA * x;
    for (const p of parts) {
      if (p.kind === 'point') { if (p.a <= x) m -= p.F * (x - p.a); } else {
        const len = Math.max(0, Math.min(x, p.e) - p.s);
        m -= p.w * len * (x - (p.s + len / 2));
      }
    }
    return m;
  };

  const x = Array.from({ length: N + 1 }, (_, i) => (L * i) / N);
  const V = x.map(shear);
  const M = x.map(moment);

  // Integrate M/EI twice (trapezoidal rule), then fix the two constants with the boundary conditions.
  const slope = [0];
  const defl = [0];
  for (let i = 1; i <= N; i++) {
    const dx = x[i] - x[i - 1];
    slope[i] = slope[i - 1] + ((M[i] + M[i - 1]) / 2) * dx / EI;
    defl[i] = defl[i - 1] + ((slope[i] + slope[i - 1]) / 2) * dx;
  }
  // Simply supported: y(0) = y(L) = 0, so add a linear correction. Cantilever: y(0) = y'(0) = 0 already.
  const y = type === 'simply' ? defl.map((d, i) => d - defl[N] * (x[i] / L)) : defl;

  const peak = (arr) => arr.reduce((best, v, i) => (Math.abs(v) > Math.abs(best.value) ? { value: v, x: x[i] } : best), { value: 0, x: 0 });
  // Where the shear changes sign the bending moment has a local maximum. Compare each sample with the last
  // non-zero one, so a shear that passes exactly through 0 on a sample point is still caught.
  const zeroShear = [];
  let last = null;
  for (let i = 0; i <= N; i++) {
    const s = V[i] > 1e-9 ? 1 : V[i] < -1e-9 ? -1 : 0;
    if (!s) continue;
    if (last && s !== last.s) {
      const t = V[last.i] / (V[last.i] - V[i]); // linear interpolation of the crossing
      zeroShear.push(x[last.i] + t * (x[i] - x[last.i]));
    }
    last = { s, i };
  }

  return {
    x, V, M, y,
    reactions: { RA, RB, MA },
    total,
    maxShear: peak(V),
    maxMoment: peak(M),
    maxDeflection: peak(y),
    zeroShear,
  };
}
