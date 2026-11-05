// Electron configuration (Aufbau order, Hund's rule) and the angular shapes of s, p and d orbitals.

export const ELEMENTS = ['H', 'He', 'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne', 'Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'Ar',
  'K', 'Ca', 'Sc', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn', 'Ga', 'Ge', 'As', 'Se', 'Br', 'Kr'];
export const NAMES = ['Hydrogen', 'Helium', 'Lithium', 'Beryllium', 'Boron', 'Carbon', 'Nitrogen', 'Oxygen', 'Fluorine', 'Neon',
  'Sodium', 'Magnesium', 'Aluminium', 'Silicon', 'Phosphorus', 'Sulfur', 'Chlorine', 'Argon', 'Potassium', 'Calcium',
  'Scandium', 'Titanium', 'Vanadium', 'Chromium', 'Manganese', 'Iron', 'Cobalt', 'Nickel', 'Copper', 'Zinc', 'Gallium',
  'Germanium', 'Arsenic', 'Selenium', 'Bromine', 'Krypton'];

// Filling order by the n + l rule (enough for Z ≤ 36).
const ORDER = ['1s', '2s', '2p', '3s', '3p', '4s', '3d', '4p'];
const CAP = { s: 2, p: 6, d: 10 };

/** Subshells in filling order, e.g. [{ sub: '1s', e: 2 }, …]. Cr and Cu take a 4s electron to half-fill / fill 3d. */
export function configuration(z) {
  const out = [];
  let left = z;
  for (const sub of ORDER) {
    if (left <= 0) break;
    const e = Math.min(CAP[sub[1]], left);
    out.push({ sub, e });
    left -= e;
  }
  if (z === 24 || z === 29) {
    out.find((s) => s.sub === '4s').e = 1;
    out.find((s) => s.sub === '3d').e += 1;
  }
  return out;
}

export const configString = (z) => configuration(z).map(({ sub, e }) => `${sub}${toSup(e)}`).join(' ');
const toSup = (n) => String(n).split('').map((d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]).join('');

/** Hund's rule: spread electrons one per orbital (spin up) before pairing. Returns per orbital: 0, 1 (↑) or 2 (↑↓). */
export function boxes(sub, e) {
  const n = CAP[sub[1]] / 2;
  return Array.from({ length: n }, (_, i) => (e > i ? 1 : 0) + (e > n + i ? 1 : 0));
}

export const unpaired = (z) => configuration(z).reduce((u, { sub, e }) => u + boxes(sub, e).filter((b) => b === 1).length, 0);

/**
 * Real angular functions of the orbitals (up to normalisation), for a unit direction (x, y, z).
 * The sign is the wave's phase, drawn as two colours.
 */
export const ORBITALS = {
  s: [['s', () => 1]],
  p: [['pₓ', (x) => x], ['p_y', (x, y) => y], ['p_z', (x, y, z) => z]],
  d: [
    ['d_xy', (x, y) => x * y * 2],
    ['d_yz', (x, y, z) => y * z * 2],
    ['d_xz', (x, y, z) => x * z * 2],
    ['d_x²−y²', (x, y) => x * x - y * y],
    ['d_z²', (x, y, z) => (3 * z * z - 1) / Math.sqrt(3)],
  ],
};
