# Conceptarium

> See the concepts you were told to imagine.

Interactive 3D visualizations of engineering concepts that are hard to understand by imagination alone. Built for B.Tech and BCA students.

The landing page has a northern-lights hero with a 3D planet horizon, a "concept sky" where each subject is a constellation of clickable stars, and a searchable catalog of 3D-tilting cards. Inside each concept you can drag and click the 3D objects directly. Every concept opens with a short "Start here" guide and has next/previous navigation.

| Visualization | Subject | What you can do |
|---|---|---|
| **Orthographic Projection** | Engineering Drawing | Place an object in the glass box. Front, top and side views are computed from its edges (feature + silhouette), with hidden lines found by ray-casting. Then unfold the planes into a 1st-angle or 3rd-angle drawing sheet, or switch to a true isometric view. |
| **Development of Surfaces** | Engineering Drawing | Unfold prisms, cylinders, pyramids and cones into their flat sheet-metal patterns. Faces are hinged in a chain, and the fold direction is chosen numerically so the solid closes. Shows the sector angle θ = 360°·r/L and true lengths. |
| **Beams: SFD, BMD & Deflection** | Mechanics | Simply supported or cantilever beams with point loads and UDLs. The beam bends (exaggerated), with the shear force and bending moment diagrams standing behind it and a marker where V = 0 and M peaks. |
| **Fourier Series** | Mathematics | Epicycles with time running into the screen: each term traces a helix, and the wave is the helix's shadow on a wall. Square, sawtooth and triangle waves, with the Gibbs overshoot visible. |
| **Matrix & Eigenvectors** | Engineering Mathematics (Linear Algebra) | Edit a 3×3 matrix, watch space deform from I → A, and see eigenvectors stay on their span. Shows determinant as volume, defective matrices, and complex eigenvalues. |
| **3D Transformations** | Computer Graphics | Build the 4×4 model matrix from T, R, S, change the multiplication order, step through each operation, and compare perspective and orthographic projection matrices. |
| **Gradient Descent** | Machine Learning (Optimization) | Race gradient descent, Momentum and Adam on four loss surfaces: a convex bowl, an ill-conditioned valley, a saddle point and Himmelblau's four minima. Tune the learning rate (see the lr < 2/L stability limit), click to choose a start point, and compare 3D and contour views. |
| **Data Structures** | Data Structures & Algorithms | Six tabs, each animated step by step with an explanation per step. **Linked list vs array** on a floor that represents memory addresses (contiguous vs scattered; singly, doubly and circular). **BST/AVL** with animated LL/RR/LR/RL rotations, balance factors, subtree-height bars, and a plain BST behind for comparison. **Heap** shown as tree and array at once. **B+ tree** with leaf and internal splits, search, and range scans along the leaf chain. **Graphs**: BFS, DFS and Dijkstra, where nodes rise to their distance from the start and the queue / stack / priority queue appears as a live row. **Hashing**: separate chaining (chains as towers), linear and quadratic probing (probe arcs, tombstones), and resize & rehash, with measured vs theoretical probe counts. |

## Run locally

ES modules need a local server (opening `index.html` directly won't work):

```bash
python serve.py
```

Then open http://localhost:5173. `serve.py` is Python's built-in server plus "don't cache" headers, so a normal refresh always shows your latest edits.

## Tests

The eigen-solver (`js/linalg.js`), the optimizers (`js/optim.js`), the data structures (`js/ds/*.js`), the beam solver (`js/mech/beam.js`) and the Fourier series (`js/maths/fourier.js`) have no dependencies and are unit-tested with Node's built-in test runner:

```bash
npm test
```

## Project structure

```
index.html          entry point + Three.js import map (CDN, no build step)
css/style.css
js/main.js          hash router + breadcrumbs / next-prev / coach
js/catalog.js       every concept: subject, blurb, "Start here" steps (drives home, search, navigation)
js/home.js          landing page: hero, concept-sky section, searchable catalog
js/sky.js           3D skies: aurora + planet horizon (hero) and clickable constellations (map)
js/interact.js      drag / click helper for 3D scenes
serve.py            dev server with no-cache headers
js/coach.js         "Start here" onboarding card
js/mech/beam.js     reactions, V(x), M(x), deflection by double integration
js/maths/fourier.js Fourier coefficients and partial sums
js/views/drawing.js, development.js, beam.js, fourier.js
js/stage.js         shared renderer, cameras, orbit controls, axes, labels
js/linalg.js        3x3 determinant, cubic solver, eigenvalues/eigenspaces
js/optim.js         loss surfaces (analytic gradients) + GD / Momentum / Adam
js/ui.js            DOM helpers (matrix inputs, matrix display)
js/views/eigen.js
js/views/transforms.js
js/views/descent.js
js/views/structures.js  DS shell: tabs + step-by-step frame player
js/views/ds/*.js    one file per DS tab (controls + layout)
js/ds/renderer.js   animated node/edge renderer (tweens nodes by id between frames)
js/ds/avl.js, heap.js, bplus.js, memory.js, graph.js, hash.js   pure DS logic that returns animation frames
tests/*.test.mjs
```

## Design decisions

- **Design language:** a northern-lights theme (black-blue night sky, violet → cyan aurora accents) with monospace tags. The landing page takes cues from feedplane.com: blur-in headline, glass search bar, flickering grid, and a 3D planet horizon (a fresnel-rim shader) that rises on scroll.
- **Direct interaction** (`js/interact.js`): pressing on a pickable object takes the gesture from the orbit camera (capture-phase listener), so you drag loads, vector tips and planes and click nodes, while empty space still orbits.
- **Hidden lines are computed, not hand-drawn.** For each view, the edges drawn are sharp feature edges plus silhouette edges (where the faces on either side point towards and away from the viewer). Each edge is sampled, and a ray towards the observer decides whether each piece is visible or hidden.
- **Beam results are tested against textbook formulas** (PL/4, PL³/48EI, wL²/8, 5wL⁴/384EI, PL³/3EI, wL⁴/8EI).
- **Plain ES modules and Three.js from a CDN, with no bundler.** It's easy to read, and it deploys to GitHub Pages as-is.
- **The eigen animation is (1 − t)·I + t·A.** Eigenvectors of A stay eigenvectors of every blend, so they stay on their line for the whole animation. Trade-off: for rotations, the blend shrinks the shape mid-way. The UI says so.
- **Eigenvalues come from the characteristic cubic** (closed form), and eigenvectors from the null space of A − λI via cross products. Repeated eigenvalues are classified by eigenspace dimension (line, plane or all of space).
- **Data-structure logic is pure and returns frames.** Each operation returns snapshots plus a message per step. The renderer matches nodes by id and tweens them, so a rotation or a swap animates without any per-structure animation code. Tests check invariants (AVL balance, heap order, B+ fill and equal leaf depth, sorted leaf chain), check BFS/Dijkstra against Floyd–Warshall, and check every hashing strategy against a `Set`.
- **Gradients are analytic, not numerical**, and tests check them against finite differences. Contour lines use marching triangles (each grid cell split in two), which avoids the ambiguous cases of marching squares.

## Roadmap

- [ ] Engineering Drawing: sections of solids (cutting plane + hatching), projections of points and lines
- [ ] CS: CPU scheduling, sorting algorithms, OSI layers / packet routing
- [ ] More concepts: EM field lines
- [ ] Graphs: directed graphs, topological sort, MST (Prim/Kruskal)
- [ ] B+ tree deletion (borrow/merge)
- [ ] Guided "challenge" mode (e.g. "find a matrix with det = 0 that isn't the zero matrix")
- [ ] Evaluate with real students: a short concept quiz before and after use
