// VSEPR: electron domains (bonds + lone pairs) around a central atom push apart as far as they can.
// The domain count fixes the electron geometry; which corners hold lone pairs fixes the molecule's shape.

export const MOLECULES = {
  BeCl2: { center: 'Be', atoms: ['Cl', 'Cl'], lone: 0 },
  CO2: { center: 'C', atoms: ['O', 'O'], lone: 0, note: 'Double bonds still count as one domain each.' },
  BF3: { center: 'B', atoms: ['F', 'F', 'F'], lone: 0 },
  SO2: { center: 'S', atoms: ['O', 'O'], lone: 1, real: 119 },
  CH4: { center: 'C', atoms: ['H', 'H', 'H', 'H'], lone: 0 },
  NH3: { center: 'N', atoms: ['H', 'H', 'H'], lone: 1, real: 107 },
  H2O: { center: 'O', atoms: ['H', 'H'], lone: 2, real: 104.5 },
  PCl5: { center: 'P', atoms: ['Cl', 'Cl', 'Cl', 'Cl', 'Cl'], lone: 0 },
  SF4: { center: 'S', atoms: ['F', 'F', 'F', 'F'], lone: 1 },
  ClF3: { center: 'Cl', atoms: ['F', 'F', 'F'], lone: 2 },
  XeF2: { center: 'Xe', atoms: ['F', 'F'], lone: 3 },
  SF6: { center: 'S', atoms: ['F', 'F', 'F', 'F', 'F', 'F'], lone: 0 },
  BrF5: { center: 'Br', atoms: ['F', 'F', 'F', 'F', 'F'], lone: 1 },
  XeF4: { center: 'Xe', atoms: ['F', 'F', 'F', 'F'], lone: 2 },
};

const ELECTRON = { 2: 'Linear', 3: 'Trigonal planar', 4: 'Tetrahedral', 5: 'Trigonal bipyramidal', 6: 'Octahedral' };
const HYBRID = { 2: 'sp', 3: 'sp²', 4: 'sp³', 5: 'sp³d', 6: 'sp³d²' };
const IDEAL = { 2: 180, 3: 120, 4: 109.5, 5: '90 and 120', 6: 90 };
const SHAPE = {
  '2,0': 'Linear', '3,0': 'Trigonal planar', '3,1': 'Bent', '4,0': 'Tetrahedral', '4,1': 'Trigonal pyramidal', '4,2': 'Bent',
  '5,0': 'Trigonal bipyramidal', '5,1': 'Seesaw', '5,2': 'T-shaped', '5,3': 'Linear', '6,0': 'Octahedral', '6,1': 'Square pyramidal', '6,2': 'Square planar',
};

const norm = ([x, y, z]) => {
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
};
const ring = (n, y = 0) => Array.from({ length: n }, (_, i) => [Math.cos((i / n) * 2 * Math.PI), y, Math.sin((i / n) * 2 * Math.PI)]);

// Domain directions, ordered so that lone pairs (taken first) go where they cause the least repulsion:
// equatorial in a trigonal bipyramid, opposite each other in an octahedron.
const DIRECTIONS = {
  2: [[0, 1, 0], [0, -1, 0]],
  3: ring(3),
  4: [[1, 1, 1], [-1, -1, 1], [-1, 1, -1], [1, -1, -1]].map(norm).map(([x, y, z]) => [x, z, -y]),
  5: [...ring(3), [0, 1, 0], [0, -1, 0]],
  6: [[0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]],
};
// For 2 lone pairs on 4 domains any two corners are equivalent; for 3 domains with 1 lone pair, any one.

export function analyze(key) {
  const m = MOLECULES[key];
  const domains = m.atoms.length + m.lone;
  const dirs = DIRECTIONS[domains];
  // Lone-pair slots: trigonal bipyramid → equatorial (indices 0..2); octahedron → trans pair (0 then 1); others → first.
  return {
    ...m,
    key,
    domains,
    electronGeometry: ELECTRON[domains],
    shape: SHAPE[`${domains},${m.lone}`],
    hybrid: HYBRID[domains],
    ideal: IDEAL[domains],
    lonePairs: dirs.slice(0, m.lone),
    bonds: dirs.slice(m.lone),
  };
}

export const angleBetween = (a, b) => (Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) * 180) / Math.PI;
