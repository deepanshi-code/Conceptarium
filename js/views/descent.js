// Visualization 3: gradient descent (and Momentum / Adam) rolling down a 3D loss surface.
import * as THREE from 'three';
import { createStage, makeLabel, setArrow, COLORS } from '../stage.js';
import { SURFACES, OPTIMIZERS, DOMAIN, createOptimizer, step } from '../optim.js';
import { html } from '../ui.js';

const LIFT = 0.15;        // gap between the floor contour map and the surface's lowest point
const GRID = 100;         // surface resolution (cells per side)
const MAX_STEPS = 400;
const STEPS_PER_SECOND = 15;
const TRAIL_CAPACITY = MAX_STEPS + 2;

const OPT_COLORS = { gd: COLORS.accent, momentum: 0xff6b9d, adam: 0x4fd1c5 };

const NOTICES = {
  bowl: 'The easy case: one minimum and the same curvature in every direction. Push the learning rate past 2/L = 4 and watch descent overshoot and blow up.',
  valley: 'Steep in one direction, almost flat in the other. Plain descent zig-zags across the steep walls but crawls along the valley floor. Momentum swings across the walls too, but its velocity builds up along the floor, so it arrives in fewer steps. Compare the step counts under Progress, then try a smaller lr.',
  saddle: 'The middle is a saddle: the gradient is zero there but it is not a minimum. The ball starts only 0.02 off the ridge, so it lingers near the saddle before rolling off. Click exactly on the ridge (the line through the middle) and it may never escape.',
  himmelblau: 'Four minima with the same loss. Which one you reach depends only on where you start. Click different starting points: this is why neural-network training depends on how you initialize the weights.',
};

