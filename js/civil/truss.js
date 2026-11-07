// Plane trusses by the method of joints, written as one linear system: at every joint ΣFx = 0 and ΣFy = 0.
// Unknowns are the member forces (tension positive) and the support reactions.

/** Gaussian elimination with partial pivoting. A is n×n (array of rows), b length n. */
export function solveLinear(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) throw new Error('Truss is unstable (singular system)');
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

/**
 * nodes: [[x, y]], members: [[i, j]], supports: [{ node, x: bool, y: bool }], loads: [{ node, fx, fy }].
 * Returns { forces (per member, + tension), reactions [{ node, dir, value }] }.
 */
export function solveTruss({ nodes, members, supports, loads }) {
  const reactionDofs = [];
  for (const s of supports) {
    if (s.x) reactionDofs.push({ node: s.node, dir: 'x' });
    if (s.y) reactionDofs.push({ node: s.node, dir: 'y' });
  }
  const m = members.length;
  const n = m + reactionDofs.length;
  if (n !== 2 * nodes.length) throw new Error(`Not statically determinate: ${n} unknowns, ${2 * nodes.length} equations`);
  const A = Array.from({ length: 2 * nodes.length }, () => new Array(n).fill(0));
  const b = new Array(2 * nodes.length).fill(0);
  members.forEach(([i, j], k) => {
    const [xi, yi] = nodes[i];
    const [xj, yj] = nodes[j];
    const L = Math.hypot(xj - xi, yj - yi);
    const cx = (xj - xi) / L;
    const cy = (yj - yi) / L;
    // A tension member pulls each joint towards the other end.
    A[2 * i][k] += cx;
    A[2 * i + 1][k] += cy;
    A[2 * j][k] -= cx;
    A[2 * j + 1][k] -= cy;
  });
  reactionDofs.forEach((r, k) => { A[2 * r.node + (r.dir === 'x' ? 0 : 1)][m + k] = 1; });
  for (const l of loads) {
    b[2 * l.node] -= l.fx ?? 0;
    b[2 * l.node + 1] -= l.fy ?? 0;
  }
  const x = solveLinear(A, b);
  return { forces: x.slice(0, m), reactions: reactionDofs.map((r, k) => ({ ...r, value: x[m + k] })) };
}

/** A Pratt truss bridge: `panels` bays of width w, height h. Bottom nodes 0..panels, top nodes above the inner ones. */
export function prattTruss(panels, w, h) {
  const nodes = [];
  for (let i = 0; i <= panels; i++) nodes.push([i * w, 0]);
  const top = [];
  for (let i = 1; i < panels; i++) { top[i] = nodes.length; nodes.push([i * w, h]); }
  const members = [];
  for (let i = 0; i < panels; i++) members.push([i, i + 1]); // bottom chord
  for (let i = 1; i < panels - 1; i++) members.push([top[i], top[i + 1]]); // top chord
  members.push([0, top[1]], [panels, top[panels - 1]]); // end posts
  for (let i = 1; i < panels; i++) members.push([i, top[i]]); // verticals
  // Diagonals slope down towards the middle (Pratt): in the left half from top[i] to bottom i+1, mirrored on the right.
  for (let i = 1; i < panels - 1; i++) {
    if (i < panels / 2) members.push([top[i], i + 1]);
    else members.push([top[i + 1], i]);
  }
  return { nodes, members, supports: [{ node: 0, x: true, y: true }, { node: panels, x: false, y: true }] };
}
