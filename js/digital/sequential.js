// Sequential logic: flip-flops remember one bit and change only on a clock edge. Registers, shift registers and
// counters are rows of flip-flops. Bits are numbers 0/1; multi-bit values are arrays [Q3, Q2, Q1, Q0] (MSB first).

/** Next Q of a single flip-flop at a rising clock edge. */
export const NEXT = {
  D: (q, { D }) => D,
  T: (q, { T }) => (T ? 1 - q : q),
  JK: (q, { J, K }) => (J && K ? 1 - q : J ? 1 : K ? 0 : q),
  SR: (q, { S, R }) => (S && R ? null : S ? 1 : R ? 0 : q), // S = R = 1 is not allowed
};

/** Characteristic tables, for the panel: rows of [inputs, what Q becomes]. */
export const CHARACTERISTIC = {
  D: [[{ D: 0 }, '0 (reset)'], [{ D: 1 }, '1 (set)']],
  T: [[{ T: 0 }, 'Q (hold)'], [{ T: 1 }, 'Q̄ (toggle)']],
  JK: [[{ J: 0, K: 0 }, 'Q (hold)'], [{ J: 0, K: 1 }, '0 (reset)'], [{ J: 1, K: 0 }, '1 (set)'], [{ J: 1, K: 1 }, 'Q̄ (toggle)']],
  SR: [[{ S: 0, R: 0 }, 'Q (hold)'], [{ S: 0, R: 1 }, '0 (reset)'], [{ S: 1, R: 0 }, '1 (set)'], [{ S: 1, R: 1 }, 'not allowed']],
};

export const toNumber = (bits) => bits.reduce((n, b) => n * 2 + b, 0);
export const toBits = (n, width = 4) => Array.from({ length: width }, (_, i) => (n >> (width - 1 - i)) & 1);

/** Parallel-load register: on the clock edge, Q takes the data inputs only if LOAD is 1. */
export const registerNext = (q, data, load) => (load ? [...data] : [...q]);

/** Shift right: the serial input enters at Q3, every bit moves one place right, Q0 falls out. */
export const shiftNext = (q, serialIn) => [serialIn, ...q.slice(0, -1)];

/** Synchronous up counter (wraps at 2^width), or down counter when `down` is set. */
export function counterNext(q, { enable = 1, down = 0 } = {}) {
  if (!enable) return [...q];
  const m = 2 ** q.length;
  return toBits((toNumber(q) + (down ? m - 1 : 1)) % m, q.length);
}
