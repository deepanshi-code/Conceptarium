// Linear vs binary search, recorded step by step. Each step: { i (index looked at), lo, hi, found }.

export function linearSteps(arr, target) {
  const steps = [];
  for (let i = 0; i < arr.length; i++) {
    steps.push({ i, lo: i, hi: arr.length - 1, found: arr[i] === target });
    if (arr[i] === target) break;
  }
  return steps;
}

export function binarySteps(arr, target) {
  const steps = [];
  let lo = 0;
  let hi = arr.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    steps.push({ i: mid, lo, hi, found: arr[mid] === target });
    if (arr[mid] === target) break;
    if (arr[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return steps;
}

/** Most guesses binary search can need for n items: ⌈log₂(n + 1)⌉. */
export const worstBinary = (n) => Math.ceil(Math.log2(n + 1));
