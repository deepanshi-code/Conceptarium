# Conceptarium

> See the concepts you were told to imagine.

Interactive 3D visualizations of engineering concepts that are hard to understand by imagination alone. Built for B.Tech and BCA students.

The landing page has a northern-lights hero with a 3D planet horizon, a "concept sky" where each subject is a constellation of clickable stars, and a searchable catalog of 3D-tilting cards. Inside each concept you can drag and click the 3D objects directly.

**Built-in help for students:** every concept ends with a two-question "Check yourself" quiz that explains each answer; the home page tracks what you have explored and mastered (stored only in your browser); <kbd>Ctrl K</kbd> or <kbd>/</kbd> opens quick search; each 3D view has Reset view (<kbd>R</kbd>), Fullscreen (<kbd>F</kbd>) and Screenshot buttons; <kbd>←</kbd> <kbd>→</kbd> move between concepts.

Text is kept short on purpose. Each concept opens with a one-line idea and where you meet it in real life; the longer explanation is folded under "Explain more", and a one-line "Try 1/3" strip suggests what to do next.

| Visualization | Subject | What you can do |
|---|---|---|
| **Orthographic Projection** | Engineering Drawing | Place an object in the glass box. Front, top and side views are computed from its edges (feature + silhouette), with hidden lines found by ray-casting. Then unfold the planes into a 1st-angle or 3rd-angle drawing sheet, or switch to a true isometric view. |
| **Development of Surfaces** | Engineering Drawing | Unfold prisms, cylinders, pyramids and cones into their flat sheet-metal patterns. Faces are hinged in a chain, and the fold direction is chosen numerically so the solid closes. Shows the sector angle θ = 360°·r/L and true lengths. |
| **Sections of Solids** | Engineering Drawing | Drag a cutting plane through a cone, cylinder, pyramid or hex prism. The cut face is hatched, the top piece lifts off, and the true shape is drawn face-on. Cone shortcuts walk through circle, ellipse, parabola and hyperbola. |
| **Beams: SFD, BMD & Deflection** | Mechanics | Simply supported or cantilever beams with point loads and UDLs. The beam bends (exaggerated), with the shear force and bending moment diagrams standing behind it and a marker where V = 0 and M peaks. |
| **Fourier Series** | Mathematics | Epicycles with time running into the screen: each term traces a helix, and the wave is the helix's shadow on a wall. Square, sawtooth and triangle waves, with the Gibbs overshoot visible. |
| **Matrix & Eigenvectors** | Engineering Mathematics (Linear Algebra) | Edit a 3×3 matrix, watch space deform from I → A, and see eigenvectors stay on their span. Shows determinant as volume, defective matrices, and complex eigenvalues. |
| **3D Transformations** | Computer Graphics | Build the 4×4 model matrix from T, R, S, change the multiplication order, step through each operation, and compare perspective and orthographic projection matrices. |
| **Gradient Descent** | Machine Learning (Optimization) | Race gradient descent, Momentum and Adam on four loss surfaces: a convex bowl, an ill-conditioned valley, a saddle point and Himmelblau's four minima. Tune the learning rate (see the lr < 2/L stability limit), click to choose a start point, and compare 3D and contour views. |
| **Data Structures** | Data Structures & Algorithms | Six tabs, each animated step by step with an explanation per step. **Linked list vs array** on a floor that represents memory addresses (contiguous vs scattered; singly, doubly and circular). **BST/AVL** with animated LL/RR/LR/RL rotations, balance factors, subtree-height bars, and a plain BST behind for comparison. **Heap** shown as tree and array at once. **B+ tree** with leaf and internal splits, search, and range scans along the leaf chain. **Graphs**: BFS, DFS and Dijkstra, where nodes rise to their distance from the start and the queue / stack / priority queue appears as a live row. **Hashing**: separate chaining (chains as towers), linear and quadratic probing (probe arcs, tombstones), and resize & rehash, with measured vs theoretical probe counts. |
| **Sorting Race** | Data Structures & Algorithms | Bubble, insertion, selection, merge and quick sort race on the same bars, one step per tick, with a scoreboard. Try nearly-sorted input: insertion sort wins. |
| **CPU Scheduling** | Operating Systems | FCFS, SJF, SRTF, Round Robin and Priority as a 3D Gantt chart. Waiting time is drawn as red glass blocks, and a table compares every scheduler on the same (editable) processes. |
| **Electric Field & Potential** | Physics | Potential is height: + charges are hills, − charges are wells. Drag charges, watch field lines run downhill, and drop a test charge to see it roll along one. |
| **Wave Interference** | Physics | Two sources on water make loud and calm stripes. Drag the sources and a probe; the panel shows the path difference in wavelengths. |
| **Projectile Motion** | Physics | Aim a cannon by dragging its barrel, try to hit a draggable target, and compare arcs on Earth, the Moon, Mars and Jupiter. Live arrows show vₓ staying constant while v_y shrinks, flips and grows. Optional cliff height and air drag. |
| **Logic Gates & Circuits** | Digital Electronics | Click input switches; wires carrying a 1 glow and send pulses to the next gate. Three groups: gates (AND, OR, NOT, NAND, NOR, XOR, XNOR); arithmetic (half/full adder, half/full subtractor, 2-bit multiplier, 1-bit comparator); data routing (2:1 and 4:1 MUX, 1:4 DEMUX, 2:4 decoder, 4:2 priority encoder). Each has a clickable truth table and a one-line explanation of the current inputs. |
| **Flip-Flops, Registers & Counters** | Digital Electronics | D, T, JK and SR flip-flops, a 4-bit parallel-load register, a 4-bit shift register (bits visibly hop right) and a 4-bit up/down counter. Press Clock (or Space, or Auto clock) and watch Q and a live timing diagram. |
| **Tower of Hanoi & Recursion** | Data Structures & Algorithms | Solve it yourself by clicking pegs (illegal moves are explained), or watch the recursive solution with its live call stack. |
| **Stack & Queue** | Data Structures & Algorithms | Push plates into a tube (LIFO) or roll boxes along a conveyor (FIFO); click a middle item to see why it can't leave. A third mode checks balanced brackets with a stack. |
| **Packet Journey** | Computer Networks | A message goes laptop → router → server. Headers join the front on the way down (encapsulation); the router opens it only to the IP header; the receiver unwraps it. TCP/IP or OSI 7. |
| **Binary Search** | Data Structures & Algorithms | A guessing game with sorted, closed boxes: each wrong guess sinks the half that can't hold the target. Then watch binary and linear search on the same boxes. |
| **Simple Harmonic Motion** | Physics | Spring and pendulum with a live x(t) trace and the reference circle that explains SHM. Drag the mass to release it; large pendulum swings visibly fall behind the ideal sine. |
| **Perceptron** | Machine Learning | A tilted score sheet whose floor crossing is the decision line. Train step by step, add points by clicking, and see XOR never converge. |
| **Page Replacement** | Operating Systems | FIFO, LRU and Optimal on an editable request string, with hits and faults as a 3D grid, a comparison table and Belady's anomaly. |
| **Gear Trains** | Mechanics | Simple and compound trains whose teeth really interlock; speed ratio, direction, torque, and what an idler does. |
| **Four-Stroke Engine** | Mechanics | A slider-crank engine with valves, spark and gas colours for intake, compression, power and exhaust, plus piston height vs a pure cosine. |
| **Atomic Orbitals** | Chemistry | Electron configuration for Z = 1 to 36 (Aufbau, Hund's rule, the Cr and Cu exceptions) as orbital boxes, and the 3D shapes of s, p and d orbitals coloured by phase. |
| **Molecular Shapes (VSEPR)** | Chemistry | 14 molecules from BeCl₂ to XeF₄ with lone-pair lobes, measured bond angles, shape names and hybridisation. |
| **Crystal Lattices** | Chemistry | SC, BCC and FCC unit cells; cut atoms to the cell to see the ⅛ and ½ shares, count neighbours, compare packing (52 / 68 / 74%). |
| **DNA to Protein** | Biology | Double helix with A–T / G–C pairs, transcription to mRNA, a ribosome translating codons, and random point mutations labelled silent, missense or nonsense. |
| **Inside a Cell** | Biology | Animal and plant cells in 3D with clickable organelles (job + everyday comparison), a cut-away view and a "find the organelle" game. |

## Run locally

ES modules need a local server (opening `index.html` directly won't work):

```bash
python serve.py
```

Then open http://localhost:5173. `serve.py` is Python's built-in server plus "don't cache" headers, so a normal refresh always shows your latest edits.

## Tests

The eigen-solver (`js/linalg.js`), the optimizers (`js/optim.js`), the data structures (`js/ds/*.js`), the beam solver (`js/mech/beam.js`), the Fourier series (`js/maths/fourier.js`), the sorts, the CPU schedulers and the field solver have no dependencies and are unit-tested with Node's built-in test runner:

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
js/views/drawing.js, development.js, sections.js, beam.js, fourier.js
js/views/sorting.js, scheduling.js, efield.js, waves.js
js/views/projectile.js, logic.js, hanoi.js, stackqueue.js, network.js
js/phys/projectile.js  trajectory with optional v² drag (RK2)
js/digital/logic.js    gates and combinational circuits, truth tables
js/digital/sequential.js  flip-flops, register, shift register, counter
js/views/sequential.js   clock, flip-flops and the timing diagram
js/algo/hanoi.js       moves with the recursion call stack
js/net/packet.js       encapsulation steps through sender, router, receiver
js/views/search.js, shm.js, perceptron.js, paging.js
js/algo/search.js, js/phys/shm.js, js/ml/perceptron.js, js/os/paging.js
js/quiz.js             "Check yourself" questions for every concept
js/progress.js         explored / mastered progress (localStorage)
js/palette.js          Ctrl K quick search
js/toolbar.js          reset view, fullscreen, screenshot
js/chem/orbitals.js, vsepr.js, crystal.js   electron configuration, VSEPR geometry, unit cells
js/mech/gears.js, slidercrank.js            gear trains, piston kinematics, four-stroke timing
js/bio/dna.js                               genetic code, transcription, translation, mutations
js/views/orbitals.js, vsepr.js, crystal.js, gears.js, engine.js, dna.js, cell.js
js/ds/brackets.js      balanced-bracket check with a stack
js/algo/sort.js     sorting algorithms that record every step
js/os/schedule.js   FCFS / SJF / SRTF / Round Robin / Priority
js/phys/field.js    potential, field and field-line tracing for point charges
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
- **Smooth on modest laptops:** a stage stops rendering when it is scrolled off-screen or the tab is hidden, frame time is clamped after pauses, and the resolution steps down if the frame rate stays under 40 fps.
- **CPU scheduling results are tested against textbook examples** (FCFS convoy average wait 17, SJF 3, SRTF 6.5, Round Robin q = 4).
- **Plain ES modules and Three.js from a CDN, with no bundler.** It's easy to read, and it deploys to GitHub Pages as-is.
- **The eigen animation is (1 − t)·I + t·A.** Eigenvectors of A stay eigenvectors of every blend, so they stay on their line for the whole animation. Trade-off: for rotations, the blend shrinks the shape mid-way. The UI says so.
- **Eigenvalues come from the characteristic cubic** (closed form), and eigenvectors from the null space of A − λI via cross products. Repeated eigenvalues are classified by eigenspace dimension (line, plane or all of space).
- **Data-structure logic is pure and returns frames.** Each operation returns snapshots plus a message per step. The renderer matches nodes by id and tweens them, so a rotation or a swap animates without any per-structure animation code. Tests check invariants (AVL balance, heap order, B+ fill and equal leaf depth, sorted leaf chain), check BFS/Dijkstra against Floyd–Warshall, and check every hashing strategy against a `Set`.
- **Gradients are analytic, not numerical**, and tests check them against finite differences. Contour lines use marching triangles (each grid cell split in two), which avoids the ambiguous cases of marching squares.

## Roadmap

- [x] Engineering Drawing: sections of solids (cutting plane + hatching)
- [ ] Engineering Drawing: projections of points and lines
- [x] CS: CPU scheduling, sorting algorithms
- [x] CS: OSI layers / packet routing, logic gates, stack & queue, recursion
- [x] Physics: electric field lines, wave interference
- [x] Physics: projectile motion
- [ ] Physics: magnetic fields
- [ ] Graphs: directed graphs, topological sort, MST (Prim/Kruskal)
- [ ] B+ tree deletion (borrow/merge)
- [ ] Guided "challenge" mode (e.g. "find a matrix with det = 0 that isn't the zero matrix")
- [ ] Evaluate with real students: a short concept quiz before and after use
