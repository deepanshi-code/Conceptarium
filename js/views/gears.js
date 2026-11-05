// Mechanical: gear trains. A small gear driving a big one turns it slower but with more torque. Meshing gears spin
// opposite ways, an idler only flips direction, and a compound train multiplies two ratios together.
import * as THREE from 'three';
import { createStage, makeLabel, clearGroup } from '../stage.js';
import { simpleTrain, compoundTrain, ratio } from '../mech/gears.js';
import { html, formatNumber } from '../ui.js';

const MODULE = 0.09; // world units of pitch diameter per tooth
const COLORS = [0xfacc15, 0x22d3ee, 0xf472b6, 0xa78bfa];
const VISUAL = 0.2; // on-screen speed relative to real rpm, so fast gears stay readable

// A gear outline: trapezoid teeth around a root circle, with a hole for the shaft.
function gearGeometry(teeth, depth) {
  const r = (MODULE * teeth) / 2;
  const tip = r + MODULE;
  const root = r - 1.25 * MODULE;
  const pitch = (2 * Math.PI) / teeth;
  const shape = new THREE.Shape();
  for (let i = 0; i < teeth; i++) {
    const a = i * pitch;
    const pts = [[root, a - pitch * 0.5], [root, a - pitch * 0.27], [tip, a - pitch * 0.14], [tip, a + pitch * 0.14], [root, a + pitch * 0.27]];
    pts.forEach(([rad, ang], k) => {
      const x = Math.cos(ang) * rad;
      const y = Math.sin(ang) * rad;
      if (i === 0 && k === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    });
  }
  shape.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, Math.max(0.08, r * 0.18), 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geom = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 6 });
  geom.translate(0, 0, -depth / 2);
  return geom;
}

