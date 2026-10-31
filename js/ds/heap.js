// Binary max-heap stored in an array. Operations return frames ({items, highlight, message}).

export const HEAP_CAPACITY = 31; // five full levels

let nextId = 1;
const newItem = (value) => ({ id: `h${nextId++}`, value });

export const createHeap = () => ({ items: [] });
export const parent = (i) => Math.floor((i - 1) / 2);

const frame = (heap, message, highlight = {}) => ({ items: heap.items.map((it) => ({ ...it })), message, highlight });

function swap(heap, i, j) {
  [heap.items[i], heap.items[j]] = [heap.items[j], heap.items[i]];
}

function siftUp(heap, i, frames) {
  const a = heap.items;
  while (i > 0) {
    const p = parent(i);
    if (a[i].value <= a[p].value) {
      frames.push(frame(heap, `${a[i].value} ≤ parent ${a[p].value}: heap property holds, stop.`, { [a[i].id]: 'found', [a[p].id]: 'visit' }));
      return;
    }
    frames.push(frame(heap, `${a[i].value} > parent ${a[p].value} (index ${i} → parent ⌊(${i}−1)/2⌋ = ${p}). Swap.`, { [a[i].id]: 'active', [a[p].id]: 'warn' }));
    swap(heap, i, p);
    i = p;
  }
  frames.push(frame(heap, `${a[0].value} reached the root.`, { [a[0].id]: 'found' }));
}

function siftDown(heap, i, frames) {
  const a = heap.items;
  for (;;) {
    const l = 2 * i + 1;
    const r = 2 * i + 2;
    let largest = i;
    if (l < a.length && a[l].value > a[largest].value) largest = l;
    if (r < a.length && a[r].value > a[largest].value) largest = r;
    if (largest === i) {
      frames.push(frame(heap, l < a.length ? `${a[i].value} is ≥ its children: stop.` : `${a[i].value} is a leaf: stop.`, { [a[i].id]: 'found' }));
      return;
    }
    frames.push(frame(heap, `Children of index ${i} are at 2i+1 = ${l} and 2i+2 = ${r}. The larger child ${a[largest].value} beats ${a[i].value}: swap.`, { [a[i].id]: 'warn', [a[largest].id]: 'active' }));
    swap(heap, i, largest);
    i = largest;
  }
}

export function insert(heap, value) {
  const frames = [];
  if (heap.items.length >= HEAP_CAPACITY) {
    frames.push(frame(heap, `The heap is full (${HEAP_CAPACITY} items) in this demo.`));
    return frames;
  }
  const item = newItem(value);
  heap.items.push(item);
  frames.push(frame(heap, `Append ${value} at the end of the array (index ${heap.items.length - 1}): the next free spot in the bottom level.`, { [item.id]: 'new' }));
  siftUp(heap, heap.items.length - 1, frames);
  return frames;
}

export function extractMax(heap) {
  const frames = [];
  const a = heap.items;
  if (!a.length) {
    frames.push(frame(heap, 'The heap is empty.'));
    return frames;
  }
  const max = a[0];
  frames.push(frame(heap, `The maximum is always at the root, index 0: ${max.value}.`, { [max.id]: 'found' }));
  if (a.length > 1) {
    swap(heap, 0, a.length - 1);
    frames.push(frame(heap, `Move the last item ${a[0].value} to the root, so the tree stays complete.`, { [a[0].id]: 'active', [max.id]: 'warn' }));
  }
  a.pop();
  frames.push(frame(heap, `Remove ${max.value}.`, a.length ? { [a[0].id]: 'active' } : {}));
  if (a.length) siftDown(heap, 0, frames);
  return frames;
}

/** Floyd's bottom-up build: O(n), faster than n separate inserts (O(n log n)). */
export function build(heap, values) {
  const frames = [];
  heap.items = values.slice(0, HEAP_CAPACITY).map(newItem);
  frames.push(frame(heap, 'Start from the array as given. The shape is already a complete tree, but the order is not a heap yet.'));
  for (let i = parent(heap.items.length - 1); i >= 0; i--) {
    frames.push(frame(heap, `Sift down index ${i} (work from the last parent back to the root).`, { [heap.items[i].id]: 'visit' }));
    siftDown(heap, i, frames);
  }
  frames.push(frame(heap, 'Done: every parent ≥ its children. Building bottom-up like this costs O(n).'));
  return frames;
}
