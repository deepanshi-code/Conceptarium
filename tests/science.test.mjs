import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configuration, configString, unpaired, boxes } from '../js/chem/orbitals.js';
import { MOLECULES, analyze, angleBetween } from '../js/chem/vsepr.js';
import { LATTICES, packing, countAtoms, block } from '../js/chem/crystal.js';
import { simpleTrain, compoundTrain, ratio } from '../js/mech/gears.js';
import { pistonX, pistonV, strokeAt } from '../js/mech/slidercrank.js';
import { complement, transcribe, translate, codonToAmino, mutationEffect } from '../js/bio/dna.js';

const near = (a, b, eps = 1e-3) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`);

test('electron configurations, including the Cr and Cu exceptions', () => {
  assert.equal(configString(10), '1s² 2s² 2p⁶');
  assert.equal(configString(26), '1s² 2s² 2p⁶ 3s² 3p⁶ 4s² 3d⁶');
  assert.deepEqual(configuration(24).slice(-2), [{ sub: '4s', e: 1 }, { sub: '3d', e: 5 }]);
  assert.deepEqual(configuration(29).slice(-2), [{ sub: '4s', e: 1 }, { sub: '3d', e: 10 }]);
  for (let z = 1; z <= 36; z++) assert.equal(configuration(z).reduce((s, x) => s + x.e, 0), z);
});

test("Hund's rule: unpaired electrons", () => {
  assert.deepEqual(boxes('2p', 4), [2, 1, 1]);
  assert.equal(unpaired(7), 3); // N
  assert.equal(unpaired(8), 2); // O
  assert.equal(unpaired(26), 4); // Fe
  assert.equal(unpaired(24), 6); // Cr
  assert.equal(unpaired(10), 0); // Ne
});

test('VSEPR shapes, hybridisation and bond angles', () => {
  const expect = { CO2: 'Linear', BF3: 'Trigonal planar', CH4: 'Tetrahedral', NH3: 'Trigonal pyramidal', H2O: 'Bent', PCl5: 'Trigonal bipyramidal', SF4: 'Seesaw', ClF3: 'T-shaped', XeF2: 'Linear', SF6: 'Octahedral', XeF4: 'Square planar', BrF5: 'Square pyramidal' };
  for (const [k, shape] of Object.entries(expect)) assert.equal(analyze(k).shape, shape, k);
  assert.equal(analyze('CH4').hybrid, 'sp³');
  const ch4 = analyze('CH4').bonds;
  near(angleBetween(ch4[0], ch4[1]), 109.47, 0.01);
  // XeF4: the two lone pairs are opposite each other, so the four F lie in one plane at 90°.
  const xe = analyze('XeF4');
  near(angleBetween(xe.lonePairs[0], xe.lonePairs[1]), 180);
  // XeF2: three equatorial lone pairs leave the two F atoms at 180°.
  const x2 = analyze('XeF2').bonds;
  near(angleBetween(x2[0], x2[1]), 180);
  for (const k of Object.keys(MOLECULES)) for (const d of [...analyze(k).bonds, ...analyze(k).lonePairs]) near(Math.hypot(...d), 1);
});

test('unit cells: atoms per cell and packing efficiency (52%, 68%, 74%)', () => {
  assert.equal(countAtoms('sc'), 1);
  assert.equal(countAtoms('bcc'), 2);
  assert.equal(countAtoms('fcc'), 4);
  near(packing('sc'), 0.5236);
  near(packing('bcc'), 0.6802);
  near(packing('fcc'), 0.7405);
  assert.equal(block('sc', 2).length, 27);
  for (const k of Object.keys(LATTICES)) assert.equal(LATTICES[k].n, countAtoms(k));
});

test('gear trains: speed ratio, idler gear, compound train', () => {
  assert.deepEqual(simpleTrain([20, 40], 100), [100, -50]);
  const idler = simpleTrain([20, 35, 40], 100);
  near(idler[2], 50); // the idler changes direction, not the ratio
  const c = compoundTrain([12, 36, 12, 36], 900);
  near(c[3], 100);
  near(ratio(900, c[3]), 9);
});

test('slider-crank: stroke is 2r, speed is zero at the dead centres, 4 strokes in two turns', () => {
  const r = 0.05;
  const l = 0.2;
  near(pistonX(0, r, l) - pistonX(Math.PI, r, l), 2 * r, 1e-12);
  near(pistonV(0, r, l, 100), 0, 1e-9);
  near(pistonV(Math.PI, r, l, 100), 0, 1e-9);
  const h = 1e-6;
  near(pistonV(1, r, l, 1), (pistonX(1 + h, r, l) - pistonX(1 - h, r, l)) / (2 * h), 1e-6);
  assert.deepEqual([0.5, 1.5, 2.5, 3.5].map((k) => strokeAt(k * Math.PI)), ['Intake', 'Compression', 'Power', 'Exhaust']);
});

test('genetic code: complement, transcription, translation and mutations', () => {
  assert.equal(complement('ATGC'), 'TACG');
  assert.equal(transcribe('ATGTTT'), 'AUGUUU');
  const pairs = { ATG: 'M', TGG: 'W', TTT: 'F', AAA: 'K', GGG: 'G', GCT: 'A', TAA: '*', TAG: '*', TGA: '*', CAT: 'H', GAA: 'E', TGT: 'C' };
  for (const [codon, aa] of Object.entries(pairs)) assert.equal(codonToAmino(codon), aa, codon);
  const t = translate(transcribe('CCATGGCCTTTAAAGGGTGACC'));
  assert.equal(t.codons.map((c) => c.aa).join(''), 'MAFKG*');
  assert.ok(t.stopped);
  assert.equal(mutationEffect('ATGGCCTTT', 'ATGGCGTTT'), 'silent'); // GCC → GCG, both alanine
  assert.equal(mutationEffect('ATGGCCTTT', 'ATGGACTTT'), 'missense'); // alanine → aspartate
  assert.equal(mutationEffect('ATGAAATTT', 'ATGTAATTT'), 'nonsense'); // lysine → stop
  assert.equal(mutationEffect('ATGAAATGACC', 'ATGAAAAGACC'), 'stop-loss'); // TGA → AGA: the stop is gone
});
