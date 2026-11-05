// Biology: a 3D cell to explore. Click any organelle to see what it does (with an everyday comparison), switch
// between animal and plant cells, cut the cell open, or play "find the organelle".
import * as THREE from 'three';
import { createStage, clearGroup } from '../stage.js';
import { interact } from '../interact.js';
import { html } from '../ui.js';

const INFO = {
  nucleus: ['Nucleus', 'Holds the DNA and controls what the cell does by deciding which genes are used.', 'the head office', 'both'],
  nucleolus: ['Nucleolus', 'Inside the nucleus; makes the parts of ribosomes (rRNA).', 'the ribosome factory', 'both'],
  mito: ['Mitochondrion', 'Releases energy from glucose by aerobic respiration, storing it as ATP.', 'the power plant', 'both'],
  rer: ['Rough ER', 'A folded membrane covered in ribosomes; makes proteins and sends them on.', 'the factory floor', 'both'],
  ser: ['Smooth ER', 'Tubes with no ribosomes; makes lipids (fats) and breaks down some toxins.', 'the chemical workshop', 'both'],
  golgi: ['Golgi apparatus', 'Receives proteins from the ER, modifies and packs them into vesicles, and ships them out.', 'the post office', 'both'],
  ribosome: ['Ribosomes', 'Tiny machines that build proteins by reading mRNA (translation).', 'the 3D printers', 'both'],
  lysosome: ['Lysosome', 'A bag of digestive enzymes that breaks down waste and worn-out parts.', 'the recycling centre', 'mostly animal cells'],
  centriole: ['Centrioles', 'A pair of tubes that help organise the spindle when the cell divides.', 'the tent pegs for division', 'animal cells'],
  membrane: ['Cell membrane', 'A thin, flexible layer that controls what enters and leaves the cell.', 'the security gate', 'both'],
  wall: ['Cell wall', 'A rigid layer of cellulose outside the membrane that supports and protects the cell.', 'the outer brick wall', 'plant cells'],
  chloroplast: ['Chloroplast', 'Captures light energy to make glucose by photosynthesis (it contains green chlorophyll).', 'the solar panel', 'plant cells'],
  vacuole: ['Central vacuole', 'A large sac of cell sap that stores water and keeps the cell firm (turgor).', 'the water tank', 'plant cells (large)'],
};

