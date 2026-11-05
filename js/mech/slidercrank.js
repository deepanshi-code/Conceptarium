// Slider-crank: the mechanism inside every piston engine. Crank radius r, connecting rod length l, crank angle θ
// measured from top dead centre. Piston distance from the crank centre: x = r cos θ + √(l² − r² sin² θ).

export const pistonX = (theta, r, l) => r * Math.cos(theta) + Math.sqrt(l * l - (r * Math.sin(theta)) ** 2);

/** Piston speed dx/dt for a crank turning at ω rad/s. */
export function pistonV(theta, r, l, omega) {
  const s = Math.sin(theta);
  return -r * omega * (s + (r * s * Math.cos(theta)) / Math.sqrt(l * l - (r * s) ** 2));
}

/** Four-stroke cycle: which stroke a crank angle (0..4π, two turns) belongs to. */
export const STROKES = ['Intake', 'Compression', 'Power', 'Exhaust'];
export const strokeAt = (theta) => STROKES[Math.floor((((theta % (4 * Math.PI)) + 4 * Math.PI) % (4 * Math.PI)) / Math.PI)];
