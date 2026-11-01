// Visualization 2: translation, rotation and scale as 4x4 homogeneous matrices,
// why their order matters, and what the camera's projection matrix does.
import * as THREE from 'three';
import { createStage, COLORS } from '../stage.js';
import { renderMatrix, html } from '../ui.js';
import { interact, rayOnPlane, cameraPlane } from '../interact.js';

const ORDERS = ['TRS', 'TSR', 'RTS', 'RST', 'STR', 'SRT'];
const OP_NAMES = { T: 'Translate', R: 'Rotate', S: 'Scale' };

const SLIDERS = [
  { group: 'T', key: 'tx', label: 'x', min: -3, max: 3, step: 0.1, value: 2 },
  { group: 'T', key: 'ty', label: 'y', min: -3, max: 3, step: 0.1, value: 0 },
  { group: 'T', key: 'tz', label: 'z', min: -3, max: 3, step: 0.1, value: 0 },
  { group: 'R', key: 'rx', label: 'x°', min: -180, max: 180, step: 1, value: 0 },
  { group: 'R', key: 'ry', label: 'y°', min: -180, max: 180, step: 1, value: 0 },
  { group: 'R', key: 'rz', label: 'z°', min: -180, max: 180, step: 1, value: 45 },
  { group: 'S', key: 'sx', label: 'x', min: 0.2, max: 2.5, step: 0.05, value: 1 },
  { group: 'S', key: 'sy', label: 'y', min: 0.2, max: 2.5, step: 0.05, value: 1.5 },
  { group: 'S', key: 'sz', label: 'z', min: 0.2, max: 2.5, step: 0.05, value: 1 },
];

