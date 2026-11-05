// Algorithms: binary vs linear search as a game. The boxes are sorted but closed. Open one: if it is too small,
// it and everything to its left sink away, because the target can't be there. That is binary search.
import * as THREE from 'three';
import { createStage, makeLabel, clearGroup } from '../stage.js';
import { linearSteps, binarySteps, worstBinary } from '../algo/search.js';
import { interact } from '../interact.js';
import { html } from '../ui.js';

const SPAN = 13;

export function mountSearch(root) {
  root.innerHTML = html`
    <div class="viewport" data-viewport></div>
    <aside class="panel">
      <h2>Binary Search</h2>
      <p class="lede">The boxes hold numbers in <b>sorted order</b>, but they are closed. Linear search opens them one by one. Binary search opens the <b>middle</b> one: if it is too small, the whole left half can be thrown away. Each guess halves what is left, so 1,000,000 items need only 20 guesses.</p>

      <div class="target-card">Find <b data-target>?</b></div>
      <div class="readout">
        <div class="row-between"><span>Your guesses</span><strong data-guesses>0</strong></div>
        <div class="row-between"><span>Binary search never needs more than</span><strong data-worst>5</strong></div>
      </div>
      <div class="notice" data-msg></div>

      <h3>Boxes</h3>
      <div class="segmented" role="radiogroup">
        <label><input type="radio" name="n" value="15"> 15</label>
        <label><input type="radio" name="n" value="31" checked> 31</label>
        <label><input type="radio" name="n" value="63"> 63</label>
      </div>
      <div class="btn-row">
        <button class="btn" data-new>New game</button>
      </div>
      <div class="btn-row">
        <button class="btn secondary" data-watch="binary">Watch binary</button>
        <button class="btn secondary" data-watch="linear">Watch linear</button>
      </div>
    </aside>
  `;

  const $ = (sel) => root.querySelector(sel);
  const stage = createStage($('[data-viewport]'), { cameraPosition: [0, 5, 12], axes: false, grid: false });
  stage.controls.target.set(0, 0.6, 0);
  const shelf = new THREE.Group();
  stage.scene.add(shelf);
  const state = { n: 31, values: [], target: 0, boxes: [], guesses: 0, lo: 0, hi: 0, auto: null, done: false };

  const floor = new THREE.Mesh(new THREE.BoxGeometry(SPAN + 1, 0.12, 1.6), new THREE.MeshStandardMaterial({ color: 0x1d1a44, roughness: 0.8 }));
  floor.position.y = -0.06;
  stage.scene.add(floor);
  const markers = { lo: makeLabel('lo', new THREE.Vector3(), 0x5eead4, 'chart-label'), hi: makeLabel('hi', new THREE.Vector3(), 0xf472b6, 'chart-label') };
  stage.scene.add(markers.lo, markers.hi);

  function newGame() {
    clearGroup(shelf);
    // Sorted, distinct values with gaps, so the target is not just "index + 1".
    const pool = Array.from({ length: 99 }, (_, i) => i + 1).sort(() => Math.random() - 0.5).slice(0, state.n).sort((a, b) => a - b);
    state.values = pool;
    state.target = pool[Math.floor(Math.random() * pool.length)];
    state.guesses = 0;
    state.lo = 0;
    state.hi = state.n - 1;
    state.auto = null;
    state.done = false;
    const w = SPAN / state.n;
    state.boxes = pool.map((v, i) => {
      const box = new THREE.Mesh(new THREE.BoxGeometry(w * 0.86, 0.9, 0.9), new THREE.MeshStandardMaterial({ color: 0x6d5bd0, roughness: 0.4 }));
      box.position.set(-SPAN / 2 + (i + 0.5) * w, 0.45, 0);
      box.userData = { i, y: 0.45, open: false };
      const label = makeLabel('?', new THREE.Vector3(0, 0, 0.5), 0xffffff, state.n > 31 ? 'box-label small' : 'box-label');
      box.add(label);
      if (state.n <= 31 || i % 2 === 0) box.add(makeLabel(String(i), new THREE.Vector3(0, -0.75, 0.5), 0x6b6f9e, 'idx-label'));
      shelf.add(box);
      return { box, label };
    });
    $('[data-target]').textContent = state.target;
    $('[data-guesses]').textContent = 0;
    $('[data-worst]').textContent = worstBinary(state.n);
    setMsg(`Click a box to open it. Tip: start in the <b>middle</b>.`);
    placeMarkers();
  }

  const setMsg = (m) => { $('[data-msg]').innerHTML = m; };

  function placeMarkers() {
    const w = SPAN / state.n;
    markers.lo.position.set(-SPAN / 2 + (state.lo + 0.5) * w, 1.5, 0);
    markers.hi.position.set(-SPAN / 2 + (state.hi + 0.5) * w, 1.5, 0);
    markers.lo.visible = markers.hi.visible = !state.done;
  }

  // Open box i: reveal it, then sink everything that can no longer hold the target.
  function open(i) {
    if (state.done) return;
    const { box, label } = state.boxes[i];
    if (box.userData.open || box.userData.y < 0) return;
    state.guesses += 1;
    $('[data-guesses]').textContent = state.guesses;
    const v = state.values[i];
    box.userData.open = true;
    label.element.textContent = v;
    if (v === state.target) {
      box.material.color.setHex(0x4ade80);
      box.material.emissive.setHex(0x14532d);
      box.userData.y = 0.75;
      state.done = true;
      const worst = worstBinary(state.n);
      setMsg(state.guesses <= worst ? `🎉 Found <b>${v}</b> in ${state.guesses} guesses. That is binary-search fast!` : `Found <b>${v}</b> in ${state.guesses} guesses. Binary search never needs more than ${worst}: try always opening the middle box.`);
    } else {
      const tooSmall = v < state.target;
      if (tooSmall) state.lo = Math.max(state.lo, i + 1);
      else state.hi = Math.min(state.hi, i - 1);
      state.boxes.forEach(({ box: b }, k) => {
        if (k < state.lo || k > state.hi) {
          b.userData.y = -0.2;
          b.material.color.setHex(0x2a2752);
        }
      });
      box.material.color.setHex(0xf472b6);
      const left = state.hi - state.lo + 1;
      setMsg(`<b>${v}</b> is too ${tooSmall ? 'small' : 'big'}, so the target is to the <b>${tooSmall ? 'right' : 'left'}</b>. ${left} box${left === 1 ? '' : 'es'} left.`);
    }
    placeMarkers();
  }

  function watch(kind) {
    newGameKeepTarget();
    const steps = kind === 'binary' ? binarySteps(state.values, state.target) : linearSteps(state.values, state.target);
    state.auto = { steps, k: 0, clock: 0.3, kind };
    setMsg(`Watching <b>${kind} search</b> look for ${state.target}…`);
  }

  // Same numbers and target, all boxes closed again (so the two searches can be compared fairly).
  function newGameKeepTarget() {
    const { values, target } = state;
    newGame();
    state.values = values;
    state.target = target;
    $('[data-target]').textContent = target;
  }

  root.querySelectorAll('input[name=n]').forEach((r) => r.addEventListener('change', () => {
    state.n = Number(r.value);
    newGame();
  }));
  $('[data-new]').addEventListener('click', newGame);
  root.querySelectorAll('[data-watch]').forEach((b) => b.addEventListener('click', () => watch(b.dataset.watch)));

  const stopInteract = interact(stage, {
    pick: () => state.boxes.map((b) => b.box),
    cursor: 'pointer',
    onClick: (hit) => { if (!state.auto) open(hit.object.userData.i); },
  });

  stage.onFrame((dt) => {
    for (const { box } of state.boxes) box.position.y += (box.userData.y - box.position.y) * Math.min(1, dt * 8);
    const a = state.auto;
    if (!a) return;
    a.clock -= dt;
    if (a.clock > 0) return;
    a.clock = a.kind === 'linear' ? 0.25 : 0.8;
    if (a.k < a.steps.length) open(a.steps[a.k++].i);
    else {
      state.auto = null;
      setMsg(`${a.kind === 'binary' ? 'Binary' : 'Linear'} search took <b>${a.steps.length}</b> look${a.steps.length === 1 ? '' : 's'}. Now try the other one on the same boxes.`);
    }
  });

  newGame();
  return () => {
    stopInteract();
    stage.dispose();
  };
}
