// Incompressible pipe flow. Continuity: A₁v₁ = A₂v₂. Bernoulli (same height, no losses): p + ½ρv² = constant.

export const RHO_WATER = 1000; // kg/m³
export const G = 9.81;

export const area = (d) => (Math.PI * d * d) / 4;

/** Velocities (m/s) and pressure drop (Pa) between the wide pipe and the throat for flow Q (m³/s). */
export function venturi(Q, D1, D2, rho = RHO_WATER) {
  const v1 = Q / area(D1);
  const v2 = Q / area(D2);
  const dp = 0.5 * rho * (v2 * v2 - v1 * v1);
  return { v1, v2, dp, dh: dp / (rho * G) };
}

/** Venturi meter: flow from the measured pressure drop. Q = A₂ √(2Δp / (ρ(1 − (A₂/A₁)²))). */
export function flowFromDrop(dp, D1, D2, rho = RHO_WATER) {
  const A1 = area(D1);
  const A2 = area(D2);
  return A2 * Math.sqrt((2 * dp) / (rho * (1 - (A2 / A1) ** 2)));
}
