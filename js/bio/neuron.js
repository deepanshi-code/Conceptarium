// The action potential: a typical textbook shape for the membrane potential (mV) against time (ms) after a stimulus.
// Resting −70 mV; if the stimulus reaches the threshold (−55 mV) the neuron fires all the way to about +40 mV.

export const REST = -70;
export const THRESHOLD = -55;
export const PEAK = 40;
export const UNDERSHOOT = -80;

/** Potential at time t (ms) after a stimulus that would raise the membrane by `kick` mV. All-or-none. */
export function potential(t, kick) {
  if (t < 0) return REST;
  const fires = REST + kick >= THRESHOLD;
  if (!fires) return REST + kick * Math.exp(-t / 0.8); // a small bump that just fades away
  const ease = (a, b, f) => a + (b - a) * (0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, f))));
  if (t < 0.3) return ease(REST, THRESHOLD, t / 0.3); // stimulus brings it to threshold
  if (t < 1) return ease(THRESHOLD, PEAK, (t - 0.3) / 0.7); // Na⁺ channels open: depolarisation
  if (t < 2) return ease(PEAK, UNDERSHOOT, (t - 1) / 1); // K⁺ channels open: repolarisation
  if (t < 4) return ease(UNDERSHOOT, REST, (t - 2) / 2); // hyperpolarisation, then back to rest
  return REST;
}

export function phaseAt(t, kick) {
  if (REST + kick < THRESHOLD) return t < 1.5 ? 'Below threshold: no action potential' : 'Resting';
  if (t < 0) return 'Resting';
  if (t < 0.3) return 'Stimulus reaches threshold';
  if (t < 1) return 'Depolarisation: Na⁺ rushes in';
  if (t < 2) return 'Repolarisation: K⁺ flows out';
  if (t < 4) return 'Hyperpolarisation, then reset by the Na⁺/K⁺ pump';
  return 'Resting';
}
