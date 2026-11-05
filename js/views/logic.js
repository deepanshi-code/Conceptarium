// Digital electronics: gates and combinational circuits (adders, subtractors, multiplier, comparator, MUX, DEMUX,
// decoder, encoder) on a 3D board. Click the input switches; wires carrying a 1 glow and send pulses towards the
// next gate, so you can follow a signal through the circuit.
import * as THREE from 'three';
import { createStage, makeLabel, clearGroup } from '../stage.js';
import { CIRCUITS, GROUPS, evaluate, truthTable } from '../digital/logic.js';
import { interact } from '../interact.js';
import { html } from '../ui.js';

const COL = 2.5;
const ROW = 1.5;
const ON = 0x4ade80;
const OFF = 0x3a3f6b;
const GATE_COLORS = { AND: 0x8b5cf6, OR: 0x22d3ee, NOT: 0xf472b6, NAND: 0xa78bfa, NOR: 0x38bdf8, XOR: 0xfacc15, XNOR: 0xfb923c };
const SHORT = { half: 'Half add', full: 'Full add', halfsub: 'Half sub', fullsub: 'Full sub', multiplier: '2×2 mult', comparator: 'Compare', mux2: '2:1 MUX', mux4: '4:1 MUX', demux: '1:4 DEMUX', decoder: 'Decoder', encoder: 'Encoder' };
const tabLabel = (k) => SHORT[k] ?? CIRCUITS[k].name.replace(' gate', '');
const INSIGHT = {
  and: 'AND is 1 only when <b>both</b> inputs are 1. Like two switches in series.',
  or: 'OR is 1 when <b>at least one</b> input is 1. Like two switches in parallel.',
  not: 'NOT flips the bit: 0 → 1, 1 → 0.',
  nand: 'NAND = NOT AND. Every other gate can be built from NANDs alone, which is why chips use them so much.',
  nor: 'NOR = NOT OR. Like NAND, it is universal: any circuit can be made from it.',
  xor: 'XOR is 1 when the inputs are <b>different</b>. It is the "sum" bit of binary addition.',
  half: 'A half adder adds two bits: XOR gives the <b>sum</b>, AND gives the <b>carry</b>. 1 + 1 = 10 in binary.',
  full: 'A full adder also takes a carry in. Chain 8 of them and you can add two bytes: that is the heart of a CPU’s ALU.',
  xnor: 'XNOR is 1 when the inputs are <b>the same</b>. It is an equality checker for one bit.',
  halfsub: 'A half subtractor works out A − B. XOR gives the <b>difference</b>; a <b>borrow</b> is needed only for 0 − 1.',
  fullsub: 'A full subtractor also takes a borrow in, so they can be chained to subtract whole numbers.',
  multiplier: 'Binary multiplication is AND (1 × 1 = 1) plus adding the partial products. Here half adders do the adding.',
  comparator: 'A comparator tells which bit is bigger. Exactly one of the three lights is on.',
  mux2: 'A multiplexer is a <b>switch</b>: the select line S chooses which input reaches the output.',
  mux4: 'With 2 select lines a MUX picks 1 of 4 inputs (2² = 4). Used to share one wire or bus between many signals.',
  demux: 'A demultiplexer is the reverse of a MUX: one input D is <b>sent to</b> the output chosen by S1 S0.',
  decoder: 'A decoder turns a binary number into “which one?”: input AB = 10 lights only output D2. Used to pick a memory chip.',
  encoder: 'An encoder does the reverse: it outputs the binary number of the active input. A <b>priority</b> encoder picks the highest if several are on; V says whether any input is on.',
};

