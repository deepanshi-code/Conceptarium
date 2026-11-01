// Tab: linked list vs array, laid out on a floor that represents memory addresses.
import * as THREE from 'three';
import { makeLabel } from '../../stage.js';
import {
  COLS, ROWS, ARRAY_CAPACITY, cellAddress, createMemory, seed, snapshot, arrayLength,
  listInsertAt, listDelete, listGet, arrayInsertAt, arrayDelete, arrayGet,
} from '../../ds/memory.js';
import { readInt, stat } from './common.js';

const CELL_W = 1.35;
const CELL_D = 1.8;
const BOX = [1.05, 0.5, 0.95];
const ARRAY_COLOR = 0x2f5f8f;
const LIST_COLOR = 0x6b4fa0;
const NEXT_COLOR = 0xc4a7ff;
const PREV_COLOR = 0x7fd1ff;

const cellPos = (cell, y = BOX[1] / 2) => [((cell % COLS) - (COLS - 1) / 2) * CELL_W, y, ((ROWS - 1) / 2 - Math.floor(cell / COLS)) * CELL_D];

export const listTab = {
  key: 'list',
  label: 'Linked List',
  view: [0, 1.1, 1], // look down at the memory floor
  intro: 'The floor is <b>memory</b>: each tile is one address. An <b>array</b> is one contiguous block (front row), so a[i] is found by arithmetic. <b>Linked-list</b> nodes sit wherever <code>malloc</code> found space and are joined only by pointers.',

  mount(ctx) {
    const mem = createMemory('singly');
    seed(mem, [12, 7, 30, 18]);

    ctx.controls.innerHTML = `
      <div class="segmented" role="radiogroup">
        <label><input type="radio" name="kind" value="singly" checked> Singly</label>
        <label><input type="radio" name="kind" value="doubly"> Doubly</label>
        <label><input type="radio" name="kind" value="circular"> Circular</label>
      </div>
      <div class="op-inputs">
        <label>Value <input type="number" data-value value="42" min="0" max="99"></label>
        <label>Index <input type="number" data-index value="1" min="0" max="11"></label>
      </div>
      <div class="op-group">
        <span class="op-title" style="--c:#${new THREE.Color(LIST_COLOR).getHexString()}">Linked list</span>
        <button class="btn small" data-op="list-insert">Insert at index</button>
        <button class="btn small" data-op="list-delete">Delete value</button>
        <button class="btn small" data-op="list-get">Get node[index]</button>
      </div>
      <div class="op-group">
        <span class="op-title" style="--c:#${new THREE.Color(ARRAY_COLOR).getHexString()}">Array</span>
        <button class="btn small" data-op="array-insert">Insert at index</button>
        <button class="btn small" data-op="array-delete">Delete at index</button>
        <button class="btn small" data-op="array-get">Get a[index]</button>
      </div>
      <p class="hint">Try the same insert at index 0 on both, then compare the step counts.</p>
    `;

    buildFloor(ctx.extras);
    const $ = (sel) => ctx.controls.querySelector(sel);

    const play = (frames) => {
      ctx.run(frames.map((f) => ({ message: f.message, layout: layout(f.state, f.highlight) })));
      renderStats();
    };

    const ops = {
      'list-insert': (v, i) => listInsertAt(mem, i, v),
      'list-delete': (v) => listDelete(mem, v),
      'list-get': (v, i) => listGet(mem, i),
      'array-insert': (v, i) => arrayInsertAt(mem, i, v),
      'array-delete': (v, i) => arrayDelete(mem, i),
      'array-get': (v, i) => arrayGet(mem, i),
    };
    ctx.controls.querySelectorAll('[data-op]').forEach((btn) => btn.addEventListener('click', () => {
      const value = readInt($('[data-value]'));
      const index = readInt($('[data-index]'), 0, ARRAY_CAPACITY - 1);
      if (value === null || index === null) return ctx.say('Enter a value from 0 to 99 and an index from 0 to 11.');
      play(ops[btn.dataset.op](value, index));
    }));
    ctx.controls.querySelectorAll('input[name="kind"]').forEach((radio) => radio.addEventListener('change', () => {
      mem.kind = radio.value;
      ctx.redraw(layout(snapshot(mem), {}));
      ctx.say({
        singly: 'Each node stores one pointer: <code>next</code>. You can only walk forwards.',
        doubly: 'Each node also stores <code>prev</code> (blue arcs), so you can walk backwards and delete a node without knowing its predecessor. The cost is one extra pointer per node.',
        circular: 'The last node points back to the first instead of NULL. This is useful for round-robin scheduling and circular buffers.',
      }[radio.value]);
    }));

    // Click a list node or an array cell to see where it lives in memory.
    ctx.onNodeClick = (id) => {
      const st = snapshot(mem);
      const li = st.list.findIndex((n) => n.id === id);
      if (li >= 0) {
        const n = st.list[li];
        const next = st.list[li + 1] ?? (st.kind === 'circular' && st.list.length > 1 ? st.list[0] : null);
        $('[data-value]').value = n.value;
        $('[data-index]').value = li;
        ctx.run([{ message: `List node ${li} holds <b>${n.value}</b> at ${cellAddress(n.cell)}. Its <code>next</code> pointer stores ${next ? cellAddress(next.cell) : 'NULL'}: the only way to find the next node.`, layout: layout(st, { [id]: 'found' }) }]);
        return;
      }
      const ai = st.array.findIndex((x) => x && x.id === id);
      if (ai >= 0) {
        $('[data-index]').value = ai;
        ctx.run([{ message: `a[${ai}] = <b>${st.array[ai].value}</b> at ${cellAddress(ai)} = base + ${ai} × 16. Neighbours are always next door in memory.`, layout: layout(st, { [id]: 'found' }) }]);
      }
    };

    function renderStats() {
      ctx.setStats(`
        ${stat('List nodes', mem.list.length)}
        ${stat('Array length / capacity', `${arrayLength(mem)} / ${ARRAY_CAPACITY}`)}
        <table class="stats complexity">
          <thead><tr><th></th><th>Array</th><th>Linked list</th></tr></thead>
          <tbody>
            <tr><td>Access i-th</td><td>O(1)</td><td>O(n)</td></tr>
            <tr><td>Insert / delete at front</td><td>O(n)</td><td>O(1)</td></tr>
            <tr><td>Insert after a known node</td><td>O(n)</td><td>O(1)</td></tr>
            <tr><td>Memory</td><td>contiguous, cache-friendly</td><td>scattered, + pointer per node</td></tr>
          </tbody>
        </table>`);
    }

    play([{ state: snapshot(mem), highlight: {}, message: 'The same four values stored two ways. Orbit the camera: array cells sit side by side, while list nodes are scattered and joined by pointer arrows.' }]);
  },
};

