// Biology: DNA replication. Helicase unzips the double helix at the replication fork; DNA polymerase builds a new
// partner for each old strand. The leading strand grows smoothly, the lagging strand in Okazaki fragments, and
// each finished molecule keeps one old (violet) and one new (green) strand: semi-conservative replication.
import * as THREE from 'three';
import { createStage, makeLabel, clearGroup, setVisible } from '../stage.js';
import { complement, clean } from '../bio/dna.js';
import { fragments, OKAZAKI } from '../bio/replication.js';
import { html } from '../ui.js';

const STEP = 0.42;
const BASE_COLOR = { A: 0xef4444, T: 0xfacc15, G: 0x22c55e, C: 0x3b82f6 };
const OLD = 0xa78bfa;
const NEW = 0x4ade80;

export function mountReplication(root) {
  root.innerHTML = html`
    <div class="viewport" data-viewport></div>
    <aside class="panel">
      <h2>DNA Replication</h2>
      <p class="lede">Before a cell divides it copies all its DNA. <b>Helicase</b> unzips the two strands; <b>DNA polymerase</b> reads each old strand and adds matching bases (A–T, G–C) to build a new one. Polymerase can only build in one direction, so one strand is made smoothly (<b>leading</b>) and the other in short pieces (<b>lagging</b>, Okazaki fragments) that <b>ligase</b> glues together.</p>

      <label class="field">Starting DNA (top strand)
        <input type="text" data-seq value="ATGCCGTATAGCTTAGGCATCGAT" maxlength="36">
      </label>
      <div class="btn-row">
        <button class="btn" data-play>▶ Replicate</button>
        <button class="btn secondary" data-reset>Reset</button>
      </div>
      <label class="slider-row wide"><span>Speed</span><input type="range" min="0.5" max="4" step="0.5" value="1.5" data-speed><output data-speed-out>1.5×</output></label>

      <div class="notice" data-msg></div>
      <div class="legend-row"><span class="swatch" style="--c:#a78bfa"></span> old strand <span class="swatch" style="--c:#4ade80"></span> new strand</div>
    </aside>
  `;

  const $ = (sel) => root.querySelector(sel);
  const stage = createStage($('[data-viewport]'), { cameraPosition: [0, 0, 13], axes: false, grid: false });
  const group = new THREE.Group();
  stage.scene.add(group);
  const helicase = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.16, 12, 24), new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 }));
  helicase.rotation.y = Math.PI / 2;
  helicase.add(makeLabel('helicase', new THREE.Vector3(0, 0.95, 0), 0xfacc15, 'chart-label'));
  stage.scene.add(helicase);
  const state = { seq: '', fork: 0, playing: false, speed: 1.5, parts: null, done: false };

  const xOf = (i) => (i - (state.seq.length - 1) / 2) * STEP;

  function base(letter, color) {
    const g = new THREE.Group();
    const bar = new THREE.Mesh(new THREE.BoxGeometry(STEP * 0.75, 0.42, 0.18), new THREE.MeshStandardMaterial({ color: BASE_COLOR[letter], roughness: 0.4 }));
    const back = new THREE.Mesh(new THREE.BoxGeometry(STEP, 0.12, 0.22), new THREE.MeshStandardMaterial({ color, roughness: 0.4 }));
    back.position.y = 0.27;
    g.add(bar, back);
    if (state.seq.length <= 30) g.add(makeLabel(letter, new THREE.Vector3(0, 0, 0.15), 0x0b0720, 'idx-label base'));
    return { g, back };
  }

  function build() {
    clearGroup(group);
    state.seq = clean($('[data-seq]').value).slice(0, 36) || 'ATGC';
    $('[data-seq]').value = state.seq;
    const top = state.seq;
    const bottom = complement(top);
    const n = top.length;
    // Old top strand (backbone above, bases pointing down) and old bottom strand (mirrored).
    const mk = (letters, color, flip) => [...letters].map((b, i) => {
      const { g } = base(b, color);
      if (flip) g.rotation.z = Math.PI;
      g.position.x = xOf(i);
      group.add(g);
      return g;
    });
    state.parts = {
      oldTop: mk(top, OLD, false),
      oldBottom: mk(bottom, OLD, true),
      newTop: mk(bottom, NEW, true), // pairs with the old top strand (leading strand)
      newBottom: mk(top, NEW, false), // pairs with the old bottom strand (lagging strand)
    };
    state.parts.newTop.concat(state.parts.newBottom).forEach((g) => setVisible(g, false));
    state.fork = -1;
    state.done = false;
    state.playing = false;
    $('[data-play]').textContent = '▶ Replicate';
    stage.camera.position.set(0, 0, Math.max(10, n * STEP * 1.15));
    stage.controls.target.set(0, 0, 0);
    stage.saveHome();
    layout();
    $('[data-msg]').innerHTML = 'One double helix (drawn flat here so the strands are easy to read). Press <b>Replicate</b>.';
  }

  // Place everything for the current fork position: left of the fork the strands are apart and being copied.
  function layout() {
    const n = state.seq.length;
    const f = state.fork;
    const open = (i) => Math.max(0, Math.min(1, f - i)); // 0 = still zipped, 1 = fully apart
    const p = state.parts;
    for (let i = 0; i < n; i++) {
      const o = open(i);
      p.oldTop[i].position.y = 0.32 + o * 1.5;
      p.oldBottom[i].position.y = -0.32 - o * 1.5;
      // Leading strand: each new base appears right behind the fork.
      const leadOn = o >= 1;
      setVisible(p.newTop[i], leadOn);
      p.newTop[i].position.y = 0.32 + 1.5 - 0.64;
    }
    // Lagging strand: whole fragments appear only once the fork has passed their far end.
    const made = new Set();
    for (const [a, b] of fragments(n, Math.floor(f))) for (let i = a; i < b; i++) made.add(i);
    for (let i = 0; i < n; i++) {
      setVisible(p.newBottom[i], made.has(i));
      p.newBottom[i].position.y = -0.32 - 1.5 + 0.64;
      // Fragments are slightly separated until ligase joins them at the end.
      const gap = state.done ? 0 : (Math.floor(i / OKAZAKI) - (n / OKAZAKI) / 2) * 0.06;
      p.newBottom[i].position.x = xOf(i) + gap;
    }
    helicase.visible = f >= 0 && f < n;
    helicase.position.set(xOf(Math.min(n - 1, Math.max(0, f))) + STEP / 2, 0, 0);
  }

  function finish() {
    state.done = true;
    state.playing = false;
    layout();
    // Pull the two daughter molecules apart so each one is visibly half old, half new.
    const p = state.parts;
    p.oldTop.forEach((g) => { g.position.y += 0.9; });
    p.newTop.forEach((g) => { g.position.y += 0.9; });
    p.oldBottom.forEach((g) => { g.position.y -= 0.9; });
    p.newBottom.forEach((g) => { g.position.y -= 0.9; });
    $('[data-play]').textContent = '↺ Again';
    $('[data-msg]').innerHTML = '✓ Two identical DNA molecules. Each has <b>one old strand (violet) and one new strand (green)</b>: that is why replication is called <b>semi-conservative</b>. Ligase has sealed the Okazaki fragments.';
  }

  $('[data-play]').addEventListener('click', () => {
    if (state.done) build();
    state.playing = !state.playing;
    $('[data-play]').textContent = state.playing ? '❚❚ Pause' : '▶ Continue';
  });
  $('[data-reset]').addEventListener('click', build);
  $('[data-seq]').addEventListener('change', build);
  $('[data-speed]').addEventListener('input', (e) => {
    state.speed = Number(e.target.value);
    $('[data-speed-out]').textContent = `${state.speed}×`;
  });

  stage.onFrame((dt) => {
    helicase.rotation.x += dt * 4;
    if (!state.playing) return;
    const n = state.seq.length;
    state.fork = Math.min(n + 1, state.fork + dt * state.speed * 2);
    layout();
    const f = Math.floor(state.fork);
    if (f < n) {
      const frags = fragments(n, f).length;
      $('[data-msg]').innerHTML = `Fork at base ${Math.max(1, f)} of ${n}. <b>Leading strand</b> (top): one base at a time. <b>Lagging strand</b> (bottom): ${frags} Okazaki fragment${frags === 1 ? '' : 's'} so far.`;
    } else if (!state.done) finish();
  });

  build();
  return () => stage.dispose();
}
