// Electrical: DC circuits as a "voltage landscape". Every wire is drawn at a height equal to its potential, so the
// battery lifts charge up and each resistor is a ramp back down. Dots show current: faster dots, more current.
import * as THREE from 'three';
import { createStage, makeLabel, clearGroup } from '../stage.js';
import { LAYOUTS, solveCircuit } from '../elec/circuits.js';
import { html, formatNumber } from '../ui.js';

const H = 0.32; // world height per volt
const RES_COLORS = [0xf472b6, 0x22d3ee, 0xfacc15];

export function mountCircuits(root) {
  root.innerHTML = html`
    <div class="viewport" data-viewport></div>
    <aside class="panel">
      <h2>DC Circuits</h2>
      <p class="lede">Height here is <b>voltage</b>. The battery lifts charge up; each resistor is a slope back down (the voltage drop V = IR). Dots show the current: <b>in series</b> it's the same everywhere and the voltages add up; <b>in parallel</b> each branch gets the full voltage and the currents add up.</p>

      <div class="tabs" data-layouts>${Object.entries(LAYOUTS).map(([k, n]) => `<button data-layout="${k}">${n}</button>`).join('')}</div>
      <label class="slider-row wide"><span>Battery</span><input type="range" min="1" max="24" step="1" value="12" data-V><output data-V-out>12 V</output></label>
      ${[1, 2, 3].map((k) => `<label class="slider-row wide"><span>R${k}</span><input type="range" min="1" max="20" step="1" value="${[2, 4, 6][k - 1]}" data-r="${k - 1}"><output data-r-out="${k - 1}">${[2, 4, 6][k - 1]} Ω</output></label>`).join('')}

      <h3>Results</h3>
      <table class="stats"><thead><tr><th></th><th>I (A)</th><th>V (V)</th><th>P (W)</th></tr></thead><tbody data-table></tbody></table>
      <div class="notice" data-msg></div>
    </aside>
  `;

  const $ = (sel) => root.querySelector(sel);
  const stage = createStage($('[data-viewport]'), { cameraPosition: [-5, 6, 9], axes: false, grid: false });
  stage.controls.target.set(0, 1.5, 0);
  const group = new THREE.Group();
  stage.scene.add(group);
  const state = { layout: 'series', V: 12, R: [2, 4, 6], segments: [] };

  // Segments: from point a to point b (x, z on the floor), potential va → vb, carrying current I from a to b.
  function segmentsFor(layout, V, sol) {
    const segs = [];
    const add = (a, b, va, vb, I, kind, k) => segs.push({ a, b, va, vb, I, kind, k });
    const [p1, p2, p3] = sol.parts;
    const I = sol.I;
    if (layout === 'series') {
      const v1 = V - p1.V;
      const v2 = v1 - p2.V;
      add([-3, 2], [-3, -2], 0, V, I, 'battery'); // battery: − at the front, + at the back
      add([-3, -2], [-1.2, -2], V, V, I, 'wire');
      add([-1.2, -2], [1.2, -2], V, v1, I, 'R', 0);
      add([1.2, -2], [3, -2], v1, v1, I, 'wire');
      add([3, -2], [3, -0.8], v1, v1, I, 'wire');
      add([3, -0.8], [3, 0.8], v1, v2, I, 'R', 1);
      add([3, 0.8], [3, 2], v2, v2, I, 'wire');
      add([3, 2], [1.2, 2], v2, v2, I, 'wire');
      add([1.2, 2], [-1.2, 2], v2, 0, I, 'R', 2);
      add([-1.2, 2], [-3, 2], 0, 0, I, 'wire');
    } else if (layout === 'parallel') {
      add([-3, 2], [-3, -2], 0, V, I, 'battery');
      // Top rail at V (back, z = −2), bottom rail at 0 (front, z = +2); three rungs.
      const xs = [-1, 1, 3];
      add([-3, -2], [xs[0], -2], V, V, I, 'wire');
      add([xs[0], -2], [xs[1], -2], V, V, I - p1.I, 'wire');
      add([xs[1], -2], [xs[2], -2], V, V, p3.I, 'wire');
      sol.parts.forEach((p, k) => {
        add([xs[k], -2], [xs[k], -0.9], V, V, p.I, 'wire');
        add([xs[k], -0.9], [xs[k], 0.9], V, 0, p.I, 'R', k);
        add([xs[k], 0.9], [xs[k], 2], 0, 0, p.I, 'wire');
      });
      add([xs[2], 2], [xs[1], 2], 0, 0, p3.I, 'wire');
      add([xs[1], 2], [xs[0], 2], 0, 0, p2.I + p3.I, 'wire');
      add([xs[0], 2], [-3, 2], 0, 0, I, 'wire');
    } else {
      const v1 = V - p1.V;
      add([-3, 2], [-3, -2], 0, V, I, 'battery');
      add([-3, -2], [-1.6, -2], V, V, I, 'wire');
      add([-1.6, -2], [0.6, -2], V, v1, I, 'R', 0);
      add([0.6, -2], [1.4, -2], v1, v1, I, 'wire');
      add([1.4, -2], [3, -2], v1, v1, p3.I, 'wire');
      [[1.4, 1], [3, 2]].forEach(([x, k]) => {
        add([x, -2], [x, -0.9], v1, v1, sol.parts[k].I, 'wire');
        add([x, -0.9], [x, 0.9], v1, 0, sol.parts[k].I, 'R', k);
        add([x, 0.9], [x, 2], 0, 0, sol.parts[k].I, 'wire');
      });
      add([3, 2], [1.4, 2], 0, 0, p3.I, 'wire');
      add([1.4, 2], [-3, 2], 0, 0, I, 'wire');
    }
    return segs;
  }

  const to3 = ([x, z], v) => new THREE.Vector3(x, v * H, z);

  function build() {
    clearGroup(group);
    const sol = solveCircuit(state.layout, state.V, state.R);
    const segs = segmentsFor(state.layout, state.V, sol);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 6), new THREE.MeshStandardMaterial({ color: 0x12153a }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.02;
    group.add(floor);
    state.segments = segs.map((s) => {
      const a = to3(s.a, s.va);
      const b = to3(s.b, s.vb);
      const len = a.distanceTo(b);
      let mesh;
      if (s.kind === 'R') {
        mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, len, 16), new THREE.MeshStandardMaterial({ color: RES_COLORS[s.k], roughness: 0.4 }));
        mesh.add(makeLabel(`R${s.k + 1} = ${state.R[s.k]} Ω`, new THREE.Vector3(0.45, 0, 0), RES_COLORS[s.k], 'chart-label'));
      } else if (s.kind === 'battery') {
        mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, len, 20), new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.4 }));
        mesh.add(makeLabel(`${state.V} V battery`, new THREE.Vector3(-0.6, 0, 0), 0x4ade80, 'chart-label'));
      } else {
        mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, len, 8), new THREE.MeshStandardMaterial({ color: 0xe5e7eb, metalness: 0.4 }));
      }
      mesh.position.copy(a).add(b).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      group.add(mesh);
      // Faint "curtain" down to the floor so the height (voltage) is easy to read.
      const curtain = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false }));
      const geo = new THREE.BufferGeometry().setFromPoints([to3(s.a, 0), to3(s.b, 0), b, to3(s.a, 0), b, a]);
      curtain.geometry.dispose();
      curtain.geometry = geo;
      group.add(curtain);
      // Current dots: count by length, speed by current.
      const count = Math.max(1, Math.round(len * 3));
      const dots = Array.from({ length: count }, (_, i) => {
        const d = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfde047 }));
        d.userData.u = i / count;
        group.add(d);
        return d;
      });
      return { ...s, a3: a, b3: b, len, dots };
    });
    group.add(makeLabel('0 V', new THREE.Vector3(-3.6, 0, 2.2), 0x8a8fb8, 'idx-label'), makeLabel(`${state.V} V`, new THREE.Vector3(-3.6, state.V * H, -2.2), 0x8a8fb8, 'idx-label'));

    root.querySelectorAll('[data-layout]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.layout === state.layout)));
    $('[data-table]').innerHTML = sol.parts.map((p, k) => `<tr><td style="color:#${new THREE.Color(RES_COLORS[k]).getHexString()}">R${k + 1}</td><td>${formatNumber(p.I, 2)}</td><td>${formatNumber(p.V, 2)}</td><td>${formatNumber(p.P, 2)}</td></tr>`).join('')
      + `<tr class="current"><td>Total</td><td>${formatNumber(sol.I, 2)}</td><td>${state.V}</td><td>${formatNumber(sol.I * state.V, 2)}</td></tr>`;
    const msg = {
      series: `Same current (${formatNumber(sol.I, 2)} A) through all three. The drops add up to the battery: ${sol.parts.map((p) => formatNumber(p.V, 2)).join(' + ')} = ${state.V} V (<b>Kirchhoff's voltage law</b>). R<sub>eq</sub> = R1 + R2 + R3 = ${formatNumber(sol.Req, 2)} Ω.`,
      parallel: `Each branch gets the full ${state.V} V. The currents add up at the junction: ${sol.parts.map((p) => formatNumber(p.I, 2)).join(' + ')} = ${formatNumber(sol.I, 2)} A (<b>Kirchhoff's current law</b>). R<sub>eq</sub> = ${formatNumber(sol.Req, 2)} Ω, smaller than any single resistor.`,
      mixed: `R1 carries all the current; it then splits between R2 and R3 (more through the smaller one). R<sub>eq</sub> = R1 + (R2 ∥ R3) = ${formatNumber(sol.Req, 2)} Ω.`,
    }[state.layout];
    $('[data-msg]').innerHTML = msg;
  }

  $('[data-layouts]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-layout]');
    if (!b) return;
    state.layout = b.dataset.layout;
    build();
  });
  $('[data-V]').addEventListener('input', (e) => { state.V = Number(e.target.value); $('[data-V-out]').textContent = `${state.V} V`; build(); });
  root.querySelectorAll('[data-r]').forEach((inp) => inp.addEventListener('input', (e) => {
    const k = Number(e.target.dataset.r);
    state.R[k] = Number(e.target.value);
    root.querySelector(`[data-r-out="${k}"]`).textContent = `${state.R[k]} Ω`;
    build();
  }));

  stage.onFrame((dt) => {
    for (const s of state.segments) {
      const speed = (s.I * 0.35) / Math.max(0.2, s.len);
      for (const d of s.dots) {
        d.userData.u = (d.userData.u + dt * speed) % 1;
        d.position.lerpVectors(s.a3, s.b3, d.userData.u).y += 0.08;
      }
    }
  });

  build();
  return () => stage.dispose();
}
