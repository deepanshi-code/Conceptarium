// Reaction rates. Arrhenius: k = A·e^(−Ea/RT). Only collisions with at least Ea of energy react; the fraction of
// such collisions is about e^(−Ea/RT), so a little extra temperature (or a catalyst lowering Ea) speeds it up a lot.

export const R = 8.314;

export const rateConstant = (Ea, T, A = 1) => A * Math.exp(-Ea / (R * T)); // Ea in J/mol
export const fractionAbove = (Ea, T) => Math.exp(-Ea / (R * T));

/**
 * Maxwell–Boltzmann energy distribution (3D gas), f(E) ∝ √E · e^(−E/kT), normalised.
 * E and kT in the same units; returns density.
 */
export const mbDensity = (E, kT) => (2 / Math.sqrt(Math.PI)) * Math.sqrt(E) * kT ** -1.5 * Math.exp(-E / kT);
