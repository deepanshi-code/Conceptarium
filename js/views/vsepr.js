// Chemistry: molecular shapes (VSEPR). Electron domains around the central atom spread out as far as possible;
// lone pairs take space too but are invisible in the final shape, which is why H₂O is bent, not linear.
import * as THREE from 'three';
import { createStage, makeLabel, clearGroup } from '../stage.js';
import { MOLECULES, analyze, angleBetween } from '../chem/vsepr.js';
import { html, formatNumber } from '../ui.js';

const CPK = { H: 0xffffff, C: 0x6b7280, N: 0x3b82f6, O: 0xef4444, F: 0xa3e635, Cl: 0x22c55e, Br: 0xb45309, S: 0xfacc15, P: 0xf97316, B: 0xf9a8d4, Be: 0x15803d, Xe: 0x22d3ee };
const SIZE = { H: 0.28, default: 0.42 };
const BOND = 1.9;
const sub = (s) => s.replace(/(\d)/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[d]);

export function mountVsepr(root) {
  root.innerHTML = html`
    <div class="viewport" data-viewport></div>
    <aside class="panel">
      <h2>Molecular Shapes (VSEPR)</h2>
      <p class="lede">Bonds and lone pairs around the central atom are all clouds of negative charge, so they <b>push each other as far apart as possible</b>. Count them (single, double or triple bonds count as 1 domain each) and the shape follows. Lone pairs push a bit harder than bonds, squeezing the bond angles.</p>

      <h3>Molecule</h3>
      <div class="tabs four" data-mols>${Object.keys(MOLECULES).map((k) => `<button data-mol="${k}">${sub(k)}</button>`).join('')}</div>
      <label class="check"><input type="checkbox" data-lp checked> Show lone pairs</label>

      <h3>Result</h3>
      <div class="readout" data-out></div>
      <div class="notice" data-msg></div>
    </aside>
  `;

  const $ = (sel) => root.querySelector(sel);
  const stage = createStage($('[data-viewport]'), { cameraPosition: [3.2, 2.4, 5.2], axes: false, grid: false });
  const mol = new THREE.Group();
  stage.scene.add(mol);
  const state = { key: 'H2O', lone: true };

  // Squeeze bonds away from the lone pairs until their angle matches the measured one (NH₃, H₂O, SO₂).
  function realBonds(info) {
    if (!info.real || info.bonds.length < 2) return info.bonds;
    const L = info.lonePairs.reduce((s, d) => s.add(new THREE.Vector3(...d)), new THREE.Vector3()).normalize();
    let lo = 0;
    let hi = 2;
    let out = info.bonds;
    for (let k = 0; k < 40; k++) {
      const t = (lo + hi) / 2;
      out = info.bonds.map((b) => new THREE.Vector3(...b).addScaledVector(L, -t).normalize().toArray());
      if (angleBetween(out[0], out[1]) > info.real) lo = t;
      else hi = t;
    }
    return out;
  }

  function build() {
    clearGroup(mol);
    const info = analyze(state.key);
    const bonds = realBonds(info);
    const center = new THREE.Mesh(new THREE.SphereGeometry(0.55, 32, 24), new THREE.MeshStandardMaterial({ color: CPK[info.center] ?? 0x9ca3af, roughness: 0.35 }));
    center.add(makeLabel(info.center, new THREE.Vector3(0, 0, 0), 0x0b0720, 'gate-label'));
    mol.add(center);
    bonds.forEach((d, i) => {
      const dir = new THREE.Vector3(...d);
      const el = info.atoms[i];
      const atom = new THREE.Mesh(new THREE.SphereGeometry(SIZE[el] ?? SIZE.default, 28, 20), new THREE.MeshStandardMaterial({ color: CPK[el] ?? 0x9ca3af, roughness: 0.35 }));
      atom.position.copy(dir.clone().multiplyScalar(BOND));
      atom.add(makeLabel(el, new THREE.Vector3(), 0x0b0720, 'gate-label'));
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, BOND, 12), new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.4 }));
      stick.position.copy(dir.clone().multiplyScalar(BOND / 2));
      stick.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      mol.add(atom, stick);
    });
    if (state.lone) {
      info.lonePairs.forEach((d) => {
        const dir = new THREE.Vector3(...d);
        const lobe = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 16), new THREE.MeshStandardMaterial({ color: 0xc4b5fd, transparent: true, opacity: 0.35, depthWrite: false }));
        lobe.scale.set(0.75, 1.4, 0.75);
        lobe.position.copy(dir.clone().multiplyScalar(1.05));
        lobe.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        for (const s of [-0.18, 0.18]) {
          const e = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
          e.position.set(s, 0.15, 0);
          lobe.add(e);
        }
        mol.add(lobe);
      });
    }
    // Angle arc between the first two bonds.
    if (bonds.length >= 2) {
      const a = new THREE.Vector3(...bonds[0]);
      const b = new THREE.Vector3(...bonds[1]);
      const ang = a.angleTo(b);
      const axis = new THREE.Vector3().crossVectors(a, b);
      if (axis.lengthSq() > 1e-6) {
        axis.normalize();
        const pts = Array.from({ length: 33 }, (_, i) => a.clone().applyAxisAngle(axis, (ang * i) / 32).multiplyScalar(0.95));
        mol.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xfacc15 })));
        const mid = a.clone().applyAxisAngle(axis, ang / 2).multiplyScalar(1.25);
        mol.add(makeLabel(`${formatNumber((ang * 180) / Math.PI, 1)}°`, mid, 0xfacc15, 'chart-label'));
      }
    }
    root.querySelectorAll('[data-mol]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mol === state.key)));
    const row = (k, v) => `<div class="row-between"><span>${k}</span><strong>${v}</strong></div>`;
    $('[data-out]').innerHTML = [
      row('Bonded atoms + lone pairs', `${info.atoms.length} + ${info.lone} = ${info.domains} domains`),
      row('Electron geometry', info.electronGeometry),
      row('Molecular shape', `<span class="ok-text">${info.shape}</span>`),
      row('Hybridisation', info.hybrid),
      row('Ideal angle', `${info.ideal}°`),
      info.real ? row('Real angle', `${info.real}°`) : '',
    ].join('');
    $('[data-msg]').innerHTML = info.note ?? (info.real
      ? `The lone pair${info.lone > 1 ? 's' : ''} push${info.lone > 1 ? '' : 'es'} the bonds closer: ${info.ideal}° shrinks to <b>${info.real}°</b>.`
      : info.lone ? `The electron geometry is ${info.electronGeometry.toLowerCase()}, but we only “see” the atoms, so the shape is <b>${info.shape.toLowerCase()}</b>.`
        : 'No lone pairs: the shape is the same as the electron geometry.');
  }

  $('[data-mols]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-mol]');
    if (!b) return;
    state.key = b.dataset.mol;
    build();
  });
  $('[data-lp]').addEventListener('change', (e) => { state.lone = e.target.checked; build(); });
  stage.onFrame((dt) => { mol.rotation.y += dt * 0.3; });

  build();
  return () => stage.dispose();
}
