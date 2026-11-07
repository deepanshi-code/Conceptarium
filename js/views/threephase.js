// Electrical: three-phase AC and the rotating magnetic field. Three coils 120° apart carry currents 120° out of
// step; their fields add up to one field of constant strength that spins. That spinning field drags the rotor of
// an induction motor round, with no brushes and no connection to the rotor.
import * as THREE from 'three';
import { createStage, makeLabel, setArrow } from '../stage.js';
import { rotatingField } from '../elec/machines.js';
import { html, formatNumber } from '../ui.js';

const PHASE_COLORS = [0xef4444, 0xfacc15, 0x3b82f6]; // R, Y, B as on Indian three-phase supplies
const NAMES = ['R', 'Y', 'B'];
const SCALE = 1.4;

export function mountThreePhase(root) {
  root.innerHTML = html`
    <div class="viewport" data-viewport></div>
    <aside class="panel">
      <h2>Three-Phase &amp; Motors</h2>
      <p class="lede">Power stations send AC on <b>three wires</b>, each 120° out of step. Fed into three coils spaced 120° apart, the three pulsing fields add up to <b>one field that rotates</b> at constant strength. An induction motor's rotor simply chases it. That's why most factory machines, pumps and fans run on three-phase.</p>

      <label class="slider-row wide"><span>Frequency</span><input type="range" min="0.1" max="1.5" step="0.05" value="0.4" data-f><output data-f-out>0.4 Hz (slowed)</output></label>
      <fieldset class="toggles"><legend>Phases connected</legend>
        ${NAMES.map((n, k) => `<label><input type="checkbox" data-ph="${k}" checked> <span class="swatch" style="--c:#${new THREE.Color(PHASE_COLORS[k]).getHexString()}"></span> Phase ${n}</label>`).join('')}
      </fieldset>
      <label class="check"><input type="checkbox" data-rotor checked> Show the motor rotor</label>

      <div class="readout" data-out></div>
      <div class="timing" data-graph></div>
      <div class="notice" data-msg></div>
    </aside>
  `;

  const $ = (sel) => root.querySelector(sel);
  const stage = createStage($('[data-viewport]'), { cameraPosition: [0, 4.5, 7.5], axes: false, grid: false });
  const scene = stage.scene;
  const state = { f: 0.4, on: [true, true, true], wt: 0, rotorAngle: 0, rotorSpeed: 0 };

  // Stator: a ring with three coil pairs, each pair on opposite sides of the ring along its phase axis.
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.18, 12, 64), new THREE.MeshStandardMaterial({ color: 0x4b5563, metalness: 0.6 }));
  ring.rotation.x = Math.PI / 2;
  scene.add(ring);
  const arrows = PHASE_COLORS.map((c, k) => {
    const angle = (k * 2 * Math.PI) / 3;
    for (const side of [1, -1]) {
      const coil = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.12, 10, 24), new THREE.MeshStandardMaterial({ color: c, metalness: 0.3 }));
      coil.position.set(Math.cos(angle) * 2.2 * side, 0, -Math.sin(angle) * 2.2 * side);
      coil.lookAt(0, 0, 0);
      scene.add(coil);
    }
    scene.add(makeLabel(NAMES[k], new THREE.Vector3(Math.cos(angle) * 3.2, 0.4, -Math.sin(angle) * 3.2), c, 'chart-label'));
    const a = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0.75, 0), 1, c, 0.25, 0.15);
    scene.add(a);
    return a;
  });
  const total = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0.8, 0), 1, 0xffffff, 0.35, 0.22);
  scene.add(total);
  const trail = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 65 }, (_, i) => new THREE.Vector3(Math.cos((i / 64) * 2 * Math.PI) * 1.5 * SCALE, 0.8, -Math.sin((i / 64) * 2 * Math.PI) * 1.5 * SCALE))), new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.1, gapSize: 0.1, transparent: true, opacity: 0.35 }));
  trail.computeLineDistances();
  scene.add(trail);

  // Squirrel-cage rotor: a drum of bars that turns a little slower than the field (slip).
  const rotor = new THREE.Group();
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.2, 32), new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.6, transparent: true, opacity: 0.5 }));
  rotor.add(drum);
  for (let i = 0; i < 12; i++) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 8), new THREE.MeshStandardMaterial({ color: 0xd97706 }));
    bar.position.set(Math.cos((i / 12) * Math.PI * 2) * 0.88, 0, Math.sin((i / 12) * Math.PI * 2) * 0.88);
    rotor.add(bar);
  }
  const mark = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.12), new THREE.MeshBasicMaterial({ color: 0x4ade80 }));
  mark.position.set(0.45, 0.63, 0);
  rotor.add(mark);
  rotor.position.y = -0.7;
  scene.add(rotor);

  function drawGraph() {
    const w = 300;
    const h = 110;
    const now = state.wt;
    let out = '';
    PHASE_COLORS.forEach((c, k) => {
      if (!state.on[k]) return;
      let d = '';
      for (let i = 0; i <= 120; i++) {
        const ph = now - 2 * Math.PI + (i / 120) * 2 * Math.PI;
        d += `${i ? 'L' : 'M'}${(i / 120) * w},${h / 2 - Math.cos(ph - (k * 2 * Math.PI) / 3) * (h / 2 - 8)}`;
      }
      out += `<path d="${d}" fill="none" stroke="#${new THREE.Color(c).getHexString()}" stroke-width="1.6"/>`;
    });
    $('[data-graph]').innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="Three phase currents"><line x1="${w}" x2="${w}" y1="0" y2="${h}" class="edge"/><line x1="0" x2="${w}" y1="${h / 2}" y2="${h / 2}" class="edge"/>${out}<text x="4" y="12" class="tlabel">phase currents (now at the right edge)</text></svg>`;
  }

  root.querySelectorAll('[data-ph]').forEach((c) => c.addEventListener('change', (e) => { state.on[Number(e.target.dataset.ph)] = e.target.checked; }));
  $('[data-rotor]').addEventListener('change', (e) => { rotor.visible = e.target.checked; });
  $('[data-f]').addEventListener('input', (e) => { state.f = Number(e.target.value); $('[data-f-out]').textContent = `${state.f} Hz (slowed)`; });

  stage.onFrame((dt) => {
    state.wt += dt * state.f * 2 * Math.PI;
    const field = rotatingField(state.wt, state.on);
    field.phases.forEach((p, k) => {
      // Each coil's field lies along its own axis and grows / shrinks / reverses with its current.
      setArrow(arrows[k], new THREE.Vector3(Math.cos(p.angle), 0, -Math.sin(p.angle)).multiplyScalar(p.i * SCALE));
    });
    setArrow(total, new THREE.Vector3(field.x, 0, -field.y).multiplyScalar(SCALE));
    const count = state.on.filter(Boolean).length;
    trail.visible = count === 3;
    // The rotor accelerates towards the field's speed when the field rotates; a pulsing field gives no steady torque.
    const sync = state.f * 2 * Math.PI;
    const target = count >= 2 ? sync * 0.95 : 0; // two phases still rotate (unevenly); one phase can't start a motor
    state.rotorSpeed += (target - state.rotorSpeed) * Math.min(1, dt * 0.8);
    state.rotorAngle += state.rotorSpeed * dt;
    rotor.rotation.y = state.rotorAngle;
    const row = (k, v) => `<div class="row-between"><span>${k}</span><strong>${v}</strong></div>`;
    $('[data-out]').innerHTML = row('Total field strength', `${formatNumber(field.magnitude, 2)} × one coil's peak`) + row('Field direction', `${Math.round(((field.angle * 180) / Math.PI + 360) % 360)}°`) + row('Rotor speed', `${formatNumber((state.rotorSpeed / (sync || 1)) * 100, 0)}% of the field`);
    $('[data-msg]').innerHTML = count === 3
      ? 'All three phases: the white arrow keeps the <b>same length</b> (1.5×) and spins smoothly. The rotor follows slightly slower (<b>slip</b>): that difference is what induces current in the rotor bars.'
      : count === 2 ? 'Two phases: the field still turns, but its strength wobbles. Motors run rough and can overheat.'
        : count === 1 ? 'One phase: the field only <b>pulses back and forth</b> along one line, it doesn\'t rotate. A single-phase motor needs a trick (a starting capacitor) to begin turning.'
          : 'No current, no field.';
    drawGraph();
  });

  return () => stage.dispose();
}
