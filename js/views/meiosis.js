// Biology: meiosis. One diploid cell (2n = 4) makes four haploid cells (n = 2), all different: homologous pairs
// swap pieces (crossing over) and then are split up in meiosis I; sister chromatids are split in meiosis II.
import * as THREE from 'three';
import { createStage } from '../stage.js';
import { MEIOSIS, meiosisCounts } from '../bio/processes.js';
import { html } from '../ui.js';

// Two homologous pairs; in each pair one chromosome came from mum (darker) and one from dad (lighter).
const PAIRS = [
  { len: 1.1, y: 0.8, colors: [0x7c3aed, 0xf472b6] },
  { len: 0.65, y: -0.8, colors: [0x0891b2, 0x86efac] },
];
const smooth = (f) => f * f * (3 - 2 * f);
const CELL_R = [3, 1.9, 1.25];

export function mountMeiosis(root) {
  root.innerHTML = html`
    <div class="viewport" data-viewport></div>
    <aside class="panel">
      <h2>Meiosis</h2>
      <p class="lede">Meiosis makes <b>sex cells</b> (eggs and sperm). It divides <b>twice</b>, so one cell becomes four, each with <b>half</b> the chromosomes. Pairs of chromosomes (one from each parent) swap pieces first, so every sex cell is genetically different. That is why siblings aren't identical.</p>

      <div class="tabs four" data-stages>${MEIOSIS.map((s, i) => `<button data-stage="${i}">${s.name}</button>`).join('')}</div>
      <label class="slider-row wide"><span>Timeline</span><input type="range" min="0" max="6.99" step="0.01" value="0" data-t><output data-t-out></output></label>
      <div class="btn-row"><button class="btn" data-play>▶ Play</button></div>

      <div class="notice" data-msg></div>
      <div class="readout" data-counts></div>
      <table class="stats compare"><thead><tr><th></th><th>Mitosis</th><th>Meiosis</th></tr></thead><tbody>
        <tr><td>Divisions</td><td>1</td><td>2</td></tr>
        <tr><td>Cells made</td><td>2</td><td>4</td></tr>
        <tr><td>Chromosomes</td><td>same (2n)</td><td>half (n)</td></tr>
        <tr><td>Identical?</td><td>yes</td><td>no</td></tr>
        <tr><td>Used for</td><td>growth, repair</td><td>eggs, sperm</td></tr>
      </tbody></table>
    </aside>
  `;

  const $ = (sel) => root.querySelector(sel);
  const stage = createStage($('[data-viewport]'), { cameraPosition: [0, 0.5, 9.5], axes: false, grid: false });
  const scene = stage.scene;
  const state = { t: 0, playing: false };
  const cellMat = new THREE.MeshStandardMaterial({ color: 0x86efac, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide });
  const cells = Array.from({ length: 4 }, () => {
    const c = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), cellMat);
    scene.add(c);
    return c;
  });

  // Each chromatid is two halves (top and bottom), so crossing over can swap a bottom half between partners.
  const chromatids = [];
  PAIRS.forEach((pair, p) => {
    [0, 1].forEach((h) => {
      [0, 1].forEach((j) => {
        const halves = [0, 1].map(() => new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 1, 6, 12), new THREE.MeshStandardMaterial({ color: pair.colors[h], roughness: 0.4 })));
        const g = new THREE.Group();
        halves.forEach((m, k) => { m.position.y = (k ? -0.5 : 0.5) * pair.len * 0.55; m.scale.y = pair.len * 0.5; g.add(m); });
        g.userData = { p, h, j, halves };
        scene.add(g);
        chromatids.push(g);
      });
    });
  });

  // Where each chromatid is at keyframe t = 0 … 7 (meiosis I at the centre, then two cells, then four).
  function at(g, k) {
    const { p, h, j } = g.userData;
    const pair = PAIRS[p];
    const hs = h ? 1 : -1; // which homolog: goes left (−) or right (+) in meiosis I
    const js = j ? 1 : -1; // which sister: goes up (+) or down (−) in meiosis II
    switch (k) {
      case 0: return [hs * 0.9 + js * 0.12 + (p ? 0.5 : -0.4), pair.y * 1.2 + h * 0.3, 0];
      case 1: return [hs * 0.28 + js * 0.11, pair.y, 0]; // pairs side by side (synapsis)
      case 2: return [hs * 0.28 + js * 0.11, pair.y, 0]; // metaphase I: pairs on the equator
      case 3: return [hs * 1.9 + js * 0.11, pair.y * 0.8, 0]; // anaphase I: homologs separate
      case 4: return [hs * 2.4 + (p ? 0.65 : -0.65), js * 0.12, 0]; // metaphase II: in each cell, line up
      case 5: return [hs * 2.4 + (p ? 0.65 : -0.65), js * 1.2, 0]; // anaphase II: sisters separate
      default: return [hs * 2.4 + (p ? 0.6 : -0.6), js * 1.45, 0]; // telophase II: four cells
    }
  }
  // Timeline keyframes: 0 → 1 → 1 (crossing over) → 2 → 3 → 4 → 5 → 6.
  const KEY = [0, 1, 2, 3, 3, 4, 5, 6];

  function draw() {
    const t = state.t;
    const i = Math.min(6, Math.floor(t));
    const f = smooth(t - i);
    chromatids.forEach((g) => {
      const a = at(g, KEY[i]);
      const b = at(g, KEY[i + 1]);
      g.position.set(...a.map((v, k) => v + (b[k] - v) * f));
      // Meiosis II chromosomes turn sideways so sisters can be pulled up and down.
      g.rotation.z = t < 3.5 ? 0 : t < 4 ? smooth((t - 3.5) * 2) * (Math.PI / 2) : Math.PI / 2;
      // Crossing over during prophase I: the inner chromatids of each pair swap their bottom halves.
      const { p, h, j, halves } = g.userData;
      const inner = (h === 0 && j === 1) || (h === 1 && j === 0);
      const swapped = inner && t > 0.6;
      halves[1].material.color.setHex(PAIRS[p].colors[swapped ? 1 - h : h]);
    });
    // Cells: one, then two side by side, then each splits top / bottom.
    const two = t >= 3 ? smooth(Math.min(1, (t - 3) / 0.8)) : 0;
    const four = t >= 6 ? smooth(Math.min(1, (t - 6) / 0.8)) : 0;
    cells.forEach((c, k) => {
      const side = k < 2 ? -1 : 1;
      const up = k % 2 ? 1 : -1;
      c.position.set(side * 2.4 * two, up * 1.45 * four, 0);
      c.scale.setScalar(four > 0 ? CELL_R[1] + (CELL_R[2] - CELL_R[1]) * four : CELL_R[0] + (CELL_R[1] - CELL_R[0]) * two);
    });
    const idx = Math.min(MEIOSIS.length - 1, Math.floor(t));
    const st = MEIOSIS[idx];
    root.querySelectorAll('[data-stage]').forEach((b) => b.setAttribute('aria-selected', String(Number(b.dataset.stage) === idx)));
    $('[data-t-out]').textContent = st.name;
    $('[data-msg]').innerHTML = `<b>${st.name}.</b> ${st.info}`;
    const c = meiosisCounts(t);
    const row = (k, v) => `<div class="row-between"><span>${k}</span><strong>${v}</strong></div>`;
    $('[data-counts]').innerHTML = row('Cells', c.cells) + row('Chromosomes in each cell', `${c.chromosomesPerCell} (${c.chromosomesPerCell === 4 ? '2n, diploid' : 'n, haploid'})`);
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
    state.t = Number(b.dataset.stage) + 0.7;
    $('[data-t]').value = state.t;
    draw();
  });
  $('[data-play]').addEventListener('click', () => {
    if (state.t >= 6.98) state.t = 0;
    state.playing = !state.playing;
    $('[data-play]').textContent = state.playing ? '❚❚ Pause' : '▶ Play';
  });
  stage.onFrame((dt) => {
    if (!state.playing) return;
    state.t = Math.min(6.99, state.t + dt * 0.33);
    $('[data-t]').value = state.t;
    if (state.t >= 6.99) {
      state.playing = false;
      $('[data-play]').textContent = '↺ Replay';
    }
    draw();
  });

  draw();
  return () => stage.dispose();
}
