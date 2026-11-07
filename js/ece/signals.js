// Sampling and aliasing, and the PN-junction diode.

/** The frequency you appear to see when a signal of frequency f is sampled at fs: fold f into [0, fs/2]. */
export function aliasFrequency(f, fs) {
  const r = f - fs * Math.round(f / fs);
  return Math.abs(r);
}

/** Signed apparent frequency, for a rotating wheel: negative means it seems to spin backwards. */
export const apparentRotation = (f, fs) => f - fs * Math.round(f / fs);

// Shockley diode equation: I = Is (e^(V / nVt) − 1). Vt ≈ 25.85 mV at 300 K. Is = 1e-14 A is a typical
// small-signal silicon value: about 6 mA at 0.7 V (real diodes also have series resistance, ignored here).
export const VT = 0.02585;
export const diodeCurrent = (V, Is = 1e-14, n = 1) => Is * (Math.exp(V / (n * VT)) - 1);

/** Depletion width relative to zero bias: w ∝ √(Vbi − V). Forward bias shrinks it, reverse bias widens it. */
export const depletionWidth = (V, Vbi = 0.7) => Math.sqrt(Math.max(0.02, Vbi - V) / Vbi);
