// Algorithms: a sorting race. Every algorithm gets the same shuffled bars in its own lane, and all lanes
// take one step per tick, so the lane that finishes first really did the least work.
import * as THREE from 'three';
import { createStage, makeLabel, clearGroup } from '../stage.js';
import { SORTS, sortSteps } from '../algo/sort.js';
import { interact } from '../interact.js';
import { html } from '../ui.js';

const LANE_GAP = 1.9;
const WIDTH = 9; // world width of a lane
const COLORS = { idle: 0x6d5bd0, compare: 0xfacc15, swap: 0xf472b6, write: 0x22d3ee, done: 0x4ade80 };

export function mountSorting(root) {
  root.innerHTML = html`
    <div class="viewport" data-viewport></div>
    <aside class="panel">
      <h2>Sorting Race</h2>
      <p class="lede">Every lane gets the <b>same bars</b> and takes one step per tick. A step is one comparison or one move. Yellow = comparing, pink = swapping, cyan = writing, green = finished.</p>

      <h3>Start with</h3>
      <div class="segmented" role="radiogroup">
        <label><input type="radio" name="order" value="random" checked> Random</label>
        <label><input type="radio" name="order" value="nearly"> Nearly sorted</label>
        <label><input type="radio" name="order" value="reversed"> Reversed</label>
      </div>
      <label class="slider-row wide"><span>Bars</span><input type="range" min="6" max="40" step="1" value="16" data-n><output data-n-out>16</output></label>
      <label class="slider-row wide"><span>Speed</span><input type="range" min="1" max="60" step="1" value="12" data-speed><output data-speed-out>12/s</output></label>
      <div class="btn-row">
        <button class="btn" data-play>▶ Race</button>
        <button class="btn secondary" data-shuffle>New bars</button>
      </div>

      <h3>Scoreboard</h3>
      <table class="stats"><thead><tr><th></th><th>sort</th><th>steps</th><th>Big-O</th></tr></thead><tbody data-board></tbody></table>
      <p class="hint" data-insight></p>
    </aside>
  `;

  const $ = (sel) => root.querySelector(sel);
  const names = Object.keys(SORTS);
  const stage = createStage($('[data-viewport]'), { cameraPosition: [-0.6, 12, 14], axes: false, grid: false });
  stage.controls.target.set(-0.3, 0, 0.6);
  const lanesGroup = new THREE.Group();
  stage.scene.add(lanesGroup);
  const state = { n: 16, order: 'random', speed: 12, playing: false, tick: 0, clock: 0, lanes: [] };
  const boxGeom = new THREE.BoxGeometry(1, 1, 0.7);
  boxGeom.translate(0, 0.5, 0); // grow up from the floor

  function makeInput() {
    const values = Array.from({ length: state.n }, (_, i) => i + 1);
    if (state.order === 'reversed') return values.reverse();
    if (state.order === 'nearly') {
      for (let k = 0; k < Math.max(1, state.n / 8); k++) {
        const i = Math.floor(Math.random() * (state.n - 1));
        [values[i], values[i + 1]] = [values[i + 1], values[i]];
      }
      return values;
    }
    for (let i = values.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }
    return values;
  }

  function build() {
    clearGroup(lanesGroup);
    const input = makeInput();
    const step = WIDTH / state.n;
    state.tick = 0;
    state.lanes = names.map((name, li) => {
      const z = (li - (names.length - 1) / 2) * LANE_GAP;
      const run = sortSteps(name, input);
      // Bars are tracked by value (each value is unique), so a swap slides the two bars past each other.
      const bars = new Map(input.map((v) => {
        const mesh = new THREE.Mesh(boxGeom, new THREE.MeshStandardMaterial({ color: COLORS.idle, roughness: 0.4 }));
        mesh.scale.set(step * 0.8, 0.15 + (v / state.n) * 2.2, 1);
        mesh.position.set(0, 0, z);
        mesh.userData.lane = li;
        lanesGroup.add(mesh);
        return [v, mesh];
      }));
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(WIDTH + 0.6, 1.1), new THREE.MeshBasicMaterial({ color: 0x141838 }));
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(0, -0.01, z);
      floor.userData.lane = li;
      const label = makeLabel(SORTS[name].name, new THREE.Vector3(-WIDTH / 2 - 0.4, 0.2, z), 0xe6e9f2, 'chart-label');
      label.center.set(1, 0.5);
      lanesGroup.add(floor, label);
      return { name, run, bars, step, z, finishedAt: null, floor };
    });
    state.lanes.forEach((lane) => place(lane, true));
    renderBoard();
  }

  // Put every bar of a lane where the current step says it is (instant, or as a target the frame loop eases to).
  function place(lane, instant = false) {
    const s = lane.run.steps[Math.min(state.tick, lane.run.steps.length - 1)];
    const finished = s.kind === 'done';
    s.a.forEach((v, i) => {
      const mesh = lane.bars.get(v);
      mesh.userData.x = -WIDTH / 2 + (i + 0.5) * lane.step;
      if (instant) mesh.position.x = mesh.userData.x;
      const c = finished ? COLORS.done : s.hl.includes(i) ? COLORS[s.kind] : COLORS.idle;
      mesh.material.color.setHex(c);
      mesh.material.emissive.setHex(s.hl.includes(i) ? c : 0x000000);
      mesh.material.emissiveIntensity = 0.35;
    });
    if (finished && lane.finishedAt === null) lane.finishedAt = lane.run.steps.length - 1;
  }

  function renderBoard() {
    const ranked = [...state.lanes].sort((a, b) => a.run.steps.length - b.run.steps.length);
    const medal = (lane) => (lane.finishedAt === null ? '' : ['🥇', '🥈', '🥉'][ranked.indexOf(lane)] ?? '✓');
    $('[data-board]').innerHTML = state.lanes.map((lane) => `<tr><td>${medal(lane)}</td><td>${SORTS[lane.name].name}</td><td>${lane.finishedAt ?? Math.min(state.tick, lane.run.steps.length - 1)}</td><td>${SORTS[lane.name].big}</td></tr>`).join('');
    const allDone = state.lanes.every((l) => l.finishedAt !== null);
    $('[data-insight]').innerHTML = !allDone ? 'Watch the O(n²) sorts fall behind as you add more bars.'
      : state.order === 'nearly' ? '<b>Nearly sorted?</b> Insertion and bubble sort barely have to work. That is why real libraries switch to insertion sort for small or almost-sorted runs.'
        : state.order === 'reversed' ? '<b>Reversed</b> is the worst case for insertion and bubble sort, and for this quick sort too (its pivot is always the smallest or largest).'
          : `<b>${SORTS[ranked[0].name].name}</b> won. Try 40 bars: the gap between O(n²) and O(n log n) grows fast.`;
  }

  function setPlaying(on) {
    state.playing = on;
    $('[data-play]').textContent = on ? '❚❚ Pause' : '▶ Race';
  }

  root.querySelectorAll('input[name=order]').forEach((r) => r.addEventListener('change', () => {
    state.order = r.value;
    setPlaying(false);
    build();
  }));
  $('[data-n]').addEventListener('input', (e) => {
    state.n = Number(e.target.value);
    $('[data-n-out]').textContent = state.n;
    setPlaying(false);
    build();
  });
  $('[data-speed]').addEventListener('input', (e) => {
    state.speed = Number(e.target.value);
    $('[data-speed-out]').textContent = `${state.speed}/s`;
  });
  $('[data-play]').addEventListener('click', () => {
    if (state.lanes.every((l) => l.finishedAt !== null)) build();
    setPlaying(!state.playing);
  });
  $('[data-shuffle]').addEventListener('click', () => { setPlaying(false); build(); });

  // Click a lane to single-step the race (handy when paused).
  const stopInteract = interact(stage, {
    pick: () => lanesGroup.children.filter((o) => o.isMesh),
    cursor: 'pointer',
    onClick: () => { setPlaying(false); advance(); },
  });

  function advance() {
    state.tick += 1;
    state.lanes.forEach((lane) => place(lane));
    renderBoard();
    if (state.lanes.every((l) => l.finishedAt !== null)) setPlaying(false);
  }

  stage.onFrame((dt) => {
    if (state.playing) {
      state.clock += dt;
      const interval = 1 / state.speed;
      while (state.clock >= interval && state.playing) {
        state.clock -= interval;
        advance();
      }
    }
    const ease = Math.min(1, dt * 14);
    for (const o of lanesGroup.children) if (o.userData.x !== undefined) o.position.x += (o.userData.x - o.position.x) * ease;
  });

  build();
  return () => {
    stopInteract();
    boxGeom.dispose();
    stage.dispose();
  };
}
