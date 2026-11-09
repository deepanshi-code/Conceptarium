// More practice-problem generators (same shape as problems.js): data structures, algorithms, chemistry, physics,
// mechanical, electrical, electronics and biology. Formulas are the standard textbook ones; each question states
// its assumptions so students aren't marked wrong for using a different convention.
import { unpaired, ELEMENTS as ELEMENT_SYMBOLS, NAMES } from '../chem/orbitals.js';
import { LATTICES } from '../chem/crystal.js';
import { aliasFrequency } from '../ece/signals.js';
import { venturi } from '../civil/fluid.js';
import { transformer } from '../elec/machines.js';
import { GRAVITY } from '../elec/pid.js';
import { codonToAmino } from '../bio/dna.js';

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const int = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
const f = (x, d = 2) => String(Number(x.toFixed(d)));
const NA = 6.022e23;

// ---- Data structures & algorithms ----
const sorting = (rng) => {
  const n = int(rng, 5, 7);
  const arr = Array.from({ length: n }, () => int(rng, 1, 30));
  const pairs = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (arr[i] > arr[j]) pairs.push(`(${arr[i]}, ${arr[j]})`);
  return {
    question: `How many <b>swaps</b> does bubble sort make to sort <b>[${arr.join(', ')}]</b> into ascending order?`,
    answer: pairs.length,
    unit: 'swaps',
    tol: { abs: 0 },
    steps: [
      'Each bubble-sort swap fixes exactly one <b>inversion</b>: a pair that is in the wrong order.',
      `List the inversions (bigger number before a smaller one): ${pairs.join(' ') || 'none'}.`,
      `So bubble sort makes <b>${pairs.length}</b> swaps.`,
    ],
    load: [],
  };
};

const search = (rng) => {
  const n = pick(rng, [7, 15, 31, 50, 100, 500, 1000, 1023, 1024, 4096, 1e6]);
  const k = Math.ceil(Math.log2(n + 1));
  return {
    question: `A sorted array has <b>${n.toLocaleString('en-IN')}</b> elements. In the worst case, how many elements does <b>binary search</b> look at?`,
    answer: k,
    unit: 'comparisons',
    tol: { abs: 0 },
    steps: [
      'Each look halves the part that could still hold the value. After k looks, up to 2ᵏ − 1 elements are covered.',
      `Smallest k with 2ᵏ − 1 ≥ ${n.toLocaleString('en-IN')}: k = ⌈log₂(${n.toLocaleString('en-IN')} + 1)⌉.`,
      `2<sup>${k - 1}</sup> − 1 = ${2 ** (k - 1) - 1} is too few, 2<sup>${k}</sup> − 1 = ${(2 ** k - 1).toLocaleString('en-IN')} is enough, so <b>${k}</b>.`,
    ],
    load: [],
  };
};

const hanoi = (rng) => {
  const n = int(rng, 3, 10);
  const smallest = rng() < 0.4;
  return {
    question: smallest ? `In the minimum solution of the Tower of Hanoi with <b>${n} disks</b>, how many times does the <b>smallest</b> disk move?` : `What is the minimum number of moves to solve the Tower of Hanoi with <b>${n} disks</b>?`,
    answer: smallest ? 2 ** (n - 1) : 2 ** n - 1,
    unit: 'moves',
    tol: { abs: 0 },
    steps: smallest
      ? ['In the optimal solution the smallest disk moves on every <b>other</b> move (1st, 3rd, 5th…).', `Total moves = 2<sup>${n}</sup> − 1 = ${2 ** n - 1}, so the smallest disk moves (${2 ** n - 1} + 1) / 2 = <b>${2 ** (n - 1)}</b> times.`]
      : ['Recurrence: T(n) = 2T(n − 1) + 1 (move n − 1 aside, move the biggest, move n − 1 back), T(1) = 1.', `This solves to T(n) = 2ⁿ − 1 = 2<sup>${n}</sup> − 1 = <b>${2 ** n - 1}</b>.`],
    load: [['set', '[data-n]', Math.min(7, n)]],
  };
};

