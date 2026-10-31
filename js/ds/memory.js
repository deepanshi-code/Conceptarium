// A toy model of RAM holding one array and one linked list, so the two can be compared side by side.
// Row 0 of memory is the array (contiguous); list nodes are allocated in random free cells of the other rows.
// Operations return frames ({state, highlight, message}).

export const COLS = 12;
export const ROWS = 4;
export const ARRAY_CAPACITY = COLS;
const BASE = 0x1000;
const CELL_BYTES = 16;

export const cellAddress = (cell) => `0x${(BASE + cell * CELL_BYTES).toString(16)}`;

let nextId = 1;

export function createMemory(kind = 'singly') {
  return {
    kind, // 'singly' | 'doubly' | 'circular'
    array: Array(ARRAY_CAPACITY).fill(null), // contiguous: items occupy indices 0 … length−1
    list: [], // nodes in list order: {id, value, cell}
    pending: null, // a node that exists in memory but is not (or no longer) linked in
    extra: [], // temporary pointers drawn during an operation: {from, to}
  };
}

export const arrayLength = (mem) => mem.array.findIndex((x) => x === null) === -1 ? ARRAY_CAPACITY : mem.array.findIndex((x) => x === null);

export function snapshot(mem) {
  return {
    kind: mem.kind,
    array: mem.array.map((x) => x && { ...x }),
    list: mem.list.map((n) => ({ ...n })),
    pending: mem.pending && { ...mem.pending },
    extra: mem.extra.map((e) => ({ ...e })),
  };
}

const frame = (mem, message, highlight = {}) => ({ state: snapshot(mem), message, highlight });

function allocate(mem, random) {
  const used = new Set(mem.list.map((n) => n.cell));
  if (mem.pending) used.add(mem.pending.cell);
  const free = [];
  for (let c = COLS; c < COLS * ROWS; c++) if (!used.has(c)) free.push(c);
  if (!free.length) return null;
  return free[Math.floor(random() * free.length)];
}

/** Fill both structures with the same values, without animation frames. */
export function seed(mem, values, random = Math.random) {
  values.slice(0, ARRAY_CAPACITY).forEach((value, i) => {
    mem.array[i] = { id: `a${nextId++}`, value };
  });
  for (const value of values) {
    const cell = allocate(mem, random);
    if (cell === null) break;
    mem.list.push({ id: `n${nextId++}`, value, cell });
  }
}

// --- Linked list -------------------------------------------------------------

function walkTo(mem, index, frames, purpose) {
  let hops = 0;
  for (let j = 0; j < index; j++) {
    const n = mem.list[j];
    frames.push(frame(mem, `${purpose}: at node ${j} (${cellAddress(n.cell)}), read its <code>next</code> pointer and jump.`, { [n.id]: 'visit' }));
    hops += 1;
  }
  return hops;
}

export function listInsertAt(mem, index, value, random = Math.random) {
  const frames = [];
  index = Math.max(0, Math.min(index, mem.list.length));
  const hops = walkTo(mem, index, frames, `Walk to position ${index}`);
  const cell = allocate(mem, random);
  if (cell === null) {
    frames.push(frame(mem, 'Out of memory in this demo.'));
    return frames;
  }
  const node = { id: `n${nextId++}`, value, cell };
  mem.pending = node;
  frames.push(frame(mem, `<code>malloc</code> returns a free cell at <b>${cellAddress(cell)}</b>. It can be anywhere: nothing is shifted.`, { [node.id]: 'new' }));

  const successor = mem.list[index] ?? (mem.kind === 'circular' ? mem.list[0] : null);
  if (successor) {
    mem.extra = [{ from: node.id, to: successor.id }];
    frames.push(frame(mem, `Set <code>new.next</code> → ${successor.value}. The old link still exists, so the list is never broken.`, { [node.id]: 'new', [successor.id]: 'visit' }));
  }

  mem.list.splice(index, 0, node);
  mem.pending = null;
  mem.extra = [];
  const who = index === 0 ? '<code>head</code>' : `<code>node${index - 1}.next</code>`;
  const prevNote = mem.kind === 'doubly' ? ' Also set both <code>prev</code> pointers.' : '';
  frames.push(frame(mem, `Point ${who} at the new node.${prevNote} Done: <b>${hops} hop${hops === 1 ? '' : 's'}</b>, <b>0 elements moved</b>.`, { [node.id]: 'new' }));
  return frames;
}

