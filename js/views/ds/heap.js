// Tab: binary max-heap shown twice at once: as a tree (upright) and as the array that actually stores it (on the floor).
import * as heap from '../../ds/heap.js';
import { readInt, randomInts, stat } from './common.js';

const TREE_WIDTH = 17;
const LEVEL_GAP = 1.5;
const ARRAY_Z = 4;
const CELL_GAP = 0.82;

export const heapTab = {
  key: 'heap',
  label: 'Heap',
  view: [0.15, 0.55, 1], // high enough to see the array lying on the floor in front
  intro: 'A <b>max-heap</b> is a complete binary tree where every parent ≥ its children. It is stored in a plain <b>array</b> with no pointers: the children of index i are at 2i+1 and 2i+2. The dashed lines link each tree node to its array slot, so every swap moves in both views.',

  mount(ctx) {
    let h = heap.createHeap();

    ctx.controls.innerHTML = `
      <div class="op-inputs">
        <label>Value <input type="number" data-value value="50" min="0" max="99"></label>
      </div>
      <div class="op-group">
        <button class="btn small" data-op="insert">Insert</button>
        <button class="btn small" data-op="extract">Extract max</button>
      </div>
      <div class="op-group">
        <button class="btn small secondary" data-op="build">Build heap from 10 random</button>
        <button class="btn small secondary" data-op="clear">Clear</button>
      </div>
      <label class="check"><input type="checkbox" data-links checked> Show tree ↔ array links</label>
    `;
    const $ = (sel) => ctx.controls.querySelector(sel);
    const links = () => $('[data-links]').checked;
    const toFrames = (frames) => frames.map((f) => ({ message: f.message, layout: layout(f.items, f.highlight, links()) }));

    ctx.controls.querySelectorAll('[data-op]').forEach((btn) => btn.addEventListener('click', () => {
      const op = btn.dataset.op;
      let frames;
      if (op === 'insert') {
        const v = readInt($('[data-value]'));
        if (v === null) return ctx.say('Enter a value from 0 to 99.');
        frames = heap.insert(h, v);
      } else if (op === 'extract') {
        frames = heap.extractMax(h);
      } else if (op === 'build') {
        h = heap.createHeap();
        frames = heap.build(h, randomInts(10));
      } else {
        h = heap.createHeap();
        frames = [{ items: [], highlight: {}, message: 'Empty heap.' }];
      }
      ctx.run(toFrames(frames));
      renderStats();
    }));
    $('[data-links]').addEventListener('change', () => ctx.redraw(layout(h.items, {}, links())));

    // Click any node (in the tree or the array): highlight its parent and children by index arithmetic.
    ctx.onNodeClick = (id) => {
      const itemId = id.replace(/^arr-/, '');
      const i = h.items.findIndex((it) => it.id === itemId);
      if (i < 0) return;
      const at = (k) => h.items[k];
      const p = heap.parent(i);
      const kids = [2 * i + 1, 2 * i + 2].filter((k) => k < h.items.length);
      const hl = { [at(i).id]: 'active' };
      if (i > 0) hl[at(p).id] = 'visit';
      kids.forEach((k) => { hl[at(k).id] = 'new'; });
      $('[data-value]').value = at(i).value;
      const parentText = i > 0 ? `parent at ⌊(${i}−1)/2⌋ = ${p} (value ${at(p).value})` : 'no parent: it is the root';
      const kidText = kids.length ? `children at 2i+1, 2i+2 = ${kids.map((k) => `${k} (value ${at(k).value})`).join(' and ')}` : 'no children: it is a leaf';
      ctx.run([{ message: `Index <b>${i}</b> holds ${at(i).value}: ${parentText}; ${kidText}. No pointers needed, just arithmetic.`, layout: layout(h.items, hl, links()) }]);
    };

    function renderStats() {
      const n = h.items.length;
      ctx.setStats(`
        ${stat('Items', n)}
        ${stat('Height', n ? Math.floor(Math.log2(n)) + 1 : 0)}
        ${stat('Max (root)', n ? h.items[0].value : '-')}
        <p class="hint">parent(i) = ⌊(i−1)/2⌋ · left(i) = 2i+1 · right(i) = 2i+2. Insert and extract-max are O(log n), reading the max is O(1). Heaps power priority queues, Dijkstra's algorithm and heapsort.</p>`);
    }

    const startFrames = heap.build(h, [35, 80, 20, 65, 50, 10, 90]);
    ctx.run(toFrames([{ ...startFrames.at(-1), highlight: {}, message: 'A max-heap of 7 values. Try "Extract max" a few times: the values come out largest first, which is heapsort.' }]));
    renderStats();
  },
};

function layout(items, highlight, showLinks) {
  const nodes = [];
  const edges = [];
  items.forEach((it, i) => {
    const level = Math.floor(Math.log2(i + 1));
    const slot = i - (2 ** level - 1);
    const width = TREE_WIDTH / 2 ** level;
    nodes.push({
      id: it.id, kind: 'ball', size: 0.36,
      pos: [-TREE_WIDTH / 2 + (slot + 0.5) * width, 6 - level * LEVEL_GAP, 0],
      label: it.value, tag: `<span class="idx">${i}</span>`, color: 0x3a5a8c, state: highlight[it.id],
    });
    nodes.push({
      id: `arr-${it.id}`, kind: 'box', size: [0.72, 0.42, 0.72],
      pos: [(i - (items.length - 1) / 2) * CELL_GAP, 0.21, ARRAY_Z],
      label: it.value, tag: `<span class="idx">[${i}]</span>`, color: 0x2f5f8f, state: highlight[it.id],
    });
    if (i > 0) edges.push({ from: items[heap.parent(i)].id, to: it.id, color: 0x55607a });
    if (showLinks) edges.push({ from: it.id, to: `arr-${it.id}`, color: 0x5c9dff, dashed: true, opacity: 0.35 });
  });
  nodes.push({ id: 'lbl-arr', kind: 'marker', pos: [-((items.length + 1) / 2) * CELL_GAP - 1, 0.2, ARRAY_Z], label: 'array' });
  return { nodes, edges };
}
