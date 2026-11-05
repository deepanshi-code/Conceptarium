// Digital electronics: sequential circuits. Flip-flops remember one bit and only change on a clock edge.
// Set the inputs with the switches, press Clock, and watch Q (and the timing diagram) update.
// Registers, shift registers and counters are rows of four flip-flops.
import * as THREE from 'three';
import { createStage, makeLabel, clearGroup } from '../stage.js';
import { NEXT, CHARACTERISTIC, registerNext, shiftNext, counterNext, toNumber } from '../digital/sequential.js';
import { interact } from '../interact.js';
import { html } from '../ui.js';

const ON = 0x4ade80;
const OFF = 0x3a3f6b;
const HISTORY = 14;
const MODES = {
  D: { name: 'D flip-flop', tab: 'D FF', inputs: ['D'], idea: '<b>D</b> = data. At each clock edge Q copies D, and holds it until the next edge. One D flip-flop = 1 bit of memory.' },
  T: { name: 'T flip-flop', tab: 'T FF', inputs: ['T'], idea: '<b>T</b> = toggle. T = 1 flips Q at each clock edge; T = 0 holds it. A chain of T flip-flops is a counter.' },
  JK: { name: 'JK flip-flop', tab: 'JK FF', inputs: ['J', 'K'], idea: 'J sets, K resets, both 0 holds, and <b>both 1 toggles</b>. The JK fixes the SR flip-flop’s forbidden input.' },
  SR: { name: 'SR flip-flop', tab: 'SR FF', inputs: ['S', 'R'], idea: 'S sets Q to 1, R resets it to 0. S = R = 1 is <b>not allowed</b>: the output would be undefined.' },
  register: { name: '4-bit register (parallel load)', tab: 'Register', inputs: ['D3', 'D2', 'D1', 'D0', 'LOAD'], idea: 'Four D flip-flops share one clock. When LOAD = 1, a clock edge stores all four data bits at once. CPU registers work like this.' },
  shift: { name: '4-bit shift register', tab: 'Shift reg', inputs: ['IN'], idea: 'Each clock edge moves every bit one place to the right, and the serial input enters on the left. Used to turn serial data into parallel (and back).' },
  counter: { name: '4-bit up counter', tab: 'Counter', inputs: ['EN', 'DOWN'], idea: 'Each clock edge adds 1 (or subtracts 1 with DOWN). Four bits count 0 to 15, then wrap to 0. Q0 toggles every edge, Q1 every 2, Q2 every 4…' },
};

