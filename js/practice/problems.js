// Exam-style numerical problems with fresh numbers every time. Each generator returns:
//   question (HTML), answer (number), unit, tol ({ rel } or { abs }), steps (HTML strings, a worked solution),
//   and load: actions that set the 3D model to the problem's values ([kind, selector, value]).
// Answers come from the same solvers that drive the 3D views, so the model and the solution always agree.
import { solveCircuit } from '../elec/circuits.js';
import { schedule, ALGOS } from '../os/schedule.js';
import { simulate, PAGE_ALGOS } from '../os/paging.js';
import { cell, METALS } from '../chem/electrochem.js';
import { pH, SUBSTANCES } from '../chem/acidbase.js';
import { pressure, R as GAS_R } from '../chem/gas.js';
import { MORE } from './more.js';

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const int = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
const f = (x, d = 2) => String(Number(x.toFixed(d)));
const G = 9.81;

const beam = (rng) => {
  if (rng() < 0.65) {
    const L = pick(rng, [4, 5, 6, 8, 10]);
    const P = pick(rng, [10, 15, 20, 25, 30, 40]);
    const a = int(rng, 1, L - 1);
    const b = L - a;
    const RB = (P * a) / L;
    const RA = P - RB;
    return {
      question: `A simply supported beam AB of span <b>${L} m</b> carries a point load of <b>${P} kN</b> at <b>${a} m</b> from A. Find the <b>maximum bending moment</b>.`,
      answer: (P * a * b) / L,
      unit: 'kN·m',
      tol: { rel: 0.01 },
      steps: [
        `Take moments about A: R<sub>B</sub> × ${L} = ${P} × ${a}, so R<sub>B</sub> = <b>${f(RB)} kN</b>.`,
        `Vertical balance: R<sub>A</sub> = ${P} − ${f(RB)} = <b>${f(RA)} kN</b>.`,
        'The shear force changes sign under the load, so the bending moment is largest there.',
        `M<sub>max</sub> = R<sub>A</sub> × a = ${f(RA)} × ${a} = <b>${f((P * a * b) / L)} kN·m</b> (same as P·a·b / L).`,
      ],
      load: [['radio', 'input[name="type"][value="simply"]'], ['set', '[data-L]', L], ['set', '[data-P]', P], ['set', '[data-a]', a / L]],
    };
  }
  const L = pick(rng, [2, 3, 4, 5, 6]);
  const P = pick(rng, [5, 10, 15, 20, 25, 30]);
  return {
    question: `A cantilever of length <b>${L} m</b> carries a point load of <b>${P} kN</b> at its free end. Find the <b>maximum bending moment</b> (magnitude).`,
    answer: P * L,
    unit: 'kN·m',
    tol: { rel: 0.01 },
    steps: [
      'For a cantilever the bending moment is largest at the fixed support.',
      `Moment of the load about the support: M = P × L = ${P} × ${L}.`,
      `M<sub>max</sub> = <b>${P * L} kN·m</b> (hogging: the beam curves downwards).`,
    ],
    load: [['radio', 'input[name="type"][value="cantilever"]'], ['set', '[data-L]', L], ['set', '[data-P]', P]],
  };
};

