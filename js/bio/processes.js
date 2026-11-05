// Models for photosynthesis, breathing, meiosis and enzymes. These are teaching models: the shapes of the curves
// are right, the exact numbers are illustrative.

// ---- Photosynthesis: 6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂ (light energy, chlorophyll) ----
export const PHOTO_EQUATION = { left: [[6, { C: 1, O: 2 }], [6, { H: 2, O: 1 }]], right: [[1, { C: 6, H: 12, O: 6 }], [6, { O: 2 }]] };

export function atomCount(side) {
  const out = {};
  for (const [k, formula] of side) for (const [el, n] of Object.entries(formula)) out[el] = (out[el] ?? 0) + k * n;
  return out;
}

/** Temperature factor for enzyme-driven processes: rises to an optimum, then falls quickly (denaturing). */
export function tempFactor(T, optimum, width = 12) {
  if (T <= optimum) return Math.exp(-(((T - optimum) / width) ** 2));
  return Math.max(0, 1 - ((T - optimum) / (width * 0.9)) ** 2);
}

/** Blackman's law of limiting factors: the scarcest of light and CO₂ sets the rate, scaled by temperature. */
export function photosynthesisRate(light, co2, T) {
  const L = light / 100; // 0..1
  const C = Math.min(1, co2 / 1000); // ppm; ~1000 ppm saturates in this model
  const f = tempFactor(T, 30);
  const limiting = f < Math.min(L, C) ? 'temperature' : L <= C ? 'light' : 'carbon dioxide';
  return { rate: Math.min(L, C) * f, limiting };
}

// ---- Breathing ----
/** Minute ventilation (L/min) = breaths per minute × tidal volume (L). */
export const minuteVentilation = (rate, tidal) => rate * tidal;
/** Lung volume (L) over time for a resting breath: FRC plus a smooth tidal swing. */
export const lungVolume = (t, rate, tidal, frc = 2.4) => frc + (tidal * (1 - Math.cos((2 * Math.PI * rate * t) / 60))) / 2;
/** Air flows in while lungs expand: alveolar pressure is below atmospheric (negative here, in arbitrary units). */
export const alveolarPressure = (t, rate, tidal) => -Math.sin((2 * Math.PI * rate * t) / 60) * tidal;

// ---- Meiosis (2n = 4) ----
export const MEIOSIS = [
  { name: 'Prophase I', info: 'Homologous chromosomes pair up and swap pieces: <b>crossing over</b>. This mixes the genes.' },
  { name: 'Metaphase I', info: 'The <b>pairs</b> line up across the middle. Which side each goes to is random (independent assortment).' },
  { name: 'Anaphase I', info: 'Homologous chromosomes are pulled apart. Sister chromatids stay together.' },
  { name: 'Telophase I', info: 'Two cells, each with <b>half</b> the chromosomes (n = 2), still as X-shaped pairs of chromatids.' },
  { name: 'Metaphase II', info: 'In each cell the chromosomes line up again, like mitosis.' },
  { name: 'Anaphase II', info: 'Sister chromatids are pulled apart.' },
  { name: 'Telophase II', info: 'Four cells, each with n = 2 chromosomes, and all genetically different: gametes (egg or sperm).' },
];

export function meiosisCounts(t) {
  if (t < 3) return { cells: 1, chromosomesPerCell: 4 };
  if (t < 6) return { cells: 2, chromosomesPerCell: 2 };
  return { cells: 4, chromosomesPerCell: 2 };
}

// ---- Enzymes ----
export const ENZYMES = {
  amylase: { name: 'Salivary amylase', where: 'mouth', substrate: 'starch', product: 'maltose', pH: 6.8 },
  pepsin: { name: 'Pepsin', where: 'stomach', substrate: 'protein', product: 'peptides', pH: 2 },
  trypsin: { name: 'Trypsin', where: 'small intestine', substrate: 'protein', product: 'peptides', pH: 8 },
};

/** Michaelis–Menten: v = Vmax·[S] / (Km + [S]). */
export const michaelis = (S, Vmax = 1, Km = 2) => (Vmax * S) / (Km + S);
export const pHFactor = (pH, optimum) => Math.exp(-(((pH - optimum) / 1.5) ** 2));

export function enzymeRate(S, T, pH, enzyme) {
  return michaelis(S) * tempFactor(T, 37, 14) * pHFactor(pH, ENZYMES[enzyme].pH);
}
