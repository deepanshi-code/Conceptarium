// Engineering Drawing 1: orthographic projection with the glass-box method.
// The object sits inside three projection planes (VP, HP, PP). Each view is computed from the solid's edges:
// feature edges plus silhouette edges for the viewing direction, split into visible and hidden parts by
// ray-casting towards the observer. The HP and PP then hinge open to lie flat beside the VP: the drawing sheet.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { createStage, makeLabel, clearGroup, setVisible } from '../stage.js';
import { interact, screenDrag } from '../interact.js';
import { html } from '../ui.js';

const D = 2.2; // half-size of the glass box
const OBJECT_COLOR = 0xfb923c;

const SOLIDS = {
  lblock: { name: 'L-block', build: () => extrude([[-1.2, -1], [1.2, -1], [1.2, -0.3], [-0.3, -0.3], [-0.3, 1], [-1.2, 1]], 1.6) },
  stepped: { name: 'Stepped block', build: () => extrude([[-1.2, -1], [1.2, -1], [1.2, -0.4], [0.4, -0.4], [0.4, 0.2], [-0.4, 0.2], [-0.4, 0.8], [-1.2, 0.8]], 1.4) },
  vblock: { name: 'V-block', build: () => extrude([[-1.2, -0.9], [1.2, -0.9], [1.2, 0.7], [0.5, 0.7], [0, 0], [-0.5, 0.7], [-1.2, 0.7]], 1.4) },
  hole: { name: 'Block with a hole', build: () => extrude([[-1.2, -0.9], [1.2, -0.9], [1.2, 0.9], [-1.2, 0.9]], 1.0, { x: 0, y: 0, r: 0.45 }) },
  tblock: { name: 'Inverted T (lying sideways)', build: () => extrude([[-1, -1], [1, -1], [1, -0.4], [0.3, -0.4], [0.3, 1], [-0.3, 1], [-0.3, -0.4], [-1, -0.4]], 2.4).rotateY(Math.PI / 2) },
  cylinder: { name: 'Cylinder', build: () => new THREE.CylinderGeometry(0.9, 0.9, 2, 48) },
  cone: { name: 'Cone', build: () => new THREE.ConeGeometry(1, 2, 48) },
  pyramid: { name: 'Square pyramid', build: () => new THREE.ConeGeometry(1.2, 2, 4).rotateY(Math.PI / 4) },
};

function extrude(points, depth, hole) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  if (hole) {
    const path = new THREE.Path();
    path.absarc(hole.x, hole.y, hole.r, 0, Math.PI * 2, true);
    shape.holes.push(path);
  }
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 40 }).translate(0, 0, -depth / 2);
}

// Each edge of the triangulated solid with the normals of its two faces, plus whether it is a sharp feature edge.
function analyzeEdges(geometry) {
  const g = geometry.clone();
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  const merged = mergeVertices(g, 1e-4);
  const pos = merged.attributes.position;
  const index = merged.index.array;
  const vertex = (i) => new THREE.Vector3().fromBufferAttribute(pos, i);
  const map = new Map();
  for (let t = 0; t < index.length; t += 3) {
    const [a, b, c] = [index[t], index[t + 1], index[t + 2]];
    const n = new THREE.Vector3().subVectors(vertex(b), vertex(a)).cross(new THREE.Vector3().subVectors(vertex(c), vertex(a)));
    if (n.lengthSq() < 1e-12) continue;
    n.normalize();
    for (const [p, q] of [[a, b], [b, c], [c, a]]) {
      const key = p < q ? `${p}_${q}` : `${q}_${p}`;
      const e = map.get(key);
      if (e) e.normals.push(n);
      else map.set(key, { a: p, b: q, normals: [n] });
    }
  }
  const sharp = THREE.MathUtils.degToRad(25);
  return [...map.values()].map((e) => {
    const [n1, n2 = n1] = e.normals;
    return { a: vertex(e.a), b: vertex(e.b), n1, n2, feature: e.normals.length < 2 || n1.angleTo(n2) > sharp };
  });
}

