// Machine learning: the perceptron, the simplest neuron. It scores each point with w·x + b, drawn here as a tilted
// sheet: above the floor means "pink", below means "cyan". Each mistake tilts the sheet towards the right answer.
import * as THREE from 'three';
import { createStage, clearGroup } from '../stage.js';
import { predict, mistakes, learnStep } from '../ml/perceptron.js';
import { interact } from '../interact.js';
import { html, formatNumber } from '../ui.js';

const SIZE = 8;
const H = 0.35; // height per unit of score
const PINK = 0xf472b6;
const CYAN = 0x22d3ee;
const START = [-0.5, 0.6, 0.4]; // deliberately wrong, so there is something to learn
const LR = 0.05; // small steps, so each update is a visible tilt

const PRESETS = {
  separable: () => cloud(14, [1.6, 1.4], 1).concat(cloud(14, [-1.6, -1.2], -1)),
  close: () => cloud(16, [0.9, 0.7], 1).concat(cloud(16, [-0.9, -0.7], -1)),
  xor: () => [...cloud(7, [2, 2], -1), ...cloud(7, [-2, -2], -1), ...cloud(7, [-2, 2], 1), ...cloud(7, [2, -2], 1)],
};

// A small random cloud of points around a centre (deterministic enough to look tidy).
function cloud(n, [cx, cz], y) {
  return Array.from({ length: n }, () => {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * 1.1;
    return { x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r, y };
  });
}

