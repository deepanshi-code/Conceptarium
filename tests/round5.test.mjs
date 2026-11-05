import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pH, titrationPH, indicatorColor } from '../js/chem/acidbase.js';
import { rateConstant, fractionAbove, mbDensity } from '../js/chem/kinetics.js';
import { PHOTO_EQUATION, atomCount, photosynthesisRate, minuteVentilation, alveolarPressure, MEIOSIS, meiosisCounts, michaelis, enzymeRate, tempFactor } from '../js/bio/processes.js';

const near = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`);

test('pH of strong and weak acids and bases', () => {
  near(pH('HCl', 0.01), 2);
  near(pH('NaOH', 0.1), 13);
  near(pH('CH3COOH', 0.1), 2.87);
  near(pH('NH3', 0.1), 11.13);
  near(pH('water', 1), 7);
  near(pH('HCl', 1e-8), 6.98); // a very dilute acid can't make water basic
});

test('titration of 25 mL 0.1 M HCl with 0.1 M NaOH', () => {
  near(titrationPH(25, 0.1, 0, 0.1), 1);
  assert.equal(titrationPH(25, 0.1, 25, 0.1), 7);
  near(titrationPH(25, 0.1, 50, 0.1), 12.52);
  near(titrationPH(25, 0.1, 24.9, 0.1), 3.7, 0.01); // the jump near equivalence
});

test('indicator colours are red for acid, green for neutral, purple for strong base', () => {
  assert.equal(indicatorColor(0), 0xdc2626);
  assert.equal(indicatorColor(7), 0x22c55e);
  assert.equal(indicatorColor(14), 0x7e22ce);
});

test('Arrhenius: Ea = 50 kJ/mol roughly doubles the rate from 300 K to 310 K', () => {
  near(rateConstant(50000, 310) / rateConstant(50000, 300), 1.91);
  assert.ok(fractionAbove(30000, 300) > fractionAbove(50000, 300)); // a catalyst (lower Ea) lets more collisions react
  // The Maxwell–Boltzmann density integrates to 1.
  let s = 0;
  for (let E = 0.0005; E < 30; E += 0.001) s += mbDensity(E, 1) * 0.001;
  near(s, 1, 0.01);
});

test('photosynthesis equation balances, and the scarcest factor limits the rate', () => {
  assert.deepEqual(atomCount(PHOTO_EQUATION.left), atomCount(PHOTO_EQUATION.right));
  assert.equal(photosynthesisRate(20, 900, 30).limiting, 'light');
  assert.equal(photosynthesisRate(100, 300, 30).limiting, 'carbon dioxide');
  assert.equal(photosynthesisRate(100, 1000, 50).limiting, 'temperature');
  assert.ok(photosynthesisRate(60, 1000, 30).rate > photosynthesisRate(30, 1000, 30).rate);
});

test('breathing: 12 breaths of 0.5 L = 6 L/min; pressure is negative while breathing in', () => {
  assert.equal(minuteVentilation(12, 0.5), 6);
  assert.ok(alveolarPressure(1, 12, 0.5) < 0); // first half of a 5 s breath: inhaling
  assert.ok(alveolarPressure(3.5, 12, 0.5) > 0);
});

test('meiosis: 1 cell with 4 chromosomes → 4 cells with 2', () => {
  assert.equal(MEIOSIS.length, 7);
  assert.deepEqual(meiosisCounts(0.5), { cells: 1, chromosomesPerCell: 4 });
  assert.deepEqual(meiosisCounts(6.9), { cells: 4, chromosomesPerCell: 2 });
});

test('enzymes: Michaelis–Menten half speed at Km, optimum pH and temperature', () => {
  near(michaelis(2, 1, 2), 0.5);
  assert.ok(enzymeRate(5, 37, 2, 'pepsin') > enzymeRate(5, 37, 7, 'pepsin'));
  assert.ok(enzymeRate(5, 37, 6.8, 'amylase') > enzymeRate(5, 60, 6.8, 'amylase'));
  near(tempFactor(37, 37), 1);
  assert.equal(tempFactor(80, 37, 14), 0); // denatured
});
