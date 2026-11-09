// Concepts grouped by the courses they usually appear in, in first- and second-year B.Tech / BCA programmes.
// These are common course names, not a particular university's codes: add your own codes and units here.

export const COURSES = {
  'Engineering Graphics': ['drawing', 'development', 'sections'],
  'Engineering Mechanics': ['beam', 'truss', 'projectile', 'gears', 'stressstrain'],
  'Strength of Materials': ['beam', 'stressstrain', 'truss'],
  'Engineering Physics': ['projectile', 'shm', 'waves', 'efield', 'induction', 'diode', 'crystal'],
  'Engineering Chemistry': ['orbitals', 'vsepr', 'crystal', 'periodic', 'bonding', 'gaslaws', 'galvanic', 'rates', 'acidbase'],
  'Engineering Mathematics': ['eigen', 'fourier', 'transforms', 'descent'],
  'Basic Electrical Engineering': ['circuits', 'induction', 'threephase'],
  'Basic Electronics': ['diode', 'logic', 'sampling'],
  'Digital Electronics': ['logic', 'sequential'],
  'Signals & Communication': ['sampling', 'fourier', 'network'],
  'Control Systems': ['pid'],
  'Thermal & Fluid Engineering': ['engine', 'fluid', 'gaslaws'],
  'Data Structures & Algorithms': ['structures/list', 'structures/tree', 'structures/heap', 'structures/bplus', 'structures/graph', 'structures/hash', 'stackqueue', 'sorting', 'hanoi', 'search'],
  'Operating Systems': ['scheduling', 'paging'],
  'Computer Networks': ['network'],
  'Computer Graphics': ['transforms', 'eigen'],
  'Machine Learning': ['descent', 'perceptron', 'eigen'],
  'Biology for Engineers': ['cell', 'dna', 'replication', 'mitosis', 'meiosis', 'heart', 'neuron', 'enzymes', 'photosynthesis', 'breathing'],
};

export const coursesFor = (path) => Object.entries(COURSES).filter(([, paths]) => paths.includes(path)).map(([name]) => name);
