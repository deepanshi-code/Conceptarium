// CPU scheduling: which process gets the CPU, and when. Processes are { id, arrival, burst, priority }.
// Returns the timeline as slices { id, start, end } (id null = CPU idle) plus per-process results.

export const ALGOS = {
  fcfs: { name: 'FCFS', long: 'First come, first served' },
  sjf: { name: 'SJF', long: 'Shortest job first' },
  srtf: { name: 'SRTF', long: 'Shortest remaining time (preemptive)' },
  rr: { name: 'Round Robin', long: 'Everyone gets a turn of q units' },
  priority: { name: 'Priority', long: 'Most important first (1 = highest)' },
};

export function schedule(procs, algo, quantum = 2) {
  const left = new Map(procs.map((p) => [p.id, p.burst]));
  const done = new Map();
  const slices = [];
  const run = (id, start, end) => {
    const last = slices.at(-1);
    if (last && last.id === id && last.end === start) last.end = end;
    else slices.push({ id, start, end });
  };
  const byArrival = [...procs].sort((a, b) => a.arrival - b.arrival || a.id.localeCompare(b.id));
  let t = 0;

  if (algo === 'rr') {
    const queue = [];
    let next = 0;
    const admit = (upTo) => { while (next < byArrival.length && byArrival[next].arrival <= upTo) queue.push(byArrival[next++]); };
    admit(t);
    while (done.size < procs.length) {
      if (!queue.length) {
        const gap = byArrival[next].arrival;
        run(null, t, gap);
        t = gap;
        admit(t);
        continue;
      }
      const p = queue.shift();
      const slice = Math.min(quantum, left.get(p.id));
      run(p.id, t, t + slice);
      t += slice;
      left.set(p.id, left.get(p.id) - slice);
      admit(t); // new arrivals join the queue before the preempted process goes to the back
      if (left.get(p.id) > 0) queue.push(p);
      else done.set(p.id, t);
    }
  } else {
    const preemptive = algo === 'srtf';
    const key = {
      fcfs: (p) => [p.arrival],
      sjf: (p) => [p.burst, p.arrival],
      srtf: (p) => [left.get(p.id), p.arrival],
      priority: (p) => [p.priority, p.arrival],
    }[algo];
    if (!key) throw new Error(`unknown algorithm ${algo}`);
    const better = (a, b) => {
      const ka = key(a);
      const kb = key(b);
      for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] < kb[i];
      return a.id < b.id;
    };
    while (done.size < procs.length) {
      const ready = procs.filter((p) => p.arrival <= t && !done.has(p.id));
      if (!ready.length) {
        const gap = Math.min(...procs.filter((p) => !done.has(p.id)).map((p) => p.arrival));
        run(null, t, gap);
        t = gap;
        continue;
      }
      const p = ready.reduce((best, q) => (better(q, best) ? q : best));
      // Preemptive: run only until the next arrival, which might be shorter.
      const nextArrival = Math.min(Infinity, ...procs.filter((q) => q.arrival > t).map((q) => q.arrival));
      const slice = preemptive ? Math.min(left.get(p.id), nextArrival - t) : left.get(p.id);
      run(p.id, t, t + slice);
      t += slice;
      left.set(p.id, left.get(p.id) - slice);
      if (left.get(p.id) === 0) done.set(p.id, t);
    }
  }

  const results = procs.map((p) => {
    const completion = done.get(p.id);
    const turnaround = completion - p.arrival;
    return { id: p.id, completion, turnaround, waiting: turnaround - p.burst };
  });
  const avg = (k) => results.reduce((s, r) => s + r[k], 0) / results.length;
  return { slices, results, avgWaiting: avg('waiting'), avgTurnaround: avg('turnaround'), makespan: t };
}
