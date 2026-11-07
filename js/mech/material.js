// Tensile test (engineering stress–strain). Typical textbook values; real ones vary with grade and treatment.
// E in GPa, stresses in MPa, strains as fractions.

export const MATERIALS = {
  steel: { name: 'Mild steel', E: 200, yield: 250, uts: 410, eu: 0.2, ef: 0.3, ductile: true, color: 0x9ca3af },
  aluminium: { name: 'Aluminium alloy (6061-T6)', E: 69, yield: 276, uts: 310, eu: 0.08, ef: 0.12, ductile: true, color: 0xcbd5e1 },
  copper: { name: 'Copper (annealed)', E: 117, yield: 70, uts: 220, eu: 0.35, ef: 0.45, ductile: true, color: 0xd97706 },
  castiron: { name: 'Grey cast iron', E: 100, yield: null, uts: 200, eu: 0.003, ef: 0.003, ductile: false, color: 0x57534e },
};

/** Engineering stress (MPa) at a strain, or null after fracture. */
export function stressAt(key, e) {
  const m = MATERIALS[key];
  const Epa = m.E * 1000; // MPa
  if (e > m.ef) return null;
  if (!m.ductile) return Math.min(Epa * e, m.uts) * (1 - 0.15 * (e / m.ef) ** 2); // slightly curved, then snaps
  const ey = m.yield / Epa;
  if (e <= ey) return Epa * e; // elastic: Hooke's law
  if (e <= m.eu) {
    // Strain hardening from yield up to the ultimate tensile strength.
    const f = (e - ey) / (m.eu - ey);
    return m.yield + (m.uts - m.yield) * Math.sin((f * Math.PI) / 2);
  }
  // Necking: engineering stress falls until fracture.
  const f = (e - m.eu) / (m.ef - m.eu);
  return m.uts - (m.uts - m.yield * 0.9) * 0.45 * f * f;
}

/** Toughness: energy absorbed per unit volume up to fracture (MJ/m³ = area under the curve). */
export function toughness(key, steps = 2000) {
  const m = MATERIALS[key];
  let s = 0;
  for (let i = 0; i < steps; i++) {
    const e = ((i + 0.5) / steps) * m.ef;
    s += (stressAt(key, e) ?? 0) * (m.ef / steps);
  }
  return s;
}