const stackqueue = (rng) => {
  // Build a postfix expression from a random small expression tree.
  const nums = () => int(rng, 2, 9);
  const ops = ['+', '-', '*'];
  const a = nums();
  const b = nums();
  const c = nums();
  const d = nums();
  const o1 = pick(rng, ops);
  const o2 = pick(rng, ops);
  const o3 = pick(rng, ops);
  const tokens = [a, b, o1, c, d, o2, o3].map(String);
  const apply = (x, y, o) => (o === '+' ? x + y : o === '-' ? x - y : x * y);
  const stack = [];
  const steps = [];
  for (const t of tokens) {
    if (ops.includes(t)) {
      const y = stack.pop();
      const x = stack.pop();
      const r = apply(x, y, t);
      stack.push(r);
      steps.push(`<b>${t}</b>: pop ${y} and ${x}, push ${x} ${t} ${y} = ${r} → stack [${stack.join(', ')}]`);
    } else {
      stack.push(Number(t));
      steps.push(`${t}: push → stack [${stack.join(', ')}]`);
    }
  }
  return {
    question: `Evaluate the postfix expression <b>${tokens.join(' ')}</b> using a stack.`,
    answer: stack[0],
    unit: '',
    tol: { abs: 0 },
    steps: ['Read left to right: push numbers; for an operator, pop two, apply (second-popped op first-popped), push the result.', steps.slice(0, 3).join('<br>'), steps.slice(3).join('<br>'), `The one value left on the stack is the answer: <b>${stack[0]}</b>.`],
    load: [],
  };
};

const bstHeight = (rng) => {
  const keys = [];
  while (keys.length < 7) {
    const k = int(rng, 1, 50);
    if (!keys.includes(k)) keys.push(k);
  }
  const root = { k: keys[0], l: null, r: null };
  for (const k of keys.slice(1)) {
    let n = root;
    for (;;) {
      const side = k < n.k ? 'l' : 'r';
      if (!n[side]) { n[side] = { k, l: null, r: null }; break; }
      n = n[side];
    }
  }
  const h = (n) => (n ? 1 + Math.max(h(n.l), h(n.r)) : 0);
  const longest = (n) => (!n ? [] : [n.k, ...(h(n.l) >= h(n.r) ? longest(n.l) : longest(n.r))]);
  return {
    question: `Insert <b>${keys.join(', ')}</b> in this order into an empty (unbalanced) binary search tree. What is its height, counted as the number of <b>levels</b> (a single node has height 1)?`,
    answer: h(root),
    unit: 'levels',
    tol: { abs: 0 },
    steps: [`${keys[0]} becomes the root. Each later key goes left if smaller, right if bigger, until it finds an empty spot.`, `The longest root-to-leaf path is ${longest(root).join(' → ')}.`, `That path has <b>${h(root)}</b> levels.`],
    load: [],
  };
};

// ---- Chemistry ----
const crystal = (rng) => {
  const key = pick(rng, ['sc', 'bcc', 'fcc']);
  const lat = LATTICES[key];
  const a = int(rng, 28, 60) * 10; // pm
  const M = pick(rng, [23, 27, 40, 52, 56, 59, 64, 108, 197]);
  const rho = (lat.n * M) / ((a * 1e-10) ** 3 * NA);
  return {
    question: `A metal (molar mass <b>${M} g/mol</b>) crystallises in a <b>${lat.name.toLowerCase()}</b> lattice with edge length <b>${a} pm</b>. Find its <b>density</b> (N<sub>A</sub> = 6.022 × 10²³ mol⁻¹).`,
    answer: rho,
    unit: 'g/cm³',
    tol: { rel: 0.02 },
    steps: [
      `Atoms per ${key.toUpperCase()} cell: n = <b>${lat.n}</b>.`,
      `Edge in cm: a = ${a} pm = ${a} × 10⁻¹⁰ cm, so a³ = ${((a * 1e-10) ** 3).toExponential(3)} cm³.`,
      `ρ = n × M / (a³ × N<sub>A</sub>) = ${lat.n} × ${M} / (${((a * 1e-10) ** 3).toExponential(3)} × 6.022 × 10²³) = <b>${f(rho)} g/cm³</b>.`,
    ],
    load: [['click', `[data-lat="${key}"]`]],
  };
};

