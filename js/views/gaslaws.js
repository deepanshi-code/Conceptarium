// Chemistry: the gas laws. Particles bounce in a box with a movable piston. Heat them and they move faster;
// squeeze the box and they hit the walls more often. Pressure comes from those hits: PV = nRT.
import * as THREE from 'three';
import { createStage } from '../stage.js';
import { pressure, volume, rmsSpeed } from '../chem/gas.js';
import { html, formatNumber } from '../ui.js';

const W = 4; // box width and depth (world units)
const H_PER_L = 0.55; // box height per litre
const MAX_PARTICLES = 200;
const MOL_PER_PARTICLE = 0.002;

export function mountGasLaws(root) {
  root.innerHTML = html`
    <div class="viewport" data-viewport></div>
    <aside class="panel">
      <h2>Gas Laws</h2>
      <p class="lede">A gas is lots of tiny particles flying around. <b>Pressure</b> is them hitting the walls. Squeeze them into less space and they hit more often (Boyle). Heat them up and they move faster and hit harder (Charles, Gay-Lussac). Together: <b>PV = nRT</b>.</p>

      <div class="segmented" role="radiogroup">
        <label><input type="radio" name="hold" value="T" checked> Keep T fixed</label>
        <label><input type="radio" name="hold" value="P"> Keep P fixed</label>
        <label><input type="radio" name="hold" value="V"> Keep V fixed</label>
      </div>
      <label class="slider-row wide"><span>Temperature T</span><input type="range" min="100" max="800" step="10" value="300" data-T><output data-T-out>300 K</output></label>
      <label class="slider-row wide"><span>Volume V</span><input type="range" min="2" max="10" step="0.1" value="5" data-V><output data-V-out>5 L</output></label>
      <label class="slider-row wide"><span>Amount n</span><input type="range" min="20" max="${MAX_PARTICLES}" step="10" value="100" data-n><output data-n-out></output></label>

      <h3>Result</h3>
      <div class="readout" data-out></div>
      <div class="timing" data-graph></div>
      <div class="notice" data-msg></div>
    </aside>
  `;

  const $ = (sel) => root.querySelector(sel);
  const stage = createStage($('[data-viewport]'), { cameraPosition: [5.5, 4, 8], axes: false, grid: false });
  stage.controls.target.set(0, 2.5, 0);
  const scene = stage.scene;
  const state = { T: 300, V: 5, count: 100, hold: 'T', P: 0 };

  const box = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(W, 1, W)), new THREE.LineBasicMaterial({ color: 0x8b5cf6 }));
  const glass = new THREE.Mesh(new THREE.BoxGeometry(W, 1, W), new THREE.MeshStandardMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0.06, depthWrite: false, side: THREE.DoubleSide }));
  const piston = new THREE.Mesh(new THREE.BoxGeometry(W + 0.1, 0.18, W + 0.1), new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.6, roughness: 0.3 }));
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2, 12), piston.material);
  scene.add(box, glass, piston, rod);

  const particles = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshStandardMaterial({ roughness: 0.3 }), MAX_PARTICLES);
  scene.add(particles);
  const p = Array.from({ length: MAX_PARTICLES }, () => ({
    pos: new THREE.Vector3((Math.random() - 0.5) * W, Math.random() * 2, (Math.random() - 0.5) * W),
    dir: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
    k: 0.6 + Math.random() * 0.8, // spread of speeds (a rough Maxwell–Boltzmann look)
  }));

  const n = () => state.count * MOL_PER_PARTICLE;
  const height = () => state.V * H_PER_L;

  function recompute(changed) {
    // The held quantity stays fixed; the one that isn't set by a slider follows from PV = nRT.
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    if (state.hold === 'P' && state.P) {
      // Pressure held: moving V sets T (Charles), anything else moves the piston. Stay inside the slider ranges.
      if (changed === 'V') state.T = clamp((state.P * state.V) / (n() * 8.314), 100, 800);
      state.V = clamp(volume(n(), state.T, state.P), 2, 10);
    }
    state.P = pressure(n(), state.T, state.V); // always consistent with PV = nRT
    $('[data-T]').value = state.T;
    $('[data-V]').value = state.V;
    $('[data-T-out]').textContent = `${Math.round(state.T)} K`;
    $('[data-V-out]').textContent = `${formatNumber(state.V, 1)} L`;
    $('[data-n-out]').textContent = `${formatNumber(n(), 2)} mol`;
    $('[data-V]').disabled = state.hold === 'V';
    $('[data-T]').disabled = false;
    const h = height();
    box.scale.y = h;
    glass.scale.y = h;
    box.position.y = glass.position.y = h / 2;
    piston.position.y = h + 0.09;
    rod.position.y = h + 1.1;
    const row = (k, v) => `<div class="row-between"><span>${k}</span><strong>${v}</strong></div>`;
    $('[data-out]').innerHTML = [
      row('Pressure P = nRT / V', `${formatNumber(state.P, 1)} kPa`),
      row('Air at sea level', '≈ 101 kPa'),
      row('Average speed (N₂)', `${Math.round(rmsSpeed(state.T, 0.028))} m/s`),
    ].join('');
    $('[data-msg]').innerHTML = {
      T: '<b>Boyle’s law</b> (T fixed): halve the volume and the pressure doubles. P × V stays the same.',
      P: '<b>Charles’s law</b> (P fixed): heat the gas and the piston rises. V ∝ T (in kelvin).',
      V: '<b>Gay-Lussac’s law</b> (V fixed): heat the gas and the pressure rises. P ∝ T.',
    }[state.hold];
    drawGraph();
  }

  // P–V graph for the current n and T (an isotherm), with the current state marked.
  function drawGraph() {
    const w = 300;
    const h = 130;
    const x = (v) => ((v - 1.5) / 9) * w;
    const maxP = pressure(n(), 800, 2);
    const y = (P) => h - 8 - (P / maxP) * (h - 16);
    let d = '';
    for (let v = 2; v <= 10.001; v += 0.1) d += `${d ? 'L' : 'M'}${x(v).toFixed(1)},${y(pressure(n(), state.T, v)).toFixed(1)}`;
    $('[data-graph]').innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="Pressure against volume">
      <path d="${d}" class="in"/><circle cx="${x(state.V)}" cy="${y(state.P)}" r="4" fill="#4ade80"/>
      <text x="4" y="12" class="tlabel">P</text><text x="${w - 4}" y="${h - 2}" text-anchor="end" class="tlabel">V →</text></svg>`;
  }

  root.querySelectorAll('input[name=hold]').forEach((r) => r.addEventListener('change', () => { state.hold = r.value; state.P = pressure(n(), state.T, state.V); recompute(); }));
  $('[data-T]').addEventListener('input', (e) => { state.T = Number(e.target.value); recompute('T'); });
  $('[data-V]').addEventListener('input', (e) => { state.V = Number(e.target.value); recompute('V'); });
  $('[data-n]').addEventListener('input', (e) => { state.count = Number(e.target.value); recompute('n'); });

  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  const cold = new THREE.Color(0x60a5fa);
  const hot = new THREE.Color(0xf97316);
  stage.onFrame((dt) => {
    const h = height();
    const speed = 1.6 * Math.sqrt(state.T / 300); // speed ∝ √T
    c.copy(cold).lerp(hot, (state.T - 100) / 700);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const q = p[i];
      if (i < state.count) {
        q.pos.addScaledVector(q.dir, speed * q.k * dt);
        for (const [axis, lo, hi] of [['x', -W / 2, W / 2], ['y', 0, h], ['z', -W / 2, W / 2]]) {
          if (q.pos[axis] < lo) { q.pos[axis] = lo; q.dir[axis] *= -1; }
          if (q.pos[axis] > hi) { q.pos[axis] = hi; q.dir[axis] *= -1; }
        }
        m.makeTranslation(q.pos.x, q.pos.y, q.pos.z);
      } else m.makeScale(0, 0, 0);
      particles.setMatrixAt(i, m);
      particles.setColorAt(i, c);
    }
    particles.instanceMatrix.needsUpdate = true;
    particles.instanceColor.needsUpdate = true;
  });

  recompute();
  return () => stage.dispose();
}
