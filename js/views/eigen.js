// Visualization 1: a 3x3 matrix as a transformation of space, and the eigenvectors it leaves on their span.
import * as THREE from 'three';
import { createStage, setArrow, makeLabel, COLORS } from '../stage.js';
import { det3, eigen3, lerpFromIdentity, mulVec3 } from '../linalg.js';
import { matrixInputs, formatNumber, html } from '../ui.js';
import { interact, rayOnPlane, cameraPlane } from '../interact.js';

const c60 = 0.5;
const s60 = Math.sqrt(3) / 2;

const PRESETS = {
  stretch: {
    name: 'Stretch along axes',
    matrix: [[2, 0, 0], [0, 1, 0], [0, 0, 0.5]],
    notice: 'A diagonal matrix only scales each axis, so the axes themselves are the eigenvectors and the diagonal entries are the eigenvalues.',
  },
  symmetric: {
    name: 'Symmetric',
    matrix: [[2, 1, 0], [1, 2, 0], [0, 0, 0.5]],
    notice: 'Symmetric matrices always have real eigenvalues and mutually perpendicular eigenvectors. Orbit the camera and check the three gold lines meet at right angles.',
  },
  nonsymmetric: {
    name: 'Non-symmetric',
    matrix: [[1, 1, 0], [0, 2, 0], [0, 0, 1.5]],
    notice: 'Eigenvectors still exist, but they are no longer perpendicular. Compare the angle between the gold lines with the symmetric preset.',
  },
  shear: {
    name: 'Shear',
    matrix: [[1, 1, 0], [0, 1, 0], [0, 0, 1]],
    notice: 'λ = 1 appears three times, but there is only a 2-D plane of eigenvectors (a "defective" matrix). Volume is unchanged: det = 1.',
  },
  rotation: {
    name: 'Rotation about z (60°)',
    matrix: [[c60, -s60, 0], [s60, c60, 0], [0, 0, 1]],
    notice: 'Only the rotation axis stays on its span. The other two eigenvalues are complex, which is the algebra telling you "no other real direction survives". (Mid-animation the shape shrinks because the animation blends I → A linearly; that is not part of the rotation.)',
  },
  projection: {
    name: 'Projection onto xy-plane',
    matrix: [[1, 0, 0], [0, 1, 0], [0, 0, 0]],
    notice: 'λ = 0 means the z-direction is squashed to nothing. det = 0, so the unit cube collapses to a flat square with zero volume, and the matrix is not invertible.',
  },
  reflection: {
    name: 'Reflection (flip y)',
    matrix: [[1, 0, 0], [0, -1, 0], [0, 0, 1]],
    notice: 'A negative determinant means orientation flips: the cube turns "inside out". The y-axis is an eigenvector with λ = −1.',
  },
};

