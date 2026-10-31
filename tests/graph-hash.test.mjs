import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../js/ds/graph.js';
import * as hash from '../js/ds/hash.js';

// Reference all-pairs shortest paths (Floyd–Warshall) to check BFS and Dijkstra against.
function floyd(graph, unit) {
  const ids = graph.nodes.map((n) => n.id);
  const d = Object.fromEntries(ids.map((a) => [a, Object.fromEntries(ids.map((b) => [b, a === b ? 0 : Infinity]))]));
  for (const { a, b, w } of graph.edges) d[a][b] = d[b][a] = Math.min(d[a][b], unit ? 1 : w);
  for (const k of ids) for (const i of ids) for (const j of ids) if (d[i][k] + d[k][j] < d[i][j]) d[i][j] = d[i][k] + d[k][j];
  return d;
}

const graphs = () => [g.sampleGraph(), ...Array.from({ length: 15 }, () => g.randomGraph(10))];

test('random graphs are connected', () => {
  for (const graph of graphs()) {
    const d = floyd(graph, true);
    for (const n of graph.nodes) assert.ok(Number.isFinite(d.A[n.id]), `${n.id} unreachable`);
  }
});

test('BFS distances equal shortest hop counts', () => {
  for (const graph of graphs()) {
    const ref = floyd(graph, true);
    const final = g.bfs(graph, 'A').at(-1);
    for (const n of graph.nodes) assert.equal(final.dist[n.id], ref.A[n.id]);
  }
});

test('Dijkstra distances equal weighted shortest paths, and parents form those paths', () => {
  for (const graph of graphs()) {
    const ref = floyd(graph, false);
    const final = g.dijkstra(graph, 'A').at(-1);
    const weight = (a, b) => graph.edges.find((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a)).w;
    for (const n of graph.nodes) {
      assert.equal(final.dist[n.id], ref.A[n.id]);
      if (n.id !== 'A') assert.equal(final.dist[final.parent[n.id]] + weight(final.parent[n.id], n.id), final.dist[n.id]);
    }
  }
});

test('DFS visits every node exactly once and finishes with an empty stack', () => {
  for (const graph of graphs()) {
    const frames = g.dfs(graph, 'A');
    const final = frames.at(-1);
    assert.equal(final.done.length, graph.nodes.length);
    assert.equal(new Set(final.done).size, graph.nodes.length);
    assert.equal(final.container.length, 0);
  }
});

test('DFS reports a back edge on a graph with a cycle', () => {
  assert.ok(g.dfs(g.sampleGraph(), 'A').some((f) => f.message.includes('back edge')));
});

// --- Hashing ----------------------------------------------------------------------

test('every collision strategy agrees with a Set through random inserts, deletes and searches', () => {
  for (const mode of Object.keys(hash.MODES)) {
    for (let round = 0; round < 20; round++) {
      const t = hash.createTable(23, mode);
      const ref = new Set();
      for (let step = 0; step < 60; step++) {
        const key = Math.floor(Math.random() * 60);
        // Open addressing cannot exceed its capacity, and quadratic probing is only guaranteed
        // to find a free slot while under half full.
        const cap = { chaining: Infinity, linear: 20, quadratic: 11 }[mode];
        if (Math.random() < 0.6 && ref.size < cap) {
          hash.insert(t, key);
          ref.add(key);
        } else {
          hash.remove(t, key);
          ref.delete(key);
        }
        assert.equal(hash.count(t), ref.size, `${mode}: wrong count`);
      }
      for (let key = 0; key < 60; key++) assert.equal(hash.search(t, key).found, ref.has(key), `${mode}: search(${key}) wrong`);
    }
  }
});

test('a tombstone keeps keys further along the probe sequence findable', () => {
  const t = hash.createTable(11, 'linear');
  [3, 14, 25].forEach((k) => hash.insert(t, k)); // all hash to 3: slots 3, 4, 5
  hash.remove(t, 14);
  assert.ok(t.slots[4].tomb);
  assert.ok(hash.search(t, 25).found, '25 must still be found past the tombstone');
});

test('rehash grows to the next prime ≥ 2m and keeps every key', () => {
  for (const mode of Object.keys(hash.MODES)) {
    const t = hash.createTable(7, mode);
    [1, 8, 15, 3, 10].forEach((k) => hash.insert(t, k));
    hash.rehash(t);
    assert.equal(t.size, 17);
    [1, 8, 15, 3, 10].forEach((k) => assert.ok(hash.search(t, k).found));
    assert.equal(hash.count(t), 5);
  }
});

test('multiples of 10 all collide in a table of size 10, but spread out with a prime size', () => {
  const keys = [10, 20, 30, 40, 50, 60];
  const bad = hash.createTable(10, 'chaining');
  const good = hash.createTable(11, 'chaining');
  keys.forEach((k) => { hash.insert(bad, k); hash.insert(good, k); });
  assert.equal(hash.longestCluster(bad), 6);
  assert.equal(hash.longestCluster(good), 1);
});
