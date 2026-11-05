// Chemical bonding between two atoms, classified by the difference in electronegativity (ΔEN).
// The cut-offs (0.4 and 1.7) are the usual textbook rule of thumb, not sharp boundaries.
import { bySymbol } from './periodic.js';

export const PAIRS = {
  NaCl: { a: 'Na', b: 'Cl', transfer: 1, label: 'NaCl' },
  MgO: { a: 'Mg', b: 'O', transfer: 2, label: 'MgO' },
  KF: { a: 'K', b: 'F', transfer: 1, label: 'KF' },
  H2: { a: 'H', b: 'H', shared: 1, label: 'H₂' },
  Cl2: { a: 'Cl', b: 'Cl', shared: 1, label: 'Cl₂' },
  O2: { a: 'O', b: 'O', shared: 2, label: 'O₂' },
  N2: { a: 'N', b: 'N', shared: 3, label: 'N₂' },
  HCl: { a: 'H', b: 'Cl', shared: 1, label: 'HCl' },
  HF: { a: 'H', b: 'F', shared: 1, label: 'HF' },
  CO: { a: 'C', b: 'O', shared: 3, label: 'CO' },
};

// Valence (outer-shell) electrons for the main-group atoms used here.
export const VALENCE = { H: 1, C: 4, N: 5, O: 6, F: 7, Na: 1, Mg: 2, Cl: 7, K: 1 };

export function classify(delta) {
  if (delta >= 1.7) return 'ionic';
  if (delta >= 0.4) return 'polar covalent';
  return 'non-polar covalent';
}

export function analyzeBond(key) {
  const p = PAIRS[key];
  const ea = bySymbol(p.a).en;
  const eb = bySymbol(p.b).en;
  const delta = Math.abs(ea - eb);
  return { ...p, ea, eb, delta, type: classify(delta), richer: ea > eb ? p.a : p.b };
}
