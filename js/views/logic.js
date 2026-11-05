// Digital electronics: logic gates and adders on a 3D board. Click the input switches; wires carrying a 1 glow
// and send pulses towards the next gate, so you can follow a signal through the circuit.
import * as THREE from 'three';
import { createStage, makeLabel, clearGroup } from '../stage.js';
import { CIRCUITS, evaluate, truthTable } from '../digital/logic.js';
import { interact } from '../interact.js';
import { html } from '../ui.js';

const COL = 2.5;
const ROW = 1.5;
const ON = 0x4ade80;
const OFF = 0x3a3f6b;
const GATE_COLORS = { AND: 0x8b5cf6, OR: 0x22d3ee, NOT: 0xf472b6, NAND: 0xa78bfa, NOR: 0x38bdf8, XOR: 0xfacc15 };
const TABS = ['and', 'or', 'not', 'nand', 'nor', 'xor', 'half', 'full'];
const INSIGHT = {
  and: 'AND is 1 only when <b>both</b> inputs are 1. Like two switches in series.',
  or: 'OR is 1 when <b>at least one</b> input is 1. Like two switches in parallel.',
  not: 'NOT flips the bit: 0 → 1, 1 → 0.',
  nand: 'NAND = NOT AND. Every other gate can be built from NANDs alone, which is why chips use them so much.',
  nor: 'NOR = NOT OR. Like NAND, it is universal: any circuit can be made from it.',
  xor: 'XOR is 1 when the inputs are <b>different</b>. It is the "sum" bit of binary addition.',
  half: 'A half adder adds two bits: XOR gives the <b>sum</b>, AND gives the <b>carry</b>. 1 + 1 = 10 in binary.',
  full: 'A full adder also takes a carry in. Chain 8 of them and you can add two bytes: that is the heart of a CPU’s ALU.',
};

