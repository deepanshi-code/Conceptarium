// Tab: hash tables. Buckets lie in a row; with chaining, collisions stack up as towers, and with open
// addressing the probe sequence arcs across the slots, so clustering is visible.
import * as hash from '../../ds/hash.js';
import { readInt, randomInts, stat } from './common.js';

const X_GAP = 1.1;
const HOVER_Y = 2.4;
const ITEM = [0.8, 0.5, 0.8];

export const hashTab = {
  key: 'hash',
  label: 'Hashing',
  view: [0.1, 0.45, 1],
  intro: 'A <b>hash table</b> turns a key into a slot index with a hash function, here <code>h(k) = k mod m</code>, giving O(1) average lookup. When two keys land in the same slot (a <b>collision</b>), either chain them in a list (towers) or <b>probe</b> for another slot (arcs).',

  mount(ctx) {
    let table = hash.createTable(11, 'chaining');

    ctx.controls.innerHTML = `
      <div class="op-inputs">
        <label>Strategy
          <select data-mode>
            ${Object.entries(hash.MODES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
          </select>
        </label>
        <label>Table size m
          <select data-size>
            <option>7</option><option>10</option><option selected>11</option><option>13</option>
          </select>
        </label>
      </div>
      <div class="op-inputs">
        <label>Key <input type="number" data-key value="27" min="0" max="99"></label>
      </div>
      <div class="op-group">
        <button class="btn small" data-op="insert">Insert</button>
        <button class="btn small" data-op="search">Search</button>
        <button class="btn small" data-op="remove">Delete</button>
      </div>
      <div class="op-group">
        <button class="btn small secondary" data-op="random">Insert 5 random</button>
        <button class="btn small secondary" data-op="pattern">Insert 10, 20 … 60</button>
        <button class="btn small secondary" data-op="rehash">Resize &amp; rehash</button>
        <button class="btn small secondary" data-op="clear">Clear</button>
      </div>
      <p class="hint">Try "Insert 10, 20 … 60" with m = 10, then with m = 11. A table size sharing a factor with a pattern in the keys funnels them into a few slots, which is why prime sizes are popular.</p>
    `;
    const $ = (sel) => ctx.controls.querySelector(sel);
    const play = (frames) => {
      ctx.run(frames.map((f) => ({ message: f.message, layout: layout(f) })));
      renderStats();
    };
    const keys = () => (table.mode === 'chaining' ? table.slots.flat() : table.slots.filter((c) => c && !c.tomb)).map((x) => x.key);
    const batch = (list) => list.flatMap((k) => hash.insert(table, k).map((f) => ({ ...f, message: `<small>[insert ${k}]</small> ${f.message}` })));

    function reset(message) {
      table = hash.createTable(Number($('[data-size]').value), $('[data-mode]').value);
      play([{ table: hash.snapshot(table), highlight: {}, probes: [], incoming: null, message }]);
    }

    ctx.controls.querySelectorAll('[data-op]').forEach((btn) => btn.addEventListener('click', () => {
      const op = btn.dataset.op;
      if (op === 'clear') return reset('Empty table.');
      if (op === 'random') return play(batch(randomInts(5, 99, keys())));
      if (op === 'pattern') return play(batch([10, 20, 30, 40, 50, 60]));
      if (op === 'rehash') {
        const frames = hash.rehash(table);
        $('[data-size]').value = String(table.size);
        if (!$('[data-size]').querySelector(`option[value="${table.size}"]`)) {
          $('[data-size]').insertAdjacentHTML('beforeend', `<option value="${table.size}">${table.size}</option>`);
          $('[data-size]').value = String(table.size);
        }
        return play(frames);
      }
      const key = readInt($('[data-key]'));
      if (key === null) return ctx.say('Enter a key from 0 to 99.');
      if (op === 'insert') play(hash.insert(table, key));
      else if (op === 'search') play(hash.search(table, key).frames);
      else play(hash.remove(table, key));
    }));
    $('[data-mode]').addEventListener('change', () => reset(`${hash.MODES[$('[data-mode]').value]}: table cleared.`));
    $('[data-size]').addEventListener('change', () => reset(`Table size m = ${$('[data-size]').value}: table cleared.`));

    function renderStats() {
      const n = hash.count(table);
      const alpha = n / table.size;
      const open = table.mode !== 'chaining';
      const limit = open ? 0.5 : 0.75;
      // Expected comparisons for a successful search under uniform hashing (Knuth): chaining 1 + α/2,
      // linear probing ½(1 + 1/(1 − α)).
      const theory = table.mode === 'chaining' ? (1 + alpha / 2).toFixed(2) : table.mode === 'linear' && alpha < 1 ? (0.5 * (1 + 1 / (1 - alpha))).toFixed(2) : '–';
      ctx.setStats(`
        ${stat('Keys n / slots m', `${n} / ${table.size}`)}
        ${stat('Load factor α = n/m', `<span class="${alpha > limit ? 'warn-text' : ''}">${alpha.toFixed(2)}</span>`)}
        ${stat(open ? 'Longest cluster' : 'Longest chain', hash.longestCluster(table))}
        ${stat('Avg. comparisons to find a key', `${hash.averageProbes(table).toFixed(2)} <small>(theory ${theory})</small>`)}
        <p class="hint">${open ? 'Open addressing slows sharply as α → 1, so tables usually resize around α ≈ 0.5–0.7.' : 'Chaining degrades gently, but each chain is a linked list to walk. Java\'s HashMap resizes at α = 0.75.'} The theory column assumes keys spread uniformly, and the patterned keys deliberately break that.</p>`);
    }

    play(batch([27, 15, 49, 4, 38]).slice(-1).map((f) => ({ ...f, highlight: {}, message: 'Five keys hashed into 11 buckets. 27, 49 and 38 all give remainder 5 when divided by 11, so bucket 5 holds a chain of three. 15 and 4 share bucket 4.' })));
  },
};

