// Galvanic cells. Standard reduction potentials (V, 25 °C) from the usual textbook table.

export const METALS = {
  Mg: { ion: 'Mg²⁺', z: 2, E: -2.37, color: 0xd4d4d8 },
  Zn: { ion: 'Zn²⁺', z: 2, E: -0.76, color: 0x9ca3af },
  Fe: { ion: 'Fe²⁺', z: 2, E: -0.44, color: 0x78716c },
  Ni: { ion: 'Ni²⁺', z: 2, E: -0.25, color: 0xa8a29e },
  Pb: { ion: 'Pb²⁺', z: 2, E: -0.13, color: 0x64748b },
  Cu: { ion: 'Cu²⁺', z: 2, E: 0.34, color: 0xd97706 },
  Ag: { ion: 'Ag⁺', z: 1, E: 0.80, color: 0xe5e7eb },
};

const gcd = (a, b) => (b ? gcd(b, a % b) : a);

/**
 * Cell made from two metals in 1 M-ish solutions of their ions. The metal with the lower E° is the anode
 * (oxidised, loses mass); the other is the cathode. Nernst equation at 25 °C: E = E° − (0.0592 / n) log₁₀ Q.
 */
export function cell(m1, c1, m2, c2) {
  const [anode, ca, cathode, cc] = METALS[m1].E <= METALS[m2].E ? [m1, c1, m2, c2] : [m2, c2, m1, c1];
  const za = METALS[anode].z;
  const zc = METALS[cathode].z;
  const n = (za * zc) / gcd(za, zc); // electrons transferred in the balanced equation
  const E0 = METALS[cathode].E - METALS[anode].E;
  const Q = ca ** (n / za) / cc ** (n / zc);
  return { anode, cathode, n, E0, Q, E: E0 - (0.0592 / n) * Math.log10(Q) };
}
