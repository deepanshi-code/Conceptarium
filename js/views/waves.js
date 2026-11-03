// Physics: interference of two point sources on a water surface. Where crest meets crest the water swings
// twice as high (constructive); where crest meets trough it stays flat (destructive). Drag the sources.
import * as THREE from 'three';
import { createStage, makeLabel } from '../stage.js';
import { interact, rayOnPlane } from '../interact.js';
import { html, formatNumber } from '../ui.js';

const SIZE = 12;
const SEGS = 150;

export function mountWaves(root) {
  root.innerHTML = html`
    <div class="viewport" data-viewport></div>
    <aside class="panel">
      <h2>Wave Interference</h2>
      <p class="lede">Two sources make ripples of the same wavelength λ. At each point, the waves arrive having travelled different distances. If the <b>path difference</b> is a whole number of λ they add up (bright stripes); if it is a half-number they cancel (dark, calm stripes). The same maths explains Young's double slit.</p>

      <h3>Sources</h3>
      <div class="segmented" role="radiogroup">
        <label><input type="radio" name="count" value="1"> One</label>
        <label><input type="radio" name="count" value="2" checked> Two</label>
      </div>
      <label class="slider-row wide"><span>Wavelength λ</span><input type="range" min="0.4" max="2.5" step="0.05" value="1" data-l><output data-l-out>1</output></label>
      <label class="slider-row wide"><span>Speed</span><input type="range" min="0" max="2" step="0.05" value="1" data-speed><output data-speed-out>1×</output></label>
      <label class="check"><input type="checkbox" data-pattern checked> Colour by loudness (show the stripes)</label>
      <label class="check"><input type="checkbox" data-antiphase> Second source out of step (½λ)</label>

      <h3>Probe</h3>
      <div class="readout" data-probe></div>
      <p class="hint" data-insight></p>
    </aside>
  `;

  const $ = (sel) => root.querySelector(sel);
  const stage = createStage($('[data-viewport]'), { cameraPosition: [0, 9, 9.5], axes: false, grid: false });
  const { scene } = stage;
  const state = { sources: [{ x: -1.2, z: -2 }, { x: 1.2, z: -2 }], count: 2, lambda: 1, speed: 1, pattern: true, anti: false, t: 0, probe: { x: 0, z: 2.5 } };

  const geom = new THREE.PlaneGeometry(SIZE, SIZE, SEGS, SEGS);
  geom.rotateX(-Math.PI / 2);
  const count = geom.attributes.position.count;
  geom.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  const water = new THREE.Mesh(geom, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, metalness: 0.1, side: THREE.DoubleSide }));
  scene.add(water);

  const sourceMeshes = state.sources.map((s, i) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.9, 20), new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0x5a4300 }));
    m.userData.index = i;
    m.add(makeLabel(`S${i + 1}`, new THREE.Vector3(0, 0.75, 0), 0xfacc15, 'chart-label'));
    scene.add(m);
    return m;
  });
  const probe = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x444444 }));
  probe.add(makeLabel('P', new THREE.Vector3(0, 0.4, 0), 0xffffff, 'chart-label'));
  scene.add(probe);
  const pathLines = [0, 1].map(() => {
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.15, gapSize: 0.1 }));
    scene.add(l);
    return l;
  });

  const active = () => state.sources.slice(0, state.count);
  const k = () => (2 * Math.PI) / state.lambda;
  const phase = (i) => (i === 1 && state.anti ? Math.PI : 0);
  // Amplitude falls off slowly with distance (≈ 1/√r on a surface) so far ripples stay visible.
  const fall = (r) => 1 / Math.sqrt(1 + r);

  const quiet = new THREE.Color(0x0b1a3a);
  const loud = new THREE.Color(0x22d3ee);
  const hot = new THREE.Color(0xe0f2ff);
  const plain = new THREE.Color(0x2563eb);
  const tmp = new THREE.Color();

  function draw() {
    const pos = geom.attributes.position;
    const col = geom.attributes.color;
    const w = state.t * 2 * Math.PI * 0.6;
    const src = active();
    for (let i = 0; i < count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      // Sum the waves as phasors: the height now, and the size of the swing (the "loudness").
      let re = 0;
      let im = 0;
      src.forEach((s, j) => {
        const r = Math.hypot(x - s.x, z - s.z);
        const a = fall(r);
        const ph = k() * r + phase(j);
        re += a * Math.cos(ph);
        im += a * Math.sin(ph);
      });
      const h = re * Math.cos(w) + im * Math.sin(w);
      pos.setY(i, h * 0.32);
      if (state.pattern) {
        const amp = Math.min(1, Math.hypot(re, im) / (src.length * 0.75));
        tmp.copy(quiet).lerp(loud, amp).lerp(hot, Math.max(0, h) * 0.35);
      } else {
        tmp.copy(plain).lerp(hot, THREE.MathUtils.clamp(h * 0.6 + 0.2, 0, 1));
      }
      col.setXYZ(i, tmp.r, tmp.g, tmp.b);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    geom.computeVertexNormals();
  }

  function updateScene() {
    sourceMeshes.forEach((m, i) => {
      m.visible = i < state.count;
      m.children.forEach((c) => { if (c.isCSS2DObject) c.visible = m.visible; });
      m.position.set(state.sources[i].x, 0.2, state.sources[i].z);
    });
    probe.position.set(state.probe.x, 0.5, state.probe.z);
    pathLines.forEach((l, i) => {
      l.visible = i < state.count;
      const s = state.sources[i];
      l.geometry.setFromPoints([new THREE.Vector3(s.x, 0.5, s.z), probe.position.clone()]);
      l.computeLineDistances();
    });
    const [d1, d2] = state.sources.map((s) => Math.hypot(state.probe.x - s.x, state.probe.z - s.z));
    if (state.count === 1) {
      $('[data-probe]').innerHTML = `<div class="row-between"><span>Distance S1 → P</span><strong>${formatNumber(d1)}</strong></div>`;
      $('[data-insight]').innerHTML = 'One source just makes circles. Add the second source to see the stripes appear.';
      return;
    }
    const diff = Math.abs(d1 - d2) / state.lambda + (state.anti ? 0.5 : 0);
    const frac = diff - Math.floor(diff);
    const verdict = frac < 0.15 || frac > 0.85 ? '<span class="ok-text">loud (constructive)</span>' : Math.abs(frac - 0.5) < 0.15 ? '<span class="warn-text">quiet (destructive)</span>' : 'in between';
    $('[data-probe]').innerHTML = `
      <div class="row-between"><span>Path difference</span><strong>${formatNumber(Math.abs(d1 - d2))} = ${formatNumber(Math.abs(d1 - d2) / state.lambda)} λ</strong></div>
      <div class="row-between"><span>At P it is</span><strong>${verdict}</strong></div>`;
    $('[data-insight]').innerHTML = '<b>Drag the white probe P</b> onto a dark stripe and onto a bright one, and compare the path difference. Move the sources apart: more stripes.';
  }

  root.querySelectorAll('input[name=count]').forEach((r) => r.addEventListener('change', () => { state.count = Number(r.value); updateScene(); }));
  $('[data-l]').addEventListener('input', (e) => {
    state.lambda = Number(e.target.value);
    $('[data-l-out]').textContent = state.lambda;
    updateScene();
  });
  $('[data-speed]').addEventListener('input', (e) => {
    state.speed = Number(e.target.value);
    $('[data-speed-out]').textContent = `${state.speed}×`;
  });
  $('[data-pattern]').addEventListener('change', (e) => { state.pattern = e.target.checked; });
  $('[data-antiphase]').addEventListener('change', (e) => { state.anti = e.target.checked; updateScene(); });

  const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.2);
  const stopInteract = interact(stage, {
    pick: () => [...sourceMeshes.filter((m) => m.visible), probe],
    onDown: (hit) => {
      const target = hit.object === probe ? state.probe : state.sources[hit.object.userData.index];
      return {
        move: (ray) => {
          const p = rayOnPlane(ray, floor);
          if (!p) return;
          target.x = THREE.MathUtils.clamp(p.x, -SIZE / 2 + 0.3, SIZE / 2 - 0.3);
          target.z = THREE.MathUtils.clamp(p.z, -SIZE / 2 + 0.3, SIZE / 2 - 0.3);
          updateScene();
        },
      };
    },
  });

  stage.onFrame((dt) => {
    state.t += dt * state.speed;
    draw();
  });

  updateScene();
  draw();
  return () => {
    stopInteract();
    stage.dispose();
  };
}
