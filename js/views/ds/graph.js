// Tab: graph traversals. The graph lies on the floor; as an algorithm runs, each node rises to a height
// equal to its distance (BFS, Dijkstra) or DFS-tree depth, so the result is visible as 3D structure.
import * as g from '../../ds/graph.js';
import { stat } from './common.js';

const LIFT = { bfs: 1.4, dfs: 1.1, dijkstra: 0.45 };
const STRIP_Z = 6.5;
const CONTAINER = {
  bfs: 'queue (front → back)',
  dfs: 'stack (bottom → top)',
  dijkstra: 'priority queue (smallest first)',
};
const NOTES = {
  bfs: 'BFS uses a <b>queue</b>: first in, first out. Height = number of edges from the start.',
  dfs: 'DFS uses a <b>stack</b> (here, the recursion stack). Tags show discovery/finish times. Height = depth in the DFS tree.',
  dijkstra: 'Dijkstra uses a <b>priority queue</b> keyed by tentative distance. Numbers on edges are weights. Height = shortest distance.',
};

export const graphTab = {
  key: 'graph',
  label: 'Graphs',
  view: [0.15, 0.85, 1], // high, so the floor layout and the heights are both readable
  intro: 'A graph is drawn flat on the floor. Run a traversal and each node <b>rises to its distance</b> from the start, so BFS forms layers and Dijkstra builds a distance landscape. Gold edges form the traversal tree.',

  mount(ctx) {
    let graph = g.sampleGraph();
    let last = null; // last frame shown, so display toggles can redraw it

    ctx.controls.innerHTML = `
      <div class="op-inputs">
        <label>Algorithm
          <select data-algo>
            <option value="bfs">Breadth-first search (BFS)</option>
            <option value="dfs">Depth-first search (DFS)</option>
            <option value="dijkstra">Dijkstra (weighted shortest paths)</option>
          </select>
        </label>
        <label>Start <select data-start></select></label>
      </div>
      <div class="op-group">
        <button class="btn small" data-run>▶ Run</button>
        <button class="btn small secondary" data-sample>Sample graph</button>
        <button class="btn small secondary" data-random>New random graph</button>
      </div>
      <label class="check"><input type="checkbox" data-lift checked> Lift nodes by distance</label>
      <p class="hint" data-note></p>
    `;
    const $ = (sel) => ctx.controls.querySelector(sel);
    const algo = () => $('[data-algo]').value;
    const lift = () => $('[data-lift]').checked;

    function fillStarts() {
      $('[data-start]').innerHTML = graph.nodes.map((n) => `<option>${n.id}</option>`).join('');
    }

    function idle(message) {
      last = { dist: {}, depth: {}, parent: {}, done: [], container: [], current: null, edge: null, message };
      ctx.run([{ message, layout: layout(graph, last, algo(), lift()) }]);
      renderStats(null);
    }

    $('[data-run]').addEventListener('click', () => {
      const frames = g[algo()](graph, $('[data-start]').value);
      last = frames.at(-1);
      ctx.run(frames.map((f) => ({ message: f.message, layout: layout(graph, f, algo(), lift()) })));
      renderStats(last);
    });
    $('[data-algo]').addEventListener('change', () => {
      $('[data-note]').innerHTML = NOTES[algo()];
      idle(`Press Run to start ${algo().toUpperCase()} from ${$('[data-start]').value}.`);
    });
    $('[data-sample]').addEventListener('click', () => {
      graph = g.sampleGraph();
      fillStarts();
      idle('Sample graph loaded.');
    });
    $('[data-random]').addEventListener('click', () => {
      graph = g.randomGraph(10);
      fillStarts();
      idle('New random graph: each node is joined to its two nearest neighbours, then the pieces are bridged so everything is connected.');
    });
    $('[data-lift]').addEventListener('change', () => ctx.redraw(layout(graph, last, algo(), lift())));

    // Click a node: make it the start and run the selected algorithm from there.
    ctx.onNodeClick = (id) => {
      if (!id.startsWith('g-')) return;
      $('[data-start]').value = id.slice(2);
      $('[data-run]').click();
    };

    function renderStats(final) {
      const V = graph.nodes.length;
      const E = graph.edges.length;
      const result = final
        ? `<p class="hint">${graph.nodes.map((n) => `${n.id}: ${algo() === 'dfs' ? (final.depth[n.id] ?? '–') : fmt(final.dist[n.id])}`).join(' · ')}</p>`
        : '';
      ctx.setStats(`
        ${stat('Vertices V / edges E', `${V} / ${E}`)}
        ${stat('Cost', algo() === 'dijkstra' ? 'O((V+E) log V)' : 'O(V + E)')}
        ${final ? `<div class="row-between"><span>${algo() === 'dfs' ? 'DFS depth' : 'Distance from start'}</span></div>${result}` : ''}
        ${algo() === 'dijkstra' ? '<p class="hint">O((V+E) log V) assumes a binary-heap priority queue. This demo finds the minimum by scanning, which is O(V²): fine for 10 nodes.</p>' : ''}`);
    }

    fillStarts();
    $('[data-note]').innerHTML = NOTES.bfs;
    idle('Pick an algorithm and a start node, then press Run.');
  },
};

