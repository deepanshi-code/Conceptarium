// Sorting algorithms that record every step, so the view can replay them side by side.
// Each step is { a: array snapshot, hl: [indices], kind: 'compare' | 'swap' | 'write' | 'done' }.

export const SORTS = {
  bubble: { name: 'Bubble sort', big: 'O(n²)' },
  insertion: { name: 'Insertion sort', big: 'O(n²)' },
  selection: { name: 'Selection sort', big: 'O(n²)' },
  merge: { name: 'Merge sort', big: 'O(n log n)' },
  quick: { name: 'Quick sort', big: 'O(n log n) avg' },
};

export function sortSteps(name, input) {
  const a = [...input];
  const steps = [];
  const stats = { compares: 0, writes: 0 };
  const push = (kind, hl) => steps.push({ a: [...a], hl, kind });
  const less = (i, j) => {
    stats.compares += 1;
    push('compare', [i, j]);
    return a[i] < a[j];
  };
  const swap = (i, j) => {
    [a[i], a[j]] = [a[j], a[i]];
    stats.writes += 2;
    push('swap', [i, j]);
  };

  if (name === 'bubble') {
    for (let end = a.length - 1; end > 0; end--) {
      let swapped = false;
      for (let i = 0; i < end; i++) {
        if (less(i + 1, i)) { swap(i, i + 1); swapped = true; }
      }
      if (!swapped) break; // already sorted: bubble sort's best case is a single pass
    }
  } else if (name === 'insertion') {
    for (let i = 1; i < a.length; i++) {
      for (let j = i; j > 0 && less(j, j - 1); j--) swap(j, j - 1);
    }
  } else if (name === 'selection') {
    for (let i = 0; i < a.length - 1; i++) {
      let min = i;
      for (let j = i + 1; j < a.length; j++) if (less(j, min)) min = j;
      if (min !== i) swap(i, min);
    }
  } else if (name === 'merge') {
    const sort = (lo, hi) => {
      if (hi - lo < 2) return;
      const mid = (lo + hi) >> 1;
      sort(lo, mid);
      sort(mid, hi);
      const merged = [];
      let i = lo;
      let j = mid;
      while (i < mid && j < hi) {
        stats.compares += 1;
        push('compare', [i, j]);
        merged.push(a[j] < a[i] ? a[j++] : a[i++]);
      }
      while (i < mid) merged.push(a[i++]);
      while (j < hi) merged.push(a[j++]);
      // Write the merged run back one value at a time. The not-yet-placed values stay to its right, so every
      // snapshot is still a permutation of the input and no bar ever appears twice on screen.
      const rest = a.slice(lo, hi);
      merged.forEach((v, k) => {
        rest.splice(rest.indexOf(v), 1);
        a[lo + k] = v;
        rest.forEach((r, m) => { a[lo + k + 1 + m] = r; });
        stats.writes += 1;
        push('write', [lo + k]);
      });
    };
    sort(0, a.length);
  } else if (name === 'quick') {
    const sort = (lo, hi) => {
      if (lo >= hi) return;
      let p = lo; // Lomuto partition with the last element as pivot
      for (let i = lo; i < hi; i++) {
        if (less(i, hi)) { if (i !== p) swap(i, p); p += 1; }
      }
      if (p !== hi) swap(p, hi);
      sort(lo, p - 1);
      sort(p + 1, hi);
    };
    sort(0, a.length - 1);
  } else {
    throw new Error(`unknown sort ${name}`);
  }
  push('done', []);
  return { steps, ...stats };
}