const orbitals = (rng) => {
  const z = int(rng, 5, 36);
  const u = unpaired(z);
  return {
    question: `How many <b>unpaired electrons</b> does a ground-state <b>${NAMES[z - 1]}</b> atom (${ELEMENT_SYMBOLS[z - 1]}, Z = ${z}) have?`,
    answer: u,
    unit: 'electrons',
    tol: { abs: 0 },
    steps: [
      'Fill subshells in Aufbau order (1s 2s 2p 3s 3p 4s 3d 4p), remembering Cr and Cu take one 4s electron into 3d.',
      "In the last, partly filled subshell, apply <b>Hund's rule</b>: one electron per orbital first, then pair up.",
      `Count the single arrows: <b>${u}</b> (load it into the model to see the boxes).`,
    ],
    load: [['set', '[data-zin]', z]],
  };
};

const rates = (rng) => {
  const Ea = pick(rng, [40, 50, 60, 75, 100]);
  const T1 = pick(rng, [280, 290, 298, 300]);
  const T2 = T1 + pick(rng, [10, 20, 30]);
  const ratio = Math.exp(((Ea * 1000) / 8.314) * (1 / T1 - 1 / T2));
  return {
    question: `A reaction has activation energy <b>${Ea} kJ/mol</b>. By what factor does its rate constant increase from <b>${T1} K</b> to <b>${T2} K</b>? (R = 8.314 J mol⁻¹ K⁻¹)`,
    answer: ratio,
    unit: '×',
    tol: { rel: 0.02 },
    steps: [
      'Arrhenius: k = A e^(−Ea/RT), so k₂ / k₁ = e^[(Ea / R)(1/T₁ − 1/T₂)].',
      `(Ea / R) = ${Ea * 1000} / 8.314 = ${f((Ea * 1000) / 8.314, 1)} K; (1/T₁ − 1/T₂) = ${(1 / T1 - 1 / T2).toExponential(3)} K⁻¹.`,
      `k₂ / k₁ = e^${f(((Ea * 1000) / 8.314) * (1 / T1 - 1 / T2), 3)} = <b>${f(ratio)}</b>.`,
    ],
    load: [],
  };
};

// ---- Physics / mechanical ----
const shm = (rng) => {
  if (rng() < 0.5) {
    const m = pick(rng, [0.2, 0.5, 1, 1.5, 2]);
    const k = pick(rng, [10, 20, 40, 50, 80]);
    const T = 2 * Math.PI * Math.sqrt(m / k);
    return {
      question: `A <b>${m} kg</b> mass hangs from a spring of stiffness <b>${k} N/m</b>. Find the period of oscillation.`,
      answer: T,
      unit: 's',
      tol: { rel: 0.01 },
      steps: ['For a mass on a spring: T = 2π √(m / k).', `T = 2π √(${m} / ${k}) = 2π × ${f(Math.sqrt(m / k), 4)} = <b>${f(T, 3)} s</b>.`],
      load: [['radio', 'input[name="sys"][value="spring"]'], ['set', '[data-m]', m], ['set', '[data-k]', k]],
    };
  }
  const L = pick(rng, [0.5, 1, 1.5, 2, 2.5]);
  const T = 2 * Math.PI * Math.sqrt(L / 9.81);
  return {
    question: `Find the period of a simple pendulum of length <b>${L} m</b> for small swings (g = 9.81 m/s²).`,
    answer: T,
    unit: 's',
    tol: { rel: 0.01 },
    steps: ['For small angles: T = 2π √(L / g). (It does not depend on the mass.)', `T = 2π √(${L} / 9.81) = <b>${f(T, 3)} s</b>.`],
    load: [['radio', 'input[name="sys"][value="pendulum"]'], ['check', '[data-moon]', false], ['set', '[data-L]', L], ['set', '[data-th]', 10]],
  };
};

const fourier = (rng) => {
  const n = pick(rng, [1, 3, 5, 7, 9]);
  return {
    question: `A square wave swings between −1 and +1. What is the amplitude of its <b>${n === 1 ? 'fundamental (1st harmonic)' : `${n}th harmonic`}</b>? (Give 3 decimal places.)`,
    answer: 4 / (n * Math.PI),
    unit: '',
    tol: { abs: 0.002 },
    steps: ['Square wave: f(t) = (4/π) [sin t + sin 3t/3 + sin 5t/5 + …]: only odd harmonics, amplitude 4/(nπ).', `For n = ${n}: 4 / (${n}π) = <b>${f(4 / (n * Math.PI), 3)}</b>.`],
    load: [['select', '[data-wave]', 'square'], ['set', '[data-k]', (n + 1) / 2]],
  };
};

