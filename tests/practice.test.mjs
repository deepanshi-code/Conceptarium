import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GENERATORS, checkAnswer, seeded } from '../js/practice/problems.js';
import { COURSES } from '../js/courses.js';
import { CATALOG } from '../js/catalog.js';
import { analyzeBeam } from '../js/mech/beam.js';
import { trajectory } from '../js/phys/projectile.js';

test('every generator makes well-formed problems that its own checker accepts', () => {
  for (const [key, gen] of Object.entries(GENERATORS)) {
    const rng = seeded(42);
    for (let i = 0; i < 200; i++) {
      const p = gen(rng);
      assert.ok(Number.isFinite(p.answer), `${key}: answer`);
      assert.ok(p.question.length > 20 && p.steps.length >= 2, `${key}: text`);
      assert.equal(checkAnswer(String(p.answer), p), true, `${key}: exact answer accepted`);
      const wrong = p.answer === 0 ? 1 : p.answer * 1.2 + 0.1;
      assert.equal(checkAnswer(String(wrong), p), false, `${key}: wrong answer rejected (${p.answer} vs ${wrong})`);
      for (const step of p.load) assert.ok(['click', 'radio', 'check', 'select', 'set', 'change'].includes(step[0]), `${key}: load action ${step[0]}`);
    }
  }
});

test('answers agree with independent solvers', () => {
  const rng = seeded(7);
  for (let i = 0; i < 60; i++) {
    const p = GENERATORS.beam(rng);
    const L = p.load.find((a) => a[1] === '[data-L]')[2];
    const P = p.load.find((a) => a[1] === '[data-P]')[2];
    const cantilever = p.load[0][1].includes('cantilever');
    const a = cantilever ? L : p.load.find((x) => x[1] === '[data-a]')[2] * L;
    const r = analyzeBeam({ type: cantilever ? 'cantilever' : 'simply', L, loads: [{ kind: 'point', a, P }], N: 4000 });
    assert.ok(Math.abs(Math.abs(r.maxMoment.value) - p.answer) < 0.01 * p.answer + 1e-6, `beam ${p.answer} vs ${r.maxMoment.value}`);
  }
  for (let i = 0; i < 40; i++) {
    const p = GENERATORS.projectile(rng);
    const v = p.load.find((a) => a[1] === '[data-v]')[2];
    const angle = p.load.find((a) => a[1] === '[data-angle]')[2];
    const t = trajectory({ v, angle });
    const want = p.unit === 's' ? t.time : p.question.includes('range') ? t.range : t.peak;
    assert.ok(Math.abs(want - p.answer) < 0.005 * p.answer, `projectile ${p.answer} vs ${want}`);
  }
});

test('checker parsing: commas, blanks and tolerance', () => {
  const p = { answer: 12.5, tol: { rel: 0.01 } };
  assert.equal(checkAnswer('12,5', p), true);
  assert.equal(checkAnswer('12.6', p), true);
  assert.equal(checkAnswer('12.7', p), false);
  assert.equal(checkAnswer('', p), null);
  assert.equal(checkAnswer('abc', p), null);
  assert.equal(checkAnswer('7', { answer: 7, tol: { abs: 0 } }), true);
  assert.equal(checkAnswer('8', { answer: 7, tol: { abs: 0 } }), false);
});

test('every course lists real concepts, and every practice concept exists', () => {
  const paths = new Set(CATALOG.map((c) => c.path));
  for (const [course, list] of Object.entries(COURSES)) for (const p of list) assert.ok(paths.has(p), `${course}: ${p}`);
  for (const p of Object.keys(GENERATORS)) assert.ok(paths.has(p), p);
});

test('new generators agree with the simulations and known values', async () => {
  const { sortSteps } = await import('../js/algo/sort.js');
  const { hanoiMoves } = await import('../js/algo/hanoi.js');
  const { translate } = await import('../js/bio/dna.js');
  const { rateConstant } = await import('../js/chem/kinetics.js');
  const rng = seeded(11);
  for (let i = 0; i < 50; i++) {
    const p = GENERATORS.sorting(rng);
    const arr = p.question.match(/\[([^\]]+)\]/)[1].split(', ').map(Number);
    const swaps = sortSteps('bubble', arr).steps.filter((s) => s.kind === 'swap').length;
    assert.equal(p.answer, swaps, `bubble swaps for ${arr}`);
  }
  for (let i = 0; i < 20; i++) {
    const p = GENERATORS.hanoi(rng);
    const n = Number(p.question.match(/(\d+) disks/)[1]);
    const moves = hanoiMoves(n);
    const want = p.question.includes('smallest') ? moves.filter((m) => m.disk === 1).length : moves.length;
    assert.equal(p.answer, want);
  }
  for (let i = 0; i < 30; i++) {
    const p = GENERATORS.dna(rng);
    const mrna = p.question.match(/class="seq">([A-Z]+)</)[1];
    const t = translate(mrna);
    assert.equal(p.answer, t.codons.filter((c) => c.aa !== '*').length);
  }
  for (let i = 0; i < 30; i++) {
    const p = GENERATORS.rates(rng);
    const [Ea, T1, T2] = p.question.match(/(\d+) kJ\/mol.*?(\d+) K.*?(\d+) K/).slice(1).map(Number);
    const want = rateConstant(Ea * 1000, T2) / rateConstant(Ea * 1000, T1);
    assert.ok(Math.abs(p.answer - want) < 1e-9 * want);
  }
  for (let i = 0; i < 30; i++) {
    const p = GENERATORS.stackqueue(rng);
    const tokens = p.question.match(/<b>([^<]+)<\/b>/)[1].split(' ');
    const st = [];
    for (const t of tokens) {
      if ('+-*'.includes(t)) { const y = st.pop(); const x = st.pop(); st.push(t === '+' ? x + y : t === '-' ? x - y : x * y); } else st.push(Number(t));
    }
    assert.equal(p.answer, st[0]);
  }
  // Copper: FCC, a = 361 pm, M = 63.5 g/mol → about 8.93 g/cm³ (textbook value).
  const rho = (4 * 63.5) / ((361e-10) ** 3 * 6.022e23);
  assert.ok(Math.abs(rho - 8.93) < 0.05);
});
