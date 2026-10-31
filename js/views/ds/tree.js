// Tab: binary search tree with AVL balancing, optionally compared against a plain BST in a plane behind it.
import * as avl from '../../ds/avl.js';
import { readInt, randomInts, stat } from './common.js';

const X_GAP = 1.1;
const Y_GAP = 1.5;
const BST_PLANE_Z = -7;
const BST_PLANE_X = 4; // shifted sideways so the two trees do not hide each other

export const treeTab = {
  key: 'tree',
  label: 'BST / AVL',
  view: [-0.45, 0.3, 1], // slightly from the side, so the height bars and the BST plane behind are visible
  intro: 'A <b>binary search tree</b> keeps smaller keys on the left and larger on the right, so search takes <em>height</em> steps. An <b>AVL tree</b> rotates after each change to keep the height near log₂ n. The number above each node is its <b>balance factor</b>, and the bar behind it is its <b>subtree height</b>.',

  mount(ctx) {
    let tree = avl.createTree();
    let plain = avl.createTree();

    ctx.controls.innerHTML = `
      <div class="op-inputs">
        <label>Key <input type="number" data-key value="25" min="0" max="99"></label>
      </div>
      <div class="op-group">
        <button class="btn small" data-op="insert">Insert</button>
        <button class="btn small" data-op="remove">Delete</button>
        <button class="btn small" data-op="search">Search</button>
      </div>
      <div class="op-group">
        <button class="btn small secondary" data-op="sorted">Insert 1…7 in order</button>
        <button class="btn small secondary" data-op="random">Insert 8 random</button>
        <button class="btn small secondary" data-op="reset">Clear</button>
      </div>
      <label class="check"><input type="checkbox" data-compare checked> Show a plain BST behind (same keys, no balancing)</label>
    `;
    const $ = (sel) => ctx.controls.querySelector(sel);
    const compare = () => $('[data-compare]').checked;

    const toFrames = (frames) => frames.map((f) => ({ message: f.message, layout: layout(f.tree, f.highlight, compare() ? avl.snapshot(plain.root) : null) }));

    function apply(op, key) {
      if (op === 'insert') {
        avl.insert(plain, key, { balance: false });
        return avl.insert(tree, key);
      }
      if (op === 'remove') {
        avl.remove(plain, key, { balance: false });
        return avl.remove(tree, key);
      }
      return avl.search(tree, key);
    }

    // Several inserts in a row: replay them as one long animation.
    function batch(keys) {
      const frames = [];
      for (const k of keys) frames.push(...apply('insert', k).map((f) => ({ ...f, message: `<small>[insert ${k}]</small> ${f.message}` })));
      return frames;
    }

    ctx.controls.querySelectorAll('[data-op]').forEach((btn) => btn.addEventListener('click', () => {
      const op = btn.dataset.op;
      let frames;
      if (op === 'reset') {
        tree = avl.createTree();
        plain = avl.createTree();
        frames = [{ tree: null, highlight: {}, message: 'Empty tree.' }];
      } else if (op === 'sorted') {
        tree = avl.createTree();
        plain = avl.createTree();
        frames = batch([1, 2, 3, 4, 5, 6, 7]);
        frames.push({ tree: avl.snapshot(tree.root), highlight: {}, message: `Sorted input turns the plain BST into a <b>linked list</b> of height ${avl.treeHeight(plain.root)}. The AVL tree has height ${avl.treeHeight(tree.root)}. Search is O(n) vs O(log n).` });
      } else if (op === 'random') {
        frames = batch(randomInts(8, 99, inorderKeys(tree.root)));
      } else {
        const key = readInt($('[data-key]'));
        if (key === null) return ctx.say('Enter a key from 0 to 99.');
        frames = apply(op, key);
      }
      ctx.run(toFrames(frames));
      renderStats();
    }));
    $('[data-compare]').addEventListener('change', () => ctx.redraw(layout(avl.snapshot(tree.root), {}, compare() ? avl.snapshot(plain.root) : null)));

    function renderStats() {
      const n = avl.size(tree.root);
      ctx.setStats(`
        ${stat('Keys', n)}
        ${stat('AVL height', avl.treeHeight(tree.root))}
        ${stat('Plain BST height', avl.treeHeight(plain.root))}
        ${stat('Best possible ⌈log₂(n+1)⌉', n ? Math.ceil(Math.log2(n + 1)) : 0)}
        <p class="hint">An AVL tree's height is at most about 1.44 log₂ n, so search, insert and delete are all O(log n).</p>`);
    }

    tree = avl.createTree();
    plain = avl.createTree();
    const start = batch([40, 20, 60, 10, 30]);
    ctx.run(toFrames([{ ...start.at(-1), highlight: {}, message:'A small balanced tree. Try inserting 5, then 3: watch the rotation.' }]));
    renderStats();
  },
};

function inorderKeys(n, out = []) {
  if (n) {
    inorderKeys(n.left, out);
    out.push(n.key);
    inorderKeys(n.right, out);
  }
  return out;
}

function layoutTree(snap, { prefix, x0 = 0, z, highlight, color, details }) {
  const nodes = [];
  const edges = [];
  const items = [];
  let order = 0;
  (function walk(n, depth) {
    if (!n) return 0;
    const item = { n, depth };
    const hl = walk(n.left, depth + 1);
    item.x = order++;
    items.push(item);
    const hr = walk(n.right, depth + 1);
    item.height = 1 + Math.max(hl, hr);
    item.bf = hl - hr;
    return item.height;
  })(snap, 0);

  for (const it of items) {
    const bad = Math.abs(it.bf) > 1;
    nodes.push({
      id: prefix + it.n.id,
      kind: 'ball',
      size: 0.36,
      pos: [x0 + (it.x - (items.length - 1) / 2) * X_GAP, 5 - it.depth * Y_GAP, z],
      label: it.n.key,
      tag: details ? `<span class="bf${bad ? ' bad' : ''}">${it.bf > 0 ? '+' : ''}${it.bf}</span>` : null,
      pillar: details ? it.height * 0.45 : null,
      color,
      state: highlight[it.n.id],
    });
    for (const child of [it.n.left, it.n.right]) if (child) edges.push({ from: prefix + it.n.id, to: prefix + child.id, color: 0x55607a });
  }
  return { nodes, edges };
}

function layout(snap, highlight, plainSnap) {
  const main = layoutTree(snap, { prefix: '', z: 0, highlight, color: 0x3a5a8c, details: true });
  if (!plainSnap) return main;
  const other = layoutTree(plainSnap, { prefix: 'bst-', x0: BST_PLANE_X, z: BST_PLANE_Z, highlight: {}, color: 0x4a4f63, details: false });
  const labels = [
    { id: 'lbl-avl', kind: 'marker', pos: [0, 6.3, 0], label: 'AVL tree' },
    { id: 'lbl-bst', kind: 'marker', pos: [BST_PLANE_X, 6.3, BST_PLANE_Z], label: 'Plain BST' },
  ];
  return { nodes: [...main.nodes, ...other.nodes, ...labels], edges: [...main.edges, ...other.edges] };
}