export function mountEigen(root) {
  root.innerHTML = html`
    <div class="viewport" data-viewport></div>
    <aside class="panel">
      <h2>Matrix &amp; Eigenvectors</h2>
      <p class="lede">A matrix moves every vector in space. Most vectors get knocked off their original line. <strong>Eigenvectors</strong> stay on their line and are only stretched by a factor <em>λ</em>.</p>

      <label class="field">Preset
        <select data-preset>
          ${Object.entries(PRESETS).map(([key, p]) => `<option value="${key}">${p.name}</option>`).join('')}
        </select>
      </label>

      <div class="field">Matrix A (edit any entry)
        <div data-matrix></div>
      </div>

      <div class="field">
        <div class="row-between"><span>Transform progress <em>t</em></span><output data-t-out>1.00</output></div>
        <input type="range" min="0" max="1" step="0.01" value="1" data-t>
        <button class="btn" data-play>▶ Play I → A</button>
      </div>

      <div class="notice" data-notice></div>

      <div class="readout">
        <div class="row-between"><span>det(A) <small>(volume scale)</small></span><strong data-det></strong></div>
        <div class="row-between"><span>det at current <em>t</em></span><strong data-det-t></strong></div>
      </div>

      <h3>Eigenvalues</h3>
      <ul class="eigen-list" data-eigen-list></ul>

      <fieldset class="toggles">
        <legend>Show</legend>
        <label><input type="checkbox" data-show="lattice" checked> Grid lines of space</label>
        <label><input type="checkbox" data-show="cube" checked> Unit cube (volume = |det|)</label>
        <label><input type="checkbox" data-show="samples" checked> Sample vectors</label>
        <label><input type="checkbox" data-show="eigen" checked> Eigenvectors &amp; spans</label>
      </fieldset>

      <details class="legend">
        <summary>How to read this</summary>
        <ul>
          <li><span class="swatch" style="--c:#ff5c5c"></span><span class="swatch" style="--c:#5cdb7f"></span><span class="swatch" style="--c:#5c9dff"></span> Where the basis vectors î, ĵ, k̂ land: these are the <em>columns</em> of A.</li>
          <li><span class="swatch" style="--c:#8892a6"></span> Sample vectors: they turn away from their starting direction.</li>
          <li><span class="swatch" style="--c:#ffc845"></span> Eigenvectors: they never leave their gold line.</li>
          <li>The animation shows (1 − t)·I + t·A, so at t = 0 nothing has moved yet.</li>
        </ul>
      </details>
    </aside>
  `;

  const stage = createStage(root.querySelector('[data-viewport]'));
  const { scene } = stage;
  const state = { matrix: PRESETS.stretch.matrix.map((r) => [...r]), t: 1, playing: false };

  // --- Scene objects -------------------------------------------------------
  const lattice = buildLattice();
  scene.add(lattice.object);

  const cube = buildUnitCube();
  scene.add(cube.object);

  const basisArrows = [COLORS.x, COLORS.y, COLORS.z].map((color) => {
    const a = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1, color);
    scene.add(a);
    return a;
  });
  // Invisible grab handles at each basis tip: much easier to catch with the mouse than the thin arrowheads.
  const tipHandles = basisArrows.map(() => {
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), new THREE.MeshBasicMaterial({ visible: false }));
    scene.add(h);
    return h;
  });

  const sampleDirs = fibonacciSphere(18).map((v) => v.multiplyScalar(1.4));
  const samples = new THREE.Group();
  const sampleArrows = sampleDirs.map(() => {
    const a = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1, COLORS.muted);
    a.line.material.transparent = true;
    a.line.material.opacity = 0.7;
    samples.add(a);
    return a;
  });
  scene.add(samples);

  const eigenGroup = new THREE.Group();
  scene.add(eigenGroup);
  let eigenItems = [];

  // --- UI wiring -----------------------------------------------------------
  const $ = (sel) => root.querySelector(sel);
  const matrixUI = matrixInputs($('[data-matrix]'), state.matrix, (m) => {
    state.matrix = m;
    $('[data-preset]').value = '';
    $('[data-notice]').textContent = 'Custom matrix. Try making two columns parallel and watch det → 0.';
    rebuildEigen();
  });

  $('[data-preset]').addEventListener('change', (e) => applyPreset(e.target.value));
  $('[data-t]').addEventListener('input', (e) => {
    state.playing = false;
    setT(Number(e.target.value));
  });
  $('[data-play]').addEventListener('click', () => {
    state.t = 0;
    state.playing = true;
  });
  root.querySelectorAll('[data-show]').forEach((box) => {
    box.addEventListener('change', () => {
      const target = { lattice: lattice.object, cube: cube.object, samples, eigen: eigenGroup }[box.dataset.show];
      target.visible = box.checked;
    });
  });

  stage.onFrame((dt) => {
    if (!state.playing) return;
    const next = Math.min(1, state.t + dt / 2.5);
    if (next >= 1) state.playing = false;
    setT(next);
  });

  function applyPreset(key) {
    const preset = PRESETS[key];
    if (!preset) return;
    state.matrix = preset.matrix.map((r) => [...r]);
    matrixUI.set(state.matrix);
    $('[data-notice]').textContent = preset.notice;
    rebuildEigen();
    state.t = 0;
    state.playing = true;
  }

  function setT(t) {
    state.t = t;
    $('[data-t]').value = t;
    $('[data-t-out]').textContent = t.toFixed(2);
    update();
  }

  // Recompute eigenvectors only when A changes; per-frame updates just move geometry.
  function rebuildEigen() {
    eigenGroup.traverse((obj) => {
      obj.geometry?.dispose();
      obj.material?.dispose();
    });
    eigenGroup.clear();
    const { values, spaces } = eigen3(state.matrix);
    eigenItems = [];

    for (const space of spaces) {
      if (space.kind === 'all') continue;
      const lambdaText = `λ = ${formatNumber(space.lambda)}`;
      if (space.kind === 'plane') {
        const [u, w] = space.basis.map((b) => new THREE.Vector3(...b));
        const plane = new THREE.Mesh(
          new THREE.PlaneGeometry(5, 5),
          new THREE.MeshBasicMaterial({ color: COLORS.accent, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }),
        );
        const normal = new THREE.Vector3().crossVectors(u, w).normalize();
        plane.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
        eigenGroup.add(plane);
      }
      for (const b of space.basis) {
        const dir = new THREE.Vector3(...b);
        const spanLine = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([dir.clone().multiplyScalar(-6), dir.clone().multiplyScalar(6)]),
          new THREE.LineDashedMaterial({ color: COLORS.accent, dashSize: 0.15, gapSize: 0.1, transparent: true, opacity: 0.6 }),
        );
        spanLine.computeLineDistances();
        const arrow = new THREE.ArrowHelper(dir, new THREE.Vector3(), 1, COLORS.accent);
        const label = makeLabel(lambdaText, new THREE.Vector3(), COLORS.accent, 'eigen-label');
        eigenGroup.add(spanLine, arrow, label);
        eigenItems.push({ dir, lambda: space.lambda, arrow, label });
      }
    }

    renderEigenList(values, spaces);
    $('[data-det]').textContent = formatNumber(det3(state.matrix));
    update();
  }

  function renderEigenList(values, spaces) {
    const items = spaces.map((s) => {
      const where = {
        line: `eigenvector ≈ (${s.basis[0].map(formatNumber).join(', ')})`,
        plane: 'a whole <strong>plane</strong> of eigenvectors (gold sheet)',
        all: 'every vector is an eigenvector',
      }[s.kind];
      const mult = s.multiplicity > 1 ? ` <small>(×${s.multiplicity})</small>` : '';
      return `<li><span class="lambda">λ = ${formatNumber(s.lambda)}</span>${mult}<br><small>${where}</small></li>`;
    });
    const complex = values.filter((v) => v.im > 1e-7);
    for (const v of complex) {
      items.push(`<li><span class="lambda">λ = ${formatNumber(v.re)} ± ${formatNumber(v.im)}i</span><br><small>complex pair: no real direction stays on its span</small></li>`);
    }
    $('[data-eigen-list]').innerHTML = items.join('');
  }

  function update() {
    const M = lerpFromIdentity(state.matrix, state.t);
    const m4 = toMatrix4(M);

    lattice.update(m4);
    cube.update(m4);
    $('[data-det-t]').textContent = formatNumber(det3(M));

    basisArrows.forEach((arrow, i) => {
      setArrow(arrow, new THREE.Vector3(M[0][i], M[1][i], M[2][i]));
      tipHandles[i].position.set(M[0][i], M[1][i], M[2][i]);
    });
    sampleArrows.forEach((arrow, i) => {
      const v = sampleDirs[i];
      setArrow(arrow, new THREE.Vector3(...mulVec3(M, [v.x, v.y, v.z])));
    });
    for (const item of eigenItems) {
      // M(t)·v = ((1 − t) + tλ)·v: the arrow only changes length (and may flip), never direction.
      const factor = 1 - state.t + state.t * item.lambda;
      const v = item.dir.clone().multiplyScalar(1.6 * factor);
      setArrow(item.arrow, v);
      item.label.position.copy(v.lengthSq() > 0.01 ? v.clone().multiplyScalar(1.12) : item.dir.clone().multiplyScalar(0.3));
    }
  }

  // Drag a basis-vector tip: that vector IS a column of A, so the matrix, eigenvalues and eigenvectors
  // all update live. Values snap to 0.1 so the matrix stays readable.
  const NAMES = ['î', 'ĵ', 'k̂'];
  const stopInteract = interact(stage, {
    pick: () => tipHandles,
    onDown: (hit) => {
      const col = tipHandles.indexOf(hit.object);
      state.playing = false;
      if (state.t < 1) setT(1);
      const plane = cameraPlane(stage.camera, hit.object.getWorldPosition(new THREE.Vector3()));
      $('[data-preset]').value = '';
      return {
        move: (ray) => {
          const p = rayOnPlane(ray, plane);
          if (!p) return;
          const snap = (v) => Math.round(THREE.MathUtils.clamp(v, -3, 3) * 10) / 10;
          [p.x, p.y, p.z].forEach((v, row) => { state.matrix[row][col] = snap(v); });
          matrixUI.set(state.matrix);
          $('[data-notice]').innerHTML = `You moved <b>${NAMES[col]}</b>, so column ${col + 1} of A is now (${state.matrix.map((r) => formatNumber(r[col])).join(', ')}). Watch the eigenvalues and gold lines react.`;
          rebuildEigen();
        },
      };
    },
  });

  applyPreset('stretch');
  return () => {
    stopInteract();
    stage.dispose();
  };
}

