// Logic gates and small circuits. A circuit lists its inputs, then gates in an order where every gate's
// inputs are already known, so one pass evaluates it. Positions (col, row) are used by the 3D layout.

export const GATES = {
  AND: (a, b) => a & b,
  OR: (a, b) => a | b,
  NOT: (a) => 1 - a,
  NAND: (a, b) => 1 - (a & b),
  NOR: (a, b) => 1 - (a | b),
  XOR: (a, b) => a ^ b,
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