const circuits = (rng) => {
  const layout = pick(rng, ['series', 'parallel', 'mixed']);
  const V = pick(rng, [6, 9, 12, 18, 24]);
  const Rs = [0, 1, 2].map(() => pick(rng, [2, 3, 4, 6, 8, 10, 12]));
  const s = solveCircuit(layout, V, Rs);
  const [R1, R2, R3] = Rs;
  const load = [['click', `[data-layout="${layout}"]`], ['set', '[data-V]', V], ...Rs.map((r, k) => ['set', `[data-r="${k}"]`, r])];
  if (layout === 'series') {
    return {
      question: `Resistors of <b>${R1} Ω</b>, <b>${R2} Ω</b> and <b>${R3} Ω</b> are connected <b>in series</b> across a <b>${V} V</b> battery. Find the <b>voltage across the ${R1} Ω resistor</b>.`,
      answer: s.parts[0].V,
      unit: 'V',
      tol: { rel: 0.01 },
      steps: [
        `In series, resistances add: R<sub>eq</sub> = ${R1} + ${R2} + ${R3} = <b>${s.Req} Ω</b>.`,
        `Current (same everywhere): I = V / R<sub>eq</sub> = ${V} / ${s.Req} = <b>${f(s.I, 3)} A</b>.`,
        `Voltage across R1: V₁ = I × R₁ = ${f(s.I, 3)} × ${R1} = <b>${f(s.parts[0].V)} V</b>.`,
      ],
      load,
    };
  }
  if (layout === 'parallel') {
    return {
      question: `Resistors of <b>${R1} Ω</b>, <b>${R2} Ω</b> and <b>${R3} Ω</b> are connected <b>in parallel</b> across a <b>${V} V</b> battery. Find the <b>total current</b> drawn from the battery.`,
      answer: s.I,
      unit: 'A',
      tol: { rel: 0.01 },
      steps: [
        `In parallel, each resistor has the full ${V} V across it.`,
        `Branch currents: ${V}/${R1} = ${f(V / R1, 3)} A, ${V}/${R2} = ${f(V / R2, 3)} A, ${V}/${R3} = ${f(V / R3, 3)} A.`,
        `Kirchhoff's current law: I = ${f(V / R1, 3)} + ${f(V / R2, 3)} + ${f(V / R3, 3)} = <b>${f(s.I, 3)} A</b>.`,
        `(Check: 1/R<sub>eq</sub> = 1/${R1} + 1/${R2} + 1/${R3}, so R<sub>eq</sub> = ${f(s.Req, 3)} Ω and V / R<sub>eq</sub> gives the same.)`,
      ],
      load,
    };
  }
  const R23 = (R2 * R3) / (R2 + R3);
  return {
    question: `A <b>${R1} Ω</b> resistor is in series with a parallel pair of <b>${R2} Ω</b> and <b>${R3} Ω</b>, across a <b>${V} V</b> battery. Find the <b>current through the ${R2} Ω resistor</b>.`,
    answer: s.parts[1].I,
    unit: 'A',
    tol: { rel: 0.01 },
    steps: [
      `Parallel pair: R<sub>23</sub> = (${R2} × ${R3}) / (${R2} + ${R3}) = <b>${f(R23, 3)} Ω</b>.`,
      `Total: R<sub>eq</sub> = ${R1} + ${f(R23, 3)} = <b>${f(s.Req, 3)} Ω</b>, so I = ${V} / ${f(s.Req, 3)} = <b>${f(s.I, 3)} A</b>.`,
      `Voltage across the pair: V<sub>23</sub> = I × R<sub>23</sub> = <b>${f(s.I * R23, 3)} V</b>.`,
      `Current in R2: I₂ = V<sub>23</sub> / ${R2} = <b>${f(s.parts[1].I, 3)} A</b>.`,
    ],
    load,
  };
};

const projectile = (rng) => {
  const v = pick(rng, [10, 12, 15, 18, 20, 25, 30]);
  const th = pick(rng, [15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75]);
  const a = (th * Math.PI) / 180;
  const vx = v * Math.cos(a);
  const vy = v * Math.sin(a);
  const T = (2 * vy) / G;
  const H = (vy * vy) / (2 * G);
  const Rg = vx * T;
  const ask = pick(rng, ['range', 'height', 'time']);
  const answer = { range: Rg, height: H, time: T }[ask];
  const unit = ask === 'time' ? 's' : 'm';
  const words = { range: 'horizontal range', height: 'maximum height', time: 'time of flight' }[ask];
  const final = { range: `R = vₓ × T = ${f(vx)} × ${f(T)} = <b>${f(Rg)} m</b> (or v² sin 2θ / g)`, height: `H = v<sub>y</sub>² / 2g = ${f(vy)}² / (2 × 9.81) = <b>${f(H)} m</b>`, time: `T = 2v<sub>y</sub> / g = 2 × ${f(vy)} / 9.81 = <b>${f(T)} s</b>` }[ask];
  return {
    question: `A ball is thrown from level ground at <b>${v} m/s</b>, <b>${th}°</b> above the horizontal. Ignoring air resistance (g = 9.81 m/s²), find the <b>${words}</b>.`,
    answer,
    unit,
    tol: { rel: 0.01 },
    steps: [
      `Split the velocity: vₓ = ${v} cos ${th}° = <b>${f(vx)} m/s</b>, v<sub>y</sub> = ${v} sin ${th}° = <b>${f(vy)} m/s</b>.`,
      'Horizontally there is no force, so vₓ stays constant. Vertically, gravity slows v<sub>y</sub> by 9.81 m/s every second.',
      ask === 'time' ? final : `Time of flight: T = 2v<sub>y</sub> / g = <b>${f(T)} s</b>.`,
      ...(ask === 'time' ? [] : [final]),
    ],
    load: [['click', '[data-planet="earth"]'], ['check', '[data-drag]', false], ['set', '[data-h]', 0], ['set', '[data-v]', v], ['set', '[data-angle]', th]],
  };
};