const fmt = (d) => (d === undefined || d === Infinity ? '∞' : d);

function layout(graph, f, algo, lift) {
  const nodes = [];
  const edges = [];
  const pos = {};

  for (const n of graph.nodes) {
    const d = algo === 'dfs' ? f.depth[n.id] : f.dist[n.id];
    const reached = d !== undefined && Number.isFinite(d);
    const y = 0.4 + (lift && reached ? d * LIFT[algo] : 0);
    pos[n.id] = [n.x, y, n.z];
    const state = f.current === n.id ? 'active' : f.fresh === n.id ? 'new' : f.container.includes(n.id) ? 'visit' : f.done.includes(n.id) ? 'found' : undefined;
    let tag = null;
    if (algo === 'dfs' && f.disc?.[n.id]) tag = `${f.disc[n.id]}/${f.fin?.[n.id] ?? '…'}`;
    else if (algo !== 'dfs' && Object.keys(f.dist).length) tag = fmt(f.dist[n.id]);
    const running = Object.keys(f.dist).length > 0;
    nodes.push({ id: `g-${n.id}`, kind: 'ball', size: 0.38, pos: pos[n.id], label: n.id, tag, color: running && !reached ? 0x2c3348 : 0x3a5a8c, state });

    // A floor marker and a dashed stem make the height readable from any angle.
    if (y > 0.5) {
      nodes.push({ id: `sh-${n.id}`, kind: 'box', size: [0.3, 0.02, 0.3], pos: [n.x, 0.01, n.z], color: 0x2c3348 });
      edges.push({ from: `g-${n.id}`, to: `sh-${n.id}`, color: 0x5c9dff, dashed: true, opacity: 0.35 });
    }
  }

  const sameEdge = (e, pair) => pair && ((pair[0] === e.a && pair[1] === e.b) || (pair[0] === e.b && pair[1] === e.a));
  for (const e of graph.edges) {
    const tree = f.parent[e.b] === e.a || f.parent[e.a] === e.b;
    const current = sameEdge(e, f.edge);
    edges.push({
      from: `g-${e.a}`, to: `g-${e.b}`,
      color: current ? 0x5c9dff : tree ? 0xffc845 : 0x55607a,
      opacity: current || tree ? 1 : 0.55,
    });
    if (algo === 'dijkstra') {
      const [pa, pb] = [pos[e.a], pos[e.b]];
      nodes.push({ id: `w-${e.a}${e.b}`, kind: 'marker', pos: [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2 + 0.25, (pa[2] + pb[2]) / 2], label: `<small>${e.w}</small>` });
    }
  }

  // The algorithm's container as a row of boxes in front of the graph.
  nodes.push({ id: 'q-title', kind: 'marker', pos: [-7.2, 0.3, STRIP_Z], label: `<small>${CONTAINER[algo]}</small>` });
  f.container.forEach((id, i) => {
    nodes.push({
      id: `q-${id}`, kind: 'box', size: [algo === 'dijkstra' ? 1.25 : 0.8, 0.45, 0.8],
      pos: [-4.6 + i * (algo === 'dijkstra' ? 1.4 : 0.95), 0.23, STRIP_Z],
      label: algo === 'dijkstra' ? `${id}:${f.dist[id]}` : id,
      color: 0x2f5f8f,
      state: (algo === 'dfs' ? i === f.container.length - 1 : i === 0) ? 'active' : undefined,
    });
  });
  return { nodes, edges };
}
