// Undirected weighted graphs and three traversals (BFS, DFS, Dijkstra).
// Each algorithm returns frames: {dist, depth, parent, container, current, edge, done, message}.
// Node positions (x, z) are on the floor; the view lifts nodes by distance.

export function sampleGraph() {
  const pts = {
    A: [-6, -1], B: [-3.5, -3.5], C: [-3, 1.5], D: [-0.5, -1.5], E: [0, 3],
    F: [2.5, -3.5], G: [3, 0.5], H: [5.5, -2], I: [5, 3], J: [-6, 3.5],
  };
  const pairs = ['AB', 'AC', 'AJ', 'BD', 'CD', 'CE', 'CJ', 'DF', 'DG', 'EG', 'EI', 'FH', 'GH', 'GI', 'BF'];
  return build(pts, pairs);
}

/** Random geometric graph: each node joins its two nearest neighbours, then components are bridged. */
export function randomGraph(n = 10, random = Math.random) {
  const pts = {};
  const names = 'ABCDEFGHIJKL'.slice(0, n).split('');
  for (const name of names) {
    let p;
    let tries = 0;
    do {
      p = [Math.round((random() * 13 - 6.5) * 10) / 10, Math.round((random() * 8 - 4) * 10) / 10];
      tries += 1;
    } while (tries < 200 && Object.values(pts).some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 2.2));
    pts[name] = p;
  }
  const d = (a, b) => Math.hypot(pts[a][0] - pts[b][0], pts[a][1] - pts[b][1]);
  const pairs = new Set();
  const key = (a, b) => (a < b ? a + b : b + a);
  for (const a of names) {
    names.filter((b) => b !== a).sort((b, c) => d(a, b) - d(a, c)).slice(0, 2).forEach((b) => pairs.add(key(a, b)));
  }
  // Bridge components with their closest pair until the graph is connected.
  for (;;) {
    const comp = components(names, [...pairs]);
    if (comp.length === 1) break;
    let best = null;
    for (const a of comp[0]) for (const other of comp.slice(1)) for (const b of other) if (!best || d(a, b) < best.d) best = { a, b, d: d(a, b) };
    pairs.add(key(best.a, best.b));
  }
  return build(pts, [...pairs]);
}

function build(pts, pairs) {
  const nodes = Object.entries(pts).map(([id, [x, z]]) => ({ id, x, z }));
  const edges = pairs.map(([a, b]) => ({ a, b, w: Math.max(1, Math.round(Math.hypot(pts[a][0] - pts[b][0], pts[a][1] - pts[b][1]))) }));
  return { nodes, edges };
}

function components(names, pairs) {
  const seen = new Set();
  const out = [];
  for (const s of names) {
    if (seen.has(s)) continue;
    const comp = [];
    const stack = [s];
    seen.add(s);
    while (stack.length) {
      const u = stack.pop();
      comp.push(u);
      for (const [a, b] of pairs) {
        const v = a === u ? b : b === u ? a : null;
        if (v && !seen.has(v)) {
          seen.add(v);
          stack.push(v);
        }
      }
    }
    out.push(comp);
  }
  return out;
}

/** Neighbours in alphabetical order, so every run is reproducible. */
export function adjacency(graph) {
  const adj = new Map(graph.nodes.map((n) => [n.id, []]));
  for (const { a, b, w } of graph.edges) {
    adj.get(a).push({ to: b, w });
    adj.get(b).push({ to: a, w });
  }
  for (const list of adj.values()) list.sort((p, q) => p.to.localeCompare(q.to));
  return adj;
}

function recorder(graph) {
  const st = { dist: {}, depth: {}, parent: {}, done: new Set(), container: [], current: null, edge: null };
  for (const n of graph.nodes) st.dist[n.id] = Infinity;
  const frames = [];
  const push = (message, extra = {}) => frames.push({
    dist: { ...st.dist }, depth: { ...st.depth }, parent: { ...st.parent }, done: [...st.done],
    container: [...st.container], current: st.current, edge: st.edge, message, ...extra,
  });
  return { st, frames, push };
}

const fmt = (d) => (d === Infinity ? '∞' : d);