export function mountLogic(root) {
  root.innerHTML = html`
    <div class="viewport" data-viewport></div>
    <aside class="panel">
      <h2>Logic Gates &amp; Adders</h2>
      <p class="lede">Computers work with bits: 0 (off) and 1 (on). A <b>logic gate</b> takes bits in and gives one bit out by a fixed rule. Wire gates together and you can <b>add numbers</b>: that is how a CPU does arithmetic.</p>

      <h3>Circuit</h3>
      <div class="tabs four" data-circuits>${TABS.map((k) => `<button data-circuit="${k}">${CIRCUITS[k].name.replace(' gate', '')}</button>`).join('')}</div>

      <h3>Truth table</h3>
      <table class="stats truth" data-table></table>
      <p class="hint">Click a row (or the switches in 3D) to set the inputs.</p>
      <div class="notice" data-sum hidden></div>
      <p class="hint" data-insight></p>
    </aside>
  `;

  const $ = (sel) => root.querySelector(sel);
  const stage = createStage($('[data-viewport]'), { cameraPosition: [0.5, 1, 11], axes: false, grid: false });
  const board = new THREE.Group();
  stage.scene.add(board);
  const state = { key: 'xor', values: {}, wires: [], switches: [], leds: [], pulses: [] };

  function layout(c) {
    const n = c.inputs.length;
    const lastCol = Math.max(...c.gates.map((g) => g.col)) + 1;
    const x0 = -(lastCol * COL) / 2;
    const pos = {};
    c.inputs.forEach((name, i) => { pos[name] = new THREE.Vector3(x0, ((n - 1) / 2 - i) * ROW, 0); });
    c.gates.forEach((g) => { pos[g.id] = new THREE.Vector3(x0 + g.col * COL, -g.row * ROW, 0); });
    const outs = Object.entries(c.outputs);
    outs.forEach(([name], i) => { pos[`out:${name}`] = new THREE.Vector3(x0 + lastCol * COL, ((outs.length - 1) / 2 - i) * ROW * 1.2, 0); });
    return pos;
  }

  // A wire from a source's right side to a target's input pin, drawn as three straight runs.
  function wire(from, to, lane) {
    const a = from.clone().add(new THREE.Vector3(0.45, 0, 0));
    const b = to.clone();
    const midX = Math.min(b.x - 0.3, (a.x + b.x) / 2 + lane * 0.18);
    const path = new THREE.CurvePath();
    const pts = [a, new THREE.Vector3(midX, a.y, 0), new THREE.Vector3(midX, b.y, 0), b];
    for (let i = 0; i < 3; i++) if (pts[i].distanceTo(pts[i + 1]) > 1e-3) path.add(new THREE.LineCurve3(pts[i], pts[i + 1]));
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(path, 64, 0.045, 6), new THREE.MeshStandardMaterial({ color: OFF }));
    board.add(mesh);
    return { path, mesh, length: path.getLength() };
  }

  function build() {
    clearGroup(board);
    const c = CIRCUITS[state.key];
    const pos = layout(c);
    state.values = Object.fromEntries(c.inputs.map((n) => [n, 0]));
    state.wires = [];
    state.switches = [];
    state.leds = [];
    let lane = 0;

    c.inputs.forEach((name) => {
      const sw = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.4), new THREE.MeshStandardMaterial({ color: OFF, roughness: 0.4 }));
      sw.position.copy(pos[name]);
      sw.userData = { input: name };
      const label = makeLabel('0', new THREE.Vector3(0, 0, 0.3), 0xffffff, 'bit-label');
      sw.add(label, makeLabel(name, new THREE.Vector3(-0.85, 0, 0), 0xc4b5fd, 'chart-label'));
      board.add(sw);
      state.switches.push({ mesh: sw, label, name });
    });

    c.gates.forEach((g) => {
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.95, 0.5), new THREE.MeshStandardMaterial({ color: GATE_COLORS[g.type], roughness: 0.35, metalness: 0.2 }));
      body.position.copy(pos[g.id]);
      body.add(makeLabel(g.type, new THREE.Vector3(0, 0, 0.3), 0x0b0720, 'gate-label'));
      board.add(body);
      g.in.forEach((src, k) => {
        const pinY = g.in.length === 1 ? 0 : k === 0 ? 0.25 : -0.25;
        const target = pos[g.id].clone().add(new THREE.Vector3(-0.65, pinY, 0));
        state.wires.push({ src, ...wire(pos[src].clone().add(new THREE.Vector3(src in state.values ? 0 : 0.2, 0, 0)), target, lane++ % 3 - 1) });
      });
    });

    Object.entries(c.outputs).forEach(([name, id]) => {
      const at = pos[`out:${name}`];
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.32, 24, 16), new THREE.MeshStandardMaterial({ color: OFF, emissive: 0x000000 }));
      led.position.copy(at);
      led.add(makeLabel(name, new THREE.Vector3(0.75, 0, 0), 0xffffff, 'chart-label'));
      board.add(led);
      state.leds.push({ mesh: led, id, name });
      state.wires.push({ src: id, ...wire(pos[id].clone().add(new THREE.Vector3(0.2, 0, 0)), at.clone().add(new THREE.Vector3(-0.32, 0, 0)), 0) });
    });

    // Pulses: a few glowing dots per wire, shown only while the wire carries a 1.
    state.pulses = state.wires.map((w) => {
      const count = Math.max(1, Math.round(w.length / 1.2));
      return Array.from({ length: count }, (_, i) => {
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), new THREE.MeshBasicMaterial({ color: 0xd9ffe6 }));
        dot.userData.offset = i / count;
        board.add(dot);
        return dot;
      });
    });

    // Fit the camera to the circuit: wider circuits need it further back.
    const lastCol = Math.max(...c.gates.map((g) => g.col)) + 1;
    stage.camera.position.set(0, 0.8, 5.5 + lastCol * 2.9);
    stage.controls.target.set(0, 0, 0);
    stage.saveHome(); // the toolbar's Reset view returns here
    root.querySelectorAll('[data-circuit]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.circuit === state.key)));
    $('[data-insight]').innerHTML = INSIGHT[state.key];
    renderTable();
    refresh();
  }

  function renderTable() {
    const c = CIRCUITS[state.key];
    const outNames = Object.keys(c.outputs);
    $('[data-table]').innerHTML = `<thead><tr>${c.inputs.map((n) => `<th>${n}</th>`).join('')}<th class="sep"></th>${outNames.map((n) => `<th>${n}</th>`).join('')}</tr></thead>
      <tbody>${truthTable(c).map((row, i) => `<tr data-row="${i}">${c.inputs.map((n) => `<td>${row.ins[n]}</td>`).join('')}<td class="sep">→</td>${outNames.map((n) => `<td class="${row.outs[n] ? 'ok-text' : ''}">${row.outs[n]}</td>`).join('')}</tr>`).join('')}</tbody>`;
  }

  function refresh() {
    const c = CIRCUITS[state.key];
    const v = evaluate(c, state.values);
    state.switches.forEach(({ mesh, label, name }) => {
      mesh.material.color.setHex(v[name] ? ON : OFF);
      mesh.material.emissive.setHex(v[name] ? 0x14532d : 0x000000);
      label.element.textContent = v[name];
    });
    state.wires.forEach((w) => {
      w.on = v[w.src] === 1;
      w.mesh.material.color.setHex(w.on ? ON : OFF);
      w.mesh.material.emissive.setHex(w.on ? 0x166534 : 0x000000);
    });
    state.leds.forEach(({ mesh, id }) => {
      mesh.material.color.setHex(v[id] ? 0xbbf7d0 : OFF);
      mesh.material.emissive.setHex(v[id] ? 0x22c55e : 0x000000);
    });
    const index = c.inputs.reduce((acc, n) => acc * 2 + state.values[n], 0);
    root.querySelectorAll('[data-row]').forEach((tr) => tr.classList.toggle('current', Number(tr.dataset.row) === index));
    const sum = $('[data-sum]');
    sum.hidden = !(state.key === 'half' || state.key === 'full');
    if (!sum.hidden) {
      const ins = c.inputs.map((n) => state.values[n]);
      const outs = Object.values(c.outputs).map((id) => v[id]); // [sum, carry]
      sum.innerHTML = `${ins.join(' + ')} = <b>${outs[1]}${outs[0]}</b> in binary = <b>${outs[1] * 2 + outs[0]}</b>`;
    }
  }

  root.querySelectorAll('[data-circuit]').forEach((b) => b.addEventListener('click', () => { state.key = b.dataset.circuit; build(); }));
  $('[data-table]').addEventListener('click', (e) => {
    const tr = e.target.closest('[data-row]');
    if (!tr) return;
    const c = CIRCUITS[state.key];
    const row = truthTable(c)[Number(tr.dataset.row)];
    state.values = { ...row.ins };
    refresh();
  });

  const stopInteract = interact(stage, {
    pick: () => state.switches.map((s) => s.mesh),
    cursor: 'pointer',
    onClick: (hit) => {
      const name = hit.object.userData.input;
      state.values[name] = 1 - state.values[name];
      refresh();
    },
  });

  let t = 0;
  stage.onFrame((dt) => {
    t += dt * 0.6;
    state.wires.forEach((w, i) => {
      state.pulses[i].forEach((dot) => {
        dot.visible = w.on;
        if (w.on) dot.position.copy(w.path.getPointAt((t * (1.2 / w.length) + dot.userData.offset) % 1));
      });
    });
  });

  build();
  return () => {
    stopInteract();
    stage.dispose();
  };
}
