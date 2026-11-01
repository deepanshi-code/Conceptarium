// Fourier series of standard periodic waves (period 2π), written as terms amp·sin(n·t + phase).
// Each term is a rotating vector of length `amp` spinning n times per period: added tip-to-tail they draw the wave.

export const WAVES = {
  square: { name: 'Square wave', formula: 'f(t) = (4/π) [ sin t + sin 3t/3 + sin 5t/5 + … ]' },
  sawtooth: { name: 'Sawtooth wave', formula: 'f(t) = (2/π) [ sin t − sin 2t/2 + sin 3t/3 − … ]' },
  triangle: { name: 'Triangle wave', formula: 'f(t) = (8/π²) [ cos t + cos 3t/9 + cos 5t/25 + … ]' },
};

/** Terms up to and including harmonic `maxN`, skipping harmonics whose coefficient is zero. */
export function coefficients(wave, maxN) {
  const terms = [];
  for (let n = 1; n <= maxN; n++) {
    if (wave === 'square' && n % 2) terms.push({ n, amp: 4 / (Math.PI * n), phase: 0 });
    if (wave === 'sawtooth') terms.push({ n, amp: (2 / (Math.PI * n)) * (n % 2 ? 1 : -1), phase: 0 });
    if (wave === 'triangle' && n % 2) terms.push({ n, amp: 8 / (Math.PI * Math.PI * n * n), phase: Math.PI / 2 });
  }
  return terms;
}

export const partialSum = (terms, t) => terms.reduce((s, { n, amp, phase }) => s + amp * Math.sin(n * t + phase), 0);

/** The exact wave, for comparison with the partial sum. */
export function target(wave, t) {
  const u = ((t + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; // wrap to (−π, π]
  if (wave === 'square') return u === 0 ? 0 : Math.sign(u);
  if (wave === 'sawtooth') return u / Math.PI;
  return 1 - (2 * Math.abs(u)) / Math.PI;
}

/** Number of terms needed for harmonic count k in the UI (square/triangle only use odd harmonics). */
export const maxHarmonic = (wave, k) => (wave === 'sawtooth' ? k : 2 * k - 1);
