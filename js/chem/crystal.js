// Cubic unit cells: simple cubic (SC), body-centred (BCC) and face-centred (FCC).
// Positions are in units of the cell edge a, with the cell from (0,0,0) to (1,1,1).

const corners = [];
for (const x of [0, 1]) for (const y of [0, 1]) for (const z of [0, 1]) corners.push([x, y, z]);
const faces = [[0.5, 0.5, 0], [0.5, 0.5, 1], [0.5, 0, 0.5], [0.5, 1, 0.5], [0, 0.5, 0.5], [1, 0.5, 0.5]];

export const LATTICES = {
  sc: { name: 'Simple cubic', sites: corners, n: 1, cn: 6, aOverR: 2, touch: 'along the edge (a = 2r)', example: 'Polonium' },
  bcc: { name: 'Body-centred cubic', sites: [...corners, [0.5, 0.5, 0.5]], n: 2, cn: 8, aOverR: 4 / Math.sqrt(3), touch: 'along the body diagonal (√3·a = 4r)', example: 'Iron (α), Na, Cr, W' },
  fcc: { name: 'Face-centred cubic', sites: [...corners, ...faces], n: 4, cn: 12, aOverR: 2 * Math.sqrt(2), touch: 'along the face diagonal (√2·a = 4r)', example: 'Copper, Al, Au, NaCl’s Cl⁻' },
};

/** Fraction of the cell volume filled by atoms: n · (4/3)πr³ / a³. */
export const packing = (key) => {
  const { n, aOverR } = LATTICES[key];
  return (n * (4 / 3) * Math.PI) / aOverR ** 3;
};

/** How much of an atom at this position lies inside the cell: corner 1/8, edge 1/4, face 1/2, inside 1. */
export const share = (p) => 1 / 2 ** p.filter((c) => c === 0 || c === 1).length;

/** Atoms per cell counted from the shares (should equal n). */
export const countAtoms = (key) => LATTICES[key].sites.reduce((s, p) => s + share(p), 0);

/** All sites in an nx × ny × nz block of cells, without duplicates. */
export function block(key, size = 3) {
  const seen = new Set();
  const out = [];
  for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) for (let k = 0; k < size; k++) {
    for (const [x, y, z] of LATTICES[key].sites) {
      const p = [x + i, y + j, z + k];
      const id = p.map((v) => v.toFixed(2)).join(',');
      if (!seen.has(id)) {
        seen.add(id);
        out.push(p);
      }
    }
  }
  return out;
}