export function mountGears(root) {
  root.innerHTML = html`
    <div class="viewport" data-viewport></div>
    <aside class="panel">
      <h2>Gear Trains</h2>
      <p class="lede">When two gears mesh, their teeth pass at the same speed. So the gear with <b>more teeth turns slower</b>, in the opposite direction, and with <b>more torque</b>: speed ratio = T<sub>driven</sub> / T<sub>driver</sub>. Cycles, clocks and car gearboxes all use this trade.</p>

      <div class="segmented" role="radiogroup">
        <label><input type="radio" name="mode" value="simple" checked> Simple train</label>
        <label><input type="radio" name="mode" value="compound"> Compound train</label>
      </div>
      <div data-teeth></div>
      <div class="btn-row" data-count-row>
        <button class="btn secondary" data-count="-1">− Gear</button>
        <button class="btn secondary" data-count="1">+ Gear</button>
      </div>
      <label class="slider-row wide"><span>Input speed</span><input type="range" min="10" max="300" step="10" value="60" data-rpm><output data-rpm-out>60 rpm</output></label>

      <h3>Result</h3>
      <div class="readout" data-out></div>
      <div class="notice" data-msg></div>
    </aside>
  `;

  const $ = (sel) => root.querySelector(sel);
  const stage = createStage($('[data-viewport]'), { cameraPosition: [0, 1.5, 9], axes: false, grid: false });
  const group = new THREE.Group();
  stage.scene.add(group);
  const state = { mode: 'simple', teeth: [16, 32, 24], compound: [12, 36, 12, 36], rpm: 60, gears: [], angle: 0 };

  function build() {
    clearGroup(group);
    const T = state.mode === 'simple' ? state.teeth : state.compound;
    const rpm = state.mode === 'simple' ? simpleTrain(T, state.rpm) : compoundTrain(T, state.rpm);
    const radius = (t) => (MODULE * t) / 2;
    // Positions: gears in a row, touching at their pitch circles. In a compound train C sits on B's shaft, in front.
    const xs = [0];
    const zs = [0, 0, 0, 0];
    if (state.mode === 'simple') for (let i = 1; i < T.length; i++) xs.push(xs[i - 1] + radius(T[i - 1]) + radius(T[i]));
    else {
      xs.push(radius(T[0]) + radius(T[1]), radius(T[0]) + radius(T[1]));
      xs.push(xs[2] + radius(T[2]) + radius(T[3]));
      zs[2] = zs[3] = 0.42;
    }
    const mid = (Math.min(...xs.map((x, i) => x - radius(T[i]))) + Math.max(...xs.map((x, i) => x + radius(T[i])))) / 2;
    // Phase so the teeth interlock: when the driver has a tooth at the contact point, the driven gear has a gap.
    const phase = [0];
    for (let i = 1; i < T.length; i++) {
      if (state.mode === 'compound' && i === 2) phase.push(phase[1]);
      else phase.push((-T[i - 1] / T[i]) * phase[i - 1] + Math.PI + Math.PI / T[i]);
    }
    state.gears = T.map((t, i) => {
      const mesh = new THREE.Mesh(gearGeometry(t, 0.3), new THREE.MeshStandardMaterial({ color: COLORS[i % COLORS.length], metalness: 0.5, roughness: 0.35 }));
      mesh.position.set(xs[i] - mid, 0, zs[i]);
      const dir = rpm[i] > 0 ? '↺' : '↻';
      const info = makeLabel(`${String.fromCharCode(65 + i)} · ${t} teeth · ${formatNumber(Math.abs(rpm[i]), 1)} rpm ${dir}`, new THREE.Vector3(xs[i] - mid, -radius(t) - 0.45 - (zs[i] ? 0.4 : 0), zs[i]), COLORS[i % COLORS.length], 'chart-label');
      const marker = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      marker.position.set(radius(t) * 0.6, 0, 0.18);
      mesh.add(marker); // a dot on each gear makes the speed easy to compare
      group.add(mesh, info);
      return { mesh, rpm: rpm[i], phase: phase[i], teeth: t };
    });
    const shaftGeom = new THREE.CylinderGeometry(0.05, 0.05, 1.4, 12);
    for (const g of state.gears) {
      const shaft = new THREE.Mesh(shaftGeom, new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.7 }));
      shaft.rotation.x = Math.PI / 2;
      shaft.position.copy(g.mesh.position).setZ(0.2);
      group.add(shaft);
    }
    const span = Math.max(...xs) - Math.min(...xs) + radius(Math.max(...T)) * 2;
    stage.camera.position.set(0, 1.2, Math.max(6, span * 1.3));
    stage.controls.target.set(0, 0, 0);
    stage.saveHome();
    renderPanel(T, rpm);
  }

  function renderPanel(T, rpm) {
    const out = rpm.at(-1);
    const r = ratio(state.rpm, out);
    const sameWay = Math.sign(out) === Math.sign(state.rpm);
    const row = (k, v) => `<div class="row-between"><span>${k}</span><strong>${v}</strong></div>`;
    $('[data-out]').innerHTML = [
      row('Speed ratio (in : out)', `${formatNumber(r, 2)} : 1`),
      row('Output speed', `${formatNumber(Math.abs(out), 1)} rpm ${sameWay ? '(same way)' : '(opposite way)'}`),
      row('Torque multiplied by', `× ${formatNumber(r, 2)}`),
    ].join('');
    let msg;
    if (state.mode === 'compound') msg = `Compound train: B and C share a shaft, so the ratios multiply: (${T[1]}/${T[0]}) × (${T[3]}/${T[2]}) = <b>${formatNumber(r, 2)}</b>. That's how clocks and gearboxes get big ratios in a small space.`;
    else if (T.length >= 3) msg = `The middle gear${T.length > 3 ? 's are idlers' : ' is an <b>idler</b>'}: ${T.length > 3 ? 'they' : 'it'} change${T.length > 3 ? '' : 's'} the direction but not the overall ratio, which is just ${T.at(-1)} / ${T[0]}.`;
    else msg = r > 1 ? 'Small gear drives big gear: <b>slower, stronger</b>. That is a reduction, as in a cycle’s low gear.' : r < 1 ? 'Big gear drives small gear: <b>faster, weaker</b>, as in a hand drill.' : 'Equal gears: same speed, opposite direction.';
    $('[data-msg]').innerHTML = msg;
    renderTeethSliders();
  }

  function renderTeethSliders() {
    const T = state.mode === 'simple' ? state.teeth : state.compound;
    $('[data-teeth]').innerHTML = T.map((t, i) => `<label class="slider-row wide"><span>Gear ${String.fromCharCode(65 + i)}${state.mode === 'compound' && i === 2 ? ' (on B)' : ''}</span><input type="range" min="8" max="60" step="1" value="${t}" data-t="${i}"><output>${t}</output></label>`).join('');
    $('[data-count-row]').hidden = state.mode !== 'simple';
  }

  $('[data-teeth]').addEventListener('input', (e) => {
    const i = Number(e.target.dataset.t);
    if (Number.isNaN(i)) return;
    (state.mode === 'simple' ? state.teeth : state.compound)[i] = Number(e.target.value);
    build();
  });
  root.querySelectorAll('input[name=mode]').forEach((r) => r.addEventListener('change', () => { state.mode = r.value; build(); }));
  root.querySelectorAll('[data-count]').forEach((b) => b.addEventListener('click', () => {
    const n = state.teeth.length + Number(b.dataset.count);
    if (n < 2 || n > 4) return;
    state.teeth = n > state.teeth.length ? [...state.teeth, 20] : state.teeth.slice(0, n);
    build();
  }));
  $('[data-rpm]').addEventListener('input', (e) => {
    state.rpm = Number(e.target.value);
    $('[data-rpm-out]').textContent = `${state.rpm} rpm`;
    build();
  });

  // Every gear's angle follows from the driver's, so teeth stay interlocked however long it runs.
  stage.onFrame((dt) => {
    state.angle += ((state.rpm * 2 * Math.PI) / 60) * dt * VISUAL;
    for (const g of state.gears) g.mesh.rotation.z = g.phase + state.angle * (g.rpm / state.rpm);
  });

  build();
  return () => stage.dispose();
}