export function mountTransforms(root) {
  root.innerHTML = html`
    <div class="viewport" data-viewport></div>
    <aside class="panel">
      <h2>3D Transformations</h2>
      <p class="lede">Graphics engines move objects by multiplying every vertex by one <strong>4×4 matrix</strong>. It is built from simpler matrices, and the <strong>order</strong> you multiply them in changes the result.</p>

      <label class="field">Multiplication order
        <select data-order>
          ${ORDERS.map((o) => `<option value="${o}">M = ${o.split('').join(' · ')}</option>`).join('')}
        </select>
      </label>
      <p class="hint" data-order-hint></p>

      <div class="field">
        <div class="row-between"><span>Operations applied</span><output data-steps-out>3 / 3</output></div>
        <input type="range" min="0" max="3" step="1" value="3" data-steps>
        <button class="btn" data-play>▶ Animate step by step</button>
      </div>

      ${['T', 'R', 'S'].map((g) => html`
        <fieldset class="sliders">
          <legend>${OP_NAMES[g]}</legend>
          ${SLIDERS.filter((s) => s.group === g).map((s) => html`
            <label class="slider-row">
              <span>${s.label}</span>
              <input type="range" min="${s.min}" max="${s.max}" step="${s.step}" value="${s.value}" data-param="${s.key}">
              <output data-out="${s.key}">${s.value}</output>
            </label>`).join('')}
        </fieldset>`).join('')}

      <button class="btn secondary" data-reset>Reset values</button>

      <h3>Composite matrix M</h3>
      <div data-m-composite></div>
      <p class="hint">Gold column = translation. It only works because points are written as (x, y, z, <strong>1</strong>): that extra 1 is what homogeneous coordinates add.</p>

      <div class="matrix-trio">
        <div><h4>T</h4><div data-m-T></div></div>
        <div><h4>R = R<sub>z</sub>·R<sub>y</sub>·R<sub>x</sub></h4><div data-m-R></div></div>
        <div><h4>S</h4><div data-m-S></div></div>
      </div>

      <h3>Camera projection</h3>
      <div class="segmented" role="radiogroup">
        <label><input type="radio" name="proj" value="perspective" checked> Perspective</label>
        <label><input type="radio" name="proj" value="orthographic"> Orthographic</label>
      </div>
      <label class="slider-row" data-fov-row>
        <span>FOV</span>
        <input type="range" min="15" max="110" step="1" value="50" data-fov>
        <output data-fov-out>50°</output>
      </label>
      <div data-m-proj></div>
      <p class="hint" data-proj-hint></p>
    </aside>
  `;

  const stage = createStage(root.querySelector('[data-viewport]'), { cameraPosition: [5, 4, 7], axisLength: 4 });
  const { scene } = stage;
  const $ = (sel) => root.querySelector(sel);

  const params = Object.fromEntries(SLIDERS.map((s) => [s.key, s.value]));
  const state = { order: 'TRS', steps: 3, playing: false, playClock: 0 };

  // The model: an asymmetric "F" so rotations and reflections are easy to tell apart.
  const model = buildModel(new THREE.MeshStandardMaterial({ color: COLORS.accent, roughness: 0.5, metalness: 0.1 }));
  model.add(new THREE.AxesHelper(0.9));
  model.matrixAutoUpdate = false;
  scene.add(model);

  // Faint copies show where the object was after each earlier step.
  const ghosts = [0, 1, 2].map((i) => {
    const g = buildModel(new THREE.MeshBasicMaterial({ color: 0x9cc2ff, transparent: true, opacity: 0.12 + i * 0.06, depthWrite: false }));
    g.matrixAutoUpdate = false;
    scene.add(g);
    return g;
  });

  // --- UI wiring -----------------------------------------------------------
  root.querySelectorAll('[data-param]').forEach((input) => {
    input.addEventListener('input', () => {
      params[input.dataset.param] = Number(input.value);
      $(`[data-out="${input.dataset.param}"]`).textContent = input.value;
      update();
    });
  });
  $('[data-order]').addEventListener('change', (e) => { state.order = e.target.value; update(); });
  $('[data-steps]').addEventListener('input', (e) => { state.playing = false; setSteps(Number(e.target.value)); });
  $('[data-play]').addEventListener('click', () => {
    state.playing = true;
    state.playClock = 0;
    setSteps(0);
  });
  $('[data-reset]').addEventListener('click', () => {
    for (const s of SLIDERS) {
      params[s.key] = s.value;
      $(`[data-param="${s.key}"]`).value = s.value;
      $(`[data-out="${s.key}"]`).textContent = s.value;
    }
    update();
  });
  root.querySelectorAll('input[name="proj"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      stage.setProjection(radio.value);
      $('[data-fov-row]').hidden = radio.value !== 'perspective';
      updateProjection();
    });
  });
  $('[data-fov]').addEventListener('input', (e) => {
    stage.setFov(Number(e.target.value));
    $('[data-fov-out]').textContent = `${e.target.value}°`;
    updateProjection();
  });

  stage.onFrame((dt) => {
    if (!state.playing) return;
    state.playClock += dt;
    const step = Math.min(3, Math.floor(state.playClock / 0.9));
    if (step !== state.steps) setSteps(step);
    if (step === 3) state.playing = false;
  });
  // Orbiting changes the projection only for orthographic zoom, but keep the readout honest.
  stage.controls.addEventListener('change', updateProjection);

  function setSteps(n) {
    state.steps = n;
    $('[data-steps]').value = n;
    $('[data-steps-out]').textContent = `${n} / 3`;
    update();
  }

  function buildMatrices() {
    const d = THREE.MathUtils.degToRad;
    const T = new THREE.Matrix4().makeTranslation(params.tx, params.ty, params.tz);
    const R = new THREE.Matrix4()
      .makeRotationZ(d(params.rz))
      .multiply(new THREE.Matrix4().makeRotationY(d(params.ry)))
      .multiply(new THREE.Matrix4().makeRotationX(d(params.rx)));
    const S = new THREE.Matrix4().makeScale(params.sx, params.sy, params.sz);
    return { T, R, S };
  }

  function update() {
    const mats = buildMatrices();
    // M = A · B · C is applied to a point right-to-left: C first, then B, then A.
    const applyOrder = state.order.split('').reverse();
    const partial = [new THREE.Matrix4()];
    for (const op of applyOrder) partial.push(mats[op].clone().multiply(partial.at(-1)));

    model.matrix.copy(partial[state.steps]);
    model.matrixWorldNeedsUpdate = true;
    ghosts.forEach((g, i) => {
      g.visible = i < state.steps;
      g.matrix.copy(partial[i]);
      g.matrixWorldNeedsUpdate = true;
    });

    const steps = applyOrder.map((op, i) => `<span class="${i < state.steps ? 'done' : ''}">${i + 1}. ${OP_NAMES[op]}</span>`);
    $('[data-order-hint]').innerHTML = `Applied right-to-left: ${steps.join(' → ')}`;

    renderMatrix($('[data-m-composite]'), toRows(partial[3]), (r, c) => (c === 3 && r < 3 ? 'gold' : r === 3 ? 'dim' : ''));
    renderMatrix($('[data-m-T]'), toRows(mats.T), (r, c) => (c === 3 && r < 3 ? 'gold' : ''));
    renderMatrix($('[data-m-R]'), toRows(mats.R));
    renderMatrix($('[data-m-S]'), toRows(mats.S));
  }

  function updateProjection() {
    const cam = stage.camera;
    renderMatrix($('[data-m-proj]'), toRows(cam.projectionMatrix), (r, c) => (r === 3 && c === 2 ? 'gold' : ''));
    $('[data-proj-hint]').innerHTML = cam.isPerspectiveCamera
      ? 'Gold entry: the −1 copies −z (depth) into w. The GPU then divides x and y by w, so far objects shrink. That division is perspective.'
      : 'The bottom row is (0, 0, 0, 1), so w stays 1 and nothing is divided by depth. Parallel lines stay parallel and size does not change with distance.';
  }

  // Grab the object and drag it: the pointer's movement is added to the translation T. With order T·R·S the
  // object follows the pointer exactly; with T applied earlier, the later R and S also act on the movement.
  const stopInteract = interact(stage, {
    pick: () => model.children.filter((c) => c.isMesh),
    onDown: (hit) => {
      const plane = cameraPlane(stage.camera, hit.point);
      let last = hit.point.clone();
      return {
        move: (ray) => {
          const p = rayOnPlane(ray, plane);
          if (!p) return;
          const delta = p.clone().sub(last);
          last = p;
          for (const [key, d] of [['tx', delta.x], ['ty', delta.y], ['tz', delta.z]]) {
            params[key] = THREE.MathUtils.clamp(params[key] + d, -3, 3);
            $(`[data-param="${key}"]`).value = params[key];
            $(`[data-out="${key}"]`).textContent = params[key].toFixed(1);
          }
          update();
        },
      };
    },
  });

  update();
  updateProjection();
  return () => {
    stopInteract();
    stage.dispose();
  };
}

function toRows(m4) {
  const e = m4.elements; // column-major
  return [0, 1, 2, 3].map((r) => [0, 1, 2, 3].map((c) => e[c * 4 + r]));
}

function buildModel(material) {
  const group = new THREE.Group();
  const parts = [
    [0.3, 1.6, 0.3, 0, 0.8, 0],     // stem
    [0.9, 0.3, 0.3, 0.45, 1.45, 0], // top bar
    [0.6, 0.3, 0.3, 0.3, 0.85, 0],  // middle bar
  ];
  for (const [w, h, d, x, y, z] of parts) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    group.add(mesh);
  }
  return group;
}