export function mountSequential(root) {
  root.innerHTML = html`
    <div class="viewport" data-viewport></div>
    <aside class="panel">
      <h2>Flip-Flops, Registers &amp; Counters</h2>
      <p class="lede">Gates alone forget everything. A <b>flip-flop</b> remembers one bit. It ignores its inputs until the <b>clock</b> ticks (a rising edge), then updates its output Q. Put flip-flops side by side and you get registers, shift registers and counters: the memory of a CPU.</p>

      <div class="tabs four" data-modes>${Object.entries(MODES).map(([k, m]) => `<button data-mode="${k}">${m.tab}</button>`).join('')}</div>
      <h4 class="circuit-name" data-name></h4>

      <div class="btn-row">
        <button class="btn" data-clock>⏱ Clock pulse</button>
        <button class="btn secondary" data-auto>Auto clock</button>
      </div>
      <button class="btn small secondary reset-q" data-reset>Reset Q to 0</button>
      <p class="hint">Click the switches in 3D to set the inputs, or press <kbd>Space</kbd> for a clock pulse.</p>

      <div class="notice" data-msg></div>
      <h3>Timing diagram</h3>
      <div class="timing" data-timing></div>
      <div data-char></div>
      <p class="hint" data-idea></p>
    </aside>
  `;

  const $ = (sel) => root.querySelector(sel);
  const stage = createStage($('[data-viewport]'), { cameraPosition: [0, 1, 11], axes: false, grid: false });
  const board = new THREE.Group();
  stage.scene.add(board);
  const state = { mode: 'D', ins: {}, q: [0], switches: [], ffs: [], history: [], auto: false, clock: 0, tokens: [], clockPulse: 0 };
  const wide = () => ['register', 'shift', 'counter'].includes(state.mode);

  function build() {
    clearGroup(board);
    const m = MODES[state.mode];
    state.ins = Object.fromEntries(m.inputs.map((n) => [n, n === 'EN' || n === 'LOAD' ? 1 : 0]));
    state.q = wide() ? [0, 0, 0, 0] : [0];
    state.switches = [];
    state.ffs = [];
    state.tokens = [];

    const count = state.q.length;
    const gap = 2.3;
    const x0 = -((count - 1) * gap) / 2;
    for (let k = 0; k < count; k++) {
      const x = x0 + k * gap;
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.8, 0.6), new THREE.MeshStandardMaterial({ color: 0x6d28d9, roughness: 0.35, metalness: 0.2 }));
      body.position.set(x, 0, 0);
      body.userData.clock = true;
      body.add(makeLabel(wide() ? 'D FF' : `${state.mode} FF`, new THREE.Vector3(0, 0.45, 0.35), 0xffffff, 'gate-label light'));
      body.add(makeLabel('▷ clk', new THREE.Vector3(-0.45, -0.65, 0.35), 0xc4b5fd, 'idx-label'));
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 16), new THREE.MeshStandardMaterial({ color: OFF }));
      led.position.set(x, -1.6, 0);
      const qLabel = makeLabel('0', new THREE.Vector3(0, 0, 0.4), 0xffffff, 'bit-label');
      led.add(qLabel, makeLabel(count > 1 ? `Q${count - 1 - k}` : 'Q', new THREE.Vector3(0, -0.55, 0), 0xc4b5fd, 'chart-label'));
      board.add(body, led);
      state.ffs.push({ body, led, qLabel, x });
    }

    // Input switches: one per flip-flop for parallel data, otherwise stacked to the left.
    m.inputs.forEach((name, i) => {
      let pos;
      if (state.mode === 'register' && name.startsWith('D')) pos = new THREE.Vector3(state.ffs[i].x, 1.8, 0);
      else if (wide()) pos = new THREE.Vector3(x0 - 2.4, 0.9 - i * 1.1, 0);
      else pos = new THREE.Vector3(x0 - 2.4, (m.inputs.length - 1) * 0.55 - i * 1.1, 0);
      const sw = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.65, 0.4), new THREE.MeshStandardMaterial({ color: OFF, roughness: 0.4 }));
      sw.position.copy(pos);
      sw.userData.input = name;
      const label = makeLabel('0', new THREE.Vector3(0, 0, 0.3), 0xffffff, 'bit-label');
      sw.add(label, makeLabel(name, new THREE.Vector3(0, 0.6, 0), 0xc4b5fd, 'chart-label'));
      board.add(sw);
      state.switches.push({ mesh: sw, label, name });
    });

    // A clock line under the flip-flops, which flashes on each pulse.
    const clockBar = new THREE.Mesh(new THREE.BoxGeometry((count - 1) * gap + 2.2, 0.08, 0.08), new THREE.MeshBasicMaterial({ color: 0x7c3aed }));
    clockBar.position.set(0, -1.05, 0.35);
    clockBar.userData.isClockBar = true;
    board.add(clockBar, makeLabel('CLK', new THREE.Vector3(-((count - 1) * gap) / 2 - 1.4, -1.05, 0.35), 0xa78bfa, 'chart-label'));
    state.clockBar = clockBar;

    stage.camera.position.set(0, 0.3, wide() ? 13 : 9);
    stage.controls.target.set(wide() ? -0.6 : -0.8, 0, 0);
    stage.saveHome();
    state.history = [{ ins: { ...state.ins }, q: [...state.q], edge: false }];
    root.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mode === state.mode)));
    $('[data-name]').textContent = m.name;
    $('[data-idea]').innerHTML = m.idea;
    setMsg('Set the inputs, then press <b>Clock pulse</b>. Q only changes on the clock edge.');
    refresh();
  }

  const setMsg = (s) => { $('[data-msg]').innerHTML = s; };

  function refresh() {
    state.switches.forEach(({ mesh, label, name }) => {
      const v = state.ins[name];
      mesh.material.color.setHex(v ? ON : OFF);
      label.element.textContent = v;
    });
    state.ffs.forEach(({ led, qLabel }, k) => {
      const v = state.q[k];
      led.material.color.setHex(v === null ? 0xff6b8b : v ? 0xbbf7d0 : OFF);
      led.material.emissive.setHex(v ? 0x22c55e : 0x000000);
      qLabel.element.textContent = v === null ? '?' : v;
    });
    renderChar();
    renderTiming();
  }

  // Characteristic table (single flip-flops) or the stored value (4-bit circuits).
  function renderChar() {
    const box = $('[data-char]');
    if (wide()) {
      const n = toNumber(state.q);
      box.innerHTML = `<div class="readout"><div class="row-between"><span>Stored bits Q3…Q0</span><strong>${state.q.join('')}</strong></div><div class="row-between"><span>As a number</span><strong>${n}</strong></div></div>`;
      return;
    }
    const rows = CHARACTERISTIC[state.mode];
    const names = Object.keys(rows[0][0]);
    box.innerHTML = `<h3>What happens at the clock edge</h3><table class="stats truth"><thead><tr>${names.map((n) => `<th>${n}</th>`).join('')}<th>Q next</th></tr></thead><tbody>
      ${rows.map(([ins, next]) => `<tr class="${names.every((n) => ins[n] === state.ins[n]) ? 'current' : ''}">${names.map((n) => `<td>${ins[n]}</td>`).join('')}<td>${next}</td></tr>`).join('')}</tbody></table>`;
  }

  // Timing diagram as SVG: a square-wave clock and one row per signal, newest edge on the right.
  function renderTiming() {
    const h = state.history.slice(-HISTORY);
    const qNames = state.q.length > 1 ? ['Q3', 'Q2', 'Q1', 'Q0'] : ['Q'];
    const rows = ['CLK', ...MODES[state.mode].inputs, ...qNames];
    const cw = 22;
    const rh = 22;
    const left = 46;
    const width = left + HISTORY * cw + 6;
    const height = rows.length * rh + 6;
    const y = (r, v) => r * rh + 4 + (v ? 3 : rh - 7);
    let out = '';
    rows.forEach((name, r) => {
      const isQ = qNames.includes(name);
      out += `<text x="4" y="${r * rh + 17}" class="tlabel ${isQ ? 'q' : ''}">${name}</text>`;
      let d = '';
      h.forEach((e, k) => {
        const x = left + k * cw;
        if (name === 'CLK') {
          d += k === 0 ? `M${x},${y(r, 0)}` : `L${x},${y(r, 0)} L${x},${y(r, 1)} L${x + cw / 2},${y(r, 1)} L${x + cw / 2},${y(r, 0)}`;
          return;
        }
        const v = isQ ? e.q[qNames.indexOf(name)] ?? 0 : e.ins[name];
        d += `${k === 0 ? 'M' : 'L'}${x},${y(r, v)} L${x + cw},${y(r, v)}`;
      });
      if (name === 'CLK' && h.length) d += ` L${left + h.length * cw},${y(r, 0)}`;
      out += `<path d="${d}" class="${name === 'CLK' ? 'clk' : isQ ? 'q' : 'in'}"/>`;
    });
    // Dashed lines at each rising edge.
    h.forEach((e, k) => { if (k > 0) out += `<line x1="${left + k * cw}" x2="${left + k * cw}" y1="2" y2="${height - 2}" class="edge"/>`; });
    $('[data-timing]').innerHTML = `<svg viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="Timing diagram">${out}</svg>`;
  }

  function pulse() {
    const before = [...state.q];
    const m = state.mode;
    if (m === 'register') state.q = registerNext(state.q, ['D3', 'D2', 'D1', 'D0'].map((n) => state.ins[n]), state.ins.LOAD);
    else if (m === 'shift') state.q = shiftNext(state.q, state.ins.IN);
    else if (m === 'counter') state.q = counterNext(state.q, { enable: state.ins.EN, down: state.ins.DOWN });
    else state.q = [NEXT[m](before[0] ?? 0, state.ins)];
    state.history.push({ ins: { ...state.ins }, q: state.q.map((v) => v ?? 0), edge: true });
    state.clockPulse = 1;
    if (m === 'shift') launchTokens(before);
    setMsg(describe(m, before, state.q));
    refresh();
  }

  function describe(m, before, after) {
    const i = state.ins;
    if (m === 'SR' && after[0] === null) return '<span class="warn-text">S = R = 1 is not allowed</span>: real hardware could end up in either state. That is why the JK flip-flop exists.';
    if (m === 'register') return i.LOAD ? `LOAD = 1: stored <b>${after.join('')}</b> (= ${toNumber(after)}).` : 'LOAD = 0: the register <b>kept</b> its value and ignored the data inputs.';
    if (m === 'shift') return `Shifted right: ${i.IN} entered at Q3, <b>${before[3]}</b> fell out of Q0. Now ${after.join('')}.`;
    if (m === 'counter') return i.EN ? `${toNumber(before)} → <b>${toNumber(after)}</b>${toNumber(after) === (i.DOWN ? 15 : 0) ? ' (wrapped around!)' : ''}` : 'EN = 0: the counter is paused.';
    const changed = before[0] !== after[0];
    return `Clock edge: Q ${changed ? `changed ${before[0]} → <b>${after[0]}</b>` : `stayed <b>${after[0]}</b>`}.`;
  }

  // Shift register: small glowing cubes carry each bit one place to the right.
  function launchTokens(before) {
    const xs = state.ffs.map((f) => f.x);
    const sources = [xs[0] - 2.4, ...xs.slice(0, 3)];
    sources.forEach((sx, k) => {
      const bit = k === 0 ? state.ins.IN : before[k - 1];
      const tok = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), new THREE.MeshBasicMaterial({ color: bit ? ON : 0x8a8fb8 }));
      tok.userData = { from: new THREE.Vector3(sx, 0.2, 0.5), to: new THREE.Vector3(xs[k], 0.2, 0.5), t: 0 };
      tok.position.copy(tok.userData.from);
      board.add(tok);
      state.tokens.push(tok);
    });
  }

  $('[data-modes]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-mode]');
    if (!b) return;
    state.mode = b.dataset.mode;
    build();
  });
  $('[data-clock]').addEventListener('click', pulse);
  $('[data-auto]').addEventListener('click', () => {
    state.auto = !state.auto;
    $('[data-auto]').textContent = state.auto ? '❚❚ Stop clock' : 'Auto clock';
  });
  $('[data-reset]').addEventListener('click', () => {
    state.q = state.q.map(() => 0);
    state.history = [{ ins: { ...state.ins }, q: [...state.q], edge: false }];
    setMsg('Q reset to 0.');
    refresh();
  });
  // Space = clock pulse (only on this page, and not while typing).
  const onKey = (e) => {
    if (e.code !== 'Space' || e.target.closest?.('input, textarea, select, button')) return;
    e.preventDefault();
    pulse();
  };
  window.addEventListener('keydown', onKey);

  const stopInteract = interact(stage, {
    pick: () => [...state.switches.map((s) => s.mesh), ...state.ffs.map((f) => f.body)],
    cursor: 'pointer',
    onClick: (hit) => {
      if (hit.object.userData.clock) { pulse(); return; }
      const name = hit.object.userData.input;
      state.ins[name] = 1 - state.ins[name];
      setMsg(`${name} = ${state.ins[name]}. Nothing happens yet: Q waits for the <b>clock</b>.`);
      refresh();
    },
  });

  stage.onFrame((dt) => {
    if (state.auto) {
      state.clock -= dt;
      if (state.clock <= 0) {
        state.clock = 1;
        pulse();
      }
    }
    state.clockPulse = Math.max(0, state.clockPulse - dt * 3);
    state.clockBar?.material.color.setHex(state.clockPulse > 0 ? 0xfacc15 : 0x7c3aed);
    state.ffs.forEach(({ body }) => body.material.emissive.setHex(state.clockPulse > 0 ? 0x3b1d80 : 0x000000));
    state.tokens = state.tokens.filter((tok) => {
      tok.userData.t = Math.min(1, tok.userData.t + dt * 2.2);
      tok.position.lerpVectors(tok.userData.from, tok.userData.to, tok.userData.t);
      tok.position.y += Math.sin(tok.userData.t * Math.PI) * 0.6;
      if (tok.userData.t < 1) return true;
      board.remove(tok);
      tok.geometry.dispose();
      tok.material.dispose();
      return false;
    });
  });

  build();
  return () => {
    window.removeEventListener('keydown', onKey);
    stopInteract();
    stage.dispose();
  };
}
