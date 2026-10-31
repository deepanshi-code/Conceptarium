// Binary search tree with optional AVL balancing.
// Every operation returns a list of frames ({tree, highlight, message}) so the UI can replay it step by step.

let nextId = 1;
const newNode = (key) => ({ id: `t${nextId++}`, key, left: null, right: null, height: 1 });
const h = (n) => (n ? n.height : 0);
const updateHeight = (n) => { n.height = 1 + Math.max(h(n.left), h(n.right)); };
const balanceFactor = (n) => h(n.left) - h(n.right);

export const createTree = () => ({ root: null });

// Plain nested copy; heights are recomputed by whoever reads it, so mid-operation frames never show stale values.
export function snapshot(n) {
  return n && { id: n.id, key: n.key, left: snapshot(n.left), right: snapshot(n.right) };
}

export function treeHeight(n) {
  return n ? 1 + Math.max(treeHeight(n.left), treeHeight(n.right)) : 0;
}

export function size(n) {
  return n ? 1 + size(n.left) + size(n.right) : 0;
}

const frame = (tree, message, highlight = {}) => ({ tree: snapshot(tree.root), message, highlight });

function rotateRight(y) {
  const x = y.left;
  y.left = x.right;
  x.right = y;
  updateHeight(y);
  updateHeight(x);
  return x;
}

function rotateLeft(x) {
  const y = x.right;
  x.right = y.left;
  y.left = x;
  updateHeight(x);
  updateHeight(y);
  return y;
}

function replaceChild(tree, parent, oldChild, newChild) {
  if (!parent) tree.root = newChild;
  else if (parent.left === oldChild) parent.left = newChild;
  else parent.right = newChild;
}

// Walk back up the search path (root … deepest), fixing heights and rotating wherever |bf| > 1.
function rebalance(tree, path, frames, balance) {
  for (let i = path.length - 1; i >= 0; i--) {
    const node = path[i];
    updateHeight(node);
    if (!balance) continue;
    const bf = balanceFactor(node);
    if (Math.abs(bf) <= 1) continue;

    const parent = path[i - 1] ?? null;
    const type = bf > 1
      ? (balanceFactor(node.left) >= 0 ? 'LL' : 'LR')
      : (balanceFactor(node.right) <= 0 ? 'RR' : 'RL');
    frames.push(frame(tree, `Node <b>${node.key}</b> is unbalanced: balance factor ${bf > 0 ? '+' : ''}${bf}. This is the <b>${type}</b> case.`, { [node.id]: 'warn' }));

    if (type === 'LR') {
      const child = node.left;
      node.left = rotateLeft(child);
      frames.push(frame(tree, `${type} step 1: rotate <b>left</b> at ${child.key}. Now it is a straight LL line.`, { [node.left.id]: 'active', [node.id]: 'warn' }));
    } else if (type === 'RL') {
      const child = node.right;
      node.right = rotateRight(child);
      frames.push(frame(tree, `${type} step 1: rotate <b>right</b> at ${child.key}. Now it is a straight RR line.`, { [node.right.id]: 'active', [node.id]: 'warn' }));
    }

    const top = bf > 1 ? rotateRight(node) : rotateLeft(node);
    replaceChild(tree, parent, node, top);
    frames.push(frame(tree, `Rotate <b>${bf > 1 ? 'right' : 'left'}</b> at ${node.key}: ${top.key} moves up and ${node.key} moves down. In-order (sorted) order is unchanged.`, { [top.id]: 'active', [node.id]: 'visit' }));
  }
}

export function insert(tree, key, { balance = true } = {}) {
  const frames = [];
  const path = [];
  let cur = tree.root;
  while (cur) {
    path.push(cur);
    if (key === cur.key) {
      frames.push(frame(tree, `${key} is already in the tree. A BST stores each key once.`, { [cur.id]: 'found' }));
      return frames;
    }
    const dir = key < cur.key ? 'left' : 'right';
    frames.push(frame(tree, `${key} ${key < cur.key ? '<' : '>'} ${cur.key}: go ${dir}.`, { [cur.id]: 'visit' }));
    cur = cur[dir];
  }

  const node = newNode(key);
  const parent = path.at(-1);
  if (!parent) tree.root = node;
  else parent[key < parent.key ? 'left' : 'right'] = node;
  frames.push(frame(tree, parent ? `Empty spot found: insert ${key} as the ${key < parent.key ? 'left' : 'right'} child of ${parent.key}.` : `Tree is empty: ${key} becomes the root.`, { [node.id]: 'new' }));

  rebalance(tree, path, frames, balance);
  frames.push(frame(tree, balance ? 'Done. Every balance factor is −1, 0 or +1.' : `Done. Height is now ${treeHeight(tree.root)}.`, { [node.id]: 'new' }));
  return frames;
}

export function remove(tree, key, { balance = true } = {}) {
  const frames = [];
  const path = [];
  let cur = tree.root;
  while (cur && cur.key !== key) {
    path.push(cur);
    frames.push(frame(tree, `${key} ${key < cur.key ? '<' : '>'} ${cur.key}: go ${key < cur.key ? 'left' : 'right'}.`, { [cur.id]: 'visit' }));
    cur = key < cur.key ? cur.left : cur.right;
  }
  if (!cur) {
    frames.push(frame(tree, `${key} is not in the tree.`));
    return frames;
  }
  frames.push(frame(tree, `Found ${key}.`, { [cur.id]: 'found' }));

  if (cur.left && cur.right) {
    path.push(cur);
    let succ = cur.right;
    while (succ.left) {
      path.push(succ);
      succ = succ.left;
    }
    frames.push(frame(tree, `${key} has two children. Replace it with its <b>in-order successor</b> ${succ.key} (smallest key in the right subtree).`, { [cur.id]: 'warn', [succ.id]: 'active' }));
    cur.key = succ.key;
    const succParent = path.at(-1);
    if (succParent === cur) cur.right = succ.right;
    else succParent.left = succ.right;
    frames.push(frame(tree, `Copy ${succ.key} up and remove its old node.`, { [cur.id]: 'active' }));
  } else {
    const child = cur.left ?? cur.right;
    replaceChild(tree, path.at(-1) ?? null, cur, child);
    frames.push(frame(tree, child ? `${key} has one child, so link that child straight to ${key}'s parent.` : `${key} is a leaf, so just remove it.`));
  }

  rebalance(tree, path, frames, balance);
  frames.push(frame(tree, balance ? 'Done. The tree is balanced again.' : `Done. Height is now ${treeHeight(tree.root)}.`));
  return frames;
}

export function search(tree, key) {
  const frames = [];
  let cur = tree.root;
  let steps = 0;
  while (cur) {
    steps += 1;
    if (cur.key === key) {
      frames.push(frame(tree, `Found ${key} after ${steps} comparison${steps > 1 ? 's' : ''}. The worst case is the tree's height.`, { [cur.id]: 'found' }));
      return frames;
    }
    frames.push(frame(tree, `${key} ${key < cur.key ? '<' : '>'} ${cur.key}: go ${key < cur.key ? 'left' : 'right'}.`, { [cur.id]: 'visit' }));
    cur = key < cur.key ? cur.left : cur.right;
  }
  frames.push(frame(tree, `Fell off the tree after ${steps} comparisons: ${key} is not present.`));
  return frames;
}