const descent = (rng) => {
  const a = pick(rng, [1, 2, 3, 0.5]);
  const x0 = pick(rng, [2, 3, 4, -2, -3, 5]);
  const lr = pick(rng, [0.1, 0.2, 0.25, 0.05]);
  const g = 2 * a * x0;
  const x1 = x0 - lr * g;
  return {
    question: `Minimise f(x) = ${a}x² by gradient descent, starting at <b>x₀ = ${x0}</b> with learning rate <b>η = ${lr}</b>. What is <b>x₁</b> after one step?`,
    answer: x1,
    unit: '',
    tol: { abs: 0.001 },
    steps: [`Gradient: f′(x) = ${2 * a}x, so f′(${x0}) = ${f(g, 4)}.`, `Update: x₁ = x₀ − η f′(x₀) = ${x0} − ${lr} × ${f(g, 4)} = <b>${f(x1, 4)}</b>.`],
    load: [],
  };
};

const gears = (rng) => {
  const t1 = pick(rng, [12, 15, 16, 20, 24]);
  const t2 = pick(rng, [30, 36, 40, 45, 48, 60]);
  const rpm = pick(rng, [60, 90, 120, 150, 180, 240, 300]);
  const idler = rng() < 0.35;
  const out = (rpm * t1) / t2;
  return {
    question: idler
      ? `A <b>${t1}-tooth</b> driver at <b>${rpm} rpm</b> drives a <b>${t2}-tooth</b> gear through a 20-tooth idler. Find the output speed in rpm.`
      : `A <b>${t1}-tooth</b> gear turning at <b>${rpm} rpm</b> drives a <b>${t2}-tooth</b> gear. Find the speed of the driven gear in rpm.`,
    answer: out,
    unit: 'rpm',
    tol: { rel: 0.01 },
    steps: [
      'Meshing gears move the same number of teeth per second: N₁T₁ = N₂T₂.',
      ...(idler ? ['An idler cancels out: (T₁/T<sub>idler</sub>) × (T<sub>idler</sub>/T₂) = T₁/T₂. It only changes the direction.'] : []),
      `N₂ = N₁ × T₁ / T₂ = ${rpm} × ${t1} / ${t2} = <b>${f(out)} rpm</b>.`,
    ],
    load: [['radio', 'input[name="mode"][value="simple"]'], ['click', '[data-count="-1"]'], ['click', '[data-count="-1"]'], ...(idler ? [['click', '[data-count="1"]'], ['set', '[data-t="0"]', t1], ['set', '[data-t="1"]', 20], ['set', '[data-t="2"]', t2]] : [['set', '[data-t="0"]', t1], ['set', '[data-t="1"]', t2]]), ['set', '[data-rpm]', rpm]],
  };
};

const engine = (rng) => {
  const r = pick(rng, [25, 30, 35, 40, 45, 50]);
  const N = pick(rng, [1200, 1500, 1800, 2400, 3000]);
  const stroke = (2 * r) / 1000;
  const v = (2 * stroke * N) / 60;
  return {
    question: `An engine has a crank radius of <b>${r} mm</b> and runs at <b>${N} rpm</b>. Find the <b>mean piston speed</b>.`,
    answer: v,
    unit: 'm/s',
    tol: { rel: 0.01 },
    steps: [`Stroke = 2 × crank radius = ${2 * r} mm = ${f(stroke, 3)} m.`, 'The piston covers 2 strokes per revolution, so mean speed = 2 × stroke × N / 60.', `v = 2 × ${f(stroke, 3)} × ${N} / 60 = <b>${f(v)} m/s</b>.`],
    load: [['set', '[data-r]', r], ['set', '[data-rpm]', Math.min(3000, N)]],
  };
};