export function bfs(graph, start) {
  const adj = adjacency(graph);
  const { st, frames, push } = recorder(graph);
  st.dist[start] = 0;
  st.depth[start] = 0;
  st.container = [start];
  push(`Start at ${start} (distance 0) and put it in the <b>queue</b>.`, { fresh: start });
  while (st.container.length) {
    const u = st.container.shift();
    st.current = u;
    st.edge = null;
    push(`Dequeue <b>${u}</b> from the front (FIFO). Look at its neighbours.`);
    for (const { to } of adj.get(u)) {
      st.edge = [u, to];
      if (st.dist[to] !== Infinity) continue;
      st.dist[to] = st.dist[u] + 1;
      st.depth[to] = st.dist[to];
      st.parent[to] = u;
      st.container.push(to);
      push(`${to} is new: distance ${st.dist[to]} (one more than ${u}). Enqueue it at the back.`, { fresh: to });
    }
    st.done.add(u);
    st.edge = null;
  }
  st.current = null;
  const levels = Math.max(...Object.values(st.dist).filter(Number.isFinite));
  push(`Done. BFS explores in <b>layers</b>: every node at distance 1 before any at distance 2, and so on (${levels + 1} layers). That is why BFS finds shortest paths when every edge counts as 1.`);
  return frames;
}

export function dfs(graph, start) {
  const adj = adjacency(graph);
  const { st, frames, push } = recorder(graph);
  const disc = {};
  const fin = {};
  let time = 0;
  let cycleShown = false;

  (function visit(u, depth) {
    disc[u] = ++time;
    st.depth[u] = depth;
    st.dist[u] = depth;
    st.container.push(u);
    st.current = u;
    st.edge = null;
    push(`Visit <b>${u}</b> (discovered at time ${disc[u]}). Push it on the <b>stack</b>.`, { fresh: u, disc: { ...disc }, fin: { ...fin } });
    for (const { to } of adj.get(u)) {
      if (disc[to] === undefined) {
        st.parent[to] = u;
        st.edge = [u, to];
        push(`${to} is unvisited, so go <b>deeper</b> along ${u}–${to} before trying ${u}'s other neighbours.`, { disc: { ...disc }, fin: { ...fin } });
        visit(to, depth + 1);
        st.current = u;
        st.edge = null;
        push(`Back at ${u} (backtracking).`, { disc: { ...disc }, fin: { ...fin } });
      } else if (!cycleShown && to !== st.parent[u] && fin[to] === undefined) {
        cycleShown = true;
        st.edge = [u, to];
        push(`${u}–${to} leads to ${to}, which is still on the stack: a <b>back edge</b>, so the graph has a cycle.`, { disc: { ...disc }, fin: { ...fin } });
      }
    }
    fin[u] = ++time;
    st.container.pop();
    st.done.add(u);
    push(`${u} has no unvisited neighbours left: pop it (finished at time ${fin[u]}).`, { disc: { ...disc }, fin: { ...fin } });
  })(start, 0);

  st.current = null;
  st.edge = null;
  push('Done. DFS dives as deep as possible first, then backtracks. Height shows each node\'s depth in the DFS tree. DFS is the basis of cycle detection, topological sort and finding connected components.', { disc: { ...disc }, fin: { ...fin } });
  return frames;
}

export function dijkstra(graph, start) {
  const adj = adjacency(graph);
  const { st, frames, push } = recorder(graph);
  const pq = () => graph.nodes.map((n) => n.id).filter((id) => !st.done.has(id) && st.dist[id] !== Infinity).sort((a, b) => st.dist[a] - st.dist[b] || a.localeCompare(b));
  st.dist[start] = 0;
  st.container = pq();
  push(`Distance to ${start} is 0; every other node starts at ∞.`, { fresh: start });
  for (;;) {
    const queue = pq();
    if (!queue.length) break;
    const u = queue[0];
    st.container = queue;
    st.current = u;
    st.edge = null;
    push(`Take the node with the smallest tentative distance: <b>${u}</b> (${st.dist[u]}). Its distance is now <b>final</b>: any other route would already be longer.`);
    st.done.add(u);
    st.container = pq();
    for (const { to, w } of adj.get(u)) {
      if (st.done.has(to)) continue;
      st.edge = [u, to];
      const nd = st.dist[u] + w;
      if (nd < st.dist[to]) {
        const old = st.dist[to];
        st.dist[to] = nd;
        st.parent[to] = u;
        st.container = pq();
        push(`Relax ${u}→${to}: ${st.dist[u]} + ${w} = ${nd} < ${fmt(old)}. Update ${to} to ${nd}.`, { fresh: to });
      } else {
        push(`Relax ${u}→${to}: ${st.dist[u]} + ${w} = ${nd} ≥ ${st.dist[to]}. No improvement.`);
      }
    }
  }
  st.current = null;
  st.edge = null;
  push('Done. Height = shortest distance from the start, and the gold edges form the <b>shortest-path tree</b>. Dijkstra needs non-negative weights; negative weights need Bellman–Ford.');
  return frames;
}
