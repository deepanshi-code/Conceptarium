// DC circuits with three resistors: series, parallel, or R1 in series with (R2 ∥ R3).
// Returns the equivalent resistance, the battery current, and each resistor's current, voltage and power.

export const LAYOUTS = {
  series: 'Series',
  parallel: 'Parallel',
  mixed: 'R1 + (R2 ∥ R3)',
};

const par = (a, b) => (a * b) / (a + b);

export function solveCircuit(layout, V, [R1, R2, R3]) {
  let Req;
  let parts;
  if (layout === 'series') {
    Req = R1 + R2 + R3;
    const I = V / Req;
    parts = [R1, R2, R3].map((R) => ({ R, I, V: I * R }));
  } else if (layout === 'parallel') {
    Req = 1 / (1 / R1 + 1 / R2 + 1 / R3);
    parts = [R1, R2, R3].map((R) => ({ R, I: V / R, V }));
  } else {
    Req = R1 + par(R2, R3);
    const I = V / Req;
    const v23 = I * par(R2, R3);
    parts = [{ R: R1, I, V: I * R1 }, { R: R2, I: v23 / R2, V: v23 }, { R: R3, I: v23 / R3, V: v23 }];
  }
  parts.forEach((p) => { p.P = p.I * p.V; });
  return { Req, I: V / Req, parts };
}