const stressstrain = (rng) => {
  const P = pick(rng, [10, 20, 25, 40, 50]) * 1000; // N
  const L = pick(rng, [1, 1.5, 2, 3]); // m
  const d = pick(rng, [10, 12, 16, 20, 25]); // mm
  const E = pick(rng, [[200, 'steel'], [70, 'aluminium'], [110, 'copper']]);
  const A = (Math.PI * d * d) / 4;
  const stress = P / A; // MPa
  const delta = (P * L * 1000) / (A * E[0] * 1000); // mm
  return {
    question: `A ${E[1]} rod (E = ${E[0]} GPa), <b>${L} m</b> long and <b>${d} mm</b> in diameter, carries a tensile load of <b>${P / 1000} kN</b>. Find its <b>elongation</b> (assume it stays elastic).`,
    answer: delta,
    unit: 'mm',
    tol: { rel: 0.01 },
    steps: [
      `Area: A = πd²/4 = π × ${d}² / 4 = ${f(A, 1)} mm².`,
      `Stress: σ = P / A = ${P} / ${f(A, 1)} = ${f(stress, 1)} MPa (below yield, so Hooke's law applies).`,
      `Elongation: δ = PL / (AE) = ${P} × ${L * 1000} / (${f(A, 1)} × ${E[0] * 1000}) = <b>${f(delta, 3)} mm</b>.`,
    ],
    load: [],
  };
};

const truss = (rng) => {
  const L = pick(rng, [4, 6, 8]);
  const h = pick(rng, [1.5, 2, 3]);
  const P = pick(rng, [10, 20, 30, 40]);
  const th = Math.atan2(h, L / 2);
  const rafter = P / (2 * Math.sin(th));
  return {
    question: `A triangular roof truss has span <b>${L} m</b> and height <b>${h} m</b>, with a load of <b>${P} kN</b> at the apex (pin and roller supports). Find the force in each sloping member (magnitude).`,
    answer: rafter,
    unit: 'kN',
    tol: { rel: 0.01 },
    steps: [
      `By symmetry each support takes ${P / 2} kN.`,
      `Slope angle: tan θ = ${h} / ${L / 2}, so θ = ${f((th * 180) / Math.PI, 2)}°.`,
      `At a support joint, vertical balance: F sin θ = ${P / 2}, so F = ${P / 2} / sin ${f((th * 180) / Math.PI, 2)}° = <b>${f(rafter)} kN</b> (compression).`,
    ],
    load: [],
  };
};

const fluid = (rng) => {
  const Q = pick(rng, [4, 6, 8, 10, 12]);
  const ratio = pick(rng, [0.5, 0.6, 0.7]);
  const r = venturi(Q / 1000, 0.1, 0.1 * ratio);
  return {
    question: `Water flows at <b>${Q} L/s</b> through a 100 mm pipe that narrows to <b>${100 * ratio} mm</b> at a Venturi throat. Find the <b>pressure drop</b> between pipe and throat (ρ = 1000 kg/m³, no losses).`,
    answer: r.dp / 1000,
    unit: 'kPa',
    tol: { rel: 0.02 },
    steps: [
      `Areas: A₁ = π(0.1)²/4 = ${f(Math.PI * 0.0025, 5)} m², A₂ = π(${0.1 * ratio})²/4 = ${f((Math.PI * (0.1 * ratio) ** 2) / 4, 5)} m².`,
      `Continuity: v₁ = Q/A₁ = <b>${f(r.v1, 3)} m/s</b>, v₂ = Q/A₂ = <b>${f(r.v2, 3)} m/s</b>.`,
      `Bernoulli: Δp = ½ρ(v₂² − v₁²) = 0.5 × 1000 × (${f(r.v2, 3)}² − ${f(r.v1, 3)}²) = <b>${f(r.dp / 1000, 2)} kPa</b>.`,
    ],
    load: [['set', '[data-Q]', Q], ['set', '[data-ratio]', ratio]],
  };
};

// ---- Electrical / electronics ----
const induction = (rng) => {
  const Vp = pick(rng, [110, 220, 230, 240]);
  const Np = pick(rng, [500, 800, 1000, 1200, 2000]);
  const Ns = pick(rng, [40, 50, 100, 200, 4000]);
  const t = transformer(Vp, Np, Ns, 10);
  return {
    question: `An ideal transformer has <b>${Np}</b> primary turns and <b>${Ns}</b> secondary turns, with <b>${Vp} V</b> AC on the primary. Find the secondary voltage.`,
    answer: t.Vs,
    unit: 'V',
    tol: { rel: 0.01 },
    steps: ['Ideal transformer: Vs / Vp = Ns / Np.', `Vs = ${Vp} × ${Ns} / ${Np} = <b>${f(t.Vs)} V</b> (${t.kind}).`],
    load: [['radio', 'input[name="mode"][value="transformer"]'], ['set', '[data-Vp]', Math.min(240, Vp)], ['set', '[data-Np]', Math.min(20, Np / 100)], ['set', '[data-Ns]', Math.max(1, Math.min(20, Ns / 100))]],
  };
};

