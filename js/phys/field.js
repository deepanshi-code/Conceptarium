// Electric field and potential of point charges on a plane, in units where k = 1.
// Charges are { x, z, q }. A small softening length keeps values finite right at a charge.

const SOFT = 0.05;

export function potential(x, z, charges) {
  let v = 0;
  for (const c of charges) v += c.q / Math.sqrt((x - c.x) ** 2 + (z - c.z) ** 2 + SOFT * SOFT);
  return v;
}

export function field(x, z, charges) {
  let ex = 0;
  let ez = 0;
  for (const c of charges) {
    const dx = x - c.x;
    const dz = z - c.z;
    const r2 = dx * dx + dz * dz + SOFT * SOFT;
    const s = c.q / (r2 * Math.sqrt(r2));
    ex += s * dx;
    ez += s * dz;
  }
  return [ex, ez];
}

/**
 * Follow the field from (x, z) in fixed-length steps (midpoint method), `dir` = +1 along E, −1 against it.
 * Stops near an opposite charge, outside `bound`, or after `maxSteps`.
 */
export function traceLine(x, z, charges, { dir = 1, step = 0.05, maxSteps = 600, bound = 6 } = {}) {
  const pts = [[x, z]];
  const unit = (px, pz) => {
    const [ex, ez] = field(px, pz, charges);
    const m = Math.hypot(ex, ez) || 1;
    return [(dir * ex) / m, (dir * ez) / m];
  };
  for (let i = 0; i < maxSteps; i++) {
    const [ux, uz] = unit(x, z);
    const [mx, mz] = unit(x + (ux * step) / 2, z + (uz * step) / 2);
    x += mx * step;
    z += mz * step;
    pts.push([x, z]);
    if (Math.abs(x) > bound || Math.abs(z) > bound) break;
    if (charges.some((c) => Math.sign(c.q) === -dir && Math.hypot(x - c.x, z - c.z) < step * 1.5)) break;
  }
  return pts;
}
