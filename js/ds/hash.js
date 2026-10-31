// Hash table with three collision strategies: separate chaining, linear probing and quadratic probing.
// Hash function: h(k) = k mod m. Operations return frames: {table, incoming, probes, highlight, message}.

export const MODES = { chaining: 'Separate chaining', linear: 'Linear probing', quadratic: 'Quadratic probing' };

let nextId = 1;

export function createTable(size = 11, mode = 'chaining') {
  return {
    size,
    mode,
    // chaining: array of arrays of {id, key}; open addressing: null | {id, key} | {id, tomb: true}
    slots: Array.from({ length: size }, () => (mode === 'chaining' ? [] : null)),
  };
}

export const home = (t, key) => key % t.size;
const probeAt = (t, h, i) => (t.mode === 'quadratic' ? (h + i * i) % t.size : (h + i) % t.size);
const isKey = (cell, key) => cell && !cell.tomb && cell.key === key;

export function count(t) {
  return t.mode === 'chaining' ? t.slots.reduce((s, b) => s + b.length, 0) : t.slots.filter((c) => c && !c.tomb).length;
}

export function snapshot(t) {
  return { size: t.size, mode: t.mode, slots: t.slots.map((s) => (Array.isArray(s) ? s.map((x) => ({ ...x })) : s && { ...s })) };
}

const frame = (t, message, { highlight = {}, incoming = null, probes = [] } = {}) => ({ table: snapshot(t), message, highlight, incoming, probes });
const hashMsg = (t, key) => `h(${key}) = ${key} mod ${t.size} = <b>${home(t, key)}</b>.`;

export function insert(t, key) {
  const frames = [];
  const h = home(t, key);
  const item = { id: `k${nextId++}`, key };
  frames.push(frame(t, `Hash the key: ${hashMsg(t, key)} That is its home bucket.`, { incoming: { ...item, slot: h }, highlight: { [`slot-${h}`]: 'visit' } }));

  if (t.mode === 'chaining') {
    const bucket = t.slots[h];
    const existing = bucket.find((x) => x.key === key);
    if (existing) {
      frames.push(frame(t, `${key} is already in bucket ${h}.`, { highlight: { [existing.id]: 'found' } }));
      return frames;
    }
    const n = bucket.length;
    bucket.push(item);
    frames.push(frame(t, n ? `<b>Collision</b>: bucket ${h} already holds ${n} key${n > 1 ? 's' : ''}. Append ${key} to its chain (a linked list). Chain length is now ${n + 1}.` : `Bucket ${h} is empty: store ${key} there.`, { highlight: { [item.id]: 'new' } }));
    return frames;
  }

  const probes = [];
  let firstTomb = null;
  for (let i = 0; i < t.size; i++) {
    const s = probeAt(t, h, i);
    probes.push(s);
    const cell = t.slots[s];
    if (isKey(cell, key)) {
      frames.push(frame(t, `${key} is already stored in slot ${s}.`, { highlight: { [cell.id]: 'found' }, probes: [...probes] }));
      return frames;
    }
    if (cell === null) {
      const target = firstTomb ?? s;
      t.slots[target] = item;
      const note = firstTomb !== null ? ` Reached an empty slot, so ${key} is not already stored; reuse the tombstone at slot ${target}.` : '';
      frames.push(frame(t, `Slot ${s} is free.${note} Store ${key} in slot ${target} after <b>${i + 1} probe${i ? 's' : ''}</b>.`, { highlight: { [item.id]: 'new' }, probes: [...probes] }));
      return frames;
    }
    if (cell.tomb) {
      if (firstTomb === null) firstTomb = s;
      frames.push(frame(t, `Slot ${s} holds a tombstone. Remember it, but keep probing in case ${key} is stored further on.`, { incoming: { ...item, slot: s }, highlight: { [`slot-${s}`]: 'visit' }, probes: [...probes] }));
      continue;
    }
    const next = probeAt(t, h, i + 1);
    const step = t.mode === 'quadratic' ? `(${h} + ${i + 1}²) mod ${t.size} = ${next}` : `${next}`;
    frames.push(frame(t, `<b>Collision</b>: slot ${s} is taken by ${cell.key}. Probe ${i + 2}: try slot ${step}.`, { incoming: { ...item, slot: s }, highlight: { [cell.id]: 'warn', [`slot-${s}`]: 'visit' }, probes: [...probes] }));
  }
  if (firstTomb !== null) {
    t.slots[firstTomb] = item;
    frames.push(frame(t, `No empty slot found, so store ${key} in the tombstone slot ${firstTomb}.`, { highlight: { [item.id]: 'new' }, probes }));
    return frames;
  }
  frames.push(frame(t, t.mode === 'quadratic'
    ? `Tried ${t.size} slots without finding a free one, even though some may be empty. Quadratic probing only guarantees a free slot while the table is under half full (and m is prime). Resize the table.`
    : 'The table is full. Resize it.', { probes }));
  return frames;
}