const threephase = (rng) => {
  const VL = pick(rng, [400, 415, 440]);
  const IL = pick(rng, [5, 10, 12, 15, 20]);
  const pf = pick(rng, [0.8, 0.85, 0.9, 1]);
  const P = Math.sqrt(3) * VL * IL * pf;
  return {
    question: `A balanced three-phase load draws <b>${IL} A</b> per line from a <b>${VL} V</b> (line-to-line) supply at a power factor of <b>${pf}</b>. Find the total power in kW.`,
    answer: P / 1000,
    unit: 'kW',
    tol: { rel: 0.01 },
    steps: ['Three-phase power: P = √3 × V<sub>L</sub> × I<sub>L</sub> × cos φ.', `P = 1.732 × ${VL} × ${IL} × ${pf} = ${f(P, 0)} W = <b>${f(P / 1000, 2)} kW</b>.`],
    load: [],
  };
};

const pid = (rng) => {
  const Kp = pick(rng, [2, 4, 5, 8, 10]);
  return {
    question: `A drone's altitude uses a PD controller with <b>Kp = ${Kp}</b> (no integral term), thrust per unit mass u = Kp·e + Kd·ė, and g = 9.81 m/s². After it settles, how far below the target does it hover?`,
    answer: GRAVITY / Kp,
    unit: 'm',
    tol: { rel: 0.01 },
    steps: ['At rest, ė = 0 and the thrust must exactly balance gravity: u = g.', `With no integral term, u = Kp·e, so e = g / Kp = 9.81 / ${Kp} = <b>${f(GRAVITY / Kp, 3)} m</b>. (An I term would remove this.)`],
    load: [['set', '[data-Kp]', Kp], ['set', '[data-Ki]', 0], ['set', '[data-Kd]', 4], ['click', '[data-restart]']],
  };
};

const sampling = (rng) => {
  const fs = pick(rng, [8, 10, 12, 16, 20]);
  const fsig = int(rng, Math.ceil(fs / 2) + 1, 2 * fs - 1);
  const al = aliasFrequency(fsig, fs);
  return {
    question: `A <b>${fsig} Hz</b> sine wave is sampled at <b>${fs} Hz</b>. What frequency do the samples appear to show?`,
    answer: al,
    unit: 'Hz',
    tol: { abs: 0.01 },
    steps: [`Nyquist limit: fs/2 = ${fs / 2} Hz. ${fsig} Hz is above it, so it aliases.`, `Fold it: f<sub>alias</sub> = |f − k·fs| for the nearest k = ${Math.round(fsig / fs)}: |${fsig} − ${Math.round(fsig / fs) * fs}| = <b>${f(al)} Hz</b>.`],
    load: [['set', '[data-f]', Math.min(12, fsig)], ['set', '[data-fs]', fs]],
  };
};

// ---- Biology ----
const heart = (rng) => {
  const hr = pick(rng, [60, 65, 70, 72, 75, 80, 90]);
  const sv = pick(rng, [60, 65, 70, 75, 80]);
  return {
    question: `A heart beats <b>${hr} times per minute</b> with a stroke volume of <b>${sv} mL</b>. Find the cardiac output in L/min.`,
    answer: (hr * sv) / 1000,
    unit: 'L/min',
    tol: { rel: 0.01 },
    steps: ['Cardiac output = heart rate × stroke volume.', `${hr} × ${sv} mL = ${hr * sv} mL/min = <b>${f((hr * sv) / 1000, 2)} L/min</b>.`],
    load: [['set', '[data-bpm]', hr]],
  };
};

const breathing = (rng) => {
  const rate = pick(rng, [10, 12, 14, 16, 20, 30]);
  const tidal = pick(rng, [0.4, 0.5, 0.6, 0.8, 1.5, 2]);
  return {
    question: `A person takes <b>${rate} breaths per minute</b> with a tidal volume of <b>${tidal} L</b>. Find the minute ventilation.`,
    answer: rate * tidal,
    unit: 'L/min',
    tol: { rel: 0.01 },
    steps: ['Minute ventilation = breathing rate × tidal volume.', `${rate} × ${tidal} = <b>${f(rate * tidal)} L/min</b>.`],
    load: [['set', '[data-rate]', rate], ['set', '[data-tidal]', tidal]],
  };
};