// --- Helpers ---------------------------------------------------------------

function toMatrix4(M) {
  return new THREE.Matrix4().set(
    M[0][0], M[0][1], M[0][2], 0,
    M[1][0], M[1][1], M[1][2], 0,
    M[2][0], M[2][1], M[2][2], 0,
    0, 0, 0, 1,
  );
}

// Lines of the cube [-2, 2]³ at unit spacing. A linear map keeps lines straight, so transforming
// the end points is enough.
function buildLattice() {
  const ticks = [-2, -1, 0, 1, 2];
  const pts = [];
  for (const a of ticks) {
    for (const b of ticks) {
      pts.push(-2, a, b, 2, a, b);
      pts.push(a, -2, b, a, 2, b);
      pts.push(a, b, -2, a, b, 2);
    }
  }
  const original = new Float32Array(pts);
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(original.slice(), 3));
  const object = new THREE.LineSegments(geom, new THREE.LineBasicMaterial({ color: 0x4a6fa5, transparent: true, opacity: 0.22 }));
  const v = new THREE.Vector3();
  return {
    object,
    update(m4) {
      const pos = geom.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        v.fromArray(original, i * 3).applyMatrix4(m4);
        pos.setXYZ(i, v.x, v.y, v.z);
      }
      pos.needsUpdate = true;
      geom.computeBoundingSphere();
    },
  };
}

function buildUnitCube() {
  const geom = new THREE.BoxGeometry(1, 1, 1).translate(0.5, 0.5, 0.5);
  const fill = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({ color: COLORS.z, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geom), new THREE.LineBasicMaterial({ color: 0x9cc2ff }));
  const object = new THREE.Group();
  object.add(fill, edges);
  object.matrixAutoUpdate = false;
  return {
    object,
    update(m4) {
      object.matrix.copy(m4);
      object.matrixWorldNeedsUpdate = true;
    },
  };
}

function fibonacciSphere(n) {
  const out = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    out.push(new THREE.Vector3(Math.cos(golden * i) * r, y, Math.sin(golden * i) * r));
  }
  return out;
}