function layout(state, highlight) {
  const nodes = [];
  const edges = [];
  state.array.forEach((item, i) => {
    if (item) nodes.push({ id: item.id, kind: 'box', pos: cellPos(i), size: BOX, label: item.value, tag: `a[${i}]`, color: ARRAY_COLOR, state: highlight[item.id] });
  });

  const listNodes = state.pending ? [...state.list, state.pending] : state.list;
  for (const n of listNodes) {
    nodes.push({ id: n.id, kind: 'box', pos: cellPos(n.cell), size: BOX, label: n.value, tag: cellAddress(n.cell), color: LIST_COLOR, state: highlight[n.id] });
  }

  const list = state.list;
  nodes.push({ id: 'HEAD', kind: 'marker', pos: [-(COLS / 2 + 0.7) * CELL_W, 0.3, ((ROWS - 1) / 2 - 2) * CELL_D], label: list.length ? 'head' : 'head = NULL' });
  if (list.length) edges.push({ from: 'HEAD', to: list[0].id, color: 0xffffff, arrow: true, curve: 0.8 });

  const dist = (a, b) => {
    const pa = cellPos(a.cell);
    const pb = cellPos(b.cell);
    return Math.hypot(pa[0] - pb[0], pa[2] - pb[2]);
  };
  for (let i = 0; i < list.length - 1; i++) {
    const d = dist(list[i], list[i + 1]);
    edges.push({ from: list[i].id, to: list[i + 1].id, color: NEXT_COLOR, arrow: true, curve: 0.6 + 0.15 * d });
    if (state.kind === 'doubly') edges.push({ from: list[i + 1].id, to: list[i].id, color: PREV_COLOR, arrow: true, curve: 0.25 + 0.06 * d });
  }
  if (state.kind === 'circular' && list.length > 1) {
    edges.push({ from: list.at(-1).id, to: list[0].id, color: NEXT_COLOR, arrow: true, curve: 1.2 + 0.2 * dist(list.at(-1), list[0]) });
  }
  for (const e of state.extra) edges.push({ from: e.from, to: e.to, color: 0xffffff, arrow: true, dashed: true, curve: 0.9 });
  return { nodes, edges };
}

function buildFloor(group) {
  const tile = new THREE.PlaneGeometry(CELL_W * 0.92, CELL_D * 0.9).rotateX(-Math.PI / 2);
  const arrayMat = new THREE.MeshBasicMaterial({ color: 0x1b2d48 });
  const heapMat = new THREE.MeshBasicMaterial({ color: 0x1a1f33 });
  for (let cell = 0; cell < COLS * ROWS; cell++) {
    const mesh = new THREE.Mesh(tile, cell < COLS ? arrayMat : heapMat);
    mesh.position.set(...cellPos(cell, 0));
    group.add(mesh);
  }
  const front = cellPos(0)[2] + CELL_D * 0.65;
  const back = cellPos(COLS * (ROWS - 1))[2] - CELL_D * 0.65;
  group.add(makeLabel(`array: one contiguous block, ${cellAddress(0)} → ${cellAddress(COLS - 1)}`, new THREE.Vector3(0, 0.05, front), 0x7fb3ff, 'floor-label'));
  group.add(makeLabel('free memory: list nodes go wherever malloc finds space', new THREE.Vector3(0, 0.05, back), 0x98a2b8, 'floor-label'));
}
