// Mitosis for a cell with 2n = 4 chromosomes. Time t runs from 0 to 6, one unit per stage.

export const STAGES = [
  { name: 'Interphase', info: 'The cell grows and copies its DNA (S phase). Chromosomes are long, thin threads you can’t see yet.' },
  { name: 'Prophase', info: 'Chromosomes coil up and become visible as X shapes: two identical sister chromatids joined at the centromere. The nuclear envelope breaks down.' },
  { name: 'Metaphase', info: 'Spindle fibres attach to each centromere and line the chromosomes up across the middle (the metaphase plate).' },
  { name: 'Anaphase', info: 'The centromeres split and the spindle pulls the sister chromatids apart to opposite poles.' },
  { name: 'Telophase', info: 'A nuclear envelope forms around each set of chromosomes, which start to uncoil.' },
  { name: 'Cytokinesis', info: 'The cytoplasm divides: two daughter cells, each with the same 4 chromosomes as the parent.' },
];

export const stageAt = (t) => STAGES[Math.min(STAGES.length - 1, Math.max(0, Math.floor(t)))];

/** Chromosome and DNA counts in one cell (or each daughter, after cytokinesis). */
export function counts(t) {
  const s = stageAt(t).name;
  if (s === 'Interphase') return { chromosomes: 4, chromatids: t < 0.5 ? 4 : 8, cells: 1 };
  if (s === 'Anaphase' || s === 'Telophase') return { chromosomes: 8, chromatids: 8, cells: 1 }; // separated chromatids count as chromosomes
  if (s === 'Cytokinesis') return { chromosomes: 4, chromatids: 4, cells: 2 };
  return { chromosomes: 4, chromatids: 8, cells: 1 };
}