const gaslaws = (rng) => {
  const kind = pick(rng, ['boyle', 'charles', 'ideal']);
  if (kind === 'boyle') {
    const P1 = pick(rng, [100, 120, 150, 200, 250]);
    const V1 = int(rng, 4, 10);
    const V2 = pick(rng, [1, 2, 3].filter((x) => x < V1).concat([V1 / 2]));
    const P2 = (P1 * V1) / V2;
    return {
      question: `A gas occupies <b>${V1} L</b> at <b>${P1} kPa</b>. It is compressed to <b>${f(V2)} L</b> at constant temperature. Find the new <b>pressure</b>.`,
      answer: P2,
      unit: 'kPa',
      tol: { rel: 0.01 },
      steps: ['Constant temperature and amount: <b>Boyle’s law</b>, P₁V₁ = P₂V₂.', `P₂ = P₁V₁ / V₂ = ${P1} × ${V1} / ${f(V2)} = <b>${f(P2)} kPa</b>.`],
      load: [],
    };
  }
  if (kind === 'charles') {
    const V1 = int(rng, 2, 8);
    const T1 = pick(rng, [0, 17, 27, 37]);
    const T2 = pick(rng, [77, 127, 177, 227]);
    const V2 = (V1 * (T2 + 273.15)) / (T1 + 273.15);
    return {
      question: `A gas has a volume of <b>${V1} L</b> at <b>${T1} °C</b>. It is heated to <b>${T2} °C</b> at constant pressure. Find its new <b>volume</b>.`,
      answer: V2,
      unit: 'L',
      tol: { rel: 0.01 },
      steps: [
        'Constant pressure: <b>Charles’s law</b>, V₁ / T₁ = V₂ / T₂, with T in <b>kelvin</b>.',
        `Convert: T₁ = ${T1} + 273.15 = ${f(T1 + 273.15)} K, T₂ = ${T2} + 273.15 = ${f(T2 + 273.15)} K.`,
        `V₂ = V₁ × T₂ / T₁ = ${V1} × ${f(T2 + 273.15)} / ${f(T1 + 273.15)} = <b>${f(V2)} L</b>.`,
      ],
      load: [],
    };
  }
  const n = pick(rng, [0.1, 0.2, 0.3, 0.4]);
  const T = pick(rng, [250, 300, 350, 400, 500]);
  const V = int(rng, 2, 10);
  const P = pressure(n, T, V);
  return {
    question: `<b>${n} mol</b> of an ideal gas is held in a <b>${V} L</b> container at <b>${T} K</b>. Find its <b>pressure</b> (R = 8.314 J mol⁻¹ K⁻¹).`,
    answer: P,
    unit: 'kPa',
    tol: { rel: 0.01 },
    steps: [
      'Ideal gas law: PV = nRT, so P = nRT / V.',
      `With V in litres, P comes out in kPa: P = ${n} × ${GAS_R} × ${T} / ${V}.`,
      `P = <b>${f(P, 1)} kPa</b>.`,
    ],
    load: [['radio', 'input[name="hold"][value="T"]'], ['set', '[data-n]', Math.round(n / 0.002)], ['set', '[data-V]', V], ['set', '[data-T]', T]],
  };
};

