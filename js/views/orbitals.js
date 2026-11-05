// Chemistry: atomic orbitals and electron configuration. Pick an element; the panel fills its orbitals in order
// (Aufbau) one arrow at a time (Hund's rule), and the 3D view shows the shapes of the selected subshell.
import * as THREE from 'three';
import { createStage, makeLabel, clearGroup } from '../stage.js';
import { ELEMENTS, NAMES, configuration, configString, boxes, unpaired, ORBITALS } from '../chem/orbitals.js';
import { html } from '../ui.js';

const PLUS = new THREE.Color(0xa78bfa);
const MINUS = new THREE.Color(0x22d3ee);

export function mountOrbitals(root) {
  root.innerHTML = html`
    <div class="viewport" data-viewport></div>
    <aside class="panel">
      <h2>Atomic Orbitals</h2>
      <p class="lede">Electrons don't orbit like planets. They live in <b>orbitals</b>: 3D regions where they are likely to be found. s orbitals are spheres, p orbitals are dumbbells, d orbitals are mostly four-leaf clovers. Each orbital holds at most <b>2 electrons</b> with opposite spins. The two colours are the wave's two phases (+ and −).</p>

      <div class="element-card"><span class="z" data-z></span><span class="sym" data-sym></span><span class="name" data-ename></span></div>
      <label class="slider-row wide"><span>Atomic no. Z</span><input type="range" min="1" max="36" step="1" value="8" data-zin><output data-zout>8</output></label>
      <div class="formula" data-config></div>

      <h3>Orbital diagram</h3>
      <div class="orbital-rows" data-rows></div>
      <p class="hint">Click a row to see that subshell's orbitals in 3D.</p>
      <div class="notice" data-msg></div>
    </aside>
  `;

  const $ = (sel) => root.querySelector(sel);
  const stage = createStage($('[data-viewport]'), { cameraPosition: [0, 3, 10], axes: false, grid: false });
  const group = new THREE.Group();
  stage.scene.add(group);
  const state = { z: 8, sub: '2p' };

  // A lobed surface: each direction u is pushed out to |Y(u)|², coloured by the sign of Y.
  function orbitalMesh(fn, scale, filled) {
    const geom = new THREE.SphereGeometry(1, 72, 54);
    const pos = geom.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const v = new THREE.Vector3();
    let max = 0;
    const vals = [];
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const y = fn(v.x, -v.z, v.y); // chemistry z is "up" (three.js y)
      vals.push(y);
      max = Math.max(max, Math.abs(y));
    }
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const r = (vals[i] / max) ** 2 * scale;
      pos.setXYZ(i, v.x * r, v.y * r, v.z * r);
      const c = vals[i] >= 0 ? PLUS : MINUS;
      colors.set([c.r, c.g, c.b], i * 3);
    }
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geom.computeVertexNormals();
    return new THREE.Mesh(geom, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, transparent: true, opacity: filled ? 0.9 : 0.18, depthWrite: filled, side: THREE.DoubleSide }));
  }

  function draw3D() {
    clearGroup(group);
    const sub = state.sub;
    const n = Number(sub[0]);
    const type = sub[1];
    const cfg = configuration(state.z).find((s) => s.sub === sub);
    const occ = boxes(sub, cfg?.e ?? 0);
    const list = ORBITALS[type];
    const gap = type === 'd' ? 2.6 : 3;
    const scale = (type === 's' ? 1.1 : 1.6) * (1 + 0.15 * (n - 1));
    list.forEach(([label, fn], i) => {
      const mesh = orbitalMesh(fn, scale, occ[i] > 0);
      mesh.position.x = (i - (list.length - 1) / 2) * gap;
      const arrows = ['empty', '↑', '↑↓'][occ[i]];
      mesh.add(makeLabel(`${n}${label}`, new THREE.Vector3(0, -scale - 0.5, 0), 0xe6e9f2, 'chart-label'));
      mesh.add(makeLabel(arrows, new THREE.Vector3(0, scale + 0.45, 0), occ[i] ? 0xfacc15 : 0x6b6f9e, 'chart-label'));
      const nucleus = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      mesh.add(nucleus);
      group.add(mesh);
    });
    stage.camera.position.set(0, 2.5, type === 'd' ? 13 : type === 'p' ? 10 : 7);
    stage.controls.target.set(0, 0, 0);
    stage.saveHome();
  }

  function render() {
    const z = state.z;
    $('[data-z]').textContent = z;
    $('[data-sym]').textContent = ELEMENTS[z - 1];
    $('[data-ename]').textContent = NAMES[z - 1];
    $('[data-config]').textContent = configString(z);
    const cfg = configuration(z);
    if (!cfg.some((s) => s.sub === state.sub)) state.sub = cfg.at(-1).sub;
    $('[data-rows]').innerHTML = cfg.map(({ sub, e }) => `
      <button class="orbital-row ${sub === state.sub ? 'current' : ''}" data-sub="${sub}">
        <span class="sub">${sub}</span>
        <span class="boxes">${boxes(sub, e).map((b) => `<span class="box">${['', '↑', '↑↓'][b]}</span>`).join('')}</span>
        <span class="count">${e}e⁻</span>
      </button>`).join('');
    const u = unpaired(z);
    $('[data-msg]').innerHTML = z === 24 || z === 29
      ? `<b>Exception!</b> ${NAMES[z - 1]} moves one 4s electron into 3d, because a ${z === 24 ? 'half-filled' : 'completely filled'} d subshell is extra stable.`
      : `${u} unpaired electron${u === 1 ? '' : 's'}${u ? ': it is attracted to a magnet (paramagnetic).' : ': not attracted to a magnet (diamagnetic).'} Electrons spread out one per box before pairing (<b>Hund's rule</b>).`;
    draw3D();
  }

  $('[data-zin]').addEventListener('input', (e) => {
    state.z = Number(e.target.value);
    $('[data-zout]').textContent = state.z;
    state.sub = configuration(state.z).at(-1).sub;
    render();
  });
  $('[data-rows]').addEventListener('click', (e) => {
    const row = e.target.closest('[data-sub]');
    if (!row) return;
    state.sub = row.dataset.sub;
    render();
  });

  stage.onFrame((dt) => { group.rotation.y += dt * 0.25; });

  render();
  return () => stage.dispose();
}
