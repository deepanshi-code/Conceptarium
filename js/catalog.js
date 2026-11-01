// Every concept in Conceptarium: drives the home page, search, breadcrumbs, next/prev and the "Start here" coach.
// `path` is the hash route (#/path); data-structure tabs are deep links into the structures view.

export const SUBJECTS = {
  drawing: { name: 'Engineering Drawing', color: '#fb923c' },
  maths: { name: 'Mathematics', color: '#a78bfa' },
  mech: { name: 'Mechanics', color: '#facc15' },
  graphics: { name: 'Computer Graphics', color: '#22d3ee' },
  ml: { name: 'Machine Learning', color: '#f472b6' },
  dsa: { name: 'Data Structures', color: '#4ade80' },
};

export const CATALOG = [
  {
    path: 'drawing', subject: 'drawing', icon: '📐', title: 'Orthographic Projection',
    blurb: 'Put an object in the glass box, see each view projected with hidden lines, then unfold the planes into a drawing sheet.',
    steps: ['<b>Drag the glowing purple grips</b> on the top and side planes to swing them open, or press <b>Unfold</b>.', 'Switch between <b>1st angle</b> and <b>3rd angle</b>: watch where the top and side views end up.', 'Press <b>Drawing sheet</b> for the flat 2D view, or <b>Isometric</b> for the 3D pictorial.'],
  },
  {
    path: 'development', subject: 'drawing', icon: '📦', title: 'Development of Surfaces',
    blurb: 'Unfold prisms, cylinders, pyramids and cones into the flat patterns used in sheet-metal work.',
    steps: ['<b>Grab the solid and drag right</b> to unfold it into its flat pattern (drag left to fold it back).', 'Change the radius and height: the flat pattern updates.', 'For a cone, compare the sector angle with the formula θ = 360° × r / L.'],
  },
  {
    path: 'beam', subject: 'mech', icon: '🌉', title: 'Beams: SFD, BMD & Deflection',
    blurb: 'Load a beam and watch it bend, with the shear force and bending moment diagrams built in 3D behind it.',
    steps: ['<b>Drag the red load arrow</b> (or grab the beam anywhere) and watch the bending moment peak follow it.', 'Switch to a <b>cantilever</b>: where is the moment largest now?', 'Notice the maximum bending moment is where the shear force crosses zero.'],
  },
  {
    path: 'fourier', subject: 'maths', icon: '🌀', title: 'Fourier Series',
    blurb: 'Build a square wave from spinning circles, and see each sine wave as the shadow of a 3D helix.',
    steps: ['Increase the <b>number of terms</b> and watch the wave sharpen.', 'Orbit to look along the time axis: each term is a helix, and its shadow is a sine wave.', 'Look at the corners of the square wave: the ~9% overshoot never goes away (Gibbs phenomenon).'],
  },
  {
    path: 'eigen', subject: 'maths', icon: '🧭', title: 'Matrix & Eigenvectors',
    blurb: 'Watch a 3×3 matrix bend all of space, and see which directions refuse to turn.',
    steps: ['<b>Drag the red, green or blue arrow tips</b>: they are the columns of the matrix, so A changes as you drag.', 'Find the gold eigenvectors: they stay on their dashed lines.', 'Edit any matrix entry and see the eigenvalues update live.'],
  },
  {
    path: 'transforms', subject: 'graphics', icon: '🔄', title: '3D Transformations',
    blurb: 'Build the 4×4 model matrix from translate, rotate and scale, and see why order matters.',
    steps: ['<b>Grab the F-shaped object and drag it</b>: you are editing the translation T. Then change the <b>multiplication order</b> and drag again.', 'Press <b>Animate step by step</b> to see each operation applied.', 'Switch the camera to <b>orthographic</b> and compare the projection matrices.'],
  },
  {
    path: 'descent', subject: 'ml', icon: '⛰️', title: 'Gradient Descent',
    blurb: 'Roll gradient descent, Momentum and Adam down a loss surface. Watch them zig-zag, stall and diverge.',
    steps: ['Press <b>Play</b> and watch the balls roll downhill.', '<b>Click on the surface</b> to drop the balls somewhere new.', 'Push the <b>learning rate</b> past the stability limit and watch it diverge.'],
  },
  {
    path: 'structures/list', subject: 'dsa', icon: '🔗', title: 'Linked List vs Array',
    blurb: 'The floor is memory: arrays are contiguous, list nodes are scattered and joined by pointers.',
    steps: ['<b>Click a list node or array cell</b> to see its memory address.', 'Insert at index 0 into the <b>list</b>, then into the <b>array</b>: compare the step counts.', 'Switch to <b>doubly</b> or <b>circular</b> to see the extra pointers.', 'Use <b>Get a[index]</b> vs <b>Get node[index]</b>: O(1) vs O(n).'],
  },
  {
    path: 'structures/tree', subject: 'dsa', icon: '🌳', title: 'BST & AVL Trees',
    blurb: 'Animated AVL rotations, balance factors, and a plain BST behind for comparison.',
    steps: ['<b>Click any node</b> to search for it, then press Delete to remove it.', 'Press <b>Insert 1…7 in order</b>: the plain BST becomes a chain, the AVL tree stays short.', 'Insert 5 then 3 to watch a single rotation.', 'Delete a node with two children to see the in-order successor in action.'],
  },
  {
    path: 'structures/heap', subject: 'dsa', icon: '🏔️', title: 'Heaps',
    blurb: 'A max-heap shown as a tree and as the array that stores it, with every swap in both.',
    steps: ['<b>Click any node</b> (tree or array) to light up its parent and children: index arithmetic in action.', 'Press <b>Extract max</b> a few times: the values come out largest first.', 'Insert a large value and watch it sift up.', 'Follow the dashed links between tree nodes and array slots.'],
  },
  {
    path: 'structures/bplus', subject: 'dsa', icon: '🗂️', title: 'B+ Trees',
    blurb: 'Node splits, separators climbing up, and range scans along the linked leaves.',
    steps: ['<b>Click a node</b> to inspect it: every node is one disk page.', 'Insert keys until a leaf <b>overflows</b> and splits.', 'Run a <b>range query</b> and follow the green leaf chain.', 'Change the <b>order</b> to see how wider nodes make the tree shorter.'],
  },
  {
    path: 'structures/graph', subject: 'dsa', icon: '🕸️', title: 'Graph Traversals',
    blurb: 'BFS, DFS and Dijkstra, where each node rises to its distance from the start.',
    steps: ['<b>Click any node</b> to start the traversal from there.', 'Run <b>BFS</b>: nodes rise in clean layers.', 'Run <b>Dijkstra</b>: heights become shortest distances.', 'Run <b>DFS</b> and watch the stack grow and shrink.'],
  },
  {
    path: 'structures/hash', subject: 'dsa', icon: '#️⃣', title: 'Hashing',
    blurb: 'Collisions stack up as towers (chaining) or arc across slots (probing).',
    steps: ['<b>Click a key</b> to search for it and watch its probe path.', 'Press <b>Insert 10, 20 … 60</b> with m = 10, then with m = 11.', 'Switch to <b>linear probing</b> and watch the probe arcs.', 'Delete a key to see why open addressing needs <b>tombstones</b>.'],
  },
];

export const findByPath = (path) => CATALOG.find((c) => c.path === path);
