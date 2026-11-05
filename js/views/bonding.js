// Chemistry: chemical bonding. Two atoms with their outer-shell electrons. If one atom pulls much harder
// (big electronegativity difference) it takes the electrons: an ionic bond. Otherwise they share pairs: covalent,
// evenly (non-polar) or lopsided (polar, with δ+ and δ−).
import * as THREE from 'three';
import { createStage, makeLabel, clearGroup } from '../stage.js';
import { PAIRS, VALENCE, analyzeBond } from '../chem/bonding.js';
import { html, formatNumber } from '../ui.js';

const ATOM_COLOR = { H: 0xe5e7eb, C: 0x6b7280, N: 0x3b82f6, O: 0xef4444, F: 0xa3e635, Na: 0xa78bfa, Mg: 0x22c55e, Cl: 0x16a34a, K: 0xc084fc };
const SHELL = 1.1;

export function mountBonding(root) {
  root.innerHTML = html`
    <div class="viewport" data-viewport></div>
    <aside class="panel">
      <h2>Chemical Bonding</h2>
      <p class="lede">Atoms bond to get a full outer shell (usually 8 electrons, 2 for hydrogen). What kind of bond depends on how hard each atom pulls on electrons: its <b>electronegativity (EN)</b>. Big difference: one atom <b>takes</b> electrons (ionic). Small difference: they <b>share</b> them (covalent).</p>

      <div class="tabs four" data-pairs>${Object.entries(PAIRS).map(([k, p]) => `<button data-pair="${k}">${p.label}</button>`).join('')}</div>
      <div class="btn-row"><button class="btn" data-play>▶ Form the bond</button></div>

      <div class="readout" data-out></div>
      <div class="en-scale" data-scale></div>
      <div class="notice" data-msg></div>
    </aside>
  `;

  const $ = (sel) => root.querySelector(sel);
  const stage = createStage($('[data-viewport]'), { cameraPosition: [0, 1.5, 8], axes: false, grid: false });
  const group = new THREE.Group();
  stage.scene.add(group);
  const state = { key: 'NaCl', t: 0, playing: false, electrons: [], atoms: [] };

  function atom(symbol, x) {
    const g = new THREE.Group();
    g.position.x = x;
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.42, 28, 20), new THREE.MeshStandardMaterial({ color: ATOM_COLOR[symbol], roughness: 0.4 }));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(SHELL, 0.015, 8, 64), new THREE.MeshBasicMaterial({ color: 0x6b6f9e }));
    const label = makeLabel(symbol, new THREE.Vector3(0, 0, 0.45), 0x0b0720, 'gate-label');
    const charge = makeLabel('', new THREE.Vector3(0.55, 0.65, 0), 0xfacc15, 'chart-label');
    g.add(core, ring, label, charge);
    group.add(g);
    return { g, core, charge, symbol };
  }

  // Electron i of n on an atom's shell, spread all round (a lone atom).
  const onShell = (center, i, n) => {
    const a = Math.PI / 2 + (i / n) * Math.PI * 2;
    return new THREE.Vector3(center.x + Math.cos(a) * SHELL, Math.sin(a) * SHELL, 0);
  };
  // Electron i of n on the far side of the shell, leaving the side that faces the partner for the bond.
  const awayFrom = (center, i, n, partnerOnRight) => {
    const start = (partnerOnRight ? 0 : Math.PI) + (55 * Math.PI) / 180;
    const a = start + ((i + 0.5) / n) * ((250 * Math.PI) / 180);
    return new THREE.Vector3(center.x + Math.cos(a) * SHELL, Math.sin(a) * SHELL, 0);
  };

  function build() {
    clearGroup(group);
    const info = analyzeBond(state.key);
    state.info = info;
    const ionic = info.type === 'ionic';
    const gap = ionic ? 3.2 : 1.9;
    const A = atom(info.a, -gap / 2);
    const B = atom(info.b, gap / 2);
    state.atoms = [A, B];
    // Electrons: each with a start and end position; colours show whose they were.
    state.electrons = [];
    const add = (from, to, color) => {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), new THREE.MeshBasicMaterial({ color }));
      e.position.copy(from);
      e.userData = { from: from.clone(), to: to.clone() };
      group.add(e);
      state.electrons.push(e);
    };
    const va = VALENCE[info.a];
    const vb = VALENCE[info.b];
    const ca = 0xfacc15;
    const cb = 0x22d3ee;
    const posA = A.g.position;
    const posB = B.g.position;
    if (ionic) {
      // The metal's valence electrons jump to the non-metal's shell.
      const k = info.transfer;
      for (let i = 0; i < va; i++) add(onShell(posA, i, va), onShell(posB, vb + i, vb + k), ca);
      for (let i = 0; i < vb; i++) add(onShell(posB, i, vb), onShell(posB, i, vb + k), cb);
    } else {
      // Each atom puts `shared` electrons into the middle; the pairs sit nearer the more electronegative atom.
      const s = info.shared;
      const pull = info.ea === info.eb ? 0 : (info.ea > info.eb ? -1 : 1) * Math.min(0.35, info.delta * 0.25);
      const mid = (i) => new THREE.Vector3(pull, (i - (s - 1) / 2) * 0.28, 0);
      for (let i = 0; i < va; i++) add(onShell(posA, i, va), i < s ? mid(i).add(new THREE.Vector3(-0.08, 0, 0)) : awayFrom(posA, i - s, va - s, true), ca);
      for (let i = 0; i < vb; i++) add(onShell(posB, i, vb), i < s ? mid(i).add(new THREE.Vector3(0.08, 0, 0)) : awayFrom(posB, i - s, vb - s, false), cb);
    }
    state.t = 0;
    state.playing = false;
    $('[data-play]').textContent = '▶ Form the bond';
    root.querySelectorAll('[data-pair]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.pair === state.key)));
    renderPanel(info);
    apply(0);
  }

  function renderPanel(info) {
    const row = (k, v) => `<div class="row-between"><span>${k}</span><strong>${v}</strong></div>`;
    const kind = { ionic: '<span class="warn-text">Ionic</span>', 'polar covalent': '<span class="ok-text">Polar covalent</span>', 'non-polar covalent': 'Non-polar covalent' }[info.type];
    $('[data-out]').innerHTML = [
      row(`EN of ${info.a} / ${info.b}`, `${formatNumber(info.ea, 2)} / ${formatNumber(info.eb, 2)}`),
      row('Difference ΔEN', formatNumber(info.delta, 2)),
      row('Bond type', kind),
      info.shared ? row('Shared pairs', `${info.shared} (${['', 'single', 'double', 'triple'][info.shared]} bond)`) : row('Electrons moved', info.transfer),
    ].join('');
    const pct = Math.min(100, (info.delta / 3.3) * 100);
    $('[data-scale]').innerHTML = `<div class="en-bar"><span class="zone np">non-polar</span><span class="zone pol">polar</span><span class="zone ion">ionic</span><i style="left:${pct}%"></i></div><small>ΔEN: 0 ── 0.4 ── 1.7 ── 3.3 (rule of thumb)</small>`;
  }

  // t: 0 = separate atoms, 1 = bond formed.
  function apply(t) {
    const info = state.info;
    const e = t * t * (3 - 2 * t);
    for (const el of state.electrons) el.position.lerpVectors(el.userData.from, el.userData.to, e);
    const [A, B] = state.atoms;
    if (info.type === 'ionic') {
      const q = info.transfer;
      A.charge.element.textContent = t > 0.95 ? `${q > 1 ? q : ''}+` : '';
      B.charge.element.textContent = t > 0.95 ? `${q > 1 ? q : ''}−` : '';
      A.core.scale.setScalar(1 - 0.25 * e); // losing its outer shell, the metal ion shrinks
      B.core.scale.setScalar(1 + 0.15 * e);
    } else if (info.type === 'polar covalent') {
      const negA = info.ea > info.eb;
      A.charge.element.textContent = t > 0.95 ? (negA ? 'δ−' : 'δ+') : '';
      B.charge.element.textContent = t > 0.95 ? (negA ? 'δ+' : 'δ−') : '';
    } else {
      A.charge.element.textContent = '';
      B.charge.element.textContent = '';
    }
    if (t >= 1) {
      $('[data-msg]').innerHTML = info.type === 'ionic'
        ? `${info.a} gives ${info.transfer} electron${info.transfer > 1 ? 's' : ''} to ${info.b}. Now both have full shells, and the opposite charges hold them together: an <b>ionic bond</b>.`
        : info.type === 'polar covalent'
          ? `They share, but ${info.richer} pulls harder, so the shared electrons sit closer to it: ${info.richer} is slightly negative (δ−). A <b>polar covalent</b> bond.`
          : `Equal pull, so the electrons are shared evenly: a <b>non-polar covalent</b> bond${info.shared > 1 ? ` with ${info.shared} shared pairs` : ''}.`;
    } else {
      $('[data-msg]').innerHTML = 'Yellow and cyan dots are each atom’s outer electrons. Press <b>Form the bond</b>.';
    }
  }

  $('[data-pairs]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-pair]');
    if (!b) return;
    state.key = b.dataset.pair;
    build();
  });
  $('[data-play]').addEventListener('click', () => {
    if (state.t >= 1) build();
    state.playing = true;
  });

  stage.onFrame((dt) => {
    for (const a of state.atoms) a.g.children[1].rotation.z += dt * 0.3;
    if (!state.playing) return;
    state.t = Math.min(1, state.t + dt * 0.5);
    apply(state.t);
    if (state.t >= 1) {
      state.playing = false;
      $('[data-play]').textContent = '↺ Again';
    }
  });

  build();
  return () => stage.dispose();
}
