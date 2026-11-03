// Physics: electric field and potential. Potential is drawn as height, so + charges are hills and − charges are
// wells. Field lines run straight downhill (E = −∇V), and a test charge dropped on the surface rolls along them.
import * as THREE from 'three';
import { createStage } from '../stage.js';
import { potential, field, traceLine } from '../phys/field.js';
import { interact, rayOnPlane } from '../interact.js';
import { html } from '../ui.js';

const SIZE = 10;
const SEGS = 140;
const CLAMP = 2.4;
const PRESETS = {
  dipole: [{ x: -1.6, z: 0, q: 1 }, { x: 1.6, z: 0, q: -1 }],
  like: [{ x: -1.6, z: 0, q: 1 }, { x: 1.6, z: 0, q: 1 }],
  single: [{ x: 0, z: 0, q: 1 }],
  plates: [-2, -1, 0, 1, 2].flatMap((z) => [{ x: -1.5, z, q: 0.5 }, { x: 1.5, z, q: -0.5 }]),
};

export function mountEfield(root) {
  root.innerHTML = html`
    <div class="viewport" data-viewport></div>
    <aside class="panel">
      <h2>Electric Field &amp; Potential</h2>
      <p class="lede">Height here is <b>electric potential V</b>: positive charges push the ground up, negative charges pull it down. The field E = −∇V always points <b>straight downhill</b>, so field lines are the paths water would take, and they always cross the contour rings at right angles.</p>

      <h3>Charges</h3>
      <div class="op-group">
        <button class="btn small secondary" data-preset="dipole">Dipole</button>
        <button class="btn small secondary" data-preset="like">Two + charges</button>
        <button class="btn small secondary" data-preset="single">Single</button>
        <button class="btn small secondary" data-preset="plates">Capacitor</button>
      </div>
      <div class="btn-row">
        <button class="btn secondary" data-add="1">+ Add positive</button>
        <button class="btn secondary" data-add="-1">− Add negative</button>
      </div>

      <h3>View</h3>
      <label class="slider-row wide"><span>Hill height</span><input type="range" min="0" max="1" step="0.01" value="0.6" data-h><output data-h-out>0.6</output></label>
      <label class="slider-row wide"><span>Field lines</span><input type="range" min="4" max="24" step="1" value="12" data-lines><output data-lines-out>12</output></label>
      <label class="check"><input type="checkbox" data-contours checked> Equipotential rings</label>
      <p class="hint" data-insight></p>
    </aside>
  `;

  const $ = (sel) => root.querySelector(sel);
  const stage = createStage($('[data-viewport]'), { cameraPosition: [0, 8, 9], axes: false, grid: false });
  const { scene } = stage;
  const state = { charges: structuredClone(PRESETS.dipole), h: 0.6, lines: 12, contours: true };

  // The potential surface, coloured red (V > 0) to blue (V < 0), with rings at equal steps of V in the shader.
  const geom = new THREE.PlaneGeometry(SIZE, SIZE, SEGS, SEGS);
  geom.rotateX(-Math.PI / 2);
  geom.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geom.attributes.position.count * 3), 3));
  geom.setAttribute('pot', new THREE.BufferAttribute(new Float32Array(geom.attributes.position.count), 1));
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide, transparent: true, opacity: 0.92 });
  const contourUniform = { value: 1 };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uContours = contourUniform;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute float pot;\nvarying float vPot;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPot = pot;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vPot;\nuniform float uContours;')
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        float f = abs(fract(vPot * 2.5 + 0.5) - 0.5) / fwidth(vPot * 2.5);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.0), uContours * (1.0 - min(f, 1.0)) * 0.55);`);
  };
  const surface = new THREE.Mesh(geom, material);
  scene.add(surface);

  const linesGroup = new THREE.Group();
  scene.add(linesGroup);
  const chargeMeshes = [];
  const test = { mesh: null, trail: null, points: [], x: 0, z: 0, active: false };

  const heightAt = (x, z) => THREE.MathUtils.clamp(potential(x, z, state.charges), -CLAMP / 0.6, CLAMP / 0.6) * state.h;

  function updateSurface() {
    const pos = geom.attributes.position;
    const col = geom.attributes.color;
    const pot = geom.attributes.pot;
    const c = new THREE.Color();
    const pos3 = new THREE.Color(0xff5c7a);
    const neg3 = new THREE.Color(0x4c8dff);
    const zero = new THREE.Color(0x2a2d55);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const v = potential(x, z, state.charges);
      pos.setY(i, heightAt(x, z));
      pot.setX(i, THREE.MathUtils.clamp(v, -6, 6));
      const t = Math.min(1, Math.abs(v) / 1.5);
      c.copy(zero).lerp(v > 0 ? pos3 : neg3, t);
      col.setXYZ(i, c.r, c.g, c.b);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    pot.needsUpdate = true;
    geom.computeVertexNormals();
  }

  function updateLines() {
    linesGroup.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
    linesGroup.clear();
    const sources = state.charges.filter((c) => c.q > 0);
    const dir = sources.length ? 1 : -1;
    const seeds = sources.length ? sources : state.charges;
    const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
    for (const c of seeds) {
      const n = Math.max(3, Math.round(state.lines * Math.abs(c.q)));
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        const pts = traceLine(c.x + Math.cos(a) * 0.12, c.z + Math.sin(a) * 0.12, state.charges, { dir, bound: SIZE / 2 });
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map(([x, z]) => new THREE.Vector3(x, heightAt(x, z) + 0.03, z))), mat);
        linesGroup.add(line);
      }
    }
  }

  function updateCharges() {
    while (chargeMeshes.length > state.charges.length) {
      const m = chargeMeshes.pop();
      scene.remove(m);
      m.geometry.dispose();
      m.material.dispose();
    }
    state.charges.forEach((c, i) => {
      let m = chargeMeshes[i];
      if (!m) {
        m = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 16), new THREE.MeshStandardMaterial({ roughness: 0.3 }));
        scene.add(m);
        chargeMeshes.push(m);
      }
      m.material.color.setHex(c.q > 0 ? 0xff5c7a : 0x4c8dff);
      m.material.emissive.setHex(c.q > 0 ? 0x661020 : 0x10265c);
      m.position.set(c.x, Math.max(0, heightAt(c.x, c.z)) + 0.25, c.z); // above wells too, so it can be grabbed
      m.userData.index = i;
    });
  }

  function update() {
    updateSurface();
    updateLines();
    updateCharges();
    if (test.mesh?.visible) placeTest();
    const pos = state.charges.filter((c) => c.q > 0).length;
    const neg = state.charges.length - pos;
    $('[data-insight]').innerHTML = !neg ? 'No negative charge: every field line runs off to infinity, downhill forever.'
      : !pos ? 'Only negative charges: field lines come in from infinity and end on them.'
        : '<b>Click anywhere on the surface</b> to drop a + test charge and watch it roll along a field line.';
  }

  // Test charge: overdamped motion, velocity ∝ E, so it traces the field line it starts on.
  function dropTest(x, z) {
    if (!test.mesh) {
      test.mesh = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
      test.trail = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xfacc15 }));
      scene.add(test.mesh, test.trail);
    }
    Object.assign(test, { x, z, points: [], active: true });
    test.mesh.visible = test.trail.visible = true;
    placeTest();
  }
  // Once the charges move, the old path no longer follows a field line, so clear it.
  function clearTest() {
    if (!test.mesh) return;
    test.active = false;
    test.mesh.visible = test.trail.visible = false;
  }
  function placeTest() {
    test.mesh.position.set(test.x, heightAt(test.x, test.z) + 0.1, test.z);
    test.trail.geometry.setFromPoints(test.points.map(([x, z]) => new THREE.Vector3(x, heightAt(x, z) + 0.05, z)));
  }

  root.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
    state.charges = structuredClone(PRESETS[b.dataset.preset]);
    clearTest();
    update();
  }));
  root.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => {
    if (state.charges.length >= 12) return;
    const a = Math.random() * Math.PI * 2;
    state.charges.push({ x: Math.cos(a) * 2.5, z: Math.sin(a) * 2.5, q: Number(b.dataset.add) });
    clearTest();
    update();
  }));
  $('[data-h]').addEventListener('input', (e) => {
    state.h = Number(e.target.value);
    $('[data-h-out]').textContent = state.h;
    update();
  });
  $('[data-lines]').addEventListener('input', (e) => {
    state.lines = Number(e.target.value);
    $('[data-lines-out]').textContent = state.lines;
    updateLines();
  });
  $('[data-contours]').addEventListener('change', (e) => { contourUniform.value = e.target.checked ? 1 : 0; });

  // Drag charges across the floor; click the surface to drop a test charge.
  const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const stopInteract = interact(stage, {
    pick: () => [...chargeMeshes, surface],
    onDown: (hit) => {
      if (hit.object === surface) return null;
      const c = state.charges[hit.object.userData.index];
      clearTest();
      let pending = false;
      return {
        move: (ray) => {
          const p = rayOnPlane(ray, floor);
          if (!p) return;
          c.x = THREE.MathUtils.clamp(p.x, -SIZE / 2 + 0.3, SIZE / 2 - 0.3);
          c.z = THREE.MathUtils.clamp(p.z, -SIZE / 2 + 0.3, SIZE / 2 - 0.3);
          if (!pending) { // recompute at most once per frame
            pending = true;
            requestAnimationFrame(() => { pending = false; update(); });
          }
        },
      };
    },
    onClick: (hit) => {
      if (hit.object === surface) dropTest(hit.point.x, hit.point.z);
    },
  });

  stage.onFrame((dt) => {
    if (!test.active) return;
    for (let k = 0; k < 4; k++) {
      const [ex, ez] = field(test.x, test.z, state.charges);
      const m = Math.hypot(ex, ez);
      if (m < 1e-4) { test.active = false; break; }
      const step = THREE.MathUtils.clamp(m * dt * 3, 0.004, 0.03); // faster where the field is stronger
      test.x += (ex / m) * step;
      test.z += (ez / m) * step;
      test.points.push([test.x, test.z]);
      const atCharge = state.charges.some((c) => c.q < 0 && Math.hypot(test.x - c.x, test.z - c.z) < 0.15);
      if (atCharge || Math.abs(test.x) > SIZE / 2 || Math.abs(test.z) > SIZE / 2 || test.points.length > 3000) { test.active = false; break; }
    }
    placeTest();
  });

  update();
  return () => {
    stopInteract();
    stage.dispose();
  };
}
