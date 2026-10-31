// B+ tree (insert, point search, range query). `order` = maximum children per node, so a node holds
// at most order − 1 keys. All keys live in the leaves; internal nodes only hold copies used for routing.
// Deletion (borrow / merge) is not implemented yet.

let nextId = 1;
const newNode = (leaf) => ({ id: `b${nextId++}`, leaf, keys: [], children: [], next: null });

export const createBPlus = (order = 4) => ({ order, root: newNode(true) });

export function snapshot(n) {
  return { id: n.id, leaf: n.leaf, keys: [...n.keys], children: n.children.map(snapshot) };
}

const frame = (tree, message, highlight = {}) => ({ tree: snapshot(tree.root), order: tree.order, message, highlight });

// Index of the child to follow: the number of separator keys ≤ key.
const childIndex = (node, key) => {
  let i = 0;
  while (i < node.keys.length && key >= node.keys[i]) i++;
  return i;
};

export function height(tree) {
  let h = 1;
  for (let n = tree.root; !n.leaf; n = n.children[0]) h++;
  return h;
}

export function leaves(tree) {
  let n = tree.root;
  while (!n.leaf) n = n.children[0];
  const out = [];
  for (; n; n = n.next) out.push(n);
  return out;
}

function descend(tree, key, frames, verb) {
  const path = [];
  let node = tree.root;
  while (!node.leaf) {
    path.push(node);
    const i = childIndex(node, key);
    const why = i === 0 ? `${key} < ${node.keys[0]}` : i === node.keys.length ? `${key} ≥ ${node.keys.at(-1)}` : `${node.keys[i - 1]} ≤ ${key} < ${node.keys[i]}`;
    frames.push(frame(tree, `${verb}: ${why}, so follow pointer ${i + 1}. <small>(1 disk read per level)</small>`, { [node.id]: 'visit' }));
    node = node.children[i];
  }
  return { path, leaf: node };
}

export function insert(tree, key) {
  const frames = [];
  const { path, leaf } = descend(tree, key, frames, `Insert ${key}`);
  if (leaf.keys.includes(key)) {
    frames.push(frame(tree, `${key} is already stored.`, { [leaf.id]: 'found' }));
    return frames;
  }
  leaf.keys.splice(childIndex(leaf, key), 0, key);
  const max = tree.order - 1;
  const overflow = leaf.keys.length > max;
  frames.push(frame(tree, `Insert ${key} into the leaf in sorted position.${overflow ? ` Now it has ${leaf.keys.length} keys, more than the maximum ${max}: <b>overflow</b>.` : ''}`, { [leaf.id]: overflow ? 'warn' : 'new' }));

  let cur = leaf;
  while (cur.keys.length > max) {
    const parentNode = path.pop() ?? null;
    let sep;
    let right;
    let message;
    if (cur.leaf) {
      const mid = Math.ceil(cur.keys.length / 2);
      right = newNode(true);
      right.keys = cur.keys.splice(mid);
      right.next = cur.next;
      cur.next = right;
      sep = right.keys[0];
      message = `Split the leaf in two and <b>copy</b> ${sep} up as a separator. It stays in the leaf too, because leaves must hold every key.`;
    } else {
      const mid = Math.floor(cur.keys.length / 2);
      sep = cur.keys[mid];
      right = newNode(false);
      right.keys = cur.keys.splice(mid + 1);
      cur.keys.pop();
      right.children = cur.children.splice(mid + 1);
      message = `Internal node overflow: split it and <b>move</b> ${sep} up. Internal keys are only signposts, so it is not kept here.`;
    }

    if (!parentNode) {
      const root = newNode(false);
      root.keys = [sep];
      root.children = [cur, right];
      tree.root = root;
      frames.push(frame(tree, `${message} The root split, so a new root is created: B+ trees grow taller at the <b>top</b>, keeping every leaf at the same depth.`, { [root.id]: 'new', [cur.id]: 'active', [right.id]: 'active' }));
      break;
    }
    const idx = parentNode.children.indexOf(cur);
    parentNode.keys.splice(idx, 0, sep);
    parentNode.children.splice(idx + 1, 0, right);
    const parentOverflow = parentNode.keys.length > max;
    frames.push(frame(tree, `${message}${parentOverflow ? ' The parent now overflows too.' : ''}`, { [cur.id]: 'active', [right.id]: 'active', [parentNode.id]: parentOverflow ? 'warn' : 'new' }));
    cur = parentNode;
  }
  frames.push(frame(tree, `Done. Height ${height(tree)}: any key is found in ${height(tree)} node reads.`));
  return frames;
}

export function search(tree, key) {
  const frames = [];
  const { leaf } = descend(tree, key, frames, `Search ${key}`);
  const found = leaf.keys.includes(key);
  frames.push(frame(tree, found ? `Found ${key} in a leaf after reading ${height(tree)} nodes.` : `${key} is not in this leaf, so it is not in the tree. (${height(tree)} nodes read.)`, { [leaf.id]: found ? 'found' : 'warn' }));
  return { frames, found };
}

export function range(tree, lo, hi) {
  const frames = [];
  const { leaf } = descend(tree, lo, frames, `Range [${lo}, ${hi}]: find ${lo}`);
  const result = [];
  for (let n = leaf; n; n = n.next) {
    const hits = n.keys.filter((k) => k >= lo && k <= hi);
    result.push(...hits);
    const done = n.keys.length && n.keys.at(-1) >= hi;
    frames.push(frame(tree, hits.length ? `Collect ${hits.join(', ')} from this leaf.${done ? '' : ' Then follow the leaf\'s <b>next</b> pointer sideways: no need to go back up the tree.'}` : 'No keys in range here.', { [n.id]: hits.length ? 'found' : 'visit' }));
    if (done) break;
  }
  frames.push(frame(tree, `Result: [${result.join(', ')}]. The linked leaf level is why databases use B+ trees for range queries (<code>WHERE x BETWEEN …</code>).`));
  return { frames, result };
}
