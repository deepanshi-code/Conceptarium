// Visualization 4: data structures. A shell with tabs, a shared 3D renderer and a step-by-step player.
// Each tab owns its data and controls, and hands the player a list of frames ({layout, message}) to replay.
import * as THREE from 'three';
import { createStage } from '../stage.js';
import { createGraphRenderer, STATE_COLORS } from '../ds/renderer.js';
import { html } from '../ui.js';
import { listTab } from './ds/list.js';
import { treeTab } from './ds/tree.js';
import { heapTab } from './ds/heap.js';
import { bplusTab } from './ds/bplus.js';
import { graphTab } from './ds/graph.js';
import { hashTab } from './ds/hash.js';

const TABS = [listTab, treeTab, heapTab, bplusTab, graphTab, hashTab];
const SPEEDS = [1600, 1100, 750, 450, 220]; // ms per step

const hex = (c) => `#${new THREE.Color(c).getHexString()}`;

export function mountStructures(root) {
  root.innerHTML = html`
    <div class="viewport" data-viewport></div>
    <aside class="panel">
      <h2>Data Structures</h2>
      <div class="tabs" role="tablist">
        ${TABS.map((t) => `<button role="tab" data-tab="${t.key}">${t.label}</button>`).join('')}
      </div>
      <p class="lede" data-intro></p>
      <div data-controls></div>

      <h3>Step by step</h3>
      <div class="notice" data-msg>Pick an operation above.</div>
      <div class="btn-row">
        <button class="btn secondary" data-pause>❚❚ Pause</button>
        <button class="btn secondary" data-next>Next step</button>
        <button class="btn secondary" data-skip>Skip to end</button>
      </div>
      <label class="slider-row speed"><span>Speed</span><input type="range" min="0" max="4" step="1" value="2" data-speed><output data-speed-out></output></label>
      <ol class="log" data-log></ol>

      <div class="readout" data-stats></div>

      <details class="legend">
        <summary>Colours</summary>
        <ul>
          <li><span class="swatch" style="--c:${hex(STATE_COLORS.visit)}"></span> being visited / compared</li>
          <li><span class="swatch" style="--c:${hex(STATE_COLORS.active)}"></span> moving or just changed</li>
          <li><span class="swatch" style="--c:${hex(STATE_COLORS.new)}"></span> newly created</li>
          <li><span class="swatch" style="--c:${hex(STATE_COLORS.warn)}"></span> problem to fix (imbalance, overflow) or being removed</li>
          <li><span class="swatch" style="--c:${hex(STATE_COLORS.found)}"></span> found / result</li>
        </ul>
      </details>
    </aside>
  `;

  const $ = (sel) => root.querySelector(sel);
  const stage = createStage($('[data-viewport]'), { cameraPosition: [3, 5, 13], axes: false, grid: false });
  const renderer = createGraphRenderer(stage);
  const extras = new THREE.Group(); // per-tab static scenery (e.g. the memory floor)
  stage.scene.add(extras);

  const player = { frames: [], index: -1, paused: false, clock: 0, interval: SPEEDS[2] };
  let current = null;
  let cleanup = null;

  function showFrame(i, instant = false) {
    player.index = i;
    const f = player.frames[i];
    renderer.show(f.layout, { instant });
    $('[data-msg]').innerHTML = f.message;
    root.querySelectorAll('[data-log] li').forEach((li, k) => li.classList.toggle('current', k === i));
    const li = $(`[data-log] li:nth-child(${i + 1})`);
    if (li) li.parentElement.scrollTop = li.offsetTop - li.parentElement.offsetTop - 40;
  }

  const ctx = {
    controls: $('[data-controls]'),
    extras,
    /** Replay frames [{layout, message}]. A new run first jumps the previous one to its end. */
    run(frames) {
      if (!frames.length) return;
      player.frames = frames;
      player.clock = 0;
      $('[data-log]').innerHTML = frames.map((f) => `<li>${f.message}</li>`).join('');
      showFrame(0);
    },
    /** Redraw immediately without adding to the log (e.g. after toggling a display option). */
    redraw(layout) {
      renderer.show(layout);
    },
    say(message) {
      $('[data-msg]').innerHTML = message;
    },
    setStats(markup) {
      $('[data-stats]').innerHTML = markup;
    },
  };

  function selectTab(key) {
    cleanup?.();
    renderer.clear();
    extras.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
    extras.clear();
    player.frames = [];
    player.index = -1;
    $('[data-log]').innerHTML = '';
    $('[data-msg]').textContent = 'Pick an operation above.';
    ctx.controls.innerHTML = '';
    ctx.setStats('');
    current = TABS.find((t) => t.key === key);
    renderer.setViewDirection(...current.view);
    $('[data-intro]').innerHTML = current.intro;
    root.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === key)));
    cleanup = current.mount(ctx);
  }

  root.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => selectTab(b.dataset.tab)));
  $('[data-pause]').addEventListener('click', () => {
    player.paused = !player.paused;
    $('[data-pause]').textContent = player.paused ? '▶ Resume' : '❚❚ Pause';
  });
  $('[data-next]').addEventListener('click', () => {
    if (player.index < player.frames.length - 1) showFrame(player.index + 1);
  });
  $('[data-skip]').addEventListener('click', () => {
    if (player.frames.length) showFrame(player.frames.length - 1);
  });
  const speed = $('[data-speed]');
  const setSpeed = () => {
    player.interval = SPEEDS[Number(speed.value)];
    $('[data-speed-out]').textContent = `${(1000 / player.interval).toFixed(1)}/s`;
  };
  speed.addEventListener('input', setSpeed);
  setSpeed();

  stage.onFrame((dt) => {
    renderer.update(dt);
    if (player.paused || player.index >= player.frames.length - 1) return;
    player.clock += dt * 1000;
    if (player.clock >= player.interval) {
      player.clock = 0;
      showFrame(player.index + 1);
    }
  });

  selectTab(TABS[0].key);
  return () => {
    cleanup?.();
    stage.dispose();
  };
}