export function mountPerceptron(root) {
  root.innerHTML = html`
    <div class="viewport" data-viewport></div>
    <aside class="panel">
      <h2>Perceptron</h2>
      <p class="lede">A perceptron gives each point a score <b>w₁x + w₂z + b</b>. Positive → pink, negative → cyan. The tilted sheet is that score, and its crossing with the floor is the <b>decision line</b>. When it gets a point wrong, it nudges w and b towards that point: w ← w + lr·y·x (here lr = 0.05). If a straight line can separate the classes, this is guaranteed to finish.</p>

      <h3>Data</h3>
      <div class="op-group">
        <button class="btn small secondary" data-preset="separable">Easy</button>
        <button class="btn small secondary" data-preset="close">Close together</button>
        <button class="btn small secondary" data-preset="xor">XOR</button>
        <button class="btn small secondary" data-clear>Clear</button>
      </div>
      <div class="segmented" role="radiogroup">
        <label><input type="radio" name="cls" value="1" checked> Add pink</label>
        <label><input type="radio" name="cls" value="-1"> Add cyan</label>
      </div>
      <p class="hint"><b>Click the floor</b> to add points of the chosen colour.</p>

      <h3>Learn</h3>
      <div class="btn-row">
        <button class="btn" data-train>▶ Train</button>
        <button class="btn secondary" data-step>One step</button>
        <button class="btn secondary" data-reset>Reset</button>
      </div>
      <div class="readout" data-stats></div>
      <div class="notice" data-msg></div>
    </aside>
  `;

  const $ = (sel) => root.querySelector(sel);
  const stage = createStage($('[data-viewport]'), { cameraPosition: [-5, 7.5, 8.5], axes: false, grid: false });
  const scene = stage.scene;
  const state = { points: PRESETS.separable(), w: [...START], shown: [...START], updates: 0, from: 0, training: false, clock: 0, flash: null };

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE), new THREE.MeshStandardMaterial({ color: 0x12153a, roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor, new THREE.GridHelper(SIZE, 8, 0x2a2f55, 0x1a1d40));

  // The score sheet, coloured by sign, and the decision line where it meets the floor.
  const sheetGeom = new THREE.PlaneGeometry(SIZE, SIZE, 40, 40);
  sheetGeom.rotateX(-Math.PI / 2);
  sheetGeom.setAttribute('color', new THREE.BufferAttribute(new Float32Array(sheetGeom.attributes.position.count * 3), 3));
  const sheet = new THREE.Mesh(sheetGeom, new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }));
  scene.add(sheet);
  const line = new THREE.Mesh(new THREE.BoxGeometry(1, 0.05, 0.08), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  scene.add(line);

  const dots = new THREE.Group();
  scene.add(dots);
  const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.04, 8, 32), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
  ringMesh.rotation.x = Math.PI / 2;
  ringMesh.visible = false;
  scene.add(ringMesh);

  function buildDots() {
    clearGroup(dots);
    const sphere = new THREE.SphereGeometry(0.16, 16, 12);
    const cube = new THREE.BoxGeometry(0.26, 0.26, 0.26);
    state.points.forEach((p) => {
      // Shape and colour both encode the class, so it reads without colour too.
      const m = new THREE.Mesh(p.y > 0 ? sphere : cube, new THREE.MeshStandardMaterial({ color: p.y > 0 ? PINK : CYAN, roughness: 0.4 }));
      m.position.set(p.x, 0.16, p.z);
      p.mesh = m;
      dots.add(m);
    });
  }

  function drawModel() {
    const [a, b, c] = state.shown;
    const pos = sheetGeom.attributes.position;
    const col = sheetGeom.attributes.color;
    const pink = new THREE.Color(PINK);
    const cyan = new THREE.Color(CYAN);
    for (let i = 0; i < pos.count; i++) {
      const s = a * pos.getX(i) + b * pos.getZ(i) + c;
      pos.setY(i, THREE.MathUtils.clamp(s * H, -2.5, 2.5));
      const k = s > 0 ? pink : cyan;
      col.setXYZ(i, k.r, k.g, k.b);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    sheetGeom.computeVertexNormals();
    // Decision line a·x + b·z + c = 0, clipped to the floor square.
    const n = Math.hypot(a, b);
    line.visible = n > 1e-6;
    if (line.visible) {
      const p0 = new THREE.Vector2((-c * a) / (n * n), (-c * b) / (n * n));
      const dir = new THREE.Vector2(-b / n, a / n);
      const ts = [];
      for (const [px, dx] of [[p0.x, dir.x], [p0.y, dir.y]]) {
        if (Math.abs(dx) > 1e-9) ts.push((-SIZE / 2 - px) / dx, (SIZE / 2 - px) / dx);
      }
      const inside = ts.filter((t) => {
        const q = p0.clone().addScaledVector(dir, t);
        return Math.abs(q.x) <= SIZE / 2 + 1e-6 && Math.abs(q.y) <= SIZE / 2 + 1e-6;
      }).sort((x, y) => x - y);
      line.visible = inside.length >= 2;
      if (line.visible) {
        const t0 = inside[0];
        const t1 = inside.at(-1);
        const mid = p0.clone().addScaledVector(dir, (t0 + t1) / 2);
        line.position.set(mid.x, 0.03, mid.y);
        line.scale.x = t1 - t0;
        line.rotation.y = -Math.atan2(dir.y, dir.x);
      }
    }
    // Wrong points get a dark outline effect: dimmer colour.
    for (const p of state.points) p.mesh.material.emissive.setHex(predict(state.w, p) !== p.y ? 0x7f1d1d : 0x000000);
  }

  function renderStats() {
    const wrong = mistakes(state.w, state.points).length;
    const [a, b, c] = state.w;
    $('[data-stats]').innerHTML = `
      <div class="row-between"><span>Weights w₁, w₂</span><strong>${formatNumber(a)}, ${formatNumber(b)}</strong></div>
      <div class="row-between"><span>Bias b</span><strong>${formatNumber(c)}</strong></div>
      <div class="row-between"><span>Points on the wrong side</span><strong class="${wrong ? 'warn-text' : 'ok-text'}">${wrong}</strong></div>
      <div class="row-between"><span>Updates so far</span><strong>${state.updates}</strong></div>`;
  }

  function step() {
    const r = learnStep(state.w, state.points, state.from, LR);
    if (!r) {
      setTraining(false);
      setMsg(state.points.length ? `✓ Every point is on the right side after <b>${state.updates}</b> update${state.updates === 1 ? '' : 's'}. Learned!` : 'Add some points first.');
      ringMesh.visible = false;
      renderStats();
      return false;
    }
    state.w = r.w;
    state.from = r.index + 1;
    state.updates += 1;
    ringMesh.position.set(r.point.x, 0.05, r.point.z);
    ringMesh.visible = true;
    setMsg(`A ${r.point.y > 0 ? 'pink' : 'cyan'} point was on the wrong side, so the sheet tilts towards it.`);
    if (state.updates >= 400 && state.updates % 100 === 0) {
      setMsg('<b>Still not done.</b> If no straight line can split pink from cyan (like XOR), a single perceptron keeps bouncing forever. That is why we stack neurons into layers.');
    }
    renderStats();
    return true;
  }

  const setMsg = (m) => { $('[data-msg]').innerHTML = m; };
  function setTraining(on) {
    state.training = on;
    $('[data-train]').textContent = on ? '❚❚ Pause' : '▶ Train';
  }
  function resetModel() {
    state.w = [...START];
    state.updates = 0;
    state.from = 0;
    setTraining(false);
    ringMesh.visible = false;
    setMsg('Press <b>Train</b> or <b>One step</b>. Points glowing dark red are currently misclassified.');
    renderStats();
  }

  root.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
    state.points = PRESETS[b.dataset.preset]();
    buildDots();
    resetModel();
  }));
  $('[data-clear]').addEventListener('click', () => {
    state.points = [];
    buildDots();
    resetModel();
  });
  $('[data-train]').addEventListener('click', () => setTraining(!state.training));
  $('[data-step]').addEventListener('click', () => { setTraining(false); step(); });
  $('[data-reset]').addEventListener('click', resetModel);

  const stopInteract = interact(stage, {
    pick: () => [floor],
    cursor: 'crosshair',
    onClick: (hit) => {
      const y = Number(root.querySelector('input[name=cls]:checked').value);
      state.points.push({ x: hit.point.x, z: hit.point.z, y });
      buildDots();
      renderStats();
    },
  });

  stage.onFrame((dt) => {
    if (state.training) {
      state.clock -= dt;
      if (state.clock <= 0) {
        state.clock = 0.18;
        step();
      }
    }
    // Ease the drawn sheet towards the current weights, so each update visibly tilts it.
    const e = Math.min(1, dt * 8);
    state.shown = state.shown.map((v, i) => v + (state.w[i] - v) * e);
    drawModel();
    if (ringMesh.visible) ringMesh.scale.setScalar(1 + 0.15 * Math.sin(performance.now() / 120));
  });

  buildDots();
  resetModel();
  return () => {
    stopInteract();
    stage.dispose();
  };
}
