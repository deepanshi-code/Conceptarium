import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ELEMENTS, bySymbol } from '../js/chem/periodic.js';
import { PAIRS, analyzeBond, classify } from '../js/chem/bonding.js';
import { pressure, volume, rmsSpeed } from '../js/chem/gas.js';
import { cell } from '../js/chem/electrochem.js';
import { ROUTE, circuitOf, heartVisits } from '../js/bio/heart.js';
import { STAGES, stageAt, counts } from '../js/bio/cellcycle.js';
import { replicate, fragments, OKAZAKI } from '../js/bio/replication.js';
import { potential, REST, PEAK } from '../js/bio/neuron.js';

const near = (a, b, eps = 1e-3) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`);

test('periodic data: 36 elements in order, and the textbook trends hold', () => {
  assert.equal(ELEMENTS.length, 36);
  ELEMENTS.forEach((e, i) => assert.equal(e.z, i + 1));
  const withEN = ELEMENTS.filter((e) => e.en !== null);
  assert.equal(withEN.reduce((a, b) => (b.en > a.en ? b : a)).symbol, 'F');
  assert.equal(ELEMENTS.reduce((a, b) => (b.ie > a.ie ? b : a)).symbol, 'He');
  assert.equal(ELEMENTS.reduce((a, b) => (b.radius > a.radius ? b : a)).symbol, 'K');
  // Down group 1: radius up, ionisation energy down. Across period 2: radius down.
  assert.ok(bySymbol('Li').radius < bySymbol('Na').radius && bySymbol('Na').radius < bySymbol('K').radius);
  assert.ok(bySymbol('Li').ie > bySymbol('Na').ie && bySymbol('Na').ie > bySymbol('K').ie);
  assert.ok(bySymbol('Li').radius > bySymbol('C').radius && bySymbol('C').radius > bySymbol('F').radius);
});

test('bond types from ΔEN', () => {
  assert.equal(analyzeBond('NaCl').type, 'ionic');
  assert.equal(analyzeBond('H2').type, 'non-polar covalent');
  assert.equal(analyzeBond('HCl').type, 'polar covalent');
  assert.equal(analyzeBond('HF').richer, 'F');
  assert.equal(classify(0.3), 'non-polar covalent');
  for (const k of Object.keys(PAIRS)) assert.ok(analyzeBond(k).delta >= 0);
});

test('ideal gas law: 1 mol at 273.15 K and 101.325 kPa fills about 22.4 L; Boyle and Charles', () => {
  near(volume(1, 273.15, 101.325), 22.41, 0.01);
  near(pressure(1, 300, 5) * 5, pressure(1, 300, 10) * 10); // Boyle: PV constant
  near(volume(1, 600, 100) / volume(1, 300, 100), 2); // Charles: V ∝ T
  near(rmsSpeed(300, 0.028), 517, 1); // N₂ at room temperature ≈ 517 m/s
});

test('galvanic cells: Daniell 1.10 V, Zn/Ag 1.56 V, Nernst correction', () => {
  const d = cell('Zn', 1, 'Cu', 1);
  assert.equal(d.anode, 'Zn');
  near(d.E0, 1.10);
  near(cell('Ag', 1, 'Zn', 1).E0, 1.56);
  assert.equal(cell('Ag', 1, 'Zn', 1).n, 2);
  near(cell('Zn', 0.1, 'Cu', 1).E, 1.10 + 0.0296, 1e-4); // less product ion → higher voltage
  near(cell('Zn', 1, 'Ag', 0.1).E, 1.56 - 0.0296 * 2, 1e-4); // Q = [Zn²⁺]/[Ag⁺]² = 100
});

test('blood route: lungs come between right and left heart, body between left and right', () => {
  const ids = ROUTE.map((s) => s.id);
  assert.ok(ids.indexOf('rv') < ids.indexOf('lungs') && ids.indexOf('lungs') < ids.indexOf('la'));
  assert.ok(ids.indexOf('lv') < ids.indexOf('body'));
  assert.equal(heartVisits(), 2);
  assert.equal(circuitOf('lungs'), 'pulmonary');
  assert.equal(circuitOf('aorta'), 'systemic');
  // Oxygen is low from the body until the lungs, then high until the body.
  const lungs = ids.indexOf('lungs');
  ROUTE.forEach((s, i) => { if (i < lungs) assert.equal(s.oxygen, 'low'); else if (s.id !== 'lungs' && s.id !== 'body') assert.equal(s.oxygen, 'high'); });
});

test('mitosis keeps the chromosome number: 4 in the parent, 4 in each daughter', () => {
  assert.equal(STAGES.length, 6);
  assert.equal(stageAt(2.5).name, 'Metaphase');
  assert.equal(stageAt(99).name, 'Cytokinesis');
  assert.deepEqual(counts(5.5), { chromosomes: 4, chromatids: 4, cells: 2 });
  assert.equal(counts(1.5).chromatids, 8);
});

test('replication is semi-conservative; Okazaki fragments cover the lagging strand', () => {
  const r = replicate('ATGCGT');
  assert.equal(r.daughter1.old, 'ATGCGT');
  assert.equal(r.daughter1.new, 'TACGCA');
  assert.equal(r.daughter2.new, 'ATGCGT'); // copy of the old bottom strand's partner: the original top
  const f = fragments(20, 20);
  assert.deepEqual(f.at(-1), [18, 20]);
  assert.equal(f.reduce((s, [a, b]) => s + b - a, 0), 20);
  assert.equal(fragments(20, OKAZAKI * 2).length, 2);
});

test('action potential is all-or-none', () => {
  assert.equal(potential(-1, 20), REST);
  near(potential(1, 20), PEAK, 1e-6);
  assert.ok(potential(1, 10) < -55); // a weak stimulus never reaches the peak
  near(potential(10, 20), REST);
});
