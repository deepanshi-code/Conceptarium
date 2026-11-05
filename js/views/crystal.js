// Chemistry / materials: cubic unit cells. Shows SC, BCC and FCC, how much of each atom really belongs to one cell
// (cut the atoms to the cell), the packing efficiency, and an atom's nearest neighbours (coordination number).
import * as THREE from 'three';
import { createStage, clearGroup } from '../stage.js';
import { LATTICES, packing, share, block } from '../chem/crystal.js';
import { interact } from '../interact.js';
import { html, formatNumber } from '../ui.js';

const A = 3; // cell edge in world units
const FRACTION = { 1: '1', 0.5: '½', 0.25: '¼', 0.125: '⅛' };

export function mountCrystal(root) {
  root.innerHTML = html`
    <div class="viewport" data-viewport></div>
    <aside class="panel">
      <h2>Crystal Lattices</h2>
      <p class="lede">Metals are atoms stacked in a repeating pattern. The smallest repeating box is the <b>unit cell</b>. Atoms on corners and faces are <b>shared</b> with neighbouring cells, so one cell only owns part of them. How tightly they pack decides density and how easily metals bend.</p>

      <div class="tabs" data-lats>${Object.entries(LATTICES).map(([k, l]) => `<button data-lat="${k}" title="${l.name}">${k.toUpperCase()}</button>`).join('')}</div>
      <h4 class="circuit-name" data-name></h4>

      <h3>View</h3>
      <label class="check"><input type="checkbox" data-cut> Cut atoms to the cell (show only what belongs to it)</label>
      <label class="check"><input type="checkbox" data-block> Show a 3 × 3 × 3 block</label>
      <label class="slider-row wide"><span>Atom size</span><input type="range" min="0.2" max="1" step="0.05" value="1" data-size><output data-size-out>touching</output></label>
      <p class="hint"><b>Click an atom</b> to light up its nearest neighbours.</p>

      <h3>Numbers</h3>
      <div class="readout" data-out></div>
      <div class="notice" data-msg></div>
    </aside>
  `;

  const $ = (sel) => root.querySelector(sel);
  const stage = createStage($('[data-viewport]'), { cameraPosition: [6, 4.5, 7], axes: false, grid: false });
  const group = new THREE.Group();
  stage.scene.add(group);
  const state = { key: 'bcc', cut: false, block: false, size: 1, atoms: [] };
  // Six planes bounding the central cell, used to cut atoms to the cell.
  const planes = [
    new THREE.Plane(new THREE.Vector3(1, 0, 0), A / 2), new THREE.Plane(new THREE.Vector3(-1, 0, 0), A / 2),
    new THREE.Plane(new THREE.Vector3(0, 1, 0), A / 2), new THREE.Plane(new THREE.Vector3(0, -1, 0), A / 2),
    new THREE.Plane(new THREE.Vector3(0, 0, 1), A / 2), new THREE.Plane(new THREE.Vector3(0, 0, -1), A / 2),
  ];

  function build() {
    clearGroup(group);
    const lat = LATTICES[state.key];
    const r = (A / lat.aOverR) * state.size;
    const offset = state.block ? -1 : 0; // the block is centred on the middle cell
    const sites = state.block ? block(state.key, 3).map((p) => p.map((v) => v + offset)) : lat.sites;
    const sphere = new THREE.SphereGeometry(r, 32, 24);
    state.atoms = sites.map((p) => {
      const inCell = p.every((v) => v >= -1e-9 && v <= 1 + 1e-9);
      const s = inCell ? share(p) : 0;
      const body = p.filter((v) => v > 0 && v < 1).length === 3;
      const color = body ? 0xf472b6 : s === 0.5 ? 0x22d3ee : s === 0.125 ? 0xa78bfa : 0x6d5bd0;
      const mesh = new THREE.Mesh(sphere, new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.15, clippingPlanes: state.cut ? planes : [], side: THREE.DoubleSide }));
      mesh.position.set((p[0] - 0.5) * A, (p[1] - 0.5) * A, (p[2] - 0.5) * A);
      mesh.visible = !state.cut || inCell;
      mesh.userData = { p, color };
      group.add(mesh);
      return mesh;
    });
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(A, A, A)), new THREE.LineBasicMaterial({ color: 0xfacc15 }));
    group.add(edges);
    stage.camera.position.set(...(state.block ? [11, 8, 13] : [6, 4.5, 7]));
    stage.controls.target.set(0, 0, 0);
    stage.saveHome();

    root.querySelectorAll('[data-lat]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.lat === state.key)));
    $('[data-name]').textContent = lat.name;
    const counts = { sc: '8 corners × ⅛ = 1', bcc: '8 × ⅛ + 1 centre = 2', fcc: '8 × ⅛ + 6 faces × ½ = 4' }[state.key];
    const row = (k, v) => `<div class="row-between"><span>${k}</span><strong>${v}</strong></div>`;
    $('[data-out]').innerHTML = [
      row('Atoms per cell', counts),
      row('Coordination number', `${lat.cn} neighbours`),
      row('Atoms touch', lat.touch),
      row('Packing efficiency', `${formatNumber(packing(state.key) * 100, 1)}%`),
      row('Examples', lat.example),
    ].join('');
    $('[data-msg]').innerHTML = state.cut
      ? `Each corner atom gives only ${FRACTION[0.125]} to this cell, each face atom ${FRACTION[0.5]}. Add them up: that is why ${lat.name.toLowerCase()} has <b>${lat.n}</b> atom${lat.n > 1 ? 's' : ''} per cell.`
      : 'Turn on <b>Cut atoms to the cell</b> to see which slices belong to this one cell.';
  }

  function showNeighbours(mesh) {
    const lat = LATTICES[state.key];
    const d = (A / lat.aOverR) * 2; // nearest-neighbour distance = 2r when atoms touch
    let found = 0;
    for (const m of state.atoms) {
      const near = m !== mesh && m.position.distanceTo(mesh.position) < d * 1.01;
      if (near) found += 1;
      m.material.color.setHex(m === mesh ? 0xfacc15 : near ? 0x4ade80 : m.userData.color);
      m.material.emissive.setHex(m === mesh || near ? 0x1f3a10 : 0x000000);
    }
    $('[data-msg]').innerHTML = found === lat.cn
      ? `✓ This atom touches <b>${found}</b> neighbours: the coordination number of ${state.key.toUpperCase()} is ${lat.cn}.`
      : `Found ${found} neighbours here, but some are in the next cells. Turn on the <b>3 × 3 × 3 block</b> and click an atom in the middle: you'll find ${lat.cn}.`;
  }

  root.querySelectorAll('[data-lat]').forEach((b) => b.addEventListener('click', () => { state.key = b.dataset.lat; build(); }));
  $('[data-cut]').addEventListener('change', (e) => { state.cut = e.target.checked; build(); });
  $('[data-block]').addEventListener('change', (e) => { state.block = e.target.checked; build(); });
  $('[data-size]').addEventListener('input', (e) => {
    state.size = Number(e.target.value);
    $('[data-size-out]').textContent = state.size === 1 ? 'touching' : `${Math.round(state.size * 100)}%`;
    build();
  });

  const stopInteract = interact(stage, {
    pick: () => state.atoms.filter((m) => m.visible),
    cursor: 'pointer',
    onClick: (hit) => showNeighbours(hit.object),
  });

  build();
  return () => {
    stopInteract();
    stage.dispose();
  };
}