export function mountDescent(root) {
  root.innerHTML = html`
    <div class="viewport" data-viewport></div>
    <aside class="panel">
      <h2>Gradient Descent</h2>
      <p class="lede">Training a model means finding the weights with the lowest <strong>loss</strong>. Gradient descent repeatedly takes a step <em>downhill</em>: in the direction of −∇f, scaled by the <strong>learning rate</strong>.</p>

      <label class="field">Loss surface
        <select data-surface>
          ${Object.entries(SURFACES).map(([key, s]) => `<option value="${key}">${s.name}</option>`).join('')}
        </select>
      </label>

      <div class="notice" data-notice></div>

      <div class="field">
        <div class="row-between"><span>Learning rate (lr)</span><output data-lr-out></output></div>
        <input type="range" min="-3" max="0.7" step="0.01" data-lr>
        <p class="hint" data-lr-hint></p>
      </div>

      <fieldset class="toggles">
        <legend>Optimizers</legend>
        ${Object.entries(OPTIMIZERS).map(([key, o]) => html`
          <label><input type="checkbox" data-opt="${key}" ${key === 'adam' ? '' : 'checked'}>
            <span class="swatch" style="--c:#${new THREE.Color(OPT_COLORS[key]).getHexString()}"></span>${o.name}</label>`).join('')}
      </fieldset>

      <div class="btn-row">
        <button class="btn" data-play>▶ Play</button>
        <button class="btn secondary" data-step>Step</button>
        <button class="btn secondary" data-reset>Reset</button>
      </div>
      <p class="hint"><strong>Click on the surface</strong> to choose a new starting point. Start: <span data-start></span></p>

      <h3>Progress</h3>
      <table class="stats">
        <thead><tr><th></th><th>step</th><th>loss</th><th>status</th></tr></thead>
        <tbody data-stats></tbody>
      </table>

      <details class="legend">
        <summary>How to read this</summary>
        <ul>
          <li>Horizontal axes w₁, w₂ are the two weights. Height is the loss f(w₁, w₂).</li>
          <li>The flat map underneath is the same surface seen from above as contour lines, with each ball's path drawn on it.</li>
          <li>The small arrow at each ball is −∇f, the steepest downhill direction. It always crosses contour lines at right angles.</li>
          <li>Adam rescales each step to roughly lr in size, so the same lr means something different for Adam than for plain descent.</li>
        </ul>
      </details>
    </aside>
  `;

  const stage = createStage(root.querySelector('[data-viewport]'), { cameraPosition: [6.5, 6, 8], axes: false, grid: false });
  const { scene } = stage;
  const $ = (sel) => root.querySelector(sel);

  const state = {
    surfaceKey: 'bowl',
    lr: SURFACES.bowl.lr,
    start: [...SURFACES.bowl.start],
    playing: false,
    clock: 0,
  };

  // --- Static scene -------------------------------------------------------
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(DOMAIN * 2, DOMAIN * 2).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x141a2a }),
  );
  scene.add(floor);
  scene.add(makeLabel('w₁', new THREE.Vector3(DOMAIN + 0.35, 0, 0), COLORS.x));
  scene.add(makeLabel('w₂', new THREE.Vector3(0, 0, DOMAIN + 0.35), COLORS.z));
  const lossLabel = makeLabel('loss ↑', new THREE.Vector3(-DOMAIN, 3.4, -DOMAIN), COLORS.y);
  scene.add(lossLabel);
  const lossAxis = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-DOMAIN, 0, -DOMAIN), new THREE.Vector3(-DOMAIN, 3.2, -DOMAIN)]),
    new THREE.LineBasicMaterial({ color: COLORS.y, transparent: true, opacity: 0.5 }),
  );
  scene.add(lossAxis);

  const surfaceGroup = new THREE.Group(); // rebuilt whenever the surface changes
  scene.add(surfaceGroup);
  let surfaceMesh = null;

  // --- One ball + trails + gradient arrow per optimizer --------------------
  const runners = Object.keys(OPTIMIZERS).map((kind) => {
    const color = OPT_COLORS[kind];
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 24, 16),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35 }),
    );
    const trail = makeTrail(color, 1);
    const floorTrail = makeTrail(color, 0.8);
    const arrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1, color);
    const group = new THREE.Group();
    group.add(ball, trail.line, floorTrail.line, arrow);
    scene.add(group);
    return { kind, group, ball, trail, floorTrail, arrow, opt: null };
  });

  // --- UI wiring -----------------------------------------------------------
  $('[data-surface]').addEventListener('change', (e) => loadSurface(e.target.value));
  $('[data-lr]').addEventListener('input', (e) => {
    state.lr = 10 ** Number(e.target.value);
    renderLr();
  });
  root.querySelectorAll('[data-opt]').forEach((box) => box.addEventListener('change', reset));
  $('[data-play]').addEventListener('click', () => setPlaying(!state.playing));
  $('[data-step]').addEventListener('click', () => { setPlaying(false); advance(); });
  $('[data-reset]').addEventListener('click', reset);

  // A click (not a drag to orbit) on the surface or floor picks a new start.
  const raycaster = new THREE.Raycaster();
  const canvas = root.querySelector('[data-viewport] canvas');
  let downAt = null;
  canvas.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
  canvas.addEventListener('pointerup', (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 4) return;
    const rect = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, stage.camera);
    const hit = raycaster.intersectObjects([surfaceMesh, floor])[0];
    if (!hit) return;
    state.start = [clampDomain(hit.point.x), clampDomain(hit.point.z)];
    reset();
  });

  stage.onFrame((dt) => {
    if (!state.playing) return;
    state.clock += dt;
    while (state.clock > 1 / STEPS_PER_SECOND) {
      state.clock -= 1 / STEPS_PER_SECOND;
      advance();
    }
  });

  // --- Behaviour -----------------------------------------------------------
  const surface = () => SURFACES[state.surfaceKey];
  const heightAt = (x, z) => LIFT + surface().f(x, z) * surface().yScale;
  const activeRunners = () => runners.filter((r) => r.opt);

  function loadSurface(key) {
    state.surfaceKey = key;
    state.lr = SURFACES[key].lr;
    state.start = [...SURFACES[key].start];
    $('[data-notice]').textContent = NOTICES[key];
    $('[data-lr]').value = Math.log10(state.lr);
    renderLr();
    buildSurface();
    reset();
  }

  function buildSurface() {
    surfaceGroup.traverse((obj) => {
      obj.geometry?.dispose();
      obj.material?.dispose();
    });
    surfaceGroup.clear();

    const s = surface();
    const n = GRID + 1;
    const values = new Float32Array(n * n);
    let min = Infinity, max = -Infinity;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const v = s.f(-DOMAIN + (2 * DOMAIN * i) / GRID, -DOMAIN + (2 * DOMAIN * j) / GRID);
        values[j * n + i] = v;
        min = Math.min(min, v);
        max = Math.max(max, v);
      }
    }

    // PlaneGeometry rotated flat lists vertices row by row from (−D, −D) to (D, D), matching `values`.
    const geom = new THREE.PlaneGeometry(DOMAIN * 2, DOMAIN * 2, GRID, GRID).rotateX(-Math.PI / 2);
    const pos = geom.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const color = new THREE.Color();
    for (let k = 0; k < pos.count; k++) {
      const v = s.f(pos.getX(k), pos.getZ(k));
      pos.setY(k, LIFT + v * s.yScale);
      colormap((v - min) / (max - min), color).toArray(colors, k * 3);
    }
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geom.computeVertexNormals();
    surfaceMesh = new THREE.Mesh(geom, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, side: THREE.DoubleSide, transparent: true, opacity: 0.92 }));
    surfaceGroup.add(surfaceMesh);

    // Contour levels are spaced quadratically so the low (interesting) region gets more lines.
    const levels = Array.from({ length: 16 }, (_, k) => min + (max - min) * ((k + 0.5) / 16) ** 2);
    const segs = contourSegments(values, n, levels);
    const onSurface = [], onFloor = [];
    for (const [x1, z1, x2, z2, level] of segs) {
      const y = LIFT + level * s.yScale + 0.01;
      onSurface.push(x1, y, z1, x2, y, z2);
      onFloor.push(x1, 0.005, z1, x2, 0.005, z2);
    }
    surfaceGroup.add(lineSegments(onSurface, 0x0b0e17, 0.35), lineSegments(onFloor, 0x7f8cab, 0.55));

    const top = LIFT + max * s.yScale;
    lossAxis.geometry.setFromPoints([new THREE.Vector3(-DOMAIN, 0, -DOMAIN), new THREE.Vector3(-DOMAIN, top, -DOMAIN)]);
    lossLabel.position.set(-DOMAIN, top + 0.25, -DOMAIN);
  }

  function reset() {
    setPlaying(false);
    for (const r of runners) {
      const enabled = $(`[data-opt="${r.kind}"]`).checked;
      r.group.visible = enabled;
      r.opt = enabled ? createOptimizer(r.kind, state.start) : null;
      r.trail.clear();
      r.floorTrail.clear();
      if (enabled) record(r);
    }
    $('[data-start]').textContent = `(${state.start.map((v) => v.toFixed(2)).join(', ')})`;
    renderStats();
  }

  function advance() {
    const live = activeRunners().filter((r) => r.opt.status === 'running');
    if (!live.length || live[0].opt.t >= MAX_STEPS) {
      setPlaying(false);
      return;
    }
    for (const r of live) {
      step(r.opt, surface().grad, state.lr);
      record(r);
    }
    renderStats();
  }

  // Move the ball, extend both trails and point the −∇f arrow.
  function record(r) {
    const [x, z] = r.opt.p;
    const ok = r.opt.status !== 'diverged';
    r.ball.visible = ok;
    r.arrow.visible = ok;
    if (!ok) return;
    const y = heightAt(x, z);
    r.ball.position.set(x, y, z);
    r.trail.push(x, y + 0.02, z);
    r.floorTrail.push(x, 0.012, z);
    const [gx, gz] = surface().grad(x, z);
    const g = new THREE.Vector3(-gx, 0, -gz);
    const len = g.length();
    r.arrow.position.set(x, y + 0.02, z);
    setArrow(r.arrow, len > 1e-6 ? g.setLength(Math.min(1.2, 0.25 + len)) : g);
  }

  function setPlaying(on) {
    state.playing = on;
    state.clock = 0;
    $('[data-play]').textContent = on ? '❚❚ Pause' : '▶ Play';
  }

  function renderLr() {
    $('[data-lr-out]').textContent = state.lr < 0.01 ? state.lr.toFixed(4) : state.lr.toFixed(3);
    const L = surface().maxCurvature;
    $('[data-lr-hint]').innerHTML = L
      ? `This surface is a quadratic with largest curvature L = ${L}. Plain descent converges only if lr &lt; 2/L = <strong>${(2 / L).toFixed(2)}</strong>.`
      : 'Not a quadratic, so there is no single safe lr. Try a few and see what happens.';
  }

  function renderStats() {
    const statusText = { running: 'running', converged: '✓ converged', diverged: '✗ diverged' };
    $('[data-stats]').innerHTML = activeRunners().map((r) => {
      const loss = r.opt.status === 'diverged' ? '—' : formatLoss(surface().f(...r.opt.p));
      const swatch = `<span class="swatch" style="--c:#${new THREE.Color(OPT_COLORS[r.kind]).getHexString()}"></span>`;
      const status = r.opt.status === 'running' && r.opt.t >= MAX_STEPS ? 'max steps' : statusText[r.opt.status];
      return `<tr><td>${swatch}${OPTIMIZERS[r.kind].name.split(' (')[0]}</td><td>${r.opt.t}</td><td>${loss}</td><td class="${r.opt.status}">${status}</td></tr>`;
    }).join('');
  }

  loadSurface('bowl');
  return () => stage.dispose();
}

