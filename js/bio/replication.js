// DNA replication is semi-conservative: each new double helix keeps one old strand and builds one new one.
// The leading strand is made continuously; the lagging strand in short Okazaki fragments.
import { complement } from './dna.js';

export const OKAZAKI = 6; // bases per fragment in this model (real ones are 100–200 bases in eukaryotes)

export function replicate(top) {
  const bottom = complement(top);
  return {
    daughter1: { old: top, new: complement(top) }, // new strand is a copy of the old bottom
    daughter2: { old: bottom, new: complement(bottom) },
  };
}

/** Lagging-strand fragments finished once the fork has opened `fork` bases: [start, end) index ranges. */
export function fragments(length, fork) {
  const out = [];
  for (let s = 0; s < length; s += OKAZAKI) {
    const e = Math.min(length, s + OKAZAKI);
    if (fork >= e) out.push([s, e]);
  }
  return out;
}