const enzymes = (rng) => {
  const Vmax = pick(rng, [10, 20, 50, 100]);
  const Km = pick(rng, [1, 2, 4, 5]);
  const S = pick(rng, [0.5, 1, 2, 4, 8, 10, 20]);
  const v = (Vmax * S) / (Km + S);
  return {
    question: `An enzyme has V<sub>max</sub> = <b>${Vmax} µmol/min</b> and K<sub>m</sub> = <b>${Km} mM</b>. Find the reaction rate at a substrate concentration of <b>${S} mM</b>.`,
    answer: v,
    unit: 'µmol/min',
    tol: { rel: 0.01 },
    steps: ['Michaelis–Menten: v = V<sub>max</sub>[S] / (K<sub>m</sub> + [S]).', `v = ${Vmax} × ${S} / (${Km} + ${S}) = <b>${f(v)} µmol/min</b>.${S === Km ? ' (At [S] = Km the rate is exactly half of Vmax.)' : ''}`],
    load: [],
  };
};

const mitosis = (rng) => {
  const n2 = pick(rng, [8, 14, 20, 24, 46, 48]);
  const ask = pick(rng, ['metaphase', 'daughter']);
  return {
    question: ask === 'metaphase' ? `A body cell has <b>2n = ${n2}</b> chromosomes. How many <b>chromatids</b> are there in the cell at metaphase of mitosis?` : `A body cell with <b>2n = ${n2}</b> divides by mitosis. How many chromosomes does <b>each daughter cell</b> have?`,
    answer: ask === 'metaphase' ? 2 * n2 : n2,
    unit: '',
    tol: { abs: 0 },
    steps: ask === 'metaphase' ? ['DNA was copied in S phase, so each chromosome is two sister chromatids.', `${n2} chromosomes × 2 = <b>${2 * n2}</b> chromatids.`] : ['Mitosis makes two cells identical to the parent.', `Each daughter has <b>${n2}</b> chromosomes (still 2n).`],
    load: [],
  };
};

const meiosis = (rng) => {
  const n2 = pick(rng, [8, 14, 20, 24, 46, 48]);
  return {
    question: `A cell with <b>2n = ${n2}</b> chromosomes undergoes meiosis. How many chromosomes are in <b>each gamete</b>?`,
    answer: n2 / 2,
    unit: '',
    tol: { abs: 0 },
    steps: ['Meiosis I separates homologous pairs, halving the number; meiosis II separates sister chromatids.', `Each gamete is haploid: n = ${n2} / 2 = <b>${n2 / 2}</b>.`],
    load: [],
  };
};

const dna = (rng) => {
  const CODONS = [];
  for (const a of 'UCAG') for (const b of 'UCAG') for (const c of 'UCAG') if (codonToAmino(a + b + c) !== '*' && a + b + c !== 'AUG') CODONS.push(a + b + c);
  const k = int(rng, 3, 7);
  const lead = pick(rng, ['', 'GC', 'CCA', 'U']);
  const body = Array.from({ length: k }, () => pick(rng, CODONS));
  const stop = pick(rng, ['UAA', 'UAG', 'UGA']);
  const mrna = lead + 'AUG' + body.join('') + stop + pick(rng, ['', 'GA', 'CU']);
  return {
    question: `How many amino acids are in the protein made from this mRNA: <b class="seq">${mrna}</b>?`,
    answer: k + 1,
    unit: 'amino acids',
    tol: { abs: 0 },
    steps: [`Find the start codon AUG (it codes for methionine): it is at position ${lead.length + 1}.`, `Read in threes from there: AUG ${body.join(' ')} <b>${stop}</b> (stop).`, `${k + 1} codons before the stop (stop codons add no amino acid): <b>${k + 1}</b>.`],
    load: [],
  };
};

export const MORE = {
  sorting, search, hanoi, stackqueue, 'structures/tree': bstHeight,
  crystal, orbitals, rates,
  shm, fourier, descent, gears, engine, stressstrain, truss, fluid,
  induction, threephase, pid, sampling,
  heart, breathing, enzymes, mitosis, meiosis, dna,
};
