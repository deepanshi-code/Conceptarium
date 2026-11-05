// Page replacement: when memory (a few frames) is full and a new page is needed, which page goes?
// Returns one step per reference: { page, frames (snapshot, null = empty), hit, slot (where it went), victim }.

export const PAGE_ALGOS = {
  fifo: { name: 'FIFO', long: 'Evict the page that came in first' },
  lru: { name: 'LRU', long: 'Evict the page unused for the longest time' },
  opt: { name: 'Optimal', long: 'Evict the page needed farthest in the future (needs to see the future!)' },
};

export function simulate(refs, frameCount, algo) {
  const frames = new Array(frameCount).fill(null);
  const loadedAt = new Array(frameCount).fill(-1);
  const usedAt = new Array(frameCount).fill(-1);
  const steps = [];
  let faults = 0;
  refs.forEach((page, t) => {
    let slot = frames.indexOf(page);
    const hit = slot !== -1;
    let victim = null;
    if (!hit) {
      faults += 1;
      slot = frames.indexOf(null);
      if (slot === -1) {
        if (algo === 'fifo') slot = argMin(loadedAt);
        else if (algo === 'lru') slot = argMin(usedAt);
        else if (algo === 'opt') {
          const nextUse = frames.map((p) => {
            const n = refs.indexOf(p, t + 1);
            return n === -1 ? Infinity : n;
          });
          slot = nextUse.indexOf(Math.max(...nextUse));
        } else throw new Error(`unknown algorithm ${algo}`);
        victim = frames[slot];
      }
      frames[slot] = page;
      loadedAt[slot] = t;
    }
    usedAt[slot] = t;
    steps.push({ page, frames: [...frames], hit, slot, victim });
  });
  return { steps, faults, hits: refs.length - faults };
}

const argMin = (arr) => arr.indexOf(Math.min(...arr));
