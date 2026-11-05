// Acids and bases at 25 °C (Kw = 1e-14). Concentrations in mol/L.

export const KW = 1e-14;

export const SUBSTANCES = {
  HCl: { name: 'Hydrochloric acid (strong acid)', kind: 'strong-acid' },
  CH3COOH: { name: 'Acetic acid (weak acid, vinegar)', kind: 'weak-acid', K: 1.8e-5 },
  water: { name: 'Pure water', kind: 'neutral' },
  NH3: { name: 'Ammonia (weak base)', kind: 'weak-base', K: 1.8e-5 },
  NaOH: { name: 'Sodium hydroxide (strong base)', kind: 'strong-base' },
};

// [H⁺] for a strong acid including water's own ions (matters only below about 1e-6 M).
const strong = (c) => c / 2 + Math.sqrt((c * c) / 4 + KW);
// Weak acid / base: solve x² / (c − x) = K for x.
const weak = (c, K) => (-K + Math.sqrt(K * K + 4 * K * c)) / 2;

export function pH(key, c) {
  const s = SUBSTANCES[key];
  switch (s.kind) {
    case 'strong-acid': return -Math.log10(strong(c));
    case 'weak-acid': return -Math.log10(weak(c, s.K));
    case 'strong-base': return 14 + Math.log10(strong(c));
    case 'weak-base': return 14 + Math.log10(weak(c, s.K));
    default: return 7;
  }
}

/** Strong acid (Va mL of Ca M) titrated with strong base (Vb mL of Cb M). */
export function titrationPH(Va, Ca, Vb, Cb) {
  const acid = Va * Ca; // mmol
  const base = Vb * Cb;
  const V = Va + Vb;
  const excess = (acid - base) / V; // mol/L of H⁺ (positive) or OH⁻ (negative)
  if (Math.abs(excess) < 1e-12) return 7;
  return excess > 0 ? -Math.log10(strong(excess)) : 14 + Math.log10(strong(-excess));
}

/** Universal-indicator-style colour for a pH (as a hex number). */
export function indicatorColor(p) {
  const stops = [[0, 0xdc2626], [3, 0xf97316], [5, 0xfacc15], [7, 0x22c55e], [9, 0x0ea5e9], [11, 0x4338ca], [14, 0x7e22ce]];
  for (let i = 0; i < stops.length - 1; i++) {
    const [a, ca] = stops[i];
    const [b, cb] = stops[i + 1];
    if (p <= b) {
      const f = Math.max(0, (p - a) / (b - a));
      const mix = (sh) => Math.round(((ca >> sh) & 255) * (1 - f) + ((cb >> sh) & 255) * f);
      return (mix(16) << 16) | (mix(8) << 8) | mix(0);
    }
  }
  return stops.at(-1)[1];
}