export function mountLogic(root) {
  root.innerHTML = html`
    <div class="viewport" data-viewport></div>
    <aside class="panel">
      <h2>Logic Gates &amp; Circuits</h2>
      <p class="lede">Computers work with bits: 0 (off) and 1 (on). A <b>logic gate</b> takes bits in and gives one bit out by a fixed rule. Wire gates together and you get circuits that <b>add, subtract, multiply, compare and route data</b>. These are <i>combinational</i>: the output depends only on the inputs right now.</p>

      <h3>Circuit</h3>
      <div class="segmented" role="radiogroup">
        ${Object.entries(GROUPS).map(([k, g], i) => `<label><input type="radio" name="group" value="${k}" ${i === 0 ? 'checked' : ''}> ${g.name}</label>`).join('')}
      </div>
      <div class="tabs four" data-circuits></div>
      <h4 class="circuit-name" data-name></h4>

      <h3>Truth table</h3>
      <div class="truth-wrap"><table class="stats truth" data-table></table></div>
      <p class="hint">Click a row (or the switches in 3D) to set the inputs.</p>
      <div class="notice" data-sum hidden></div>
      <p class="hint" data-insight></p>
    </aside>
  `;

  const $ = (sel) => root.querySelector(sel);
  const stage = createStage($('[data-viewport]'), { cameraPosition: [0.5, 1, 11], axes: false, grid: false });
  const board = new THREE.Group();
  stage.scene.add(board);
  const state = { group: 'gates', key: 'and', values: {}, wires: [], switches: [], leds: [], pulses: [] };

  function renderTabs() {
    $('[data-circuits]').innerHTML = GROUPS[state.group].keys.map((k) => `<button data-circuit="${k}">${tabLabel(k)}</button>`).join('');
  }

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
      const h = Math.max(0.95, g.in.length * 0.32);
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.3, h, 0.5), new THREE.MeshStandardMaterial({ color: GATE_COLORS[g.type], roughness: 0.35, metalness: 0.2 }));
      body.position.copy(pos[g.id]);
      body.add(makeLabel(g.type, new THREE.Vector3(0, 0, 0.3), 0x0b0720, 'gate-label'));
      board.add(body);
      g.in.forEach((src, k) => {
        const pinY = ((g.in.length - 1) / 2 - k) * (g.in.length > 2 ? 0.28 : 0.5);
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
    const tall = Math.max(c.inputs.length, Object.keys(c.outputs).length * 1.2, ...c.gates.map((g) => Math.abs(g.row) * 2 + 1));
    stage.camera.position.set(0, 0.8, Math.max(5.5 + lastCol * 2.9, 4 + tall * 2.3));
    stage.controls.target.set(0, 0, 0);
    stage.saveHome(); // the toolbar's Reset view returns here
    root.querySelectorAll('[data-circuit]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.circuit === state.key)));
    $('[data-name]').textContent = c.name;
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
    const text = explain(state.key, state.values, Object.fromEntries(Object.entries(c.outputs).map(([name, id]) => [name, v[id]])));
    $('[data-sum]').hidden = !text;
    $('[data-sum]').innerHTML = text ?? '';
    root.querySelector('[data-row].current')?.scrollIntoView({ block: 'nearest' });
  }

  root.querySelectorAll('input[name=group]').forEach((r) => r.addEventListener('change', () => {
    state.group = r.value;
    state.key = GROUPS[state.group].keys[0];
    renderTabs();
    build();
  }));
  $('[data-circuits]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-circuit]');
    if (!b) return;
    state.key = b.dataset.circuit;
    build();
  });
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

  renderTabs();
  build();
  return () => {
    stopInteract();
    stage.dispose();
  };
}

// One line in plain words: what the circuit just did with these inputs.
function explain(key, i, o) {
  const bin = (...bits) => bits.join('');
  switch (key) {
    case 'half':
    case 'full': {
      const carry = o.Carry ?? o.Cout;
      const ins = key === 'half' ? [i.A, i.B] : [i.A, i.B, i.Cin];
      return `${ins.join(' + ')} = <b>${bin(carry, o.Sum)}</b> in binary = <b>${2 * carry + o.Sum}</b>`;
    }
    case 'halfsub':
    case 'fullsub': {
      const borrow = o.Borrow ?? o.Bout;
      const ins = key === 'halfsub' ? [i.A, i.B] : [i.A, i.B, i.Bin];
      const value = ins.slice(1).reduce((a, b) => a - b, ins[0]);
      return `${ins.join(' − ')} = <b>${value}</b>. Diff ${o.Diff}, ${borrow ? '<b>borrow 1</b> (we took 2 from the next column)' : 'no borrow'}.`;
    }
    case 'multiplier': {
      const a = 2 * i.A1 + i.A0;
      const b = 2 * i.B1 + i.B0;
      return `${bin(i.A1, i.A0)} × ${bin(i.B1, i.B0)} = <b>${bin(o.P3, o.P2, o.P1, o.P0)}</b>, that is ${a} × ${b} = <b>${a * b}</b>`;
    }
    case 'comparator':
      return `A = ${i.A}, B = ${i.B}: <b>${i.A > i.B ? 'A > B' : i.A < i.B ? 'A < B' : 'A = B'}</b>`;
    case 'mux2':
      return `S = ${i.S} selects <b>I${i.S}</b>, so Y = I${i.S} = <b>${o.Y}</b>`;
    case 'mux4': {
      const sel = 2 * i.S1 + i.S0;
      return `S1 S0 = ${bin(i.S1, i.S0)} = ${sel} selects <b>I${sel}</b>, so Y = <b>${o.Y}</b>`;
    }
    case 'demux': {
      const sel = 2 * i.S1 + i.S0;
      return `S1 S0 = ${bin(i.S1, i.S0)} sends D = ${i.D} to <b>Y${sel}</b>. The other outputs stay 0.`;
    }
    case 'decoder': {
      const sel = 2 * i.A + i.B;
      return `AB = ${bin(i.A, i.B)} = ${sel}, so only <b>D${sel}</b> is on`;
    }
    case 'encoder': {
      if (!o.V) return 'No input is on, so V = 0 and Y means nothing.';
      const top = [3, 2, 1, 0].find((k) => i[`I${k}`]);
      return `Highest active input is <b>I${top}</b>, so Y1 Y0 = <b>${bin(o.Y1, o.Y0)}</b> (= ${top}), V = 1`;
    }
    default:
      return null;
  }
}
