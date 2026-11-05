// DNA → mRNA → protein. Uses the standard genetic code (NCBI table 1).

const BASES = 'TCAG';
// Amino acid for every codon in TCAG × TCAG × TCAG order ('*' = stop).
const CODE = 'FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG';

export const AMINO = {
  A: 'Alanine', R: 'Arginine', N: 'Asparagine', D: 'Aspartate', C: 'Cysteine', Q: 'Glutamine', E: 'Glutamate', G: 'Glycine',
  H: 'Histidine', I: 'Isoleucine', L: 'Leucine', K: 'Lysine', M: 'Methionine', F: 'Phenylalanine', P: 'Proline', S: 'Serine',
  T: 'Threonine', W: 'Tryptophan', Y: 'Tyrosine', V: 'Valine', '*': 'STOP',
};

const PAIR = { A: 'T', T: 'A', G: 'C', C: 'G' };

export const clean = (seq) => seq.toUpperCase().replace(/[^ACGT]/g, '');
export const complement = (dna) => [...dna].map((b) => PAIR[b]).join('');

/** mRNA has the same sequence as the coding strand, with U instead of T (it is copied from the template strand). */
export const transcribe = (coding) => coding.replace(/T/g, 'U');

/** Amino acid (one letter, '*' for stop) of a DNA or RNA codon. */
export function codonToAmino(codon) {
  const c = codon.replace(/U/g, 'T');
  const i = BASES.indexOf(c[0]) * 16 + BASES.indexOf(c[1]) * 4 + BASES.indexOf(c[2]);
  return CODE[i];
}

/** Translate from the first AUG until a stop codon. Returns { start, codons: [{codon, aa}], stopped }. */
export function translate(mrna) {
  const start = mrna.indexOf('AUG');
  if (start < 0) return { start, codons: [], stopped: false };
  const codons = [];
  for (let i = start; i + 3 <= mrna.length; i += 3) {
    const codon = mrna.slice(i, i + 3);
    const aa = codonToAmino(codon);
    codons.push({ codon, aa });
    if (aa === '*') return { start, codons, stopped: true };
  }
  return { start, codons, stopped: false };
}

/** What a single-base change does to the protein. */
export function mutationEffect(before, after) {
  const a = translate(transcribe(before)).codons.map((c) => c.aa).join('');
  const b = translate(transcribe(after)).codons.map((c) => c.aa).join('');
  if (a === b) return 'silent';
  if (b.length < a.length && b.endsWith('*')) return 'nonsense';
  if (a.endsWith('*') && (b.length > a.length || !b.endsWith('*'))) return 'stop-loss';
  return 'missense';
}