export function listDelete(mem, value) {
  const frames = [];
  const i = mem.list.findIndex((n) => n.value === value);
  const hops = walkTo(mem, i === -1 ? mem.list.length : i, frames, `Search for ${value}`);
  if (i === -1) {
    frames.push(frame(mem, `Reached <code>NULL</code> after ${hops} hops: ${value} is not in the list.`));
    return frames;
  }
  const target = mem.list[i];
  frames.push(frame(mem, `Found ${value} at ${cellAddress(target.cell)}.`, { [target.id]: 'warn' }));

  const successor = mem.list[i + 1] ?? (mem.kind === 'circular' && mem.list.length > 1 ? mem.list[0] : null);
  mem.list.splice(i, 1);
  mem.pending = target;
  mem.extra = successor && successor !== target ? [{ from: target.id, to: successor.id }] : [];
  const who = i === 0 ? '<code>head</code>' : `<code>node${i - 1}.next</code>`;
  frames.push(frame(mem, `Bypass it: ${who} now points ${successor && successor !== target ? `to ${successor.value}` : 'to NULL'}. The node is unreachable but still uses memory.`, { [target.id]: 'warn' }));

  mem.pending = null;
  mem.extra = [];
  frames.push(frame(mem, `<code>free()</code> the node. Done: ${hops} hop${hops === 1 ? '' : 's'}, 0 elements moved. (Forgetting <code>free</code> is a memory leak.)`));
  return frames;
}

export function listGet(mem, index) {
  const frames = [];
  if (index < 0 || index >= mem.list.length) {
    frames.push(frame(mem, `Index ${index} is out of range (length ${mem.list.length}).`));
    return frames;
  }
  const hops = walkTo(mem, index, frames, `Get node ${index}`);
  frames.push(frame(mem, `Reached node ${index} = <b>${mem.list[index].value}</b> after ${hops} hop${hops === 1 ? '' : 's'}. There is no shortcut: the address is only known from the previous node. <b>O(n)</b>.`, { [mem.list[index].id]: 'found' }));
  return frames;
}

// --- Array ----------------------------------------------------------------------

export function arrayGet(mem, index) {
  const frames = [];
  const len = arrayLength(mem);
  if (index < 0 || index >= len) {
    frames.push(frame(mem, `Index ${index} is out of range (length ${len}).`));
    return frames;
  }
  const item = mem.array[index];
  frames.push(frame(mem, `Address of a[${index}] = base + ${index} × ${CELL_BYTES} = ${cellAddress(0)} + ${index * CELL_BYTES} = <b>${cellAddress(index)}</b>. One calculation, no walking: <b>O(1)</b>. Value: ${item.value}.`, { [item.id]: 'found' }));
  return frames;
}

export function arrayInsertAt(mem, index, value) {
  const frames = [];
  const len = arrayLength(mem);
  if (len >= ARRAY_CAPACITY) {
    frames.push(frame(mem, `The array is full. A dynamic array (like a C++ <code>vector</code> or Python <code>list</code>) would now allocate a bigger block and copy all ${len} elements.`));
    return frames;
  }
  index = Math.max(0, Math.min(index, len));
  let moves = 0;
  for (let j = len - 1; j >= index; j--) {
    mem.array[j + 1] = mem.array[j];
    mem.array[j] = null;
    moves += 1;
    frames.push(frame(mem, `Shift a[${j}] → a[${j + 1}] to make room. (move ${moves})`, { [mem.array[j + 1].id]: 'warn' }));
  }
  const item = { id: `a${nextId++}`, value };
  mem.array[index] = item;
  frames.push(frame(mem, `Write ${value} into a[${index}]. Done: <b>${moves} element${moves === 1 ? '' : 's'} moved</b>. Inserting near the front of an array is O(n).`, { [item.id]: 'new' }));
  return frames;
}

export function arrayDelete(mem, index) {
  const frames = [];
  const len = arrayLength(mem);
  if (index < 0 || index >= len) {
    frames.push(frame(mem, `Index ${index} is out of range (length ${len}).`));
    return frames;
  }
  const removed = mem.array[index];
  frames.push(frame(mem, `Remove a[${index}] = ${removed.value}.`, { [removed.id]: 'warn' }));
  mem.array[index] = null;
  let moves = 0;
  for (let j = index + 1; j < len; j++) {
    mem.array[j - 1] = mem.array[j];
    mem.array[j] = null;
    moves += 1;
    frames.push(frame(mem, `Shift a[${j}] → a[${j - 1}] to close the gap. (move ${moves})`, { [mem.array[j - 1].id]: 'warn' }));
  }
  frames.push(frame(mem, `Done: ${moves} element${moves === 1 ? '' : 's'} moved. Arrays must stay contiguous.`));
  return frames;
}
