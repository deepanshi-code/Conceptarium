// Operating systems: CPU scheduling as a 3D Gantt chart. Each process has a lane; solid blocks are time on the
// CPU and red glass blocks are time spent waiting in the ready queue, so "average waiting time" is visible.
import * as THREE from 'three';
import { createStage, makeLabel, clearGroup } from '../stage.js';
import { ALGOS, schedule } from '../os/schedule.js';
import { html, formatNumber } from '../ui.js';

const LENGTH = 11; // world length of the time axis
const LANE = 0.9;
const PALETTE = [0xa78bfa, 0x22d3ee, 0xfacc15, 0xf472b6, 0x4ade80, 0xfb923c];
const PRESETS = {
  convoy: [[0, 12, 3], [0, 2, 1], [0, 3, 2], [0, 1, 4]],
  mixed: [[0, 5, 2], [1, 3, 1], [2, 8, 4], [3, 2, 3], [5, 4, 2]],
  same: [[0, 6, 2], [0, 6, 1], [0, 6, 3]],
};

export function mountScheduling(root) {
  root.innerHTML = html`
    <div class="viewport" data-viewport></div>
    <aside class="panel">
      <h2>CPU Scheduling</h2>
      <p class="lede">The CPU can run one process at a time. The <b>scheduler</b> decides who goes next. Solid blocks are time on the CPU; <b>red glass</b> is time spent waiting. Less red = a better schedule for that workload.</p>

      <h3>Scheduler</h3>
      <div class="tabs" data-algos>${Object.entries(ALGOS).map(([k, a]) => `<button data-algo="${k}" title="${a.long}">${a.name}</button>`).join('')}</div>
      <p class="hint" data-algo-long></p>
      <label class="slider-row wide" data-q-row><span>Time slice q</span><input type="range" min="1" max="6" step="1" value="2" data-q><output data-q-out>2</output></label>

      <h3>Processes</h3>
      <div class="op-group">
        <button class="btn small secondary" data-preset="convoy">Long job first</button>
        <button class="btn small secondary" data-preset="mixed">Mixed</button>
        <button class="btn small secondary" data-preset="random">Random</button>
      </div>
      <table class="stats proc-table"><thead><tr><th>id</th><th>arrives</th><th>burst</th><th>priority</th></tr></thead><tbody data-procs></tbody></table>
      <div class="btn-row"><button class="btn" data-replay>▶ Replay</button></div>

      <h3>Which scheduler wins?</h3>
      <table class="stats"><thead><tr><th>scheduler</th><th>avg wait</th><th>avg turnaround</th></tr></thead><tbody data-compare></tbody></table>
      <p class="hint" data-insight></p>
    </aside>
  `;

  const $ = (sel) => root.querySelector(sel);
  const stage = createStage($('[data-viewport]'), { cameraPosition: [-0.5, 11, 9.5], axes: false, grid: false });
  stage.controls.target.set(0, 0, 0.6);
  const chart = new THREE.Group();
  stage.scene.add(chart);
  const state = { algo: 'fcfs', q: 2, procs: fromPreset(PRESETS.convoy), time: 0, result: null, blocks: [] };
  const box = new THREE.BoxGeometry(1, 1, 1);
  box.translate(0.5, 0.5, 0); // anchor at the left end, on the floor, so scaling x grows it along time

  const playhead = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
  stage.scene.add(playhead);
  const clockLabel = makeLabel('t = 0', new THREE.Vector3(), 0xffffff, 'chart-label');
  stage.scene.add(clockLabel);

  function fromPreset(rows) {
    return rows.map(([arrival, burst, priority], i) => ({ id: `P${i + 1}`, arrival, burst, priority }));
  }

  function build() {
    clearGroup(chart);
    const r = schedule(state.procs, state.algo, state.q);
    state.result = r;
    state.time = 0;
    const sx = LENGTH / r.makespan;
    const x = (t) => -LENGTH / 2 + t * sx;
    const lanes = state.procs.length + 1;
    const zOf = (i) => (i - (lanes - 1) / 2) * LANE; // lane 0 is the CPU, at the back
    const color = (id) => PALETTE[state.procs.findIndex((p) => p.id === id) % PALETTE.length];
    state.blocks = [];
    const addBlock = (start, end, z, height, material) => {
      const m = new THREE.Mesh(box, material);
      m.position.set(x(start), 0, z);
      m.scale.set(1, height, LANE * 0.62);
      m.visible = false;
      m.userData = { start, end, sx };
      chart.add(m);
      state.blocks.push(m);
    };

    // Floor stripes, lane names and a tick every time unit.
    for (let i = 0; i < lanes; i++) {
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(LENGTH, LANE * 0.86), new THREE.MeshBasicMaterial({ color: i === 0 ? 0x1d1a44 : 0x11142e }));
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(0, -0.005, zOf(i));
      const name = i === 0 ? 'CPU' : state.procs[i - 1].id;
      const label = makeLabel(name, new THREE.Vector3(-LENGTH / 2 - 0.25, 0.1, zOf(i)), i === 0 ? 0xffffff : PALETTE[(i - 1) % PALETTE.length], 'chart-label');
      label.center.set(1, 0.5);
      chart.add(floor, label);
    }
    const tickEvery = r.makespan > 30 ? 5 : r.makespan > 14 ? 2 : 1;
    for (let t = 0; t <= r.makespan; t += tickEvery) {
      chart.add(makeLabel(String(t), new THREE.Vector3(x(t), 0, zOf(lanes - 1) + LANE * 0.75), 0x8a8fb8, 'chart-label'));
    }

    // CPU lane: who is running. Process lanes: running (solid) and waiting (red glass).
    for (const s of r.slices) {
      if (s.id === null) continue;
      addBlock(s.start, s.end, zOf(0), 0.55, new THREE.MeshStandardMaterial({ color: color(s.id), roughness: 0.35 }));
    }
    state.procs.forEach((p, i) => {
      const mine = r.slices.filter((s) => s.id === p.id);
      const done = r.results[i].completion;
      let t = p.arrival;
      for (const s of mine) {
        if (s.start > t) addBlock(t, s.start, zOf(i + 1), 0.22, new THREE.MeshStandardMaterial({ color: 0xff4d6d, transparent: true, opacity: 0.45, roughness: 0.2 }));
        addBlock(s.start, s.end, zOf(i + 1), 0.4, new THREE.MeshStandardMaterial({ color: color(p.id), roughness: 0.35 }));
        t = s.end;
      }
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.25, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      arrow.rotation.x = Math.PI;
      arrow.position.set(x(p.arrival), 0.75, zOf(i + 1));
      chart.add(arrow);
      chart.add(makeLabel(`done ${done}`, new THREE.Vector3(x(done) + 0.08, 0.55, zOf(i + 1)), 0x9b98c4, 'chart-label'));
    });

    playhead.scale.y = lanes * LANE;
    playhead.rotation.x = -Math.PI / 2;
    playhead.position.set(x(0), 0.02, 0);
    state.backZ = zOf(0) - LANE * 0.8;
    renderTables();
  }

  function renderProcs() {
    $('[data-procs]').innerHTML = state.procs.map((p, i) => `<tr><td style="color:#${new THREE.Color(PALETTE[i % PALETTE.length]).getHexString()}">${p.id}</td>${['arrival', 'burst', 'priority'].map((k) => `<td><input type="number" min="${k === 'burst' ? 1 : 0}" max="20" value="${p[k]}" data-i="${i}" data-k="${k}"></td>`).join('')}</tr>`).join('');
  }

  function renderTables() {
    const all = Object.keys(ALGOS).map((k) => ({ k, r: schedule(state.procs, k, state.q) }));
    const best = Math.min(...all.map((a) => a.r.avgWaiting));
    $('[data-compare]').innerHTML = all.map(({ k, r }) => `<tr class="${k === state.algo ? 'current' : ''}"><td>${ALGOS[k].name}${r.avgWaiting === best ? ' 🏆' : ''}</td><td>${formatNumber(r.avgWaiting)}</td><td>${formatNumber(r.avgTurnaround)}</td></tr>`).join('');
    $('[data-algo-long]').textContent = ALGOS[state.algo].long;
    $('[data-q-row]').hidden = state.algo !== 'rr';
    root.querySelectorAll('[data-algo]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.algo === state.algo)));
    const longFirst = state.procs[0].burst >= Math.max(...state.procs.map((p) => p.burst)) && state.procs.length > 2;
    $('[data-insight]').innerHTML = state.algo === 'fcfs' && longFirst
      ? '<b>Convoy effect:</b> one long job at the front makes every short job wait behind it. Switch to SJF and watch the red shrink.'
      : state.algo === 'rr' ? 'Round Robin is fair: nobody waits long for a first turn. A tiny q means many switches; a huge q turns it back into FCFS.'
        : state.algo === 'sjf' || state.algo === 'srtf' ? 'Shortest-first gives the lowest average wait, but a long job can <b>starve</b> if short ones keep arriving.'
          : 'Each scheduler is a trade-off. Compare the red in each lane, and the table below.';
  }

  root.querySelectorAll('[data-algo]').forEach((b) => b.addEventListener('click', () => { state.algo = b.dataset.algo; build(); }));
  $('[data-q]').addEventListener('input', (e) => {
    state.q = Number(e.target.value);
    $('[data-q-out]').textContent = state.q;
    build();
  });
  root.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
    const key = b.dataset.preset;
    state.procs = key === 'random'
      ? fromPreset(Array.from({ length: 4 + Math.floor(Math.random() * 2) }, (_, i) => [i === 0 ? 0 : Math.floor(Math.random() * 8), 1 + Math.floor(Math.random() * 9), 1 + Math.floor(Math.random() * 4)]))
      : fromPreset(PRESETS[key]);
    renderProcs();
    build();
  }));
  $('[data-procs]').addEventListener('change', (e) => {
    const input = e.target;
    const v = Number(input.value);
    const min = input.dataset.k === 'burst' ? 1 : 0;
    if (!Number.isInteger(v) || v < min || v > 20) { input.classList.add('invalid'); return; }
    input.classList.remove('invalid');
    state.procs[Number(input.dataset.i)][input.dataset.k] = v;
    build();
  });
  $('[data-replay]').addEventListener('click', () => { state.time = 0; });

  // Play the schedule: blocks grow as the clock passes them.
  stage.onFrame((dt) => {
    const r = state.result;
    state.time = Math.min(r.makespan, state.time + dt * Math.max(2, r.makespan / 6));
    for (const m of state.blocks) {
      const { start, end, sx } = m.userData;
      m.visible = state.time > start; // a zero-width box would render as a sliver with broken normals
      if (m.visible) m.scale.x = (Math.min(end, state.time) - start) * sx;
    }
    playhead.position.x = -LENGTH / 2 + state.time * (LENGTH / r.makespan);
    clockLabel.position.set(playhead.position.x, 0.1, state.backZ);
    clockLabel.element.textContent = `t = ${Math.floor(state.time)}`;
  });

  renderProcs();
  build();
  return () => stage.dispose();
}
