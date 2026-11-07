// Electromagnetic induction, transformers and three-phase rotating fields.

/** Flux through a coil from a bar magnet whose centre is at distance x along the coil axis (model shape). */
export const flux = (x, phi0 = 1, a = 1) => phi0 / (1 + (x / a) ** 2) ** 1.5;

/** Faraday: emf = −N dΦ/dt = −N (dΦ/dx)(dx/dt). */
export function emf(x, v, N, phi0 = 1, a = 1) {
  const dPhiDx = (-3 * phi0 * x) / (a * a * (1 + (x / a) ** 2) ** 2.5);
  return -N * dPhiDx * v;
}

/** Ideal transformer: Vs/Vp = Ns/Np, and power in = power out, so Is/Ip = Np/Ns. */
export function transformer(Vp, Np, Ns, loadOhms) {
  const Vs = (Vp * Ns) / Np;
  const Is = Vs / loadOhms;
  const Ip = (Is * Ns) / Np;
  return { Vs, Is, Ip, P: Vs * Is, kind: Ns > Np ? 'step-up' : Ns < Np ? 'step-down' : 'isolation' };
}

/**
 * Three coils 120° apart carrying currents cos(ωt − k·120°). Their fields add to one vector of constant size
 * (1.5 × each coil's peak) that rotates at ω. Switch a phase off (enabled[k] = false) and it just pulses.
 */
export function rotatingField(wt, enabled = [true, true, true]) {
  let x = 0;
  let y = 0;
  const phases = [0, 1, 2].map((k) => {
    const shift = (k * 2 * Math.PI) / 3;
    const i = enabled[k] ? Math.cos(wt - shift) : 0;
    x += i * Math.cos(shift);
    y += i * Math.sin(shift);
    return { i, angle: shift };
  });
  return { phases, x, y, magnitude: Math.hypot(x, y), angle: Math.atan2(y, x) };
}
