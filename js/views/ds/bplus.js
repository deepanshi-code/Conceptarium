// Tab: B+ tree — wide nodes (disk pages), splits that grow the tree at the root, and a linked leaf level.
import * as bp from '../../ds/bplus.js';
import { readInt, randomInts, stat } from './common.js';

const SLOT_W = 0.62;
const NODE_H = 0.62;
const NODE_D = 0.7;
const LEVEL_GAP = 2.1;
const LEAF_GAP = 0.7;

export const bplusTab = {
  key: 'bplus',
  label: 'B+ Tree',
  view: [0.15, 0.2, 1],
  intro: 'Databases and file systems store indexes as <b>B+ trees</b>. Each node is one disk page holding many keys, so the tree stays very short (few disk reads). All values live in the <b>leaves</b>, which are linked left to right for fast range scans.',

  mount(ctx) {
    let order = 4;
    let tree = bp.createBPlus(order);

    ctx.controls.innerHTML = `
      <label class="field">Order (max children per node)
        <select data-order>
          <option value="3">3 (max 2 keys per node)</option>
          <option value="4" selected>4 (max 3 keys per node)</option>
          <option value="5">5 (max 4 keys per node)</option>
        </select>
      </label>
      <div class="op-inputs">
        <label>Key <input type="number" data-key value="42" min="0" max="99"></label>
        <label>From <input type="number" data-lo value="20" min="0" max="99"></label>
        <label>To <input type="number" data-hi value="45" min="0" max="99"></label>
      </div>
      <div class="op-group">
        <button class="btn small" data-op="insert">Insert key</button>
        <button class="btn small" data-op="search">Search key</button>
        <button class="btn small" data-op="range">Range from → to</button>
      </div>
      <div class="op-group">
        <button class="btn small secondary" data-op="random">Insert 6 random</button>
        <button class="btn small secondary" data-op="reset">Clear</button>
      </div>
      <p class="hint">Deletion (borrowing and merging nodes) is not implemented yet.</p>
    `;
    const $ = (sel) => ctx.controls.querySelector(sel);
    const toFrames = (frames) => frames.map((f) => ({ message: f.message, layout: layout(f.tree, f.order, f.highlight) }));

    ctx.controls.querySelectorAll('[data-op]').forEach((btn) => btn.addEventListener('click', () => {
      const op = btn.dataset.op;
      let frames;
      if (op === 'insert' || op === 'search') {
        const key = readInt($('[data-key]'));
        if (key === null) return ctx.say('Enter a key from 0 to 99.');
        frames = op === 'insert' ? bp.insert(tree, key) : bp.search(tree, key).frames;
      } else if (op === 'range') {
        const lo = readInt($('[data-lo]'));
        const hi = readInt($('[data-hi]'));
        if (lo === null || hi === null || lo > hi) return ctx.say('Enter a range with From ≤ To, both from 0 to 99.');
        frames = bp.range(tree, lo, hi).frames;
      } else if (op === 'random') {
        const existing = bp.leaves(tree).flatMap((l) => l.keys);
        frames = randomInts(6, 99, existing).flatMap((k) => bp.insert(tree, k).map((f) => ({ ...f, message: `<small>[insert ${k}]</small> ${f.message}` })));
      } else {
        tree = bp.createBPlus(order);
        frames = [{ tree: bp.snapshot(tree.root), order, highlight: {}, message: 'Empty tree: a single empty leaf.' }];
      }
      ctx.run(toFrames(frames));
      renderStats();
    }));
    $('[data-order]').addEventListener('change', (e) => {
      order = Number(e.target.value);
      tree = bp.createBPlus(order);
      seedTree();
    });

    function renderStats() {
      const keys = bp.leaves(tree).flatMap((l) => l.keys).length;
      let nodes = 0;
      (function count(n) { nodes++; n.children.forEach(count); })(tree.root);
      ctx.setStats(`
        ${stat('Keys', keys)}
        ${stat('Nodes (disk pages)', nodes)}
        ${stat('Height = reads per search', bp.height(tree))}
        <p class="hint">Real databases use pages of ~4–16 KB, so each node holds hundreds of keys. With 200 keys per node, a height of 4 already indexes 200⁴ = 1.6 billion rows.</p>`);
    }

    function seedTree() {
      const frames = [10, 20, 30, 40, 50, 60, 70].flatMap((k) => bp.insert(tree, k));
      ctx.run(toFrames([{ ...frames.at(-1), highlight: {}, message: `Order ${order}: a node splits when it would hold more than ${order - 1} keys. Insert keys to watch leaves split and separators climb, or run a range query to see the leaf chain in action.` }]));
      renderStats();
    }
    seedTree();
  },
};

function layout(snap, order, highlight) {
  const nodes = [];
  const edges = [];
  const levels = [];
  (function collect(n, depth) {
    (levels[depth] ??= []).push(n);
    n.children.forEach((c) => collect(c, depth + 1));
  })(snap, 0);

  const maxKeys = order - 1;
  const widthOf = (n) => Math.max(maxKeys, n.keys.length) * SLOT_W + 0.2;
  const pos = new Map();
  const leafLevel = levels.length - 1;

  // Leaves are spaced evenly; each internal node is centred over its children.
  const leaves = levels[leafLevel];
  const total = leaves.reduce((s, n) => s + widthOf(n), 0) + LEAF_GAP * (leaves.length - 1);
  let x = -total / 2;
  for (const leaf of leaves) {
    pos.set(leaf.id, x + widthOf(leaf) / 2);
    x += widthOf(leaf) + LEAF_GAP;
  }
  for (let d = leafLevel - 1; d >= 0; d--) {
    for (const n of levels[d]) pos.set(n.id, (pos.get(n.children[0].id) + pos.get(n.children.at(-1).id)) / 2);
  }

  levels.forEach((level, d) => {
    for (const n of level) {
      const w = widthOf(n);
      const cx = pos.get(n.id);
      const y = (leafLevel - d) * LEVEL_GAP + NODE_H / 2;
      nodes.push({
        id: n.id, kind: 'box', size: [w, NODE_H, NODE_D], pos: [cx, y, 0],
        color: n.leaf ? 0x2f5f8f : 0x4a3f7a, state: highlight[n.id],
      });
      // Each key is its own label, placed in its slot. Leaf keys are unique and so are separators,
      // so ids based on the value let keys glide into their new node when a node splits.
      n.keys.forEach((k, i) => {
        nodes.push({
          id: `${n.leaf ? 'k' : 's'}${k}`, kind: 'marker',
          pos: [cx - w / 2 + 0.1 + (i + 0.5) * SLOT_W, y, NODE_D / 2 + 0.01],
          label: k,
        });
      });
      // Child pointer i leaves the parent's bottom edge between key i−1 and key i.
      n.children.forEach((c, i) => {
        edges.push({
          from: n.id, to: c.id, color: 0x8892a6, arrow: true,
          fromOffset: [-w / 2 + 0.1 + i * SLOT_W, -NODE_H / 2, 0],
          toOffset: [0, NODE_H / 2, 0],
        });
      });
    }
  });

  for (let i = 0; i < leaves.length - 1; i++) {
    edges.push({
      from: leaves[i].id, to: leaves[i + 1].id, color: 0x5cdb7f, arrow: true,
      fromOffset: [widthOf(leaves[i]) / 2, 0, 0], toOffset: [-widthOf(leaves[i + 1]) / 2, 0, 0],
    });
  }
  return { nodes, edges };
}
