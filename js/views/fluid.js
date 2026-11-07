// Civil / mechanical: flow through a Venturi. Where the pipe narrows, water must speed up (continuity) and its
// pressure drops (Bernoulli): the manometer tubes show it. Measuring that drop is how a Venturi meter finds flow.
import * as THREE from 'three';
import { createStage, makeLabel, clearGroup } from '../stage.js';
import { venturi, area } from '../civil/fluid.js';
import { html, formatNumber } from '../ui.js';

const LEN = 9;
const R1 = 0.8; // world radius of the wide pipe
const PARTICLES = 160;
const P_BASE = 2.6; // world height of the pressure column in the wide pipe

export function mountFluid(root) {
  root.innerHTML = html`
    <div class="viewport" data-viewport></div>
    <aside class="panel">
      <h2>Fluid Flow: Venturi</h2>
      <p class="lede">Water can't pile up, so the same volume per second passes every section: <b>A₁v₁ = A₂v₂</b> (continuity). Narrow the pipe and the water speeds up. Faster water has <b>lower pressure</b> (Bernoulli: p + ½ρv² stays constant). The tubes on top show the pressure as water height.</p>

      <label class="slider-row wide"><span>Flow rate Q</span><input type="range" min="2" max="20" step="1" value="10" data-Q><output data-Q-out>10 L/s</output></label>
      <label class="slider-row wide"><span>Throat size</span><input type="range" min="0.3" max="1" step="0.05" value="0.5" data-ratio><output data-ratio-out>50%</output></label>
      <p class="hint">Pipe diameter 100 mm; throat diameter is the percentage above.</p>

      <div class="readout" data-out></div>
      <div class="notice" data-msg></div>
    </aside>
  `;

  const $ = (sel) => root.querySelector(sel);
  const stage = createStage($('[data-viewport]'), { cameraPosition: [0, 2.5, 10], axes: false, grid: false });
  stage.controls.target.set(0, 1, 0);
  const group = new THREE.Group();
  stage.scene.add(group);
  const state = { Q: 10, ratio: 0.5, result: null };

  // Pipe radius along x: wide, smooth taper in, throat, slower taper out (as real Venturi meters are built).
  const radiusAt = (x, r2) => {
    const t = (x + LEN / 2) / LEN;
    const smooth = (a, b, u) => a + (b - a) * (0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, u))));
    if (t < 0.3) return R1;
    if (t < 0.45) return smooth(R1, r2, (t - 0.3) / 0.15);
    if (t < 0.55) return r2;
    if (t < 0.8) return smooth(r2, R1, (t - 0.55) / 0.25);
    return R1;
  };
  const particles = Array.from({ length: PARTICLES }, () => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
    m.userData = { x: -LEN / 2 + Math.random() * LEN, r: Math.sqrt(Math.random()) * 0.9, a: Math.random() * Math.PI * 2 };
    stage.scene.add(m);
    return m;
  });
  const columns = [];

  function build() {
    clearGroup(group);
    const r2 = R1 * state.ratio;
    const pts = [];
    for (let i = 0; i <= 120; i++) {
      const x = -LEN / 2 + (i / 120) * LEN;
      pts.push(new THREE.Vector2(radiusAt(x, r2), x));
    }
    const pipe = new THREE.Mesh(new THREE.LatheGeometry(pts, 48), new THREE.MeshStandardMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
    pipe.rotation.z = -Math.PI / 2; // lathe axis (y) → pipe axis (x)
    group.add(pipe);
    const r = venturi(state.Q / 1000, 0.1, 0.1 * state.ratio);
    state.result = r;
    // Manometer tubes at the wide section and the throat: water rises to show pressure head.
    columns.length = 0;
    const scale = 1.2; // world units per metre of head (exaggerated)
    [[-LEN * 0.35, 0], [0, r.dh]].forEach(([x, drop], k) => {
      const height = Math.max(0.05, P_BASE - drop * scale);
      const yBase = radiusAt(x, r2);
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.6, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false }));
      tube.position.set(x, yBase + 1.8, 0);
      const water = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, height, 16), new THREE.MeshStandardMaterial({ color: 0x0ea5e9, transparent: true, opacity: 0.8 }));
      water.position.set(x, yBase + height / 2, 0);
      group.add(tube, water, makeLabel(k ? 'throat' : 'wide pipe', new THREE.Vector3(x, -1.3, 0), 0x9b98c4, 'chart-label'));
      columns.push(water);
    });
    if (P_BASE - r.dh * scale < 0.05) group.add(makeLabel('pressure off the scale!', new THREE.Vector3(0, 0.9, 0), 0xff6b8b, 'chart-label'));
    const row = (k, v) => `<div class="row-between"><span>${k}</span><strong>${v}</strong></div>`;
    $('[data-out]').innerHTML = [
      row('Area ratio A₁ / A₂', formatNumber(area(0.1) / area(0.1 * state.ratio), 2)),
      row('Speed in pipe v₁', `${formatNumber(r.v1, 2)} m/s`),
      row('Speed in throat v₂', `${formatNumber(r.v2, 2)} m/s`),
      row('Pressure drop Δp', `${formatNumber(r.dp / 1000, 2)} kPa (${formatNumber(r.dh * 100, 1)} cm of water)`),
    ].join('');
    $('[data-msg]').innerHTML = `Half the diameter = a quarter of the area = <b>4×</b> the speed. Speed goes up ${formatNumber(r.v2 / r.v1, 1)}×, so the pressure drops: the throat's water column is lower. Used in Venturi flow meters, carburettors and spray nozzles.`;
  }

  const bind = (sel, key, fmt) => $(sel).addEventListener('input', (e) => {
    state[key] = Number(e.target.value);
    $(sel.replace(']', '-out]')).textContent = fmt(state[key]);
    build();
  });
  bind('[data-Q]', 'Q', (v) => `${v} L/s`);
  bind('[data-ratio]', 'ratio', (v) => `${Math.round(v * 100)}%`);

  const slow = new THREE.Color(0x38bdf8);
  const fast = new THREE.Color(0xf97316);
  stage.onFrame((dt) => {
    const r2 = R1 * state.ratio;
    const v1 = state.result.v1;
    const vis = 0.9 * Math.min(2, v1); // on-screen speed in the wide pipe
    for (const p of particles) {
      const u = p.userData;
      const rad = radiusAt(u.x, r2);
      const local = vis * (R1 / rad) ** 2; // continuity: v ∝ 1/A
      u.x += local * dt;
      if (u.x > LEN / 2) u.x -= LEN;
      const rr = u.r * rad;
      p.position.set(u.x, Math.cos(u.a) * rr, Math.sin(u.a) * rr);
      p.material.color.copy(slow).lerp(fast, Math.min(1, ((R1 / rad) ** 2 - 1) / 8));
    }
  });

  build();
  return () => stage.dispose();
}
