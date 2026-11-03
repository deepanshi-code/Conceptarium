// Tower of Hanoi, recorded with the recursion call stack at every move, so students can see
// which call is running while each disk moves. Pegs are 0, 1, 2 (A, B, C).

export const PEG_NAMES = ['A', 'B', 'C'];

export function hanoiMoves(n) {
  const moves = [];
  const stack = [];
  const solve = (k, from, to, via) => {
    if (k === 0) return;
    stack.push(`hanoi(${k}, ${PEG_NAMES[from]}→${PEG_NAMES[to]})`);
    solve(k - 1, from, via, to);
    moves.push({ disk: k, from, to, stack: [...stack] });
    solve(k - 1, via, to, from);
    stack.pop();
  };
  solve(n, 0, 2, 1);
  return moves;
}

/** Applies a move to pegs (arrays of disk sizes, bottom first). Returns an error message if it breaks a rule. */
export function applyMove(pegs, from, to) {
  const disk = pegs[from].at(-1);
  if (disk === undefined) return 'That peg is empty.';
  const top = pegs[to].at(-1);
  if (top !== undefined && top < disk) return `Disk ${disk} can't go on top of the smaller disk ${top}.`;
  pegs[to].push(pegs[from].pop());
  return null;
}