// --- Helpers ---------------------------------------------------------------

const clampDomain = (v) => Math.max(-DOMAIN, Math.min(DOMAIN, v));
const formatLoss = (v) => (Math.abs(v) < 1e-3 ? v.toExponential(1) : v.toFixed(3));

function makeTrail(color, opacity) {
  const positions = new Float32Array(TRAIL_CAPACITY * 3);
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setDrawRange(0, 0);
  const line = new THREE.Line(geom, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
  line.frustumCulled = false; // the bounding sphere is never recomputed as the trail grows
  let count = 0;
  return {
    line,
    push(x, y, z) {
      if (count >= TRAIL_CAPACITY) return;
      positions.set([x, y, z], count * 3);
      count += 1;
      geom.setDrawRange(0, count);
      geom.attributes.position.needsUpdate = true;
    },
    clear() {
      count = 0;
      geom.setDrawRange(0, 0);
    },
  };
}

function lineSegments(points, color, opacity) {
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  return new THREE.LineSegments(geom, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
}

/**
 * Contour lines by splitting every grid cell into two triangles. A level crosses a triangle's
 * edges either 0 or 2 times, so each crossing gives exactly one segment (no ambiguous cases).
 * Returns [x1, z1, x2, z2, level] tuples in world coordinates.
 */
function contourSegments(values, n, levels) {
  const toWorld = (i) => -DOMAIN + (2 * DOMAIN * i) / (n - 1);
  const segs = [];
  const tri = (a, b, c, level) => {
    const pts = [];
    for (const [p, q] of [[a, b], [b, c], [c, a]]) {
      if ((p.v < level) !== (q.v < level)) {
        const t = (level - p.v) / (q.v - p.v);
        pts.push(p.i + t * (q.i - p.i), p.j + t * (q.j - p.j));
      }
    }
    if (pts.length === 4) segs.push([toWorld(pts[0]), toWorld(pts[1]), toWorld(pts[2]), toWorld(pts[3]), level]);
  };
  for (let j = 0; j < n - 1; j++) {
    for (let i = 0; i < n - 1; i++) {
      const p00 = { i, j, v: values[j * n + i] };
      const p10 = { i: i + 1, j, v: values[j * n + i + 1] };
      const p01 = { i, j: j + 1, v: values[(j + 1) * n + i] };
      const p11 = { i: i + 1, j: j + 1, v: values[(j + 1) * n + i + 1] };
      for (const level of levels) {
        tri(p00, p10, p11, level);
        tri(p00, p11, p01, level);
      }
    }
  }
  return segs;
}

// Dark blue → teal → yellow, similar to viridis: perceptually ordered, readable for colour-blind users.
const STOPS = [0x2d1b69, 0x2a5f9e, 0x1fa187, 0x7ad151, 0xfde725].map((c) => new THREE.Color(c));
function colormap(t, out) {
  const x = Math.min(0.9999, Math.max(0, t)) * (STOPS.length - 1);
  const k = Math.floor(x);
  return out.copy(STOPS[k]).lerp(STOPS[k + 1], x - k);
}
