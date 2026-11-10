// "Check yourself": two quick questions at the bottom of every concept panel. Each answer explains itself,
// and the best score is saved (progress.js) so the home page can show which concepts are mastered.
import { recordQuiz, progressFor } from './progress.js';

// [question, [options], index of the right option, why]
const Q = {
  drawing: [
    ['In first-angle projection, where is the top view drawn?', ['Above the front view', 'Below the front view', 'Right of the front view'], 1, 'In 1st angle the object sits between you and the plane, so the top view drops below the front view. 3rd angle puts it above.'],
    ['How are hidden edges drawn?', ['Thick solid lines', 'Dashed lines', 'Chain (dot-dash) lines'], 1, 'Hidden edges are dashed. Chain lines are for centre lines.'],
  ],
  development: [
    ['A cone (base radius r, slant height L) unfolds into a sector of angle…', ['360° × r / L', '360° × L / r', '180° × r / L'], 0, 'The sector arc must equal the base circumference 2πr, on a circle of radius L.'],
    ['The curved surface of a cylinder unfolds into a…', ['Sector', 'Rectangle', 'Trapezium'], 1, 'A rectangle: height h, width πd.'],
  ],
  sections: [
    ['Cutting a cone parallel to its slanted side gives a…', ['Ellipse', 'Parabola', 'Hyperbola'], 1, 'Equal angle to the side → parabola. Flatter → ellipse, steeper → hyperbola.'],
    ['Cutting a cylinder parallel to its base gives a…', ['Circle', 'Ellipse', 'Rectangle'], 0, 'Parallel to the base, every cut is a copy of the base circle.'],
  ],
  beam: [
    ['Simply supported beam, span L, point load P at the centre. Maximum bending moment?', ['PL/2', 'PL/4', 'PL/8'], 1, 'Each support takes P/2; at the middle M = (P/2)(L/2) = PL/4.'],
    ['The bending moment is largest where the shear force is…', ['Largest', 'Zero (changes sign)', 'Equal to the load'], 1, 'V = dM/dx, so M peaks where V crosses zero.'],
  ],
  fourier: [
    ['Which harmonics make up a square wave?', ['Only odd ones (1, 3, 5…)', 'Only even ones', 'All of them'], 0, 'The square wave is (4/π)(sin t + sin 3t/3 + sin 5t/5 + …).'],
    ['The ~9% overshoot next to a jump, which never shrinks with more terms, is called…', ['Aliasing', 'Gibbs phenomenon', 'Resonance'], 1, 'Gibbs: the spike gets narrower with more terms but not lower.'],
  ],
  eigen: [
    ['If Av = λv (v ≠ 0), then v is…', ['An eigenvector, with eigenvalue λ', 'Always a unit vector', 'Always the zero vector'], 0, 'A only stretches v by λ; it does not turn it.'],
    ['If det(A) = 0, then…', ['A doubles every volume', 'A squashes space flat (one eigenvalue is 0)', 'A is a rotation'], 1, 'det is the volume scale factor; 0 means some direction collapses.'],
  ],
  transforms: [
    ['With column vectors, M = T · R · S is applied to a point in which order?', ['Scale, then rotate, then translate', 'Translate, then rotate, then scale', 'Order does not matter'], 0, 'The matrix nearest the point (S) acts first.'],
    ['Why use 4×4 matrices for 3D?', ['To include time', 'So translation is also a matrix multiplication', 'To store colour'], 1, 'Homogeneous coordinates turn a shift into a matrix product, so everything chains together.'],
  ],
  descent: [
    ['If the learning rate is too large, gradient descent can…', ['Overshoot and diverge', 'Always converge faster', 'Never move'], 0, 'Past lr = 2/L each step overshoots more than the last.'],
    ['Momentum mainly helps by…', ['Computing exact second derivatives', 'Smoothing zig-zags in narrow valleys', 'Removing the need for gradients'], 1, 'It averages past steps, so side-to-side bounces cancel and the downhill part adds up.'],
  ],
  'structures/list': [
    ['Getting the i-th element costs…', ['Array O(1), linked list O(n)', 'Both O(1)', 'Array O(n), linked list O(1)'], 0, 'An array computes the address directly; a list must walk node by node.'],
    ['Inserting at the front is O(1) for…', ['An array', 'A linked list', 'Neither'], 1, 'A list just rewires one pointer; an array must shift every element.'],
  ],
  'structures/tree': [
    ['Insert 1, 2, 3, 4, 5 in that order into a plain BST. You get…', ['A balanced tree', 'A chain of height 5', 'An error'], 1, 'Each key goes right of the last: a linked list in disguise. AVL fixes this with rotations.'],
    ['An AVL tree keeps every balance factor in…', ['{−1, 0, 1}', '{0}', '{−2 … 2}'], 0, 'As soon as a node reaches ±2, a rotation brings it back.'],
  ],
  'structures/heap': [
    ['In a 0-indexed array heap, the children of index i are at…', ['2i + 1 and 2i + 2', 'i + 1 and i + 2', 'i / 2'], 0, 'Level by level packing gives this formula, so no pointers are needed.'],
    ['Extract-max from a heap of n items costs…', ['O(1)', 'O(log n)', 'O(n)'], 1, 'The last item moves to the root and sifts down one level at a time.'],
  ],
  'structures/bplus': [
    ['In a B+ tree, the actual records (or pointers to them) are kept in…', ['Leaf nodes only', 'Every node', 'The root only'], 0, 'Inner nodes only hold separator keys to guide the search.'],
    ['Why are B+ trees wide and short?', ['Fewer levels means fewer disk reads', 'They use less memory than arrays', 'Sorting becomes free'], 0, 'Each node is one disk page; a short tree finds any key in 3–4 reads.'],
  ],
  'structures/graph': [
    ['BFS uses which structure to remember what to visit next?', ['Queue', 'Stack', 'Heap'], 0, 'First in, first out keeps the visit order layer by layer.'],
    ['Dijkstra’s algorithm can give wrong answers when the graph has…', ['Cycles', 'Negative edge weights', 'More than 100 nodes'], 1, 'It assumes a settled node can never get cheaper, which negative edges break.'],
  ],
  'structures/hash': [
    ['Two keys landing in the same slot is called a…', ['Rotation', 'Collision', 'Overflow'], 1, 'Chaining or probing then decides where the second key goes.'],
    ['Why does open addressing mark deleted slots with a tombstone?', ['To save memory', 'An empty slot would cut probe chains, losing keys', 'To keep keys sorted'], 1, 'Searches stop at a truly empty slot, so keys further along the chain would become unreachable.'],
  ],
  stackqueue: [
    ['The Undo button in an editor is best modelled by a…', ['Queue', 'Stack', 'Heap'], 1, 'The most recent action is undone first: last in, first out.'],
    ['Print jobs waiting for a printer form a…', ['Queue', 'Stack', 'Tree'], 0, 'The first job sent is printed first: first in, first out.'],
  ],
  sorting: [
    ['On input that is already sorted, insertion sort takes…', ['O(n)', 'O(n log n)', 'O(n²)'], 0, 'Each new item is compared once and stays where it is.'],
    ['Merge sort’s running time is…', ['O(n log n) in every case', 'O(n²) in the worst case', 'O(n)'], 0, 'It always splits in half (log n levels) and merges each level in O(n).'],
  ],
  hanoi: [
    ['The fewest moves for 5 disks is…', ['25', '31', '32'], 1, '2⁵ − 1 = 31. Each extra disk doubles the work and adds one.'],
    ['A recursive function needs a base case so that…', ['It runs faster', 'It stops instead of calling itself forever', 'It can use a queue'], 1, 'Here the base case is 0 disks: nothing to move.'],
  ],
  scheduling: [
    ['All jobs arrive together. Which gives the lowest average waiting time?', ['FCFS', 'Round Robin', 'SJF'], 2, 'Running short jobs first means fewer jobs wait behind long ones.'],
    ['Round Robin with a huge time slice behaves like…', ['FCFS', 'SJF', 'Priority'], 0, 'If every job finishes within one slice, it is just first come, first served.'],
  ],
  efield: [
    ['Electric field lines point…', ['From + towards −', 'From − towards +', 'Along the equipotential rings'], 0, 'E = −∇V: downhill from high potential (+) to low (−).'],
    ['Field lines cross equipotential lines at…', ['45°', '90°', 'They never meet'], 1, 'Moving along an equipotential needs no work, so the field has no component along it.'],
  ],
  waves: [
    ['Two in-phase sources cancel (destructive) where the path difference is…', ['nλ', '(n + ½)λ', 'Exactly 2λ'], 1, 'Half a wavelength apart puts a crest on a trough.'],
    ['Noise-cancelling headphones work by…', ['Adding a wave in opposite phase', 'Making the sound louder', 'Changing the wavelength'], 0, 'Crest meets trough: destructive interference.'],
  ],
  projectile: [
    ['Without air resistance, which angle throws furthest on flat ground?', ['30°', '45°', '60°'], 1, 'R = v² sin 2θ / g is largest when 2θ = 90°.'],
    ['At the highest point of the flight, the velocity is…', ['Zero', 'Horizontal: v_y = 0, vₓ unchanged', 'Vertical'], 1, 'Only the vertical part reaches zero; vₓ never changes.'],
  ],
  logic: [
    ['Which gate outputs 1 only when its inputs are different?', ['AND', 'XOR', 'NOR'], 1, 'XOR = exclusive OR: one or the other, not both.'],
    ['How many select lines does a 4:1 multiplexer need?', ['1', '2', '4'], 1, '2 select bits give 2² = 4 choices. An 8:1 MUX needs 3.'],
  ],
  sequential: [
    ['A JK flip-flop has J = 1 and K = 1. At the clock edge, Q…', ['Becomes 0', 'Becomes 1', 'Toggles'], 2, 'J = K = 1 is the toggle case. (In an SR flip-flop, S = R = 1 is not allowed.)'],
    ['A 4-bit up counter shows 1111 (15). After one more clock edge it shows…', ['10000', '0000', '1111'], 1, 'Four bits cannot hold 16, so it wraps around to 0.'],
  ],
  network: [
    ['Which device reads the IP header to choose where a packet goes next?', ['Your app', 'A router', 'The cable'], 1, 'Routers work at the network layer: they read the destination IP.'],
    ['Adding headers as data goes down the layers is called…', ['Encryption', 'Encapsulation', 'Compression'], 1, 'Each layer wraps the one above it, like envelopes.'],
  ],
  search: [
    ['Binary search on 1 to 100 needs at most how many guesses?', ['7', '10', '50'], 0, 'Each guess halves the range: 2⁷ = 128 ≥ 100.'],
    ['Binary search only works if the data is…', ['Sorted', 'Small', 'Unique'], 0, 'It decides which half to drop by comparing with the middle.'],
  ],
  shm: [
    ['The period of a mass m on a spring of stiffness k is…', ['2π√(m/k)', '2π√(k/m)', '2π√(L/g)'], 0, 'Heavier → slower, stiffer → faster.'],
    ['Make a pendulum 4 times longer and its period becomes…', ['4 times longer', '2 times longer', 'Unchanged'], 1, 'T = 2π√(L/g), and √4 = 2.'],
  ],
  perceptron: [
    ['A single perceptron can separate two classes only if they are…', ['Linearly separable', 'Any shape', 'Equal in size'], 0, 'Its boundary is always one straight line (a plane in 3D).'],
    ['Which classic problem can a single perceptron NOT learn?', ['AND', 'OR', 'XOR'], 2, 'XOR’s classes sit on opposite corners: no single straight line splits them.'],
  ],
  paging: [
    ['Which algorithm can get MORE page faults when given MORE frames (Belady’s anomaly)?', ['FIFO', 'LRU', 'Optimal'], 0, 'LRU and Optimal are stack algorithms and never suffer from it.'],
    ['LRU replaces the page that…', ['Arrived first', 'Was used least recently', 'Will be used farthest in the future'], 1, 'Farthest in the future is Optimal, which needs to know the future.'],
  ],
  orbitals: [
    ['How many electrons can one orbital hold?', ['1', '2', '8'], 1, 'At most two, with opposite spins (Pauli exclusion principle).'],
    ['Oxygen (2p⁴) has how many unpaired electrons?', ['0', '2', '4'], 1, "Hund's rule: three boxes get one each, the fourth electron pairs up: ↑↓ ↑ ↑."],
  ],
  vsepr: [
    ['Water has 2 bonds and 2 lone pairs. Its shape is…', ['Linear', 'Bent', 'Tetrahedral'], 1, 'The 4 domains are tetrahedral, but we only see the atoms: a bent molecule (104.5°).'],
    ['CH₄ has which bond angle?', ['90°', '109.5°', '120°'], 1, 'Four bonds as far apart as possible point to the corners of a tetrahedron.'],
  ],
  crystal: [
    ['How many atoms belong to one FCC unit cell?', ['2', '4', '14'], 1, '8 corners × ⅛ + 6 faces × ½ = 1 + 3 = 4.'],
    ['Which packs atoms most tightly?', ['Simple cubic', 'BCC', 'FCC'], 2, 'FCC fills 74% of space, BCC 68%, simple cubic 52%.'],
  ],
  gears: [
    ['A 20-tooth gear at 100 rpm drives a 40-tooth gear. The big gear turns at…', ['50 rpm', '200 rpm', '100 rpm'], 0, 'Speed scales by 20/40, and its torque doubles.'],
    ['What does an idler gear between two gears change?', ['The speed ratio', 'The direction of the output', 'Nothing at all'], 1, 'Its teeth cancel out of the ratio, but every extra mesh flips the direction.'],
  ],
  engine: [
    ['How many crank turns does one four-stroke cycle take?', ['1', '2', '4'], 1, 'Four strokes, each half a turn: two full turns.'],
    ['The stroke length of a slider-crank with crank radius r is…', ['r', '2r', 'The rod length'], 1, 'The piston moves from top dead centre (l + r) to bottom (l − r).'],
  ],
  dna: [
    ['In DNA, adenine (A) always pairs with…', ['Guanine', 'Thymine', 'Uracil'], 1, 'A–T and G–C. In RNA, uracil (U) replaces thymine.'],
    ['How many bases make one codon?', ['2', '3', '4'], 1, 'Three bases: 4³ = 64 codons, enough for 20 amino acids plus stop signals.'],
  ],
  cell: [
    ['Which organelle releases energy as ATP?', ['Golgi apparatus', 'Mitochondrion', 'Nucleus'], 1, 'Mitochondria carry out aerobic respiration.'],
    ['Which of these is found in plant cells but not animal cells?', ['Ribosome', 'Chloroplast', 'Mitochondrion'], 1, 'Chloroplasts (and the cell wall) are plant-only. Both have mitochondria and ribosomes.'],
  ],
  periodic: [
    ['Going down a group, the atomic radius…', ['Increases', 'Decreases', 'Stays the same'], 0, 'Each period down adds a new electron shell.'],
    ['Which element is the most electronegative?', ['Oxygen', 'Chlorine', 'Fluorine'], 2, 'Fluorine (3.98): small, with a nearly full shell, it pulls electrons hardest.'],
  ],
  bonding: [
    ['In NaCl, what happens to sodium’s outer electron?', ['It is shared with Cl', 'It moves to Cl', 'It is lost to the air'], 1, 'Na⁺ and Cl⁻ form, held by opposite charges: an ionic bond.'],
    ['In HCl, the shared electrons sit closer to…', ['H', 'Cl', 'Exactly in the middle'], 1, 'Cl is more electronegative (3.16 vs 2.20), so it is δ−.'],
  ],
  gaslaws: [
    ['At constant temperature, halving a gas’s volume makes its pressure…', ['Halve', 'Double', 'Stay the same'], 1, 'Boyle’s law: P × V stays constant.'],
    ['In gas laws, temperature must be in…', ['°C', 'Kelvin', 'Either'], 1, 'V ∝ T only works from absolute zero, so use kelvin (°C + 273).'],
  ],
  galvanic: [
    ['In a Daniell cell, which electrode dissolves?', ['Zinc (anode)', 'Copper (cathode)', 'Neither'], 0, 'Zn has the lower E° (−0.76 V), so it is oxidised: Zn → Zn²⁺ + 2e⁻.'],
    ['Standard EMF of the Daniell cell (E°Cu = +0.34 V, E°Zn = −0.76 V)?', ['0.42 V', '1.10 V', '−1.10 V'], 1, 'E°cell = E°cathode − E°anode = 0.34 − (−0.76) = 1.10 V.'],
  ],
  heart: [
    ['Which chamber pumps blood to the whole body?', ['Right ventricle', 'Left ventricle', 'Left atrium'], 1, 'That is why it has the thickest muscle wall.'],
    ['The pulmonary artery carries…', ['Oxygen-rich blood to the body', 'Oxygen-poor blood to the lungs', 'Oxygen-rich blood to the heart'], 1, 'It is the one artery with deoxygenated blood.'],
  ],
  mitosis: [
    ['In which stage do chromosomes line up across the middle of the cell?', ['Prophase', 'Metaphase', 'Anaphase'], 1, 'Metaphase: the “middle” stage, on the metaphase plate.'],
    ['A cell with 46 chromosomes divides by mitosis. Each daughter cell has…', ['23', '46', '92'], 1, 'Mitosis keeps the number the same. Meiosis halves it.'],
  ],
  replication: [
    ['DNA replication is called semi-conservative because each new molecule has…', ['Two new strands', 'One old and one new strand', 'Two old strands'], 1, 'Each old strand is kept and acts as the template for a new partner.'],
    ['Which enzyme unzips the double helix?', ['Ligase', 'Helicase', 'Polymerase'], 1, 'Helicase opens the fork; polymerase builds; ligase seals the fragments.'],
  ],
  neuron: [
    ['What rushes into the neuron during depolarisation?', ['K⁺ ions', 'Na⁺ ions', 'Cl⁻ ions'], 1, 'Na⁺ channels open first; K⁺ flows out afterwards to repolarise.'],
    ['Why does myelin make nerve signals faster?', ['It adds more sodium', 'The signal jumps between gaps (nodes)', 'It makes the axon longer'], 1, 'Saltatory conduction: the impulse only regenerates at the nodes of Ranvier.'],
  ],
  photosynthesis: [
    ['Which gas do plants give out during photosynthesis?', ['Carbon dioxide', 'Oxygen', 'Nitrogen'], 1, '6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂.'],
    ['In bright light with low CO₂, what limits the rate?', ['Light', 'Carbon dioxide', 'Water'], 1, 'The scarcest factor limits the rate: adding light no longer helps.'],
  ],
  breathing: [
    ['When you breathe in, the diaphragm…', ['Relaxes and domes up', 'Contracts and flattens', 'Does not move'], 1, 'Flattening makes the chest bigger, so pressure drops and air flows in.'],
    ['Where does gas exchange happen in the lungs?', ['Trachea', 'Bronchi', 'Alveoli'], 2, 'Alveoli have thin walls and a huge surface area, wrapped in capillaries.'],
  ],
  meiosis: [
    ['A human cell with 46 chromosomes makes sperm by meiosis. Each sperm has…', ['46', '23', '92'], 1, 'Meiosis halves the number, so egg (23) + sperm (23) = 46.'],
    ['What makes the four cells from meiosis genetically different?', ['Mutation only', 'Crossing over and independent assortment', 'They are identical'], 1, 'Pairs swap pieces in prophase I, and line up randomly in metaphase I.'],
  ],
  enzymes: [
    ['What happens to an enzyme at a very high temperature?', ['It works faster forever', 'Its active site changes shape (denatures)', 'It turns into substrate'], 1, 'The substrate no longer fits, and the change is permanent.'],
    ['Pepsin works best in the stomach. Its optimum pH is about…', ['2', '7', '11'], 0, 'The stomach is strongly acidic; trypsin in the intestine prefers about pH 8.'],
  ],
  rates: [
    ['A catalyst speeds up a reaction by…', ['Raising the temperature', 'Lowering the activation energy', 'Adding more reactant'], 1, 'It offers an easier route, and is not used up.'],
    ['Why does heating speed up most reactions?', ['Particles get bigger', 'More collisions have energy ≥ Ea', 'Ea goes up'], 1, 'Faster particles collide more often and much more of them are energetic enough.'],
  ],
  acidbase: [
    ['A solution has pH 3. Compared with pH 5, its [H⁺] is…', ['2 times higher', '100 times higher', '2 times lower'], 1, 'Each pH step is ×10, so 2 steps = ×100.'],
    ['0.1 M acetic acid has a higher pH than 0.1 M HCl because acetic acid is…', ['More concentrated', 'A weak acid (only partly ionised)', 'A base'], 1, 'Fewer molecules release H⁺, so [H⁺] is lower and the pH higher (about 2.9 vs 1).'],
  ],
  circuits: [
    ['Three resistors of 2 Ω, 4 Ω and 6 Ω in series across 12 V. The current is…', ['1 A', '2 A', '6 A'], 0, 'R = 2 + 4 + 6 = 12 Ω, so I = V / R = 12 / 12 = 1 A.'],
    ['Adding another resistor in parallel makes the total resistance…', ['Bigger', 'Smaller', 'Unchanged'], 1, 'Each new branch is one more path for current, so the circuit passes more current for the same voltage.'],
  ],
  induction: [
    ['A magnet rests inside a coil without moving. The induced voltage is…', ['Large', 'Zero', 'Reversed'], 1, 'Faraday: only a changing flux induces a voltage.'],
    ['A transformer has 1000 primary and 50 secondary turns on 230 V AC. The output is about…', ['11.5 V', '4600 V', '230 V'], 0, 'Vs = Vp × Ns / Np = 230 × 50 / 1000 = 11.5 V (step-down).'],
  ],
  threephase: [
    ['In a three-phase supply, the phases are shifted from each other by…', ['90°', '120°', '180°'], 1, '360° / 3 = 120°.'],
    ['Why does an induction motor’s rotor turn a little slower than the field (slip)?', ['Friction only', 'If it matched, no current would be induced in the rotor', 'To save energy'], 1, 'Induction needs relative motion between field and rotor bars.'],
  ],
  pid: [
    ['A drone with only P control hovers below its target. Which term fixes this?', ['D', 'I', 'Neither'], 1, 'The integral grows while the error lasts, until it supplies the thrust gravity needs.'],
    ['Increasing Kd mainly…', ['Removes steady error', 'Damps overshoot and oscillation', 'Makes it faster to start'], 1, 'D reacts to how fast the error changes, like a brake.'],
  ],
  truss: [
    ['Under its own weight, the bottom chord of a simple truss bridge is in…', ['Compression', 'Tension', 'No force'], 1, 'Like the bottom of a sagging beam, it is stretched.'],
    ['Why are trusses built from triangles?', ['They look good', 'A triangle cannot change shape without changing a side length', 'They use less paint'], 1, 'So members carry only axial push or pull, not bending.'],
  ],
  fluid: [
    ['Water flows from a pipe into a section with half the diameter. Its speed becomes…', ['2×', '4×', 'Half'], 1, 'Area ∝ d², so a quarter of the area means 4× the speed (A₁v₁ = A₂v₂).'],
    ['Where the flow is fastest, the pressure is…', ['Highest', 'Lowest', 'The same'], 1, 'Bernoulli: p + ½ρv² is constant along the flow.'],
  ],
  stressstrain: [
    ['In the elastic region, stress divided by strain equals…', ["Young's modulus E", 'Yield strength', 'Toughness'], 0, "Hooke's law: σ = E ε."],
    ['A material that breaks with very little stretching is called…', ['Ductile', 'Brittle', 'Elastic'], 1, 'Like cast iron or glass: no necking, no warning.'],
  ],
  sampling: [
    ['To capture a 20 kHz sound without aliasing, you must sample at more than…', ['10 kHz', '20 kHz', '40 kHz'], 2, 'Nyquist: more than twice the highest frequency. CDs use 44.1 kHz.'],
    ['A 7 Hz signal sampled at 10 Hz looks like…', ['7 Hz', '3 Hz', '17 Hz'], 1, 'It aliases to |7 − 10| = 3 Hz.'],
  ],
  diode: [
    ['A silicon diode starts conducting strongly at about…', ['0.07 V', '0.7 V', '7 V'], 1, 'About 0.6–0.7 V forward; germanium is about 0.3 V.'],
    ['Under reverse bias, the depletion region…', ['Gets wider', 'Disappears', 'Stays the same'], 0, 'Carriers are pulled away from the junction, so only a tiny leakage current flows.'],
  ],
};

