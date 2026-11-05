// Biology: mitosis. Scrub or play the timeline: chromosomes condense, line up, split and end up in two identical
// daughter cells. The cell has 2n = 4 chromosomes (two pairs, two colours).
import * as THREE from 'three';
import { createStage } from '../stage.js';
import { STAGES, stageAt, counts } from '../bio/cellcycle.js';
import { html } from '../ui.js';

const CHROMOSOMES = [
  { color: 0xa78bfa, len: 1.1, y: 0.9, z: 0.3, start: [-0.4, 0.4, 0.2] },
  { color: 0xc4b5fd, len: 1.1, y: -0.3, z: -0.3, start: [0.5, -0.2, -0.3] },
  { color: 0x22d3ee, len: 0.65, y: 0.25, z: -0.5, start: [0.1, 0.6, -0.4] },
  { color: 0x67e8f9, len: 0.65, y: -1, z: 0.4, start: [-0.3, -0.5, 0.4] },
];
const smooth = (f) => f * f * (3 - 2 * f);

export function mountMitosis(root) {
  root.innerHTML = html`
    <div class="viewport" data-viewport></div>
    <aside class="panel">
      <h2>Mitosis</h2>
      <p class="lede">Mitosis is how one cell becomes <b>two identical cells</b>, for growth and repair. First the DNA is copied, so each chromosome becomes two <b>sister chromatids</b>. Then the cell pulls one copy of every chromosome to each side and splits down the middle.</p>

      <div class="tabs" data-stages>${STAGES.map((s, i) => `<button data-stage="${i}">${s.name}</button>`).join('')}</div>
      <label class="slider-row wide"><span>Timeline</span><input type="range" min="0" max="5.99" step="0.01" value="0" data-t><output data-t-out></output></label>
      <div class="btn-row"><button class="btn" data-play>▶ Play</button></div>

      <div class="notice" data-msg></div>
      <div class="readout" data-counts></div>
      <p class="hint">Mitosis keeps the chromosome number the same (4 → 4 + 4). Meiosis, which makes egg and sperm cells, halves it.</p>
    </aside>
  `;

  const $ = (sel) => root.querySelector(sel);
  const stage = createStage($('[data-viewport]'), { cameraPosition: [0, 1.5, 10], axes: false, grid: false });
  const scene = stage.scene;
  const state = { t: 0, playing: false };

  const cellMat = new THREE.MeshStandardMaterial({ color: 0x86efac, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide });
  const cells = [0, 1].map(() => {
    const c = new THREE.Mesh(new THREE.SphereGeometry(3, 48, 32), cellMat);
    scene.add(c);
    return c;
  });
  const envMat = () => new THREE.MeshStandardMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0.3, depthWrite: false });
  const envelope = new THREE.Mesh(new THREE.SphereGeometry(1.5, 32, 24), envMat());
  const daughterEnv = [0, 1].map(() => new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), envMat()));
  scene.add(envelope, ...daughterEnv);
  const centrosomes = [0, 1].map(() => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
    scene.add(m);
    return m;
  });

  // Each chromosome: two chromatids (capsules) that start together and are later pulled apart.
  const chromatids = CHROMOSOMES.flatMap((c, k) => [0, 1].map((j) => {
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(1, 1, 6, 12), new THREE.MeshStandardMaterial({ color: c.color, roughness: 0.4 }));
    m.userData = { k, j };
    scene.add(m);
    return m;
  }));
  const spindleGeom = new THREE.BufferGeometry();
  spindleGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(chromatids.length * 2 * 3), 3));
  const spindle = new THREE.LineSegments(spindleGeom, new THREE.LineBasicMaterial({ color: 0xfde68a, transparent: true, opacity: 0.6 }));
  scene.add(spindle);

  // Keyframes per chromatid at t = 0, 1, …, 6: [x, y, z, length, radius].
  function keyframes(c, j) {
    const side = j ? 1 : -1;
    const [sx, sy, sz] = c.start;
    return [
      [sx, sy, sz, c.len * 2.2, 0.035],
      [sx + side * 0.05, sy, sz, c.len * 2.2, 0.04],
      [sx * 1.4 + side * 0.13, sy * 1.4, sz, c.len, 0.12],
      [side * 0.13, c.y, c.z, c.len, 0.12],
      [side * 2.1, c.y * 0.7, c.z * 0.7, c.len, 0.11],
      [side * 2.1, c.y * 0.6, c.z * 0.6, c.len * 1.5, 0.07],
      [side * 2.7, c.y * 0.5, c.z * 0.5, c.len * 2, 0.04],
    ];
  }
  const frames = chromatids.map((m) => keyframes(CHROMOSOMES[m.userData.k], m.userData.j));

  function draw() {
    const t = state.t;
    const i = Math.min(5, Math.floor(t));
    const f = smooth(t - i);
    const lerp = (a, b) => a + (b - a) * f;
    const sp = spindleGeom.attributes.position;
    const poles = [new THREE.Vector3(), new THREE.Vector3()];
    // Centrosomes: start together above the nucleus, move to the poles in prophase, ride with the daughter cells.
    const poleX = t < 1 ? 0.3 : t < 2 ? 0.3 + 2.4 * smooth(t - 1) : t < 5 ? 2.7 : 2.7 + 0.5 * smooth(t - 5);
    const poleY = t < 1 ? 1.9 : t < 2 ? 1.9 * (1 - smooth(t - 1)) : 0;
    centrosomes.forEach((cs, k) => { cs.position.set((k ? 1 : -1) * poleX, poleY, 0); poles[k].copy(cs.position); });

    chromatids.forEach((m, n) => {
      const a = frames[n][i];
      const b = frames[n][i + 1];
      const [x, y, z, len, r] = a.map((v, k) => lerp(v, b[k]));
      m.position.set(x, y, z);
      m.scale.set(r, len / 2, r);
      // Thin threads tangle in interphase; condensed chromosomes stand upright.
      m.rotation.set(t < 2 ? (1 - smooth(Math.min(1, Math.max(0, t - 1)))) * (n * 1.3) : 0, 0, t < 2 ? (1 - smooth(Math.min(1, Math.max(0, t - 1)))) * (n * 0.7) : 0);
      const pole = poles[m.userData.j];
      sp.setXYZ(n * 2, pole.x, pole.y, pole.z);
      sp.setXYZ(n * 2 + 1, x, y, z);
    });
    sp.needsUpdate = true;
    spindle.visible = t > 2 && t < 4.6;
    spindle.material.opacity = 0.6 * Math.min(1, (t - 2) * 2) * Math.min(1, (4.6 - t) * 2);

    envelope.material.opacity = t < 1 ? 0.3 : t < 2 ? 0.3 * (1 - smooth(t - 1)) : 0;
    daughterEnv.forEach((e, k) => {
      e.position.set((k ? 1 : -1) * (t < 5 ? 2.1 : 2.1 + 0.6 * smooth(t - 5)), 0, 0);
      e.material.opacity = t < 4 ? 0 : 0.3 * Math.min(1, t - 4);
      e.visible = t >= 4;
    });
    // The cell stretches in anaphase/telophase, then pinches into two.
    const stretch = t < 3 ? 1 : t < 5 ? 1 + 0.25 * smooth(Math.min(1, (t - 3) / 2)) : 1.25;
    const apart = t < 5 ? 0 : 1.9 * smooth(t - 5);
    cells.forEach((c, k) => {
      c.position.x = (k ? 1 : -1) * apart;
      const s = t < 5 ? 1 : 1 - 0.3 * smooth(t - 5);
      c.scale.set(stretch * s, s, s);
    });

    const st = stageAt(t);
    const idx = STAGES.indexOf(st);
    root.querySelectorAll('[data-stage]').forEach((b) => b.setAttribute('aria-selected', String(Number(b.dataset.stage) === idx)));
    $('[data-t-out]').textContent = st.name;
    $('[data-msg]').innerHTML = `<b>${st.name}.</b> ${st.info}`;
    const cnt = counts(t);
    const row = (k, v) => `<div class="row-between"><span>${k}</span><strong>${v}</strong></div>`;
    $('[data-counts]').innerHTML = [row('Cells', cnt.cells), row(cnt.cells > 1 ? 'Chromosomes in each cell' : 'Chromosomes', cnt.chromosomes), row('DNA copies (chromatids)', cnt.chromatids)].join('');
  }

  $('[data-t]').addEventListener('input', (e) => {
    state.t = Number(e.target.value);
    state.playing = false;
    $('[data-play]').textContent = '▶ Play';
    draw();
  });
  $('[data-stages]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-stage]');
    if (!b) return;
    state.t = Number(b.dataset.stage) + 0.6;
    $('[data-t]').value = state.t;
    draw();
  });
  $('[data-play]').addEventListener('click', () => {
    if (state.t >= 5.98) state.t = 0;
    state.playing = !state.playing;
    $('[data-play]').textContent = state.playing ? '❚❚ Pause' : '▶ Play';
  });

  stage.onFrame((dt) => {
    if (!state.playing) return;
    state.t = Math.min(5.99, state.t + dt * 0.35);
    $('[data-t]').value = state.t;
    if (state.t >= 5.99) {
      state.playing = false;
      $('[data-play]').textContent = '↺ Replay';
    }
    draw();
  });

  draw();
  return () => stage.dispose();
}
