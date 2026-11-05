// Logic gates and combinational circuits. A circuit lists its inputs, then gates in an order where every gate's
// inputs are already known, so one pass evaluates it. Positions (col, row) are used by the 3D layout:
// col counts gate columns left to right, row is in units of the input spacing (negative = higher up).

const all = (xs) => xs.every(Boolean) ? 1 : 0;
const any = (xs) => xs.some(Boolean) ? 1 : 0;

// AND, OR and their inverses take any number of inputs; XOR / XNOR are the 2-input forms used here.
export const GATES = {
  AND: (...x) => all(x),
  OR: (...x) => any(x),
  NOT: (a) => 1 - a,
  NAND: (...x) => 1 - all(x),
  NOR: (...x) => 1 - any(x),
  XOR: (a, b) => a ^ b,
  XNOR: (a, b) => 1 - (a ^ b),
};

const single = (type) => ({
  name: `${type} gate`,
  inputs: type === 'NOT' ? ['A'] : ['A', 'B'],
  gates: [{ id: 'g', type, in: type === 'NOT' ? ['A'] : ['A', 'B'], col: 1, row: 0 }],
  outputs: { Y: 'g' },
});

export const CIRCUITS = {
  and: single('AND'),
  or: single('OR'),
  not: single('NOT'),
  nand: single('NAND'),
  nor: single('NOR'),
  xor: single('XOR'),
  xnor: single('XNOR'),

  half: {
    name: 'Half adder',
    inputs: ['A', 'B'],
    gates: [
      { id: 's', type: 'XOR', in: ['A', 'B'], col: 1, row: -0.6 },
      { id: 'c', type: 'AND', in: ['A', 'B'], col: 1, row: 0.6 },
    ],
    outputs: { Sum: 's', Carry: 'c' },
  },
  full: {
    name: 'Full adder',
    inputs: ['A', 'B', 'Cin'],
    gates: [
      { id: 'x1', type: 'XOR', in: ['A', 'B'], col: 1, row: -0.9 },
      { id: 'a1', type: 'AND', in: ['A', 'B'], col: 1, row: 0.9 },
      { id: 's', type: 'XOR', in: ['x1', 'Cin'], col: 2, row: -1.2 },
      { id: 'a2', type: 'AND', in: ['x1', 'Cin'], col: 2, row: 0.1 },
      { id: 'c', type: 'OR', in: ['a2', 'a1'], col: 3, row: 0.6 },
    ],
    outputs: { Sum: 's', Cout: 'c' },
  },
  halfsub: {
    name: 'Half subtractor',
    inputs: ['A', 'B'],
    gates: [
      { id: 'd', type: 'XOR', in: ['A', 'B'], col: 1, row: -0.7 },
      { id: 'na', type: 'NOT', in: ['A'], col: 1, row: 0.5 },
      { id: 'b', type: 'AND', in: ['na', 'B'], col: 2, row: 0.6 },
    ],
    outputs: { Diff: 'd', Borrow: 'b' },
  },
  fullsub: {
    name: 'Full subtractor',
    inputs: ['A', 'B', 'Bin'],
    gates: [
      { id: 'x1', type: 'XOR', in: ['A', 'B'], col: 1, row: -1.1 },
      { id: 'na', type: 'NOT', in: ['A'], col: 1, row: 0.4 },
      { id: 'd', type: 'XOR', in: ['x1', 'Bin'], col: 2, row: -1.3 },
      { id: 'nx', type: 'NOT', in: ['x1'], col: 2, row: -0.2 },
      { id: 'a1', type: 'AND', in: ['na', 'B'], col: 2, row: 0.9 },
      { id: 'a2', type: 'AND', in: ['nx', 'Bin'], col: 3, row: 0 },
      { id: 'bo', type: 'OR', in: ['a2', 'a1'], col: 4, row: 0.5 },
    ],
    outputs: { Diff: 'd', Bout: 'bo' },
  },
  comparator: {
    name: '1-bit comparator',
    inputs: ['A', 'B'],
    gates: [
      { id: 'na', type: 'NOT', in: ['A'], col: 1, row: -1.2 },
      { id: 'nb', type: 'NOT', in: ['B'], col: 1, row: 1.2 },
      { id: 'gt', type: 'AND', in: ['A', 'nb'], col: 2, row: -1.2 },
      { id: 'eq', type: 'XNOR', in: ['A', 'B'], col: 2, row: 0 },
      { id: 'lt', type: 'AND', in: ['na', 'B'], col: 2, row: 1.2 },
    ],
    outputs: { 'A>B': 'gt', 'A=B': 'eq', 'A<B': 'lt' },
  },
  multiplier: {
    name: '2-bit multiplier',
    inputs: ['A1', 'A0', 'B1', 'B0'],
    gates: [
      { id: 'p0', type: 'AND', in: ['A0', 'B0'], col: 1, row: -1.8 },
      { id: 'm1', type: 'AND', in: ['A1', 'B0'], col: 1, row: -0.6 },
      { id: 'm2', type: 'AND', in: ['A0', 'B1'], col: 1, row: 0.6 },
      { id: 'm3', type: 'AND', in: ['A1', 'B1'], col: 1, row: 1.8 },
      { id: 'p1', type: 'XOR', in: ['m1', 'm2'], col: 2, row: -0.6 },
      { id: 'c1', type: 'AND', in: ['m1', 'm2'], col: 2, row: 0.6 },
      { id: 'p2', type: 'XOR', in: ['m3', 'c1'], col: 3, row: 0.6 },
      { id: 'p3', type: 'AND', in: ['m3', 'c1'], col: 3, row: 1.8 },
    ],
    outputs: { P3: 'p3', P2: 'p2', P1: 'p1', P0: 'p0' },
  },

  mux2: {
    name: '2:1 MUX',
    inputs: ['I0', 'I1', 'S'],
    gates: [
      { id: 'ns', type: 'NOT', in: ['S'], col: 1, row: 1.2 },
      { id: 'a0', type: 'AND', in: ['I0', 'ns'], col: 2, row: -0.6 },
      { id: 'a1', type: 'AND', in: ['I1', 'S'], col: 2, row: 0.6 },
      { id: 'y', type: 'OR', in: ['a0', 'a1'], col: 3, row: 0 },
    ],
    outputs: { Y: 'y' },
  },
  mux4: {
    name: '4:1 MUX',
    inputs: ['I0', 'I1', 'I2', 'I3', 'S1', 'S0'],
    gates: [
      { id: 'n1', type: 'NOT', in: ['S1'], col: 1, row: 1.6 },
      { id: 'n0', type: 'NOT', in: ['S0'], col: 1, row: 2.7 },
      { id: 'a0', type: 'AND', in: ['I0', 'n1', 'n0'], col: 2, row: -1.9 },
      { id: 'a1', type: 'AND', in: ['I1', 'n1', 'S0'], col: 2, row: -0.65 },
      { id: 'a2', type: 'AND', in: ['I2', 'S1', 'n0'], col: 2, row: 0.6 },
      { id: 'a3', type: 'AND', in: ['I3', 'S1', 'S0'], col: 2, row: 1.85 },
      { id: 'y', type: 'OR', in: ['a0', 'a1', 'a2', 'a3'], col: 3, row: 0 },
    ],
    outputs: { Y: 'y' },
  },
  demux: {
    name: '1:4 DEMUX',
    inputs: ['D', 'S1', 'S0'],
    gates: [
      { id: 'n1', type: 'NOT', in: ['S1'], col: 1, row: 0.5 },
      { id: 'n0', type: 'NOT', in: ['S0'], col: 1, row: 1.6 },
      { id: 'y0', type: 'AND', in: ['D', 'n1', 'n0'], col: 2, row: -1.9 },
      { id: 'y1', type: 'AND', in: ['D', 'n1', 'S0'], col: 2, row: -0.65 },
      { id: 'y2', type: 'AND', in: ['D', 'S1', 'n0'], col: 2, row: 0.6 },
      { id: 'y3', type: 'AND', in: ['D', 'S1', 'S0'], col: 2, row: 1.85 },
    ],
    outputs: { Y0: 'y0', Y1: 'y1', Y2: 'y2', Y3: 'y3' },
  },
  decoder: {
    name: '2:4 Decoder',
    inputs: ['A', 'B'],
    gates: [
      { id: 'na', type: 'NOT', in: ['A'], col: 1, row: -0.3 },
      { id: 'nb', type: 'NOT', in: ['B'], col: 1, row: 0.9 },
      { id: 'd0', type: 'AND', in: ['na', 'nb'], col: 2, row: -1.9 },
      { id: 'd1', type: 'AND', in: ['na', 'B'], col: 2, row: -0.65 },
      { id: 'd2', type: 'AND', in: ['A', 'nb'], col: 2, row: 0.6 },
      { id: 'd3', type: 'AND', in: ['A', 'B'], col: 2, row: 1.85 },
    ],
    outputs: { D0: 'd0', D1: 'd1', D2: 'd2', D3: 'd3' },
  },
  encoder: {
    name: '4:2 Priority encoder',
    inputs: ['I0', 'I1', 'I2', 'I3'],
    gates: [
      { id: 'n2', type: 'NOT', in: ['I2'], col: 1, row: -0.1 },
      { id: 'y1', type: 'OR', in: ['I3', 'I2'], col: 2, row: -1.6 },
      { id: 'a', type: 'AND', in: ['I1', 'n2'], col: 2, row: -0.3 },
      { id: 'v', type: 'OR', in: ['I0', 'I1', 'I2', 'I3'], col: 2, row: 1.3 },
      { id: 'y0', type: 'OR', in: ['I3', 'a'], col: 3, row: -0.4 },
    ],
    outputs: { Y1: 'y1', Y0: 'y0', V: 'v' },
  },
};

// How the circuits are grouped in the UI.
export const GROUPS = {
  gates: { name: 'Gates', keys: ['and', 'or', 'not', 'nand', 'nor', 'xor', 'xnor'] },
  arithmetic: { name: 'Arithmetic', keys: ['half', 'full', 'halfsub', 'fullsub', 'multiplier', 'comparator'] },
  routing: { name: 'Data routing', keys: ['mux2', 'mux4', 'demux', 'decoder', 'encoder'] },
};

/** Value (0/1) of every input and gate output, keyed by id. */
export function evaluate(circuit, inputValues) {
  const v = { ...inputValues };
  for (const g of circuit.gates) v[g.id] = GATES[g.type](...g.in.map((id) => v[id]));
  return v;
}

/** Every input combination with its outputs, in binary counting order. */
export function truthTable(circuit) {
  const n = circuit.inputs.length;
  return Array.from({ length: 2 ** n }, (_, i) => {
    const ins = Object.fromEntries(circuit.inputs.map((name, k) => [name, (i >> (n - 1 - k)) & 1]));
    const v = evaluate(circuit, ins);
    return { ins, outs: Object.fromEntries(Object.entries(circuit.outputs).map(([name, id]) => [name, v[id]])) };
  });
}