// Options appear in a new order each time, so the right answer isn't learned by position.
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const hasQuiz = (path) => Boolean(Q[path]);

/** Adds (or refreshes) the quiz section at the bottom of a concept panel. */
export function renderQuiz(panel, concept) {
  panel.querySelector('.quiz')?.remove();
  const questions = Q[concept.path];
  if (!questions) return;
  const best = progressFor(concept.path).quiz;
  const section = document.createElement('section');
  section.className = 'quiz';
  section.innerHTML = `
    <h3>Check yourself</h3>
    ${best !== undefined ? `<p class="hint quiz-best">Best so far: ${best}/${questions.length}</p>` : ''}
    ${questions.map(([q, options], i) => `
      <div class="quiz-q" data-q="${i}">
        <p>${i + 1}. ${q}</p>
        <div class="quiz-options">${shuffle(options.map((o, k) => [o, k])).map(([o, k]) => `<button data-k="${k}">${o}</button>`).join('')}</div>
        <p class="quiz-why" hidden></p>
      </div>`).join('')}
    <p class="quiz-score" hidden></p>`;
  const answers = new Array(questions.length).fill(null);
  section.addEventListener('click', (e) => {
    if (e.target.closest('[data-retry]')) {
      renderQuiz(panel, concept);
      return;
    }
    const btn = e.target.closest('[data-k]');
    if (!btn) return;
    const box = btn.closest('[data-q]');
    const i = Number(box.dataset.q);
    if (answers[i] !== null) return; // first answer counts
    const [, , right, why] = questions[i];
    const k = Number(btn.dataset.k);
    answers[i] = k === right;
    box.querySelectorAll('[data-k]').forEach((b) => {
      b.disabled = true;
      if (Number(b.dataset.k) === right) b.classList.add('right');
    });
    if (k !== right) btn.classList.add('wrong');
    const whyEl = box.querySelector('.quiz-why');
    whyEl.hidden = false;
    whyEl.innerHTML = `${answers[i] ? '✓ Right.' : '✗ Not quite.'} ${why}`;
    if (answers.every((a) => a !== null)) {
      const score = answers.filter(Boolean).length;
      recordQuiz(concept.path, score, questions.length);
      const out = section.querySelector('.quiz-score');
      out.hidden = false;
      out.innerHTML = (score === questions.length ? `★ ${score}/${questions.length}: concept mastered!` : `${score}/${questions.length}. Play with the model a bit more, then try again.`)
        + ' <button class="btn small secondary" data-retry>Try again</button>';
    }
  });
  panel.append(section);
}
