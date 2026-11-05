// Mechanical: the four-stroke engine and its slider-crank. The crank turns steadily, the connecting rod pushes the
// piston up and down, and the valves and spark plug time the four strokes over two crank turns.
import * as THREE from 'three';
import { createStage, makeLabel } from '../stage.js';
import { pistonX, pistonV, strokeAt, STROKES } from '../mech/slidercrank.js';
import { html, formatNumber } from '../ui.js';

const S = 22; // world units per metre
const GRAPH_X = 2.6;
const GRAPH_W = 5;
const GAS = { Intake: 0x60a5fa, Compression: 0x2563eb, Power: 0xf97316, Exhaust: 0x6b7280 };

export function mountEngine(root) {
  root.innerHTML = html`
    <div class="viewport" data-viewport></div>
    <aside class="panel">
      <h2>Four-Stroke Engine</h2>
      <p class="lede">A <b>slider-crank</b> turns the piston's up-and-down motion into rotation. One cycle takes <b>two turns</b> of the crank: intake (fuel-air in), compression, power (spark, the gas pushes the piston down), exhaust. Only one stroke in four gives power, which is why a flywheel is needed.</p>

      <h3>Engine</h3>
      <label class="slider-row wide"><span>Crank radius</span><input type="range" min="20" max="60" step="1" value="40" data-r><output data-r-out>40 mm</output></label>
      <label class="slider-row wide"><span>Rod / crank</span><input type="range" min="2.5" max="6" step="0.1" value="3.5" data-n><output data-n-out>3.5</output></label>
      <label class="slider-row wide"><span>Engine speed</span><input type="range" min="0" max="3000" step="50" value="600" data-rpm><output data-rpm-out>600 rpm</output></label>
      <p class="hint">On screen it runs 60× slower so you can follow it.</p>

      <h3>Right now</h3>
      <div class="stroke-strip" data-strip>${STROKES.map((s) => `<span data-s="${s}">${s}</span>`).join('')}</div>
      <div class="readout" data-out></div>
      <p class="hint" data-insight></p>
    </aside>
  `;

  const $ = (sel) => root.querySelector(sel);
  const stage = createStage($('[data-viewport]'), { cameraPosition: [1.8, 2.4, 11.5], axes: false, grid: false });
  stage.controls.target.set(1.8, 2, 0);
  const scene = stage.scene;
  const state = { r: 0.04, n: 3.5, rpm: 600, theta: 0 };
  const L = () => state.r * state.n;

  // Parts (rebuilt when the geometry changes).
  const crankDisk = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.25, 40), new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.6, roughness: 0.35 }));
  crankDisk.rotation.x = Math.PI / 2;
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.5, 16), new THREE.MeshStandardMaterial({ color: 0xfacc15 }));
  pin.rotation.x = Math.PI / 2;
  const rod = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1, 0.12), new THREE.MeshStandardMaterial({ color: 0xc4b5fd, metalness: 0.4, roughness: 0.3 }));
  const piston = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.7, 40), new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.6, roughness: 0.3 }));
  const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 1, 40, 1, true), new THREE.MeshStandardMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
  const gas = new THREE.Mesh(new THREE.CylinderGeometry(0.84, 0.84, 1, 40), new THREE.MeshBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.35 }));
  const head = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.3, 1.2), new THREE.MeshStandardMaterial({ color: 0x4b4580 }));
  const valves = [-0.45, 0.45].map((x) => {
    const v = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 10), new THREE.MeshStandardMaterial({ color: 0xe5e7eb }));
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 20), v.material);
    cap.position.y = -0.35;
    v.add(cap);
    v.userData.x = x;
    return v;
  });
  const spark = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfff7ae, transparent: true, opacity: 0 }));
  scene.add(crankDisk, pin, rod, piston, cylinder, gas, head, ...valves, spark);
  scene.add(makeLabel('intake valve', new THREE.Vector3(-1.4, 0, 0), 0x60a5fa, 'chart-label'), makeLabel('exhaust valve', new THREE.Vector3(1.4, 0, 0), 0x9ca3af, 'chart-label'));
  const valveLabels = scene.children.slice(-2);

  // Graph: piston height against crank angle over one turn, with a pure cosine for comparison.
  const graph = new THREE.Group();
  scene.add(graph);
  const pen = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
  graph.add(pen);

  function layout() {
    const r = state.r * S;
    const l = L() * S;
    const top = l + r; // piston height at top dead centre
    crankDisk.scale.set(r * 1.25, 1, r * 1.25);
    cylinder.scale.y = 2 * r + 1.2;
    cylinder.position.y = top - r + 0.35;
    head.position.y = top + 0.95;
    valves.forEach((v, i) => { v.position.set(v.userData.x, top + 0.95, 0); valveLabels[i].position.set(v.userData.x * 3, top + 1.3, 0); });
    spark.position.set(0, top + 0.72, 0);

    // Graph lines (rebuilt): real piston motion (yellow) vs simple harmonic (dashed).
    graph.children.filter((c) => c !== pen).forEach((c) => { graph.remove(c); c.geometry.dispose(); c.material.dispose(); });
    const N = 120;
    const yOf = (x) => (x - l) * 1.2 + 2.4;
    const real = Array.from({ length: N + 1 }, (_, i) => new THREE.Vector3(GRAPH_X + (i / N) * GRAPH_W, yOf(pistonX((i / N) * 2 * Math.PI, r, l)), 0));
    const ideal = Array.from({ length: N + 1 }, (_, i) => new THREE.Vector3(GRAPH_X + (i / N) * GRAPH_W, yOf(l + r * Math.cos((i / N) * 2 * Math.PI)), 0));
    const dashed = new THREE.Line(new THREE.BufferGeometry().setFromPoints(ideal), new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.1, gapSize: 0.08, transparent: true, opacity: 0.4 }));
    dashed.computeLineDistances();
    graph.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(real), new THREE.LineBasicMaterial({ color: 0xfacc15 })), dashed);
    graph.add(makeLabel('piston height over one crank turn', new THREE.Vector3(GRAPH_X, yOf(l + r) + 0.6, 0), 0x9b98c4, 'chart-label'));
    graph.add(makeLabel('TDC', new THREE.Vector3(GRAPH_X - 0.35, yOf(l + r), 0), 0x9b98c4, 'idx-label'), makeLabel('BDC', new THREE.Vector3(GRAPH_X + GRAPH_W / 2, yOf(l - r) - 0.3, 0), 0x9b98c4, 'idx-label'));
    graph.userData.yOf = yOf;
  }

  function place() {
    const r = state.r * S;
    const l = L() * S;
    const th = state.theta;
    const x = pistonX(th, r, l);
    const pinPos = new THREE.Vector3(r * Math.sin(th), r * Math.cos(th), 0.3);
    pin.position.copy(pinPos);
    crankDisk.rotation.y = -th;
    piston.position.set(0, x + 0.1, 0);
    const wrist = new THREE.Vector3(0, x, 0.15);
    rod.position.copy(pinPos.clone().add(wrist).multiplyScalar(0.5));
    rod.scale.y = pinPos.distanceTo(wrist);
    rod.rotation.z = Math.atan2(wrist.x - pinPos.x, wrist.y - pinPos.y) * -1;
    // Gas between piston top and head, coloured by stroke.
    const top = l + r + 0.8;
    const pTop = x + 0.45;
    gas.scale.y = Math.max(0.01, top - pTop);
    gas.position.y = (top + pTop) / 2;
    const stroke = strokeAt(th);
    gas.material.color.setHex(GAS[stroke]);
    gas.material.opacity = stroke === 'Compression' ? 0.25 + 0.4 * ((th % Math.PI) / Math.PI) : 0.35;
    // Valves open (drop) during intake / exhaust.
    const lift = (on) => (on ? 0.22 * Math.sin(th % Math.PI) : 0);
    valves[0].position.y = l + r + 0.95 - lift(stroke === 'Intake');
    valves[1].position.y = l + r + 0.95 - lift(stroke === 'Exhaust');
    const sinceFire = (((th % (4 * Math.PI)) + 4 * Math.PI) % (4 * Math.PI)) - 2 * Math.PI;
    spark.material.opacity = sinceFire >= 0 && sinceFire < 0.5 ? 1 - sinceFire / 0.5 : 0;
    // Graph pen.
    const frac = (((th % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI);
    pen.position.set(GRAPH_X + frac * GRAPH_W, graph.userData.yOf(x), 0.01);

    root.querySelectorAll('[data-s]').forEach((el) => el.classList.toggle('current', el.dataset.s === stroke));
    const omega = (state.rpm * 2 * Math.PI) / 60;
    const v = pistonV(th, state.r, L(), omega);
    const row = (k, val) => `<div class="row-between"><span>${k}</span><strong>${val}</strong></div>`;
    $('[data-out]').innerHTML = [
      row('Crank angle', `${Math.round(((th * 180) / Math.PI) % 720)}° of 720°`),
      row('Stroke length (2r)', `${formatNumber(state.r * 2000, 0)} mm`),
      row('Piston speed now', `${formatNumber(Math.abs(v), 2)} m/s`),
      row('Mean piston speed', `${formatNumber((2 * 2 * state.r * state.rpm) / 60, 2)} m/s`),
    ].join('');
  }

  function insight() {
    $('[data-insight]').innerHTML = state.n < 3.2
      ? '<b>Short rod:</b> the yellow curve is lopsided compared with the dashed cosine. The piston moves faster near the top than near the bottom.'
      : 'The yellow curve (real piston) is not a perfect cosine (dashed) because the rod tilts. A longer rod makes it closer to SHM.';
  }

  const bind = (sel, key, conv, fmt) => $(sel).addEventListener('input', (e) => {
    state[key] = conv(Number(e.target.value));
    $(sel.replace(']', '-out]')).textContent = fmt(Number(e.target.value));
    layout();
    insight();
  });
  bind('[data-r]', 'r', (v) => v / 1000, (v) => `${v} mm`);
  bind('[data-n]', 'n', (v) => v, (v) => formatNumber(v, 1));
  bind('[data-rpm]', 'rpm', (v) => v, (v) => `${v} rpm`);

  stage.onFrame((dt) => {
    state.theta += ((state.rpm * 2 * Math.PI) / 60) * dt / 60; // 60× slow motion
    place();
  });

  layout();
  insight();
  place();
  return () => stage.dispose();
}