const galvanic = (rng) => {
  const metals = Object.keys(METALS);
  const m1 = pick(rng, metals);
  let m2 = pick(rng, metals);
  while (m2 === m1) m2 = pick(rng, metals);
  const nernst = rng() < 0.5;
  const c1 = nernst ? pick(rng, [0.001, 0.01, 0.1, 1]) : 1;
  const c2 = nernst ? pick(rng, [0.01, 0.1, 1]) : 1;
  const r = cell(m1, c1, m2, c2);
  const [ca, cc] = r.anode === m1 ? [c1, c2] : [c2, c1];
  const za = METALS[r.anode].z;
  const zc = METALS[r.cathode].z;
  const conc = (m, c) => `${m}|${METALS[m].ion} (${c} M)`;
  return {
    question: nernst
      ? `A cell is made from ${conc(m1, c1)} and ${conc(m2, c2)} at 25 °C. Using E°(${m1}) = ${METALS[m1].E} V and E°(${m2}) = ${METALS[m2].E} V, find the <b>cell voltage</b>.`
      : `A galvanic cell is made from ${m1} and ${m2} electrodes in 1 M solutions of their ions. Given E°(${m1}) = ${METALS[m1].E} V and E°(${m2}) = ${METALS[m2].E} V, find the <b>standard cell EMF</b>.`,
    answer: r.E,
    unit: 'V',
    tol: { abs: 0.005 },
    steps: [
      `The metal with the lower E° is the <b>anode</b> (oxidised): ${r.anode}. The cathode is ${r.cathode}.`,
      `E°<sub>cell</sub> = E°<sub>cathode</sub> − E°<sub>anode</sub> = ${METALS[r.cathode].E} − (${METALS[r.anode].E}) = <b>${f(r.E0)} V</b>.`,
      ...(nernst ? [
        `Electrons transferred: n = ${r.n}. Reaction quotient Q = [${METALS[r.anode].ion}]${r.n / za > 1 ? `<sup>${r.n / za}</sup>` : ''} / [${METALS[r.cathode].ion}]${r.n / zc > 1 ? `<sup>${r.n / zc}</sup>` : ''} = ${ca}${r.n / za > 1 ? `<sup>${r.n / za}</sup>` : ''} / ${cc}${r.n / zc > 1 ? `<sup>${r.n / zc}</sup>` : ''} = ${f(r.Q, 4)}.`,
        `Nernst: E = E° − (0.0592 / ${r.n}) log Q = ${f(r.E0)} − ${f(0.0592 / r.n, 4)} × ${f(Math.log10(r.Q), 3)} = <b>${f(r.E, 3)} V</b>.`,
      ] : []),
    ],
    load: [['select', '[data-m1]', m1], ['select', '[data-m2]', m2], ['set', '[data-c1]', Math.log10(c1)], ['set', '[data-c2]', Math.log10(c2)]],
  };
};

const scheduling = (rng) => {
  const algo = pick(rng, ['fcfs', 'sjf', 'rr']);
  const q = pick(rng, [2, 3]);
  const arrivals = [0, int(rng, 0, 3), int(rng, 1, 5), int(rng, 2, 7)].sort((a, b) => a - b);
  const procs = arrivals.map((arrival, i) => ({ id: `P${i + 1}`, arrival, burst: int(rng, 1, 9), priority: int(rng, 1, 4) }));
  const r = schedule(procs, algo, q);
  const table = `<table class="mini"><tr><th></th>${procs.map((p) => `<th>${p.id}</th>`).join('')}</tr><tr><td>arrival</td>${procs.map((p) => `<td>${p.arrival}</td>`).join('')}</tr><tr><td>burst</td>${procs.map((p) => `<td>${p.burst}</td>`).join('')}</tr></table>`;
  const gantt = r.slices.map((s) => `${s.id ?? 'idle'} ${s.start}–${s.end}`).join(' | ');
  return {
    question: `Find the <b>average waiting time</b> using <b>${ALGOS[algo].name}</b>${algo === 'rr' ? ` (time quantum ${q})` : ''}${algo === 'sjf' ? ' (non-preemptive)' : ''}.${table}`,
    answer: r.avgWaiting,
    unit: 'time units',
    tol: { abs: 0.01 },
    steps: [
      `Gantt chart: ${gantt}`,
      `Completion times: ${r.results.map((x) => `${x.id} = ${x.completion}`).join(', ')}.`,
      `Waiting = completion − arrival − burst: ${r.results.map((x, i) => `${x.id} = ${x.completion} − ${procs[i].arrival} − ${procs[i].burst} = ${x.waiting}`).join('; ')}.`,
      `Average = (${r.results.map((x) => x.waiting).join(' + ')}) / 4 = <b>${f(r.avgWaiting)}</b>.`,
    ],
    load: [
      ['click', '[data-preset="convoy"]'],
      ...procs.flatMap((p, i) => ['arrival', 'burst', 'priority'].map((k) => ['change', `[data-procs] input[data-i="${i}"][data-k="${k}"]`, p[k]])),
      ['click', `[data-algo="${algo}"]`],
      ...(algo === 'rr' ? [['set', '[data-q]', q]] : []),
    ],
  };
};

