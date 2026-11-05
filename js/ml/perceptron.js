// The perceptron: predict class +1 if w·x + b > 0, else −1. When it gets a point wrong, nudge the line
// towards that point: w += lr·y·x, b += lr·y. Points are { x, z, y } with y = +1 or −1.

export const predict = (w, p) => (w[0] * p.x + w[1] * p.z + w[2] > 0 ? 1 : -1);

export const mistakes = (w, points) => points.filter((p) => predict(w, p) !== p.y);

/**
 * One learning step: find the next misclassified point after `from` (cycling through the data) and update.
 * Returns { w, point, index } or null if everything is already classified correctly.
 */
export function learnStep(w, points, from = 0, lr = 0.2) {
  for (let k = 0; k < points.length; k++) {
    const index = (from + k) % points.length;
    const p = points[index];
    if (predict(w, p) !== p.y) {
      return { w: [w[0] + lr * p.y * p.x, w[1] + lr * p.y * p.z, w[2] + lr * p.y], point: p, index };
    }
  }
  return null;
}

/** Train until no mistakes or `maxSteps` updates. */
export function train(points, { w = [0, 0, 0], lr = 0.2, maxSteps = 5000 } = {}) {
  let steps = 0;
  let from = 0;
  for (; steps < maxSteps; steps++) {
    const r = learnStep(w, points, from, lr);
    if (!r) return { w, steps, converged: true };
    w = r.w;
    from = r.index + 1;
  }
  return { w, steps, converged: false };
}
