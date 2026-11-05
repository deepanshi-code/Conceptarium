// Operating systems: page replacement. Memory has a few frames; programs ask for pages in a sequence. Each column is
// one request: green = the page was already in memory (hit), red = it had to be loaded (page fault).
import * as THREE from 'three';
import { createStage, makeLabel, clearGroup, setVisible } from '../stage.js';
import { PAGE_ALGOS, simulate } from '../os/paging.js';
import { html } from '../ui.js';

const STEP = 0.72;
const CELL = 0.6;
const PRESETS = {
  textbook: '7 0 1 2 0 3 0 4 2 3 0 3 2 1 2 0 1 7 0 1',
  belady: '1 2 3 4 1 2 5 1 2 3 4 5',
  loop: '1 2 3 4 1 2 3 4 1 2 3 4',
};

export function mountPaging(root) {
  root.innerHTML = html`
    <div class="viewport" data-viewport></div>
    <aside class="panel">
      <h2>Page Replacement</h2>
      <p class="lede">RAM holds only a few <b>frames</b>. A program asks for pages one after another. If the page is already in RAM it is a <b>hit</b>; if not, it is a <b>page fault</b> and some page must be thrown out. Which one to throw out is the whole game.</p>

      <h3>Algorithm</h3>
      <div class="tabs" data-algos>${Object.entries(PAGE_ALGOS).map(([k, a]) => `<button data-algo="${k}" title="${a.long}">${a.name}</button>`).join('')}</div>
      <p class="hint" data-algo-long></p>

      <h3>Requests</h3>
      <label class="field">Page sequence
        <input type="text" data-refs value="${PRESETS.textbook}">
      </label>
      <div class="op-group">
        <button class="btn small secondary" data-preset="textbook">Textbook</button>
        <button class="btn small secondary" data-preset="belady">Belady’s anomaly</button>
        <button class="btn small secondary" data-preset="loop">Loop</button>
      </div>
      <label class="slider-row wide"><span>Frames</span><input type="range" min="1" max="6" step="1" value="3" data-frames><output data-frames-out>3</output></label>
      <div class="btn-row">
        <button class="btn" data-play>▶ Replay</button>
        <button class="btn secondary" data-instant>Show all</button>
      </div>

      <h3>Compare</h3>
      <table class="stats"><thead><tr><th>algorithm</th><th>faults</th><th>with 1 more frame</th></tr></thead><tbody data-compare></tbody></table>
      <p class="hint" data-insight></p>
    </aside>
  `;

  const $ = (sel) => root.querySelector(sel);
  const stage = createStage($('[data-viewport]'), { cameraPosition: [0, 1, 14], axes: false, grid: false });
  const grid = new THREE.Group();
  stage.scene.add(grid);
  const state = { algo: 'fifo', frames: 3, refs: [], columns: [], shown: 0, clock: 0, playing: true };

  function parseRefs() {
    const refs = $('[data-refs]').value.split(/[\s,]+/).filter(Boolean).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 99).slice(0, 30);
    $('[data-refs]').classList.toggle('invalid', refs.length === 0);
    return refs;
  }

  function build() {
    clearGroup(grid);
    state.refs = parseRefs();
    if (!state.refs.length) return;
    const { steps } = simulate(state.refs, state.frames, state.algo);
    const n = steps.length;
    const x0 = -((n - 1) * STEP) / 2;
    const yOf = (f) => (state.frames - 1 - f) * CELL - (state.frames * CELL) / 2;
    // Frame row labels.
    for (let f = 0; f < state.frames; f++) {
      const l = makeLabel(`frame ${f + 1}`, new THREE.Vector3(x0 - 0.6, yOf(f), 0), 0x8a8fb8, 'chart-label');
      l.center.set(1, 0.5);
      grid.add(l);
    }
    state.columns = steps.map((s, t) => {
      const col = new THREE.Group();
      col.position.set(x0 + t * STEP, 0, 0);
      col.add(makeLabel(String(s.page), new THREE.Vector3(0, yOf(-1) + 0.15, 0), 0xffffff, 'box-label'));
      s.frames.forEach((p, f) => {
        if (p === null) return;
        const changed = !s.hit && f === s.slot;
        const used = s.hit && f === s.slot;
        const cell = new THREE.Mesh(new THREE.BoxGeometry(STEP * 0.88, CELL * 0.88, 0.4), new THREE.MeshStandardMaterial({
          color: changed ? 0xff4d6d : used ? 0x4ade80 : 0x2b2858, roughness: 0.45, emissive: changed ? 0x4a0b18 : used ? 0x0d3b20 : 0x000000,
        }));
        cell.position.y = yOf(f);
        cell.add(makeLabel(String(p), new THREE.Vector3(0, 0, 0.25), changed || used ? 0x0b0720 : 0xc4b5fd, 'gate-label'));
        col.add(cell);
      });
      col.add(makeLabel(s.hit ? 'hit' : 'fault', new THREE.Vector3(0, yOf(state.frames) + 0.1, 0), s.hit ? 0x4ade80 : 0xff6b8b, 'idx-label'));
      if (s.victim !== null) col.add(makeLabel(`out ${s.victim}`, new THREE.Vector3(0, yOf(state.frames) - 0.3, 0), 0x9b98c4, 'idx-label'));
      col.scale.setScalar(0.001);
      setVisible(col, false);
      grid.add(col);
      return col;
    });
    // Fit the camera to the number of columns.
    stage.camera.position.set(0, 0.6, Math.max(10, n * STEP * 1.3 + 2.5));
    stage.controls.target.set(0, -0.2, 0);
    stage.saveHome();
    state.shown = 0;
    state.clock = 0;
    state.playing = true;
    renderTables();
  }

  function renderTables() {
    const rows = Object.keys(PAGE_ALGOS).map((k) => ({ k, now: simulate(state.refs, state.frames, k).faults, more: simulate(state.refs, state.frames + 1, k).faults }));
    const best = Math.min(...rows.map((r) => r.now));
    $('[data-compare]').innerHTML = rows.map(({ k, now, more }) => `<tr class="${k === state.algo ? 'current' : ''}"><td>${PAGE_ALGOS[k].name}${now === best ? ' 🏆' : ''}</td><td>${now} / ${state.refs.length}</td><td class="${more > now ? 'warn-text' : ''}">${more}${more > now ? ' ⚠ more!' : ''}</td></tr>`).join('');
    $('[data-algo-long]').textContent = PAGE_ALGOS[state.algo].long;
    root.querySelectorAll('[data-algo]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.algo === state.algo)));
    const belady = rows.find((r) => r.k === 'fifo');
    $('[data-insight]').innerHTML = belady.more > belady.now
      ? "<b>Belady's anomaly!</b> With FIFO, one <i>more</i> frame gives <i>more</i> faults. LRU and Optimal never do this."
      : state.algo === 'opt' ? 'Optimal is the best possible, but it needs to know future requests, so real systems use it only as a yardstick.'
        : 'LRU is close to Optimal in practice, because recently used pages tend to be used again soon (locality).';
  }

  root.querySelectorAll('[data-algo]').forEach((b) => b.addEventListener('click', () => { state.algo = b.dataset.algo; build(); }));
  root.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
    $('[data-refs]').value = PRESETS[b.dataset.preset];
    if (b.dataset.preset === 'belady') {
      state.algo = 'fifo';
      state.frames = 3;
      $('[data-frames]').value = 3;
      $('[data-frames-out]').textContent = 3;
    }
    build();
  }));
  $('[data-refs]').addEventListener('change', build);
  $('[data-frames]').addEventListener('input', (e) => {
    state.frames = Number(e.target.value);
    $('[data-frames-out]').textContent = state.frames;
    build();
  });
  $('[data-play]').addEventListener('click', build);
  $('[data-instant]').addEventListener('click', () => {
    state.columns.forEach((c) => { setVisible(c, true); c.scale.setScalar(1); });
    state.shown = state.columns.length;
  });

  stage.onFrame((dt) => {
    if (state.playing && state.shown < state.columns.length) {
      state.clock -= dt;
      if (state.clock <= 0) {
        setVisible(state.columns[state.shown++], true);
        state.clock = 0.45;
      }
    }
    for (const c of state.columns) if (c.visible && c.scale.x < 1) c.scale.setScalar(Math.min(1, c.scale.x + dt * 5));
  });

  build();
  return () => stage.dispose();
}