const paging = (rng) => {
  const algo = pick(rng, ['fifo', 'lru', 'opt']);
  const frames = pick(rng, [3, 4]);
  const refs = Array.from({ length: 12 }, () => int(rng, 0, 5));
  const r = simulate(refs, frames, algo);
  const trace = r.steps.map((s) => `${s.page}${s.hit ? '✓' : '✗'}`).join(' ');
  return {
    question: `Reference string: <b>${refs.join(' ')}</b>. With <b>${frames} frames</b> and <b>${PAGE_ALGOS[algo].name}</b> page replacement (frames start empty), how many <b>page faults</b> occur?`,
    answer: r.faults,
    unit: 'faults',
    tol: { abs: 0 },
    steps: [
      `${PAGE_ALGOS[algo].long}.`,
      `Go through the string (✗ = fault, ✓ = hit): ${trace}`,
      `Frames at the end: [${r.steps.at(-1).frames.map((p) => p ?? '–').join(', ')}].`,
      `Count the ✗: <b>${r.faults} page faults</b> (${r.hits} hits).`,
    ],
    load: [['change', '[data-refs]', refs.join(' ')], ['set', '[data-frames]', frames], ['click', `[data-algo="${algo}"]`]],
  };
};

const acidbase = (rng) => {
  const kind = pick(rng, ['strong-acid', 'strong-base', 'weak-acid']);
  // Weak-acid concentrations stay ≥ 0.01 M so the usual x ≪ c approximation is within the marking tolerance.
  const c = kind === 'weak-acid' ? pick(rng, [0.01, 0.02, 0.05, 0.1, 0.2, 0.5]) : pick(rng, [1, 2, 5]) * 10 ** -int(rng, 1, 3);
  const key = { 'strong-acid': 'HCl', 'strong-base': 'NaOH', 'weak-acid': 'CH3COOH' }[kind];
  const p = pH(key, c);
  const cs = c >= 0.01 ? f(c, 3) : c.toExponential(0);
  const steps = {
    'strong-acid': [`HCl is a strong acid: it ionises completely, so [H⁺] = ${cs} mol/L.`, `pH = −log[H⁺] = −log(${cs}) = <b>${f(p)}</b>.`],
    'strong-base': [`NaOH is a strong base: [OH⁻] = ${cs} mol/L.`, `pOH = −log(${cs}) = ${f(14 - p)}.`, `pH = 14 − pOH = <b>${f(p)}</b>.`],
    'weak-acid': [
      'Acetic acid is weak (Ka = 1.8 × 10⁻⁵): only a little ionises. Ka = x² / (c − x).',
      `Since x ≪ c: x ≈ √(Ka × c) = √(1.8 × 10⁻⁵ × ${cs}) = ${(Math.sqrt(1.8e-5 * c)).toExponential(2)} mol/L.`,
      `pH = −log x ≈ <b>${f(p)}</b> (solving the quadratic exactly gives ${f(p, 3)}).`,
    ],
  }[kind];
  return {
    question: `Find the <b>pH</b> of a <b>${cs} M</b> solution of ${SUBSTANCES[key].name.split(' (')[0].toLowerCase()} at 25 °C.`,
    answer: p,
    unit: '',
    tol: { abs: 0.03 },
    steps,
    load: [['radio', 'input[name="mode"][value="explore"]'], ['select', '[data-sub]', key], ['set', '[data-c]', Math.log10(c)]],
  };
};

export const GENERATORS = { beam, circuits, projectile, gaslaws, galvanic, scheduling, paging, acidbase, ...MORE };

/** Is a typed answer close enough? Accepts "12.5", "12,5", "1.2e3". */
export function checkAnswer(text, problem) {
  const v = Number(String(text).trim().replace(',', '.'));
  if (!Number.isFinite(v) || String(text).trim() === '') return null;
  const { rel, abs } = problem.tol;
  const err = Math.abs(v - problem.answer);
  return rel !== undefined ? err <= rel * Math.max(Math.abs(problem.answer), 1e-9) : err <= abs + 1e-9;
}

/** A small seeded random generator, so tests (and shared links) can reproduce a problem. */
export function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