// Projection setup for first- and third-angle. `d` points from the object towards the observer of each view.
function planesFor(angle) {
  const first = angle === 'first';
  const zV = first ? -D : D;
  const yH = first ? -D : D;
  const xP = D;
  return {
    zV, yH, xP,
    views: {
      front: { name: 'Front view', d: new THREE.Vector3(0, 0, 1), project: (p) => new THREE.Vector3(p.x, p.y, zV), inward: new THREE.Vector3(0, 0, first ? 1 : -1) },
      top: { name: 'Top view', d: new THREE.Vector3(0, 1, 0), project: (p) => new THREE.Vector3(p.x, yH, p.z), inward: new THREE.Vector3(0, first ? 1 : -1, 0) },
      side: { name: first ? 'Left view' : 'Right view', d: new THREE.Vector3(first ? -1 : 1, 0, 0), project: (p) => new THREE.Vector3(xP, p.y, p.z), inward: new THREE.Vector3(-1, 0, 0) },
    },
    hpHinge: new THREE.Vector3(0, yH, zV),
    ppHinge: new THREE.Vector3(xP, 0, zV),
    ppUnfold: first ? Math.PI / 2 : -Math.PI / 2,
  };
}

export function mountDrawing(root) {
  root.innerHTML = html`
    <div class="viewport" data-viewport></div>
    <aside class="panel">
      <h2>Orthographic Projection</h2>
      <p class="lede">An orthographic drawing shows an object as separate <b>2D views</b>, each looking straight at one face. Imagine the object inside a <b>glass box</b>: each view is traced on a wall, then the walls open out flat onto the drawing sheet.</p>

      <label class="field">Object
        <select data-solid>${Object.entries(SOLIDS).map(([k, s]) => `<option value="${k}">${s.name}</option>`).join('')}</select>
      </label>

      <h3>Projection method</h3>
      <div class="segmented" role="radiogroup">
        <label><input type="radio" name="angle" value="first" checked> 1st angle</label>
        <label><input type="radio" name="angle" value="third"> 3rd angle</label>
      </div>
      <p class="hint" data-angle-note></p>

      <h3>Unfold the glass box</h3>
      <label class="slider-row wide"><span>Unfold</span><input type="range" min="0" max="1" step="0.01" value="0" data-unfold><output data-unfold-out>0%</output></label>
      <div class="btn-row">
        <button class="btn" data-play>▶ Unfold</button>
        <button class="btn secondary" data-fold>Fold back</button>
      </div>

      <h3>Camera</h3>
      <div class="view-buttons">
        <button class="btn small secondary" data-cam="3d">3D view</button>
        <button class="btn small secondary" data-cam="sheet">Drawing sheet</button>
        <button class="btn small secondary" data-cam="iso">Isometric</button>
      </div>
      <p class="hint" data-cam-note></p>

      <fieldset class="toggles">
        <legend>Show</legend>
        <label><input type="checkbox" data-show="hidden" checked> Hidden lines (dashed)</label>
        <label><input type="checkbox" data-show="projectors" checked> Projectors</label>
        <label><input type="checkbox" data-show="observers" checked> Observer arrows</label>
        <label><input type="checkbox" data-show="planes" checked> Glass planes</label>
      </fieldset>

      <details class="legend">
        <summary>Line conventions</summary>
        <ul>
          <li><b>Continuous thick line:</b> visible edge or outline.</li>
          <li><b>Dashed line:</b> hidden edge, behind material as seen from that view.</li>
          <li>Curved surfaces (cylinder, cone) are outlined by their <b>silhouette</b>, which changes with the view.</li>
          <li>Projectors are drawn perpendicular to each plane: every view is a <b>parallel</b> projection, so there is no perspective.</li>
        </ul>
      </details>
    </aside>
  `;

  const $ = (sel) => root.querySelector(sel);
  const stage = createStage($('[data-viewport]'), { cameraPosition: [7, 5.5, 9], axes: false, grid: false });
  const { scene, controls } = stage;
  controls.target.set(0.6, -0.4, 0);

  const state = { solid: 'lblock', angle: 'first', t: 0, playing: 0, cam: null };
  const world = new THREE.Group();
  scene.add(world);
  const raycaster = new THREE.Raycaster();
  raycaster.near = 1e-4;

  function rebuild() {
    clearGroup(world);

    const geometry = SOLIDS[state.solid].build();
    geometry.computeVertexNormals();
    const solid = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: OBJECT_COLOR, roughness: 0.55, metalness: 0.05, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
    const outline = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 25), new THREE.LineBasicMaterial({ color: 0x3b1d06 }));
    world.add(solid, outline);
    state.solidObjects = [solid, outline];
    // Ray-casting uses a double-sided copy so rays leaving the surface are blocked by any face in the way.
    const blocker = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    blocker.visible = false;
    world.add(blocker);
    blocker.updateMatrixWorld();

    const edges = analyzeEdges(geometry);
    const setup = planesFor(state.angle);
    const hp = new THREE.Group();
    hp.position.copy(setup.hpHinge);
    const pp = new THREE.Group();
    pp.position.copy(setup.ppHinge);
    world.add(hp, pp);
    state.hp = hp;
    state.pp = pp;
    state.setup = setup;
    state.planeObjects = [];
    state.grips = [];
    state.hiddenObjects = [];

    const parents = { front: world, top: hp, side: pp };
    const origins = { front: new THREE.Vector3(), top: setup.hpHinge, side: setup.ppHinge };

    // Glass planes.
    const planeMat = () => new THREE.MeshBasicMaterial({ color: 0x9cc2ff, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false });
    const borderMat = () => new THREE.LineBasicMaterial({ color: 0x6f8fc7, transparent: true, opacity: 0.6 });
    const square = new THREE.PlaneGeometry(2 * D, 2 * D);
    const placements = {
      front: (m) => m.position.set(0, 0, setup.zV),
      top: (m) => { m.rotation.x = -Math.PI / 2; m.position.set(0, 0, -setup.zV); },
      side: (m) => { m.rotation.y = Math.PI / 2; m.position.set(0, 0, -setup.zV); },
    };
    for (const [key, view] of Object.entries(setup.views)) {
      const plane = new THREE.Mesh(square, planeMat());
      placements[key](plane);
      const border = new THREE.LineSegments(new THREE.EdgesGeometry(square), borderMat());
      border.position.copy(plane.position);
      border.rotation.copy(plane.rotation);
      parents[key].add(plane, border);
      state.planeObjects.push(plane, border);

      // A glowing grip along the hinged plane's free edge: drag it to swing the plane open or shut.
      if (key !== 'front') {
        const far = (state.angle === 'first' ? 1 : -1) * 2 * D; // the free edge, measured from the hinge
        const grip = new THREE.Mesh(
          key === 'top' ? new THREE.BoxGeometry(2 * D, 0.1, 0.1) : new THREE.BoxGeometry(0.1, 2 * D, 0.1),
          new THREE.MeshBasicMaterial({ color: 0xb197fc }),
        );
        grip.position.set(0, 0, far);
        grip.userData.view = key;
        // A thicker invisible box around it makes the grip easy to catch with the mouse.
        const catcher = new THREE.Mesh(
          key === 'top' ? new THREE.BoxGeometry(2 * D, 0.5, 0.5) : new THREE.BoxGeometry(0.5, 2 * D, 0.5),
          new THREE.MeshBasicMaterial({ visible: false }),
        );
        catcher.position.copy(grip.position);
        catcher.userData.view = key;
        parents[key].add(grip, catcher);
        state.grips.push(catcher);
        state.planeObjects.push(grip);
      }

      // The traced view: visible and hidden segments, projected and expressed relative to the plane's hinge.
      const { visible, hidden } = traceView(edges, view, blocker, raycaster);
      const toLocal = (p, lift) => view.project(p).add(view.inward.clone().multiplyScalar(lift)).sub(origins[key]);
      const vis = segmentsObject(visible.map(([a, b]) => [toLocal(a, 0.012), toLocal(b, 0.012)]), new THREE.LineBasicMaterial({ color: 0xffffff }));
      const hid = segmentsObject(hidden.map(([a, b]) => [toLocal(a, 0.008), toLocal(b, 0.008)]), new THREE.LineDashedMaterial({ color: 0x9cc2ff, dashSize: 0.09, gapSize: 0.06 }));
      hid.computeLineDistances();
      vis.renderOrder = 2;
      parents[key].add(vis, hid);
      state.hiddenObjects.push(hid);

      // View name at the corner that ends up top-left of that view on the unfolded sheet; it rides along with the plane.
      const nearHinge = state.angle === 'first' ? -D + 0.25 : D - 0.25;
      const corner = {
        front: new THREE.Vector3(-D + 0.15, D - 0.15, setup.zV),
        top: new THREE.Vector3(-D + 0.15, setup.yH, -D + 0.25),
        side: new THREE.Vector3(setup.xP, D - 0.15, nearHinge),
      }[key];
      const label = makeLabel(view.name, corner.sub(origins[key]), 0xffd9a8, 'plane-label');
      label.center.set(0, 0);
      parents[key].add(label);
    }

    // XY reference line where the HP meets the VP.
    world.add(makeLabel('X', new THREE.Vector3(-D - 0.25, setup.yH, setup.zV), 0xffd9a8, 'dim-label'));
    world.add(makeLabel('Y', new THREE.Vector3(D + 0.25, setup.yH, setup.zV), 0xffd9a8, 'dim-label'));

    state.projectors = buildProjectors(edges, setup);
    world.add(state.projectors);
    state.observers = buildObservers(setup, state.angle);
    world.add(state.observers);

    applyUnfold();
    applyToggles();
  }

  function applyUnfold() {
    const t = state.t;
    state.hp.rotation.x = (t * Math.PI) / 2;
    state.pp.rotation.y = t * state.setup.ppUnfold;
    const fade = Math.max(0, 1 - t * 4);
    state.projectors.visible = fade > 0 && $('[data-show="projectors"]').checked;
    state.projectors.material.opacity = 0.35 * fade;
    setVisible(state.observers, t < 0.15 && $('[data-show="observers"]').checked);
    $('[data-unfold]').value = t;
    $('[data-unfold-out]').textContent = `${Math.round(t * 100)}%`;
  }

  function applyToggles() {
    for (const o of state.hiddenObjects) o.visible = $('[data-show="hidden"]').checked;
    for (const o of state.planeObjects) o.visible = $('[data-show="planes"]').checked;
    applyUnfold();
  }

  function setAngleNote() {
    $('[data-angle-note]').innerHTML = state.angle === 'first'
      ? '<b>1st angle</b>: the object is <b>between</b> the observer and the plane. Unfolded, the top view goes <b>below</b> the front view and the left view goes on the <b>right</b>. India (BIS SP 46) and most of Europe use this.'
      : '<b>3rd angle</b>: the plane is <b>between</b> the observer and the object, like looking through a window. Unfolded, the top view goes <b>above</b> and the right view on the <b>right</b>. Used in the USA.';
  }

  // --- Camera moves --------------------------------------------------------
  function moveCamera(kind) {
    const s = state.setup;
    let pos;
    let target;
    let mode = 'orthographic';
    if (kind === '3d') {
      mode = 'perspective';
      target = new THREE.Vector3(0.6, -0.4, 0);
      pos = new THREE.Vector3(7, 5.5, 9);
      $('[data-cam-note]').textContent = 'Perspective 3D view. Drag to orbit around the glass box.';
    } else if (kind === 'sheet') {
      state.playing = 1;
      target = new THREE.Vector3(D, state.angle === 'first' ? -D : D, s.zV);
      pos = target.clone().add(new THREE.Vector3(0, 0, 11));
      $('[data-cam-note]').textContent = 'Looking straight at the unfolded sheet with no perspective: this is the drawing you would make in AutoCAD.';
    } else {
      state.playing = -1;
      target = new THREE.Vector3(0, 0, 0);
      const dir = state.angle === 'first' ? new THREE.Vector3(-1, 1, 1) : new THREE.Vector3(1, 1, 1);
      pos = dir.normalize().multiplyScalar(8);
      $('[data-cam-note]').textContent = 'Isometric: looking along a cube\'s body diagonal. The three axes appear 120° apart and are foreshortened equally (to about 82%), which is why isometric drawings use one scale for all three.';
    }
    if (kind === 'iso') {
      $('[data-show="planes"]').checked = false;
      applyToggles();
    } else if (!$('[data-show="planes"]').checked) {
      $('[data-show="planes"]').checked = true;
      applyToggles();
    }
    // On the flat sheet the solid would sit in front of the views (1st angle), so hide it there.
    for (const o of state.solidObjects) o.visible = kind !== 'sheet';
    if (mode === 'perspective') stage.setProjection('perspective');
    state.cam = { from: stage.camera.position.clone(), to: pos, fromT: controls.target.clone(), toT: target, k: 0, mode };
  }

  // --- Wiring --------------------------------------------------------------
  $('[data-solid]').addEventListener('change', (e) => { state.solid = e.target.value; rebuild(); });
  root.querySelectorAll('input[name="angle"]').forEach((r) => r.addEventListener('change', () => {
    state.angle = r.value;
    setAngleNote();
    rebuild();
  }));
  $('[data-unfold]').addEventListener('input', (e) => {
    state.playing = 0;
    state.t = Number(e.target.value);
    applyUnfold();
  });
  $('[data-play]').addEventListener('click', () => { state.playing = 1; });
  $('[data-fold]').addEventListener('click', () => { state.playing = -1; });
  root.querySelectorAll('[data-show]').forEach((box) => box.addEventListener('change', applyToggles));
  root.querySelectorAll('[data-cam]').forEach((b) => b.addEventListener('click', () => moveCamera(b.dataset.cam)));

  stage.onFrame((dt) => {
    if (state.playing) {
      state.t = THREE.MathUtils.clamp(state.t + state.playing * dt / 1.6, 0, 1);
      if (state.t === 0 || state.t === 1) state.playing = 0;
      applyUnfold();
    }
    if (state.cam) {
      const c = state.cam;
      c.k = Math.min(1, c.k + dt / 0.9);
      const e = c.k * c.k * (3 - 2 * c.k);
      stage.camera.position.lerpVectors(c.from, c.to, e);
      controls.target.lerpVectors(c.fromT, c.toT, e);
      stage.camera.lookAt(controls.target);
      if (c.k === 1) {
        if (c.mode === 'orthographic') stage.setProjection('orthographic');
        state.cam = null;
      }
    }
  });

  setAngleNote();
  // Dragging a grip sets the unfold amount: down (1st angle) or up (3rd angle) for the top plane,
  // right for the side plane, matching the direction each plane swings.
  const stopInteract = interact(stage, {
    pick: () => state.grips,
    onDown: (hit, e) => {
      state.playing = 0;
      const t0 = state.t;
      const view = hit.object.userData.view;
      const sign = view === 'top' && state.angle === 'third' ? -1 : 1;
      return screenDrag(e, (dx, dy) => {
        state.t = THREE.MathUtils.clamp(t0 + (view === 'top' ? sign * dy : dx) / 260, 0, 1);
        applyUnfold();
      });
    },
  });

  rebuild();
  return () => {
    stopInteract();
    stage.dispose();
  };
}