export function mountCell(root) {
  root.innerHTML = html`
    <div class="viewport" data-viewport></div>
    <aside class="panel">
      <h2>Inside a Cell</h2>
      <p class="lede">A cell is a tiny factory. Each <b>organelle</b> has one job: the nucleus stores the instructions, ribosomes build proteins, mitochondria supply energy. Plant cells add a <b>cell wall</b>, <b>chloroplasts</b> and a big <b>vacuole</b>. Not to scale: real ribosomes are far smaller.</p>

      <div class="segmented" role="radiogroup">
        <label><input type="radio" name="kind" value="animal" checked> Animal cell</label>
        <label><input type="radio" name="kind" value="plant"> Plant cell</label>
      </div>
      <label class="check"><input type="checkbox" data-cut checked> Cut the cell open</label>

      <div class="organelle-card" data-card><p class="dim">Click any part of the cell.</p></div>

      <h3>Find it!</h3>
      <div class="btn-row"><button class="btn" data-game>🎯 Start the game</button></div>
      <div class="notice" data-msg hidden></div>
    </aside>
  `;

  const $ = (sel) => root.querySelector(sel);
  const stage = createStage($('[data-viewport]'), { cameraPosition: [5, 5, 9], axes: false, grid: false });
  const cell = new THREE.Group();
  stage.scene.add(cell);
  const cutPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0.6); // keeps z ≤ 0.6: the front is cut away
  const state = { kind: 'animal', cut: true, parts: [], selected: null, game: null };

  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.45, ...extra });
  const add = (mesh, key) => {
    mesh.userData.key = key;
    // Clicks: ignore the part that is cut away, and let the outer layers (membrane, wall) count only when nothing
    // inside was hit, so you can click through them.
    const outer = key === 'membrane' || key === 'wall';
    mesh.raycast = function raycast(raycaster, hits) {
      const tmp = [];
      THREE.Mesh.prototype.raycast.call(this, raycaster, tmp);
      for (const h of tmp) {
        if (state.cut && this.material.clippingPlanes?.length && cutPlane.distanceToPoint(h.point) < 0) continue;
        if (outer) h.distance += 1000;
        hits.push(h);
      }
    };
    mesh.userData.color = mesh.material.color.getHex();
    cell.add(mesh);
    state.parts.push(mesh);
    return mesh;
  };
  // Seeded random so organelles land in the same places every time.
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const inside = (r) => {
    for (;;) {
      const p = new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).multiplyScalar(r);
      if (p.length() < r && p.distanceTo(new THREE.Vector3(0, 0.2, 0)) > 2.1) return p;
    }
  };

  function build() {
    clearGroup(cell);
    state.parts = [];
    seed = 7;
    const plant = state.kind === 'plant';
    const clip = state.cut ? [cutPlane] : [];

    // Outer layers.
    const shell = plant ? new THREE.BoxGeometry(9, 6.4, 6.4, 1, 1, 1) : new THREE.SphereGeometry(4.2, 48, 32);
    add(new THREE.Mesh(shell, mat(0x86efac, { transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false, clippingPlanes: clip })), 'membrane');
    if (plant) add(new THREE.Mesh(new THREE.BoxGeometry(9.5, 6.9, 6.9), mat(0x65a30d, { transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false, clippingPlanes: clip })), 'wall');

    // Nucleus with nucleolus.
    const nucleus = add(new THREE.Mesh(new THREE.SphereGeometry(1.35, 40, 28), mat(0x8b5cf6, { transparent: true, opacity: 0.85, clippingPlanes: clip })), 'nucleus');
    nucleus.position.set(plant ? -2.6 : 0, 0.2, 0);
    const nucleolus = add(new THREE.Mesh(new THREE.SphereGeometry(0.45, 24, 16), mat(0x4c1d95)), 'nucleolus');
    nucleolus.position.copy(nucleus.position).add(new THREE.Vector3(0.3, 0.2, 0.1));

    // Rough ER: curved sheets wrapped around the nucleus, studded with ribosomes.
    for (let i = 0; i < 4; i++) {
      const sheet = add(new THREE.Mesh(new THREE.TorusGeometry(1.75 + i * 0.28, 0.07, 8, 40, Math.PI * 0.9), mat(0x38bdf8)), 'rer');
      sheet.position.copy(nucleus.position);
      sheet.rotation.set(0.4, 0.9 + i * 0.12, 0.2);
    }
    // Smooth ER: a few tubes.
    for (let i = 0; i < 3; i++) {
      const tube = add(new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.08, 8, 24, Math.PI * 1.4), mat(0x5eead4)), 'ser');
      tube.position.copy(nucleus.position).add(new THREE.Vector3(-1.4 + i * 0.35, -1.9, 0.6));
      tube.rotation.set(1.2, i * 0.8, 0);
    }
    // Golgi: stacked curved discs.
    for (let i = 0; i < 5; i++) {
      const disc = add(new THREE.Mesh(new THREE.TorusGeometry(0.75 - i * 0.07, 0.09, 8, 24, Math.PI), mat(0xfacc15)), 'golgi');
      disc.position.set(plant ? 0.4 : 2.2, -1.3 + i * 0.22, -0.4);
      disc.rotation.x = Math.PI / 2;
    }
    // Mitochondria.
    for (let i = 0; i < (plant ? 4 : 6); i++) {
      const m = add(new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.75, 6, 12), mat(0xf97316)), 'mito');
      m.position.copy(plant ? new THREE.Vector3(rand() * 6 - 1.5, rand() * 4 - 2, rand() * 3 - 2) : inside(3.4));
      m.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    }
    // Free ribosomes: tiny dots.
    const ribo = new THREE.SphereGeometry(0.07, 8, 6);
    for (let i = 0; i < 60; i++) {
      const r = add(new THREE.Mesh(ribo, mat(0x1e293b)), 'ribosome');
      r.position.copy(plant ? new THREE.Vector3(rand() * 8 - 4, rand() * 5.6 - 2.8, rand() * 5.6 - 2.8) : inside(3.9));
    }
    if (plant) {
      const vac = add(new THREE.Mesh(new THREE.SphereGeometry(1.9, 32, 24), mat(0x60a5fa, { transparent: true, opacity: 0.45, clippingPlanes: clip })), 'vacuole');
      vac.position.set(1.9, 0.4, -0.3);
      vac.scale.set(1.3, 1, 1);
      for (let i = 0; i < 6; i++) {
        const c = add(new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 14), mat(0x16a34a)), 'chloroplast');
        c.scale.set(1.6, 0.7, 0.9);
        c.position.set(-3.6 + (i % 3) * 3.4, i < 3 ? 2.4 : -2.4, (i % 2 ? 1 : -1) * 1.6);
        c.rotation.set(rand(), rand(), rand());
      }
    } else {
      for (let i = 0; i < 5; i++) {
        const l = add(new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), mat(0xc026d3)), 'lysosome');
        l.position.copy(inside(3.3));
      }
      for (const rot of [0, Math.PI / 2]) {
        const c = add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.6, 12), mat(0xe11d48)), 'centriole');
        c.position.set(1.4, 1.6, 0.9);
        c.rotation.z = rot;
      }
    }
    select(null);
  }

  function select(key) {
    state.selected = key;
    for (const p of state.parts) {
      const on = p.userData.key === key;
      p.material.emissive.setHex(on ? 0x3b3b00 : 0x000000);
      p.material.color.setHex(on ? 0xfff176 : p.userData.color);
    }
    if (!key) {
      $('[data-card]').innerHTML = '<p class="dim">Click any part of the cell.</p>';
      return;
    }
    const [name, what, like, where] = INFO[key];
    $('[data-card]').innerHTML = `<h4>${name}</h4><p>${what}</p><p class="like">Think of it as <b>${like}</b>.</p><small>Found in: ${where}</small>`;
  }

  function nextTarget() {
    const keys = [...new Set(state.parts.map((p) => p.userData.key))].filter((k) => k !== 'nucleolus');
    let k;
    do k = keys[Math.floor(Math.random() * keys.length)]; while (k === state.game?.target && keys.length > 1);
    state.game.target = k;
    const [name, , like] = INFO[k];
    $('[data-msg]').innerHTML = `Find: <b>${name}</b> (${like}). Score ${state.game.score}/${state.game.tries}`;
  }

  root.querySelectorAll('input[name=kind]').forEach((r) => r.addEventListener('change', () => { state.kind = r.value; build(); if (state.game) nextTarget(); }));
  $('[data-cut]').addEventListener('change', (e) => { state.cut = e.target.checked; build(); });
  $('[data-game]').addEventListener('click', () => {
    state.game = { score: 0, tries: 0, target: null };
    $('[data-msg]').hidden = false;
    $('[data-game]').textContent = '↺ Restart game';
    nextTarget();
  });

  const stopInteract = interact(stage, {
    pick: () => state.parts,
    cursor: 'pointer',
    onClick: (hit) => {
      const key = hit.object.userData.key;
      select(key);
      if (!state.game) return;
      state.game.tries += 1;
      const right = key === state.game.target;
      if (right) state.game.score += 1;
      const msg = right ? '✓ Correct!' : `✗ That's the ${INFO[key][0].toLowerCase()}.`;
      $('[data-msg]').innerHTML = msg;
      setTimeout(() => { if (state.game) nextTarget(); }, 1100);
    },
  });

  build();
  return () => {
    stopInteract();
    stage.dispose();
  };
}
