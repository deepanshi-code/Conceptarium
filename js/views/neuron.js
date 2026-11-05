// Biology: the nerve impulse. A stimulus at the cell body starts an action potential that travels down the axon.
// With myelin it jumps from node to node (saltatory conduction, much faster). The graph shows the membrane
// potential at the probe: rest −70 mV, threshold −55 mV, peak about +40 mV. Too weak a stimulus: nothing.
import * as THREE from 'three';
import { createStage, makeLabel, clearGroup } from '../stage.js';
import { potential, phaseAt, REST, THRESHOLD, PEAK, UNDERSHOOT } from '../bio/neuron.js';
import { html } from '../ui.js';

const AXON_START = -3.4;
const AXON_END = 5.6;
const NODES = [-2.2, -0.6, 1, 2.6, 4.2];
const PROBE_X = 1;

export function mountNeuron(root) {
  root.innerHTML = html`
    <div class="viewport" data-viewport></div>
    <aside class="panel">
      <h2>Nerve Impulse</h2>
      <p class="lede">A neuron at rest is <b>−70 mV</b> inside. A strong enough stimulus opens Na⁺ channels: sodium rushes in and the inside flips positive (the <b>action potential</b>). K⁺ then flows out to reset it. The spike travels along the axon. It is <b>all-or-none</b>: below the threshold, nothing happens; above it, always the same size.</p>

      <label class="slider-row wide"><span>Stimulus</span><input type="range" min="2" max="30" step="1" value="20" data-kick><output data-kick-out>+20 mV</output></label>
      <label class="check"><input type="checkbox" data-myelin checked> Myelin sheath (insulation)</label>
      <div class="btn-row"><button class="btn" data-fire>⚡ Stimulate</button></div>

      <h3>Membrane potential at the probe</h3>
      <div class="timing" data-graph></div>
      <div class="notice" data-msg>Press <b>Stimulate</b>.</div>
    </aside>
  `;

  const $ = (sel) => root.querySelector(sel);
  const stage = createStage($('[data-viewport]'), { cameraPosition: [0.6, 2.5, 11.5], axes: false, grid: false });
  stage.controls.target.set(0.6, 0, 0);
  const scene = stage.scene;
  const state = { kick: 20, myelin: true, t: -1, firing: false, front: AXON_START, trace: [] };
  const sheath = new THREE.Group();
  scene.add(sheath);

  // Cell body with dendrites, the axon, and the axon terminals.
  const soma = new THREE.Mesh(new THREE.SphereGeometry(0.9, 32, 24), new THREE.MeshStandardMaterial({ color: 0xc084fc, roughness: 0.5 }));
  soma.position.x = -4.2;
  const nucleus = new THREE.Mesh(new THREE.SphereGeometry(0.35, 20, 14), new THREE.MeshStandardMaterial({ color: 0x6d28d9 }));
  nucleus.position.set(-4.3, 0.1, 0.5);
  scene.add(soma, nucleus);
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 2 + (i / 5) * Math.PI;
    const pts = [new THREE.Vector3(-4.2 + Math.cos(a) * 0.8, Math.sin(a) * 0.8, 0), new THREE.Vector3(-4.2 + Math.cos(a) * 1.8, Math.sin(a) * 1.8, (i % 2 ? 0.4 : -0.4)), new THREE.Vector3(-4.2 + Math.cos(a + 0.2) * 2.4, Math.sin(a + 0.2) * 2.4, 0)];
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.07, 6), soma.material));
  }
  const axon = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, AXON_END - AXON_START, 20), new THREE.MeshStandardMaterial({ color: 0xa78bfa, roughness: 0.4 }));
  axon.rotation.z = Math.PI / 2;
  axon.position.x = (AXON_START + AXON_END) / 2;
  scene.add(axon);
  for (let i = 0; i < 4; i++) {
    const end = new THREE.Vector3(AXON_END + 0.9, (i - 1.5) * 0.55, 0);
    const pts = [new THREE.Vector3(AXON_END, 0, 0), new THREE.Vector3(AXON_END + 0.5, (i - 1.5) * 0.3, 0), end];
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.06, 6), axon.material));
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), axon.material);
    knob.position.copy(end);
    scene.add(knob);
  }
  scene.add(
    makeLabel('cell body', new THREE.Vector3(-4.2, -1.3, 0), 0xd8b4fe, 'chart-label'),
    makeLabel('axon terminals', new THREE.Vector3(AXON_END + 0.9, -1.3, 0), 0xd8b4fe, 'chart-label'),
  );
  const probe = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  probe.rotation.x = Math.PI;
  probe.position.set(PROBE_X, 0.65, 0);
  probe.add(makeLabel('probe', new THREE.Vector3(0, -0.4, 0), 0xffffff, 'idx-label'));
  scene.add(probe);

  // The travelling impulse: a glowing band, plus Na⁺ (in) and K⁺ (out) dots near it.
  const pulse = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.5, 20), new THREE.MeshBasicMaterial({ color: 0xfde047, transparent: true, opacity: 0.85 }));
  pulse.rotation.z = Math.PI / 2;
  pulse.visible = false;
  scene.add(pulse);
  const ions = Array.from({ length: 12 }, (_, i) => {
    const na = i % 2 === 0;
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: na ? 0xfb923c : 0x38bdf8 }));
    m.userData = { na, a: (i / 12) * Math.PI * 2 };
    m.visible = false;
    scene.add(m);
    return m;
  });
  // Ion labels ride along with the impulse.
  const naLabel = makeLabel('Na⁺ in', new THREE.Vector3(), 0xfb923c, 'idx-label');
  const kLabel = makeLabel('K⁺ out', new THREE.Vector3(), 0x38bdf8, 'idx-label');
  naLabel.visible = kLabel.visible = false;
  scene.add(naLabel, kLabel);

  function buildSheath() {
    clearGroup(sheath);
    if (!state.myelin) return;
    const edges = [AXON_START, ...NODES, AXON_END];
    for (let i = 0; i < edges.length - 1; i++) {
      const a = edges[i] + 0.1;
      const b = edges[i + 1] - 0.1;
      const s = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, b - a - 0.5, 6, 16), new THREE.MeshStandardMaterial({ color: 0xf1f5f9, transparent: true, opacity: 0.55, roughness: 0.6 }));
      s.rotation.z = Math.PI / 2;
      s.position.x = (a + b) / 2;
      sheath.add(s);
    }
  }

  function drawGraph() {
    const W = 300;
    const H = 150;
    const tMax = 6;
    const y = (v) => ((PEAK + 10 - v) / (PEAK + 10 - (UNDERSHOOT - 5))) * H;
    const x = (t) => (t / tMax) * W;
    const line = (v, cls, label) => `<line x1="0" x2="${W}" y1="${y(v)}" y2="${y(v)}" class="${cls}"/><text x="${W - 2}" y="${y(v) - 3}" text-anchor="end" class="tlabel">${label}</text>`;
    const d = state.trace.map(([t, v], i) => `${i ? 'L' : 'M'}${x(t).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    $('[data-graph]').innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Membrane potential graph">
      ${line(REST, 'edge', 'rest −70')}${line(THRESHOLD, 'thresh', 'threshold −55')}${line(0, 'edge', '0 mV')}
      <path d="${d}" class="q"/></svg>`;
  }

  // Impulse speed along the axon (world units per second of animation): myelin jumps, bare axon crawls.
  function frontAt(t) {
    if (state.myelin) {
      const hops = Math.floor(t / 0.35);
      return [AXON_START, ...NODES, AXON_END][Math.min(hops, NODES.length + 1)];
    }
    return AXON_START + t * 1.3;
  }

  $('[data-kick]').addEventListener('input', (e) => {
    state.kick = Number(e.target.value);
    $('[data-kick-out]').textContent = `+${state.kick} mV`;
  });
  $('[data-myelin]').addEventListener('change', (e) => { state.myelin = e.target.checked; buildSheath(); });
  $('[data-fire]').addEventListener('click', () => {
    state.t = 0;
    state.firing = true;
    state.trace = [];
    state.arrival = null;
  });

  stage.onFrame((dt) => {
    if (!state.firing) return;
    state.t += dt;
    const fires = REST + state.kick >= THRESHOLD;
    const front = fires ? frontAt(state.t) : AXON_START;
    pulse.visible = fires && front < AXON_END;
    pulse.position.x = front;
    naLabel.visible = kLabel.visible = pulse.visible;
    naLabel.position.set(front - 0.2, 0.95, 0);
    kLabel.position.set(front + 0.45, -0.95, 0);
    ions.forEach((m) => {
      m.visible = pulse.visible;
      const a = m.userData.a + state.t * 3;
      const r = m.userData.na ? 0.55 - 0.3 * ((state.t * 2) % 1) : 0.25 + 0.3 * ((state.t * 2) % 1);
      m.position.set(front + (m.userData.na ? -0.15 : 0.25), Math.cos(a) * r, Math.sin(a) * r);
    });
    // The probe sees the spike when the front reaches it; potential() runs in ms, the animation in slow motion.
    if (fires && state.arrival === null && front >= PROBE_X) state.arrival = state.t;
    const local = fires ? (state.arrival === null ? -1 : (state.t - state.arrival) * 4) : state.t * 4;
    const v = potential(local, state.kick);
    state.trace.push([Math.min(6, state.t * (fires ? 1.6 : 4)), v]);
    drawGraph();
    $('[data-msg]').innerHTML = `${phaseAt(local, state.kick)}.` + (fires && front >= AXON_END ? ` Reached the terminals ${state.myelin ? 'quickly by <b>jumping node to node</b>' : 'slowly, crawling along the bare axon'}.` : '');
    if (state.t > 7) state.firing = false;
  });

  buildSheath();
  drawGraph();
  return () => stage.dispose();
}