const slotX = (i, m) => (i - (m - 1) / 2) * X_GAP;

function layout(f) {
  const { size: m, mode, slots } = f.table;
  const h = f.highlight;
  const nodes = [];
  const edges = [];

  for (let i = 0; i < m; i++) {
    nodes.push({ id: `slot-${i}`, kind: 'box', size: [0.95, 0.2, 0.95], pos: [slotX(i, m), 0.1, 0], color: 0x1f2a40, state: h[`slot-${i}`] });
    // Index on the floor in front of the slot, so it never overlaps the key sitting on top.
    nodes.push({ id: `idx-${i}`, kind: 'marker', pos: [slotX(i, m), 0.02, 0.85], label: `<small class="idx">${i}</small>` });
  }
  nodes.push({ id: 'hfn', kind: 'marker', pos: [slotX(-2, m), 0.3, 0], label: `<small>h(k) = k mod ${m}</small>` });

  slots.forEach((cell, i) => {
    if (mode === 'chaining') {
      cell.forEach((item, j) => {
        nodes.push({ id: item.id, kind: 'box', size: ITEM, pos: [slotX(i, m), 0.2 + ITEM[1] / 2 + j * 0.62, 0], label: item.key, color: 0x2f5f8f, state: h[item.id] });
        edges.push({ from: j ? cell[j - 1].id : `slot-${i}`, to: item.id, color: 0xc4a7ff, arrow: true });
      });
    } else if (cell) {
      nodes.push({ id: cell.id, kind: 'box', size: ITEM, pos: [slotX(i, m), 0.2 + ITEM[1] / 2, 0], label: cell.tomb ? '<small>DEL</small>' : cell.key, color: cell.tomb ? 0x444a5c : 0x2f5f8f, state: h[cell.id] });
    }
  });

  if (f.incoming) {
    nodes.push({ id: f.incoming.id, kind: 'box', size: ITEM, pos: [slotX(f.incoming.slot, m), HOVER_Y, 0], label: f.incoming.key, color: 0x6b4fa0, state: 'active' });
  }
  for (let i = 1; i < f.probes.length; i++) {
    edges.push({ from: `slot-${f.probes[i - 1]}`, to: `slot-${f.probes[i]}`, color: 0x5c9dff, arrow: true, dashed: true, curve: 0.7 + 0.08 * Math.abs(f.probes[i] - f.probes[i - 1]) });
  }
  // During a rehash, keys not yet moved wait in a row behind the new table.
  (f.waiting ?? []).forEach((item, k, all) => {
    nodes.push({ id: item.id, kind: 'box', size: ITEM, pos: [(k - (all.length - 1) / 2) * 0.95, ITEM[1] / 2, -3], label: item.key, color: 0x6b4fa0 });
  });
  return { nodes, edges };
}
