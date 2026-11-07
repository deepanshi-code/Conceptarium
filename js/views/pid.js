// Control systems: a PID controller flying a drone to a target height. P pushes towards the target, I removes the
// leftover error (here, from gravity), D damps the overshoot. Tune it, kick it, and watch the response graph.
import * as THREE from 'three';
import { createStage, makeLabel } from '../stage.js';
import { createDrone, stepResponse, GRAVITY } from '../elec/pid.js';
import { interact, rayOnPlane } from '../interact.js';
import { html, formatNumber } from '../ui.js';

const PRESETS = {
  p: { name: 'P only', Kp: 4, Ki: 0, Kd: 0 },
  pd: { name: 'PD', Kp: 4, Ki: 0, Kd: 3 },
  pid: { name: 'PID (tuned)', Kp: 6, Ki: 3, Kd: 4 },
  wild: { name: 'Too much P', Kp: 30, Ki: 0, Kd: 0.5 },
};
const HISTORY = 15; // seconds shown on the graph

export function mountPid(root) {
  root.innerHTML = html`
    <div class="viewport" data-viewport></div>
    <aside class="panel">
      <h2>PID Control</h2>
      <p class="lede">A controller compares where you <b>are</b> with where you <b>want</b> to be (the error e) and sets the motors: <b>P</b> = push in proportion to e, <b>I</b> = push harder the longer an error lasts, <b>D</b> = brake when closing in fast. Cruise control, drones, ovens and robot arms all use it.</p>

      <div class="op-group">${Object.entries(PRESETS).map(([k, p]) => `<button class="btn small secondary" data-preset="${k}">${p.name}</button>`).join('')}</div>
      <label class="slider-row wide"><span>Kp</span><input type="range" min="0" max="30" step="0.5" value="6" data-Kp><output data-Kp-out>6</output></label>
      <label class="slider-row wide"><span>Ki</span><input type="range" min="0" max="10" step="0.25" value="3" data-Ki><output data-Ki-out>3</output></label>
      <label class="slider-row wide"><span>Kd</span><input type="range" min="0" max="10" step="0.25" value="4" data-Kd><output data-Kd-out>4</output></label>
      <label class="slider-row wide"><span>Target</span><input type="range" min="1" max="8" step="0.5" value="5" data-target><output data-target-out>5 m</output></label>
      <div class="btn-row">
        <button class="btn" data-restart>↺ Take off again</button>
        <button class="btn secondary" data-kick>💨 Gust of wind</button>
      </div>

      <div class="timing" data-graph></div>
      <div class="readout" data-out></div>
      <div class="notice" data-msg></div>
    </aside>
  `;

  const $ = (sel) => root.querySelector(sel);
  const stage = createStage($('[data-viewport]'), { cameraPosition: [5, 4, 9], axes: false, grid: true });
  stage.controls.target.set(0, 3.5, 0);
  const scene = stage.scene;
  const state = { gains: { Kp: 6, Ki: 3, Kd: 4 }, target: 5, drone: null, trace: [], t: 0, thrust: 0 };

  // Drone: body, arms and four spinning rotors; a translucent target ring you can drag.
  const drone = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.2, 0.7), new THREE.MeshStandardMaterial({ color: 0x8b5cf6, metalness: 0.4 }));
  drone.add(body);
  const rotors = [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([sx, sz]) => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.08), new THREE.MeshStandardMaterial({ color: 0x9ca3af }));
    arm.position.set(sx * 0.4, 0, sz * 0.4);
    arm.rotation.y = sx * sz > 0 ? -Math.PI / 4 : Math.PI / 4;
    const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.02, 24), new THREE.MeshStandardMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.5 }));
    rotor.position.set(sx * 0.7, 0.1, sz * 0.7);
    drone.add(arm, rotor);
    return rotor;
  });
  const thrustArrow = new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, -0.15, 0), 1, 0xfacc15, 0.2, 0.12);
  drone.add(thrustArrow);
  scene.add(drone);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.04, 8, 48), new THREE.MeshBasicMaterial({ color: 0x4ade80 }));
  ring.rotation.x = Math.PI / 2;
  const ringHit = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.4, 24), new THREE.MeshBasicMaterial({ visible: false }));
  scene.add(ring, ringHit, makeLabel('target (drag me)', new THREE.Vector3(1.3, 0, 0), 0x4ade80, 'idx-label'));
  const ringLabel = scene.children.at(-1);

  function restart() {
    state.drone = createDrone(state.gains);
    state.trace = [];
    state.t = 0;
    summary();
  }

  function summary() {
    const r = stepResponse(state.gains, state.target, 20);
    const row = (k, v) => `<div class="row-between"><span>${k}</span><strong>${v}</strong></div>`;
    $('[data-out]').innerHTML = [
      row('Overshoot', `${formatNumber(r.overshoot, 1)}%`),
      row('Settles (within 2%) after', r.settle >= 19.9 ? 'never (in 20 s)' : `${formatNumber(r.settle, 1)} s`),
      row('Steady-state error', `${formatNumber(Math.abs(r.steadyError), 2)} m`),
    ].join('');
    const { Kp, Ki, Kd } = state.gains;
    $('[data-msg]').innerHTML = Kp === 0 ? 'With Kp = 0 the controller barely reacts to the error. Turn P up first.'
      : Kd < 1 ? `<b>Little or no D:</b> nothing brakes the drone as it nears the target, so it overshoots and keeps bouncing like a spring.${Kp > 10 ? ' Big P makes it worse.' : ''} Increase Kd to add damping.`
        : Ki === 0 ? `<b>No I term:</b> to hover, the motors need thrust = g, and P only gives thrust when there's an error. So it settles <b>${formatNumber(GRAVITY / Kp, 2)} m too low</b> (g / Kp). Add some Ki to remove it.`
          : r.overshoot > 20 ? 'It reaches the target but overshoots a lot. More Kd (damping) or less Ki will calm it.'
          : 'Nicely tuned: reaches the target with little overshoot and no lasting error. Try a gust of wind!';
  }

  function drawGraph() {
    const w = 300;
    const h = 130;
    const tr = state.trace;
    const t0 = Math.max(0, state.t - HISTORY);
    const x = (t) => ((t - t0) / HISTORY) * w;
    const y = (v) => h - 8 - (v / 10) * (h - 16);
    const d = tr.filter(([t]) => t >= t0).map(([t, v], i) => `${i ? 'L' : 'M'}${x(t).toFixed(1)},${y(v).toFixed(1)}`).join('');
    $('[data-graph]').innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="Height against time"><line x1="0" x2="${w}" y1="${y(state.target)}" y2="${y(state.target)}" class="thresh"/><path d="${d}" class="q"/><text x="4" y="12" class="tlabel">height (m)</text><text x="${w - 4}" y="${y(state.target) - 4}" text-anchor="end" class="tlabel">target</text></svg>`;
  }

  const setGains = (g) => {
    Object.assign(state.gains, g);
    for (const k of ['Kp', 'Ki', 'Kd']) {
      $(`[data-${k}]`).value = state.gains[k];
      $(`[data-${k}-out]`).textContent = state.gains[k];
    }
    if (state.drone) state.drone.gains = state.gains;
    summary();
  };
  root.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
    const { Kp, Ki, Kd } = PRESETS[b.dataset.preset];
    setGains({ Kp, Ki, Kd });
    restart();
  }));
  for (const k of ['Kp', 'Ki', 'Kd']) $(`[data-${k}]`).addEventListener('input', (e) => setGains({ [k]: Number(e.target.value) }));
  $('[data-target]').addEventListener('input', (e) => { state.target = Number(e.target.value); $('[data-target-out]').textContent = `${state.target} m`; summary(); });
  $('[data-restart]').addEventListener('click', restart);
  $('[data-kick]').addEventListener('click', () => { state.drone.state.v -= 4; });

  const vertical = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const stopInteract = interact(stage, {
    pick: () => [ringHit],
    onDown: () => ({
      move: (ray) => {
        const p = rayOnPlane(ray, vertical);
        if (!p) return;
        state.target = Math.round(Math.min(8, Math.max(1, p.y)) * 2) / 2;
        $('[data-target]').value = state.target;
        $('[data-target-out]').textContent = `${state.target} m`;
      },
      end: summary,
    }),
  });

  stage.onFrame((dt) => {
    const sub = 10;
    let u = 0;
    for (let i = 0; i < sub; i++) u = state.drone.step(state.target, dt / sub).u;
    state.t += dt;
    const y = state.drone.state.y;
    state.trace.push([state.t, y]);
    if (state.trace.length > 2000) state.trace.shift();
    drone.position.set(0, y + 0.15, 0);
    drone.rotation.z = Math.sin(state.t * 3) * 0.03;
    rotors.forEach((r) => { r.rotation.y += dt * (5 + u * 2); });
    thrustArrow.setLength(Math.max(0.05, (u / GRAVITY) * 0.6), 0.15, 0.1);
    ring.position.y = state.target;
    ringHit.position.y = state.target;
    ringLabel.position.y = state.target;
    drawGraph();
  });

  restart();
  return () => {
    stopInteract();
    stage.dispose();
  };
}