export function search(t, key) {
  const frames = [];
  const h = home(t, key);
  frames.push(frame(t, `Hash the key: ${hashMsg(t, key)}`, { highlight: { [`slot-${h}`]: 'visit' } }));
  if (t.mode === 'chaining') {
    const bucket = t.slots[h];
    for (let j = 0; j < bucket.length; j++) {
      if (bucket[j].key === key) {
        frames.push(frame(t, `Found ${key} at position ${j + 1} of the chain.`, { highlight: { [bucket[j].id]: 'found' } }));
        return { frames, found: true };
      }
      frames.push(frame(t, `${bucket[j].key} ≠ ${key}: follow the chain.`, { highlight: { [bucket[j].id]: 'visit' } }));
    }
    frames.push(frame(t, `End of chain: ${key} is not in the table.`));
    return { frames, found: false };
  }
  const probes = [];
  for (let i = 0; i < t.size; i++) {
    const s = probeAt(t, h, i);
    probes.push(s);
    const cell = t.slots[s];
    if (cell === null) {
      frames.push(frame(t, `Slot ${s} is empty: ${key} is not in the table (an insert would have put it here). ${i + 1} probe${i ? 's' : ''}.`, { highlight: { [`slot-${s}`]: 'visit' }, probes: [...probes] }));
      return { frames, found: false };
    }
    if (isKey(cell, key)) {
      frames.push(frame(t, `Found ${key} in slot ${s} after ${i + 1} probe${i ? 's' : ''}.`, { highlight: { [cell.id]: 'found' }, probes: [...probes] }));
      return { frames, found: true };
    }
    frames.push(frame(t, cell.tomb ? `Slot ${s} is a tombstone: keep going (do not stop here).` : `Slot ${s} has ${cell.key} ≠ ${key}: keep probing.`, { highlight: { [cell.id]: 'visit' }, probes: [...probes] }));
  }
  frames.push(frame(t, `Probed every slot: ${key} is not in the table.`, { probes }));
  return { frames, found: false };
}

export function remove(t, key) {
  const { frames, found } = search(t, key);
  if (!found) return frames;
  const h = home(t, key);
  if (t.mode === 'chaining') {
    t.slots[h] = t.slots[h].filter((x) => x.key !== key);
    frames.push(frame(t, `Unlink ${key} from the chain. Chaining makes deletion easy.`));
    return frames;
  }
  for (let i = 0; i < t.size; i++) {
    const s = probeAt(t, h, i);
    if (isKey(t.slots[s], key)) {
      const tomb = { id: `tomb${nextId++}`, tomb: true };
      t.slots[s] = tomb;
      frames.push(frame(t, `Replace ${key} with a <b>tombstone</b>, not an empty slot. Otherwise a search for a key further along this probe sequence would stop here too early and report it missing.`, { highlight: { [tomb.id]: 'warn' } }));
      break;
    }
  }
  return frames;
}

export function nextPrime(n) {
  const isPrime = (x) => {
    if (x < 2) return false;
    for (let d = 2; d * d <= x; d++) if (x % d === 0) return false;
    return true;
  };
  while (!isPrime(n)) n++;
  return n;
}

/** Grow to the next prime ≥ 2m and re-insert every key: positions change because h(k) = k mod m changes. */
export function rehash(t) {
  const frames = [];
  const items = t.mode === 'chaining' ? t.slots.flat() : t.slots.filter((c) => c && !c.tomb);
  const oldSize = t.size;
  t.size = nextPrime(oldSize * 2);
  t.slots = Array.from({ length: t.size }, () => (t.mode === 'chaining' ? [] : null));
  // Keep the old keys visible while they are moved one by one.
  const pending = [...items];
  const show = (message, highlight) => {
    const f = frame(t, message, { highlight });
    f.waiting = pending.map((x) => ({ ...x }));
    frames.push(f);
  };
  show(`Load factor too high: allocate a new table of size ${t.size} (the next prime ≥ 2 × ${oldSize}). Every key must be re-hashed, because h(k) = k mod m depends on m.`, {});
  for (const item of items) {
    pending.shift();
    const h = item.key % t.size;
    if (t.mode === 'chaining') {
      t.slots[h].push(item);
    } else {
      // The new table is at most half full and m is prime, so even quadratic probing finds a free slot.
      let i = 0;
      while (t.slots[probeAt(t, h, i)] !== null && i < t.size) i++;
      t.slots[probeAt(t, h, i)] = item;
    }
    show(`${item.key} mod ${t.size} = ${h}.`, { [item.id]: 'active' });
  }
  show(`Done: ${items.length} keys moved. Resizing costs O(n), but doubling makes it rare, so inserts stay O(1) on average (amortised).`, {});
  return frames;
}

/** Average number of comparisons to find each stored key (successful search). */
export function averageProbes(t) {
  let total = 0;
  let n = 0;
  if (t.mode === 'chaining') {
    for (const b of t.slots) b.forEach((_, j) => { total += j + 1; n++; });
  } else {
    for (const cell of t.slots) {
      if (!cell || cell.tomb) continue;
      const h = home(t, cell.key);
      let i = 0;
      while (!isKey(t.slots[probeAt(t, h, i)], cell.key)) i++;
      total += i + 1;
      n++;
    }
  }
  return n ? total / n : 0;
}

/** Longest chain (chaining) or longest run of consecutive occupied slots (open addressing). */
export function longestCluster(t) {
  if (t.mode === 'chaining') return Math.max(0, ...t.slots.map((b) => b.length));
  let best = 0;
  let run = 0;
  for (let i = 0; i < t.size * 2; i++) {
    run = t.slots[i % t.size] ? run + 1 : 0;
    best = Math.max(best, Math.min(run, t.size));
  }
  return best;
}
