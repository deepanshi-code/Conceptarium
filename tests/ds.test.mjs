import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as avl from '../js/ds/avl.js';
import * as heap from '../js/ds/heap.js';
import * as bp from '../js/ds/bplus.js';
import * as mem from '../js/ds/memory.js';

const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(([, v]) => v);

// --- AVL ----------------------------------------------------------------------

function inorder(n, out = []) {
  if (n) { inorder(n.left, out); out.push(n.key); inorder(n.right, out); }
  return out;
}

function assertAVL(n) {
  if (!n) return 0;
  const hl = assertAVL(n.left);
  const hr = assertAVL(n.right);
  assert.ok(Math.abs(hl - hr) <= 1, `node ${n.key} unbalanced (${hl} vs ${hr})`);
  assert.equal(n.height, 1 + Math.max(hl, hr), `stored height of ${n.key} is wrong`);
  return 1 + Math.max(hl, hr);
}

test('AVL stays balanced and sorted through random inserts and deletes', () => {
  for (let round = 0; round < 30; round++) {
    const t = avl.createTree();
    const keys = shuffle(Array.from({ length: 40 }, (_, i) => i + 1));
    keys.forEach((k) => avl.insert(t, k));
    assertAVL(t.root);
    const toDelete = shuffle(keys).slice(0, 25);
    toDelete.forEach((k) => avl.remove(t, k));
    assertAVL(t.root);
    assert.deepEqual(inorder(t.root), keys.filter((k) => !toDelete.includes(k)).sort((a, b) => a - b));
  }
});

test('sorted inserts: AVL height stays logarithmic, a plain BST becomes a linked list', () => {
  const a = avl.createTree();
  const b = avl.createTree();
  for (let k = 1; k <= 15; k++) {
    avl.insert(a, k);
    avl.insert(b, k, { balance: false });
  }
  assert.equal(avl.treeHeight(a.root), 4);
  assert.equal(avl.treeHeight(b.root), 15);
});

test('AVL reports the double-rotation case it performs', () => {
  const t = avl.createTree();
  avl.insert(t, 30);
  avl.insert(t, 10);
  const frames = avl.insert(t, 20); // 30 → 10 → 20 is the LR case
  assert.ok(frames.some((f) => f.message.includes('LR')));
  assert.equal(t.root.key, 20);
});

test('AVL search finds present keys and rejects missing ones', () => {
  const t = avl.createTree();
  [50, 20, 70, 10, 30].forEach((k) => avl.insert(t, k));
  assert.match(avl.search(t, 30).at(-1).message, /Found 30/);
  assert.match(avl.search(t, 31).at(-1).message, /not present/);
});

// --- Heap ---------------------------------------------------------------------

const assertHeap = (items) => items.forEach((it, i) => i && assert.ok(items[heap.parent(i)].value >= it.value, `heap property broken at ${i}`));

test('heap property holds after inserts and build; extracting yields descending order', () => {
  const values = shuffle(Array.from({ length: 25 }, (_, i) => i * 3));
  const h1 = heap.createHeap();
  values.forEach((v) => heap.insert(h1, v));
  assertHeap(h1.items);

  const h2 = heap.createHeap();
  heap.build(h2, values);
  assertHeap(h2.items);
  const out = [];
  while (h2.items.length) {
    out.push(h2.items[0].value);
    heap.extractMax(h2);
    assertHeap(h2.items);
  }
  assert.deepEqual(out, [...values].sort((a, b) => b - a));
});

// --- B+ tree ------------------------------------------------------------------

function assertBPlus(tree) {
  const maxKeys = tree.order - 1;
  const leafDepths = new Set();
  (function walk(n, depth, isRoot) {
    assert.ok(n.keys.length <= maxKeys, `node over capacity: ${n.keys}`);
    if (!isRoot) assert.ok(n.keys.length >= Math.ceil(tree.order / 2) - 1, `node under-full: ${n.keys}`);
    for (let i = 1; i < n.keys.length; i++) assert.ok(n.keys[i - 1] < n.keys[i]);
    if (n.leaf) return leafDepths.add(depth);
    assert.equal(n.children.length, n.keys.length + 1);
    n.children.forEach((c, i) => {
      if (i > 0) assert.ok(c.keys[0] >= n.keys[i - 1], 'child key below its separator');
      if (i < n.keys.length) assert.ok(c.keys.at(-1) < n.keys[i], 'child key above its separator');
      walk(c, depth + 1, false);
    });
  })(tree.root, 0, true);
  assert.equal(leafDepths.size, 1, 'leaves at different depths');
}

test('B+ tree invariants hold for orders 3, 4 and 5', () => {
  for (const order of [3, 4, 5]) {
    const t = bp.createBPlus(order);
    const keys = shuffle(Array.from({ length: 60 }, (_, i) => i + 1));
    keys.forEach((k) => bp.insert(t, k));
    assertBPlus(t);
    const chain = bp.leaves(t).flatMap((l) => l.keys);
    assert.deepEqual(chain, [...keys].sort((a, b) => a - b), 'leaf chain must list every key in order');
    keys.forEach((k) => assert.ok(bp.search(t, k).found));
    assert.ok(!bp.search(t, 999).found);
  }
});

test('B+ range query walks the leaf chain and returns exactly the keys in range', () => {
  const t = bp.createBPlus(4);
  shuffle(Array.from({ length: 30 }, (_, i) => (i + 1) * 2)).forEach((k) => bp.insert(t, k));
  assert.deepEqual(bp.range(t, 9, 25).result, [10, 12, 14, 16, 18, 20, 22, 24]);
  assert.deepEqual(bp.range(t, 100, 200).result, []);
});

// --- Memory model (array vs linked list) ---------------------------------------

test('linked list insert/delete keeps order and never moves existing nodes', () => {
  const m = mem.createMemory();
  mem.seed(m, [1, 2, 3]);
  const cellsBefore = new Map(m.list.map((n) => [n.id, n.cell]));
  mem.listInsertAt(m, 1, 9);
  assert.deepEqual(m.list.map((n) => n.value), [1, 9, 2, 3]);
  for (const n of m.list) if (cellsBefore.has(n.id)) assert.equal(n.cell, cellsBefore.get(n.id));
  assert.equal(new Set(m.list.map((n) => n.cell)).size, m.list.length, 'two nodes share a cell');
  mem.listDelete(m, 2);
  assert.deepEqual(m.list.map((n) => n.value), [1, 9, 3]);
  assert.equal(m.pending, null);
});

test('array insert shifts the tail right and stays contiguous', () => {
  const m = mem.createMemory();
  mem.seed(m, [1, 2, 3, 4]);
  const frames = mem.arrayInsertAt(m, 1, 9);
  assert.deepEqual(m.array.slice(0, 5).map((x) => x.value), [1, 9, 2, 3, 4]);
  assert.equal(mem.arrayLength(m), 5);
  assert.match(frames.at(-1).message, /3 elements moved/);
  mem.arrayDelete(m, 0);
  assert.deepEqual(m.array.slice(0, 4).map((x) => x.value), [9, 2, 3, 4]);
  assert.equal(m.array[4], null);
});
