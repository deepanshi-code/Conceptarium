// Chemistry: reaction rates and collision theory. Blue (A) and green (B) particles react to orange product only
// when they collide with enough energy (at least Ea). Heat them, crowd them, or add a catalyst to lower Ea.
import * as THREE from 'three';
import { createStage } from '../stage.js';
import { R, fractionAbove, mbDensity } from '../chem/kinetics.js';
import { html, formatNumber } from '../ui.js';

const BOX = 3.2;
const MAX = 120;
const RADIUS = 0.09;

export function mountRates(root) {
  root.innerHTML = html`
    <div class="viewport" data-viewport></div>
    <aside class="panel">
      <h2>Reaction Rates</h2>
      <p class="lede">For a reaction, particles must <b>collide</b>, and hard enough: with at least the <b>activation energy (Ea)</b>. Heating makes more collisions energetic enough; more concentration means more collisions; a <b>catalyst</b> offers an easier path with a lower Ea.</p>

      <label class="slider-row wide"><span>Temperature</span><input type="range" min="250" max="450" step="5" value="300" data-T><output data-T-out>300 K</output></label>
      <label class="slider-row wide"><span>Particles</span><input type="range" min="20" max="${MAX}" step="10" value="70" data-n><output data-n-out>70</output></label>
      <label class="check"><input type="checkbox" data-cat> Add a catalyst (Ea 50 → 35 kJ/mol)</label>
      <div class="btn-row"><button class="btn secondary" data-reset>↺ Restart reaction</button></div>

      <div class="readout" data-out></div>
      <h3>Energy of collisions</h3>
      <div class="timing" data-mb></div>
      <h3>Energy profile</h3>
      <div class="timing" data-profile></div>
      <div class="notice" data-msg></div>
    </aside>
  `;

  const $ = (sel) => root.querySelector(sel);
  const stage = createStage($('[data-viewport]'), { cameraPosition: [4.5, 3.5, 6.5], axes: false, grid: false });
  const scene = stage.scene;
  const state = { T: 300, n: 70, cat: false, products: 0, flashes: [], time: 0 };
  scene.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(BOX, BOX, BOX)), new THREE.LineBasicMaterial({ color: 0x8b5cf6 })));

  const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(RADIUS, 12, 8), new THREE.MeshStandardMaterial({ roughness: 0.35 }), MAX);
  scene.add(mesh);
  const COLORS = { A: new THREE.Color(0x60a5fa), B: new THREE.Color(0x4ade80), P: new THREE.Color(0xfb923c) };
  let parts = [];
  const flashGeom = new THREE.SphereGeometry(0.25, 12, 8);

  const Ea = () => (state.cat ? 35000 : 50000);

  function reset() {
    parts = Array.from({ length: state.n }, (_, i) => ({
      pos: new THREE.Vector3((Math.random() - 0.5) * BOX, (Math.random() - 0.5) * BOX, (Math.random() - 0.5) * BOX),
      dir: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
      kind: i % 2 ? 'B' : 'A',
    }));
    state.products = 0;
    state.time = 0;
    readout();
  }

  // A collision reacts with probability e^(−Ea/RT), the fraction of collisions energetic enough. Real values span
  // many powers of ten (the slowest setting is ~40 000× slower than the fastest), which would leave the slow cases
  // frozen on screen, so the animation compresses them (power 0.35). The readout shows the true ratio.
  const FASTEST = fractionAbove(35000, 450);
  const chance = () => 0.6 * (fractionAbove(Ea(), state.T) / FASTEST) ** 0.35;

  function readout() {
    const f = fractionAbove(Ea(), state.T);
    const f300 = fractionAbove(50000, 300);
    const row = (k, v) => `<div class="row-between"><span>${k}</span><strong>${v}</strong></div>`;
    $('[data-out]').innerHTML = [
      row('Collisions with E ≥ Ea', `${f.toExponential(1)} of all`),
      row('Rate vs 300 K, no catalyst', `× ${formatNumber(f / f300, 1)}`),
      row('Products formed', `${state.products} of ${Math.floor(state.n / 2)}`),
    ].join('');
    $('[data-msg]').innerHTML = state.cat
      ? 'The catalyst gives a different route with a <b>lower Ea</b>, so many more collisions succeed. It is not used up.'
      : state.T >= 340 ? 'Hotter particles move faster and collide harder: a much bigger share now beats Ea. (Rule of thumb: +10 °C roughly doubles the rate.)'
        : 'Only the rare energetic collisions react (they flash). Raise the temperature or add a catalyst.';
    drawMB();
  }

  // Maxwell–Boltzmann curve of collision energies, with the part above Ea shaded.
  function drawMB() {
    const w = 300;
    const h = 110;
    const kT = (R * state.T) / 1000; // kJ/mol
    const Emax = 60;
    const x = (E) => (E / Emax) * w;
    const kTlow = (R * 250) / 1000; // the coolest setting has the tallest peak; keep the y-scale fixed to it
    const peak = mbDensity(kTlow / 2, kTlow);
    const y = (d) => h - 10 - (d / peak) * (h - 20);
    let d = '';
    let area = '';
    const ea = Ea() / 1000;
    for (let E = 0.2; E <= Emax; E += 0.5) {
      const v = mbDensity(E, kT);
      d += `${d ? 'L' : 'M'}${x(E).toFixed(1)},${y(v).toFixed(1)}`;
      if (E >= ea) area += `${area ? 'L' : `M${x(E).toFixed(1)},${h - 10}L`}${x(E).toFixed(1)},${y(v).toFixed(1)}`;
    }
    area += `L${x(Emax)},${h - 10}Z`;
    $('[data-mb]').innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="Energy distribution"><path d="${area}" fill="rgba(251,146,60,0.35)"/><path d="${d}" class="q"/>
      <line x1="${x(ea)}" x2="${x(ea)}" y1="4" y2="${h - 10}" class="thresh"/><text x="${x(ea) + 4}" y="14" class="tlabel">Ea</text>
      ${state.cat ? `<line x1="${x(50)}" x2="${x(50)}" y1="4" y2="${h - 10}" class="edge"/><text x="${x(50) + 4}" y="26" class="tlabel">old Ea</text>` : ''}
      <text x="${w - 4}" y="${h - 1}" text-anchor="end" class="tlabel">energy →</text></svg>`;
    drawProfile();
  }

  function drawProfile() {
    const w = 300;
    const h = 110;
    const hump = (peak) => `M10,70 C80,70 100,${70 - peak} 150,${70 - peak} S220,85 290,85`;
    $('[data-profile]').innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="Energy profile">
      <path d="${hump(55)}" class="${state.cat ? 'edge' : 'q'}"/>${state.cat ? `<path d="${hump(35)}" class="q"/>` : ''}
      <text x="12" y="64" class="tlabel">reactants</text><text x="288" y="100" text-anchor="end" class="tlabel">products</text>
      <text x="150" y="${70 - (state.cat ? 35 : 55) - 6}" text-anchor="middle" class="tlabel q">Ea</text></svg>`;
  }

  $('[data-T]').addEventListener('input', (e) => { state.T = Number(e.target.value); $('[data-T-out]').textContent = `${state.T} K`; readout(); });
  $('[data-n]').addEventListener('input', (e) => { state.n = Number(e.target.value); $('[data-n-out]').textContent = state.n; reset(); });
  $('[data-cat]').addEventListener('change', (e) => { state.cat = e.target.checked; readout(); });
  $('[data-reset]').addEventListener('click', reset);

  const m = new THREE.Matrix4();
  stage.onFrame((dt) => {
    const speed = 1.2 * Math.sqrt(state.T / 300);
    for (const p of parts) {
      p.pos.addScaledVector(p.dir, speed * dt);
      for (const ax of ['x', 'y', 'z']) {
        if (Math.abs(p.pos[ax]) > BOX / 2) { p.pos[ax] = Math.sign(p.pos[ax]) * BOX / 2; p.dir[ax] *= -1; }
      }
    }
    // A–B collisions may react.
    for (let i = 0; i < parts.length; i++) {
      const a = parts[i];
      if (a.kind === 'P') continue;
      for (let j = i + 1; j < parts.length; j++) {
        const b = parts[j];
        if (b.kind === 'P' || b.kind === a.kind || a.pos.distanceToSquared(b.pos) > (2 * RADIUS) ** 2) continue;
        // Bounce apart either way.
        const tmp = a.dir.clone();
        a.dir.copy(b.dir);
        b.dir.copy(tmp);
        if (Math.random() < chance()) {
          a.kind = b.kind = 'P';
          state.products += 1;
          const fl = new THREE.Mesh(flashGeom, new THREE.MeshBasicMaterial({ color: 0xfde047, transparent: true, opacity: 0.9 }));
          fl.position.copy(a.pos);
          scene.add(fl);
          state.flashes.push(fl);
          readout();
        }
        break;
      }
    }
    state.flashes = state.flashes.filter((fl) => {
      fl.material.opacity -= dt * 2;
      fl.scale.multiplyScalar(1 + dt * 2);
      if (fl.material.opacity > 0) return true;
      scene.remove(fl);
      fl.material.dispose();
      return false;
    });
    for (let i = 0; i < MAX; i++) {
      const p = parts[i];
      if (p) {
        m.makeTranslation(p.pos.x, p.pos.y, p.pos.z);
        mesh.setColorAt(i, COLORS[p.kind]);
      } else m.makeScale(0, 0, 0);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  reset();
  return () => stage.dispose();
}
