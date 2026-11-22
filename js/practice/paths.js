// Which concepts have practice problems. Kept as a plain list so the home page (badges, "only with practice"
// filter) doesn't have to download every problem generator. tests/practice.test.mjs checks it matches GENERATORS.
export const PRACTICE_PATHS = new Set([
  'beam', 'circuits', 'projectile', 'gaslaws', 'galvanic', 'scheduling', 'paging', 'acidbase', 'sorting', 'search',
  'hanoi', 'stackqueue', 'structures/tree', 'crystal', 'orbitals', 'rates', 'shm', 'fourier', 'descent', 'gears',
  'engine', 'stressstrain', 'truss', 'fluid', 'induction', 'threephase', 'pid', 'sampling', 'heart', 'breathing',
  'enzymes', 'mitosis', 'meiosis', 'dna',
]);

export const hasPractice = (path) => PRACTICE_PATHS.has(path);