// Split every edge drawn in this view into visible and hidden runs by casting a ray towards the observer.
function traceView(edges, view, blocker, raycaster) {
  const visible = [];
  const hidden = [];
  const d = view.d;
  for (const e of edges) {
    const s1 = e.n1.dot(d);
    const s2 = e.n2.dot(d);
    const silhouette = s1 * s2 < -1e-9;
    if (!e.feature && !silhouette) continue;
    if (view.project(e.a).distanceTo(view.project(e.b)) < 1e-4) continue; // edge seen end-on

    // Nudge ray origins off the surface (outwards along the edge's average normal) to avoid self-hits.
    const out = e.n1.clone().add(e.n2);
    if (out.lengthSq() < 1e-8) out.copy(e.n1);
    out.normalize();
    const steps = Math.max(1, Math.ceil(e.a.distanceTo(e.b) / 0.04));
    let runStart = e.a.clone();
    let runHidden = null;
    for (let i = 0; i < steps; i++) {
      const p0 = e.a.clone().lerp(e.b, i / steps);
      const mid = e.a.clone().lerp(e.b, (i + 0.5) / steps);
      raycaster.set(mid.addScaledVector(out, 0.003).addScaledVector(d, 0.002), d);
      const isHidden = raycaster.intersectObject(blocker, false).length > 0;
      if (runHidden === null) runHidden = isHidden;
      else if (isHidden !== runHidden) {
        (runHidden ? hidden : visible).push([runStart, p0]);
        runStart = p0;
        runHidden = isHidden;
      }
    }
    (runHidden ? hidden : visible).push([runStart, e.b.clone()]);
  }
  return { visible, hidden };
}

function segmentsObject(pairs, material) {
  const pts = [];
  for (const [a, b] of pairs) pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return new THREE.LineSegments(geom, material);
}

// Thin lines from the object's corners to each plane: shows that every view is a perpendicular projection.
function buildProjectors(edges, setup) {
  const corners = [];
  const seen = new Set();
  for (const e of edges) {
    // Skip the many short segments that approximate curves (hole rims, cylinder caps): corners only.
    if (!e.feature || e.a.distanceTo(e.b) < 0.25) continue;
    for (const p of [e.a, e.b]) {
      const key = p.toArray().map((v) => v.toFixed(2)).join(',');
      if (!seen.has(key)) {
        seen.add(key);
        corners.push(p);
      }
    }
  }
  const pairs = [];
  for (const p of corners.slice(0, 48)) for (const view of Object.values(setup.views)) pairs.push([p, view.project(p)]);
  return segmentsObject(pairs, new THREE.LineBasicMaterial({ color: 0xb197fc, transparent: true, opacity: 0.35 }));
}

// Arrows showing where the observer stands for each view.
function buildObservers(setup, angle) {
  const group = new THREE.Group();
  const add = (from, dir, text) => {
    const arrow = new THREE.ArrowHelper(dir, from, 1.3, 0xb197fc, 0.3, 0.18);
    group.add(arrow);
    group.add(makeLabel(text, from.clone().addScaledVector(dir, -0.35), 0xb197fc, 'dim-label'));
  };
  add(new THREE.Vector3(0, 0, 4.6), new THREE.Vector3(0, 0, -1), 'FV');
  add(new THREE.Vector3(0, 4.4, 0), new THREE.Vector3(0, -1, 0), 'TV');
  if (angle === 'first') add(new THREE.Vector3(-4.6, 0, 0), new THREE.Vector3(1, 0, 0), 'LV');
  else add(new THREE.Vector3(4.9, 0, 0), new THREE.Vector3(-1, 0, 0), 'RV');
  return group;
}
