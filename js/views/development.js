// Engineering Drawing 2: development of surfaces. A prism, cylinder, pyramid or cone is built as a chain of
// hinged faces. At t = 1 every hinge is flat (the development / sheet-metal pattern); at t = 0 it is folded shut.
import * as THREE from 'three';
import { createStage, makeLabel, clearGroup } from '../stage.js';
import { html, formatNumber } from '../ui.js';
import { interact, screenDrag } from '../interact.js';

const SOLIDS = {
  prism3: { name: 'Triangular prism', kind: 'prism', n: 3 },
  prism4: { name: 'Square prism', kind: 'prism', n: 4 },
  prism6: { name: 'Hexagonal prism', kind: 'prism', n: 6 },
  cylinder: { name: 'Cylinder', kind: 'prism', n: 48, smooth: true },
  pyramid4: { name: 'Square pyramid', kind: 'pyramid', n: 4 },
  pyramid6: { name: 'Hexagonal pyramid', kind: 'pyramid', n: 6 },
  cone: { name: 'Cone', kind: 'pyramid', n: 48, smooth: true },
};
const COLORS = [0xfb923c, 0xf97316];

export function mountDevelopment(root) {
  root.innerHTML = html`
    <div class="viewport" data-viewport></div>
    <aside class="panel">
      <h2>Development of Surfaces</h2>
      <p class="lede">A <b>development</b> is the flat pattern that folds up into a solid. Sheet-metal workers cut it out to make ducts, funnels, hoppers and cans. Prisms and cylinders unroll into <b>rectangles</b>; pyramids and cones unfold into <b>sectors</b> around the apex.</p>

      <label class="field">Solid
        <select data-solid>${Object.entries(SOLIDS).map(([k, s]) => `<option value="${k}">${s.name}</option>`).join('')}</select>
      </label>
      <label class="slider-row wide"><span>Base radius r</span><input type="range" min="0.5" max="1.5" step="0.05" value="1" data-r><output data-r-out>1</output></label>
      <label class="slider-row wide"><span>Height h</span><input type="range" min="0.8" max="3" step="0.05" value="2" data-h><output data-h-out>2</output></label>
      <label class="check"><input type="checkbox" data-caps checked> Include base / top</label>

      <h3>Unfold</h3>
      <label class="slider-row wide"><span>Unfold</span><input type="range" min="0" max="1" step="0.01" value="0" data-t><output data-t-out>0%</output></label>
      <div class="btn-row">
        <button class="btn" data-play>▶ Unfold</button>
        <button class="btn secondary" data-fold>Fold up</button>
      </div>

      <h3>Measurements</h3>
      <div class="formula" data-formula></div>
      <p class="hint" data-note></p>
    </aside>
  `;

  const $ = (sel) => root.querySelector(sel);
  const stage = createStage($('[data-viewport]'), { cameraPosition: [2, 4, 11], axes: false, grid: false });
  const state = { key: 'prism4', r: 1, h: 2, caps: true, t: 0, playing: 0 };
  const holder = new THREE.Group();
  stage.scene.add(holder);
  let net = null;

  function rebuild() {
    clearGroup(holder);
    const spec = SOLIDS[state.key];
    net = spec.kind === 'prism' ? buildPrism(spec, state.r, state.h, state.caps) : buildPyramid(spec, state.r, state.h, state.caps);
    holder.add(net.root);
    // Frame both poses: the camera target glides between the folded solid and the flat pattern.
    net.setT(0);
    net.root.updateMatrixWorld(true);
    net.foldedCenter = new THREE.Box3().setFromObject(net.root).getCenter(new THREE.Vector3());
    net.setT(1);
    net.root.updateMatrixWorld(true);
    const flatBox = new THREE.Box3().setFromObject(net.root);
    net.flatCenter = flatBox.getCenter(new THREE.Vector3());
    net.flatSize = flatBox.getSize(new THREE.Vector3());
    apply();
    renderFormula(spec);
  }

  function apply() {
    net.setT(state.t);
    for (const l of net.labels) l.visible = state.t > 0.92;
    stage.controls.target.copy(net.foldedCenter).lerp(net.flatCenter, state.t);
    $('[data-t]').value = state.t;
    $('[data-t-out]').textContent = `${Math.round(state.t * 100)}%`;
  }

  function renderFormula(spec) {
    const { r, h } = state;
    const L = Math.hypot(r, h);
    const n = spec.n;
    const a = 2 * r * Math.sin(Math.PI / n);
    const f = formatNumber;
    if (spec.kind === 'prism' && spec.smooth) {
      $('[data-formula]').innerHTML = `Pattern: rectangle ${f(2 * Math.PI * r)} × ${f(h)}<br>width = 2πr = ${f(2 * Math.PI * r)}<br>lateral area = 2πrh = ${f(2 * Math.PI * r * h)}`;
      $('[data-note]').innerHTML = 'The rectangle\'s width equals the base circumference, which is how a sheet is rolled into a pipe.';
    } else if (spec.kind === 'prism') {
      $('[data-formula]').innerHTML = `Pattern: ${n} rectangles, each ${f(a)} × ${f(h)}<br>side a = 2r·sin(180°/${n}) = ${f(a)}<br>lateral area = ${n}·a·h = ${f(n * a * h)}`;
      $('[data-note]').innerHTML = 'Each lateral face appears at its true size in the development, because it is folded flat onto the sheet.';
    } else if (spec.smooth) {
      const theta = (360 * r) / L;
      $('[data-formula]').innerHTML = `Pattern: sector of radius L = √(r² + h²) = ${f(L)}<br>sector angle θ = 360° × r / L = <b>${f(theta)}°</b><br>lateral area = πrL = ${f(Math.PI * r * L)}`;
      $('[data-note]').innerHTML = 'The arc length of the sector (θ/360 × 2πL) equals the base circumference 2πr: that is where θ = 360·r/L comes from. Change h and watch θ change.';
    } else {
      const slantFace = Math.hypot(h, r * Math.cos(Math.PI / n));
      $('[data-formula]').innerHTML = `Pattern: ${n} triangles around the apex<br>slant edge (true length) L = √(r² + h²) = ${f(L)}<br>lateral area = ${n} × ½ × a × slant height = ${f(n * 0.5 * a * slantFace)}`;
      $('[data-note]').innerHTML = 'Draughtsmen must find the <b>true length</b> of the slant edge first: in the front view it is foreshortened unless it lies parallel to the vertical plane.';
    }
  }

  const bindRange = (key) => $(`[data-${key}]`).addEventListener('input', (e) => {
    state[key] = Number(e.target.value);
    $(`[data-${key}-out]`).textContent = e.target.value;
    rebuild();
  });
  bindRange('r');
  bindRange('h');
  $('[data-solid]').addEventListener('change', (e) => { state.key = e.target.value; rebuild(); });
  $('[data-caps]').addEventListener('change', (e) => { state.caps = e.target.checked; rebuild(); });
  $('[data-t]').addEventListener('input', (e) => { state.playing = 0; state.t = Number(e.target.value); apply(); });
  $('[data-play]').addEventListener('click', () => { state.playing = 1; });
  $('[data-fold]').addEventListener('click', () => { state.playing = -1; });

  stage.onFrame((dt) => {
    if (!state.playing) return;
    state.t = THREE.MathUtils.clamp(state.t + state.playing * dt / 2, 0, 1);
    if (state.t === 0 || state.t === 1) state.playing = 0;
    apply();
  });

  $('[data-solid]').value = state.key;
  // Grab the solid and drag sideways: right unfolds it into its pattern, left folds it back up.
  const stopInteract = interact(stage, {
    pick: () => {
      const meshes = [];
      net?.root.traverse((o) => { if (o.isMesh) meshes.push(o); });
      return meshes;
    },
    onDown: (hit, e) => {
      state.playing = 0;
      const t0 = state.t;
      return screenDrag(e, (dx) => {
        state.t = THREE.MathUtils.clamp(t0 + dx / 320, 0, 1);
        apply();
      });
    },
  });

  rebuild();
  return () => {
    stopInteract();
    stage.dispose();
  };
}

// --- Geometry ----------------------------------------------------------------

function faceMesh(points2d, color) {
  const shape = new THREE.Shape(points2d.map(([x, y]) => new THREE.Vector2(x, y)));
  const geom = new THREE.ShapeGeometry(shape);
  const group = new THREE.Group();
  group.add(new THREE.Mesh(geom, new THREE.MeshStandardMaterial({ color, roughness: 0.6, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })));
  return group;
}

function outline(points2d, color = 0x2a1405) {
  const pts = points2d.map(([x, y]) => new THREE.Vector3(x, y, 0));
  return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color }));
}

// Regular n-gon (circumradius r) with one side along the x-axis from (0,0) to (a,0), on the +y side.
function polygonOnEdge(n, r) {
  const a = 2 * r * Math.sin(Math.PI / n);
  const ap = r * Math.cos(Math.PI / n);
  const cx = a / 2;
  const cy = ap;
  const start = Math.atan2(-ap, -a / 2);
  return Array.from({ length: n }, (_, k) => [cx + r * Math.cos(start + (2 * Math.PI * k) / n), cy + r * Math.sin(start + (2 * Math.PI * k) / n)]);
}

function buildPrism(spec, r, h, caps) {
  const { n, smooth } = spec;
  const a = 2 * r * Math.sin(Math.PI / n);
  const theta = (2 * Math.PI) / n; // exterior angle between neighbouring faces
  const root = new THREE.Group();
  const hinges = [];
  let parent = root;
  for (let i = 0; i < n; i++) {
    const g = new THREE.Group();
    if (i > 0) g.position.set(a, 0, 0);
    const rect = [[0, 0], [a, 0], [a, h], [0, h]];
    g.add(faceMesh(rect, smooth ? COLORS[0] : COLORS[i % 2]));
    if (!smooth) g.add(outline(rect));
    else g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(a, 0, 0), new THREE.Vector3(0, h, 0), new THREE.Vector3(a, h, 0)]), new THREE.LineBasicMaterial({ color: 0x2a1405 })));
    parent.add(g);
    if (i > 0) hinges.push(g);
    parent = g;
  }
  const face0 = root.children[0];
  const capGroups = [];
  if (caps) {
    const poly = polygonOnEdge(n, r);
    const top = new THREE.Group();
    top.position.set(0, h, 0);
    top.add(faceMesh(poly, 0xfdba74), outline(poly));
    const bottom = new THREE.Group();
    bottom.add(faceMesh(poly.map(([x, y]) => [x, -y]), 0xfdba74), outline(poly.map(([x, y]) => [x, -y])));
    face0.add(top, bottom);
    capGroups.push([top, -1], [bottom, 1]);
  }

  const labels = [];
  const width = n * a;
  const wLabel = makeLabel(smooth ? `2πr = ${formatNumber(2 * Math.PI * r)}` : `${n} × a = ${formatNumber(width)}`, new THREE.Vector3(width / 2, h + 0.35, 0), 0xffd9a8, 'dim-label');
  const hLabel = makeLabel(`h = ${formatNumber(h)}`, new THREE.Vector3(width + 0.45, h / 2, 0), 0xffd9a8, 'dim-label');
  root.add(wLabel, hLabel);
  labels.push(wLabel, hLabel);
  // Labels live in face 0's frame, which never moves, so they line up with the flat sheet.
  return {
    root,
    labels,
    setT(t) {
      for (const g of hinges) g.rotation.y = (1 - t) * theta;
      // Caps start in the face's plane and swing 90° inwards (towards −z, where the faces fold).
      for (const [g, s] of capGroups) g.rotation.x = s * (1 - t) * (Math.PI / 2);
    },
  };
}

function buildPyramid(spec, r, h, caps) {
  const { n, smooth } = spec;
  const L = Math.hypot(r, h);
  const a = 2 * r * Math.sin(Math.PI / n);
  const beta = 2 * Math.asin(a / (2 * L)); // apex angle of each triangle in the flat sector
  // Fold angle between neighbouring lateral faces = angle between their outward normals in the real solid.
  const v = (k) => new THREE.Vector3(r * Math.cos((2 * Math.PI * k) / n), 0, r * Math.sin((2 * Math.PI * k) / n));
  const apex = new THREE.Vector3(0, h, 0);
  const normal = (k) => new THREE.Vector3().subVectors(v(k), apex).cross(new THREE.Vector3().subVectors(v(k + 1), apex)).normalize();
  const gamma = normal(0).angleTo(normal(1));

  // Choose the fold direction that actually closes the solid: after n−1 hinges the last triangle's free
  // edge must land back on the first triangle's starting edge (the +x axis).
  const closure = (sign) => {
    const m = new THREE.Matrix4();
    const step = new THREE.Matrix4().makeRotationZ(beta).multiply(new THREE.Matrix4().makeRotationX(sign * gamma));
    for (let i = 1; i < n; i++) m.multiply(step);
    const end = new THREE.Vector3(L * Math.cos(beta), L * Math.sin(beta), 0).applyMatrix4(m);
    return end.distanceTo(new THREE.Vector3(L, 0, 0));
  };
  const sign = closure(1) < closure(-1) ? 1 : -1;

  const root = new THREE.Group();
  const hinges = [];
  let parent = root;
  const tri = [[0, 0], [L, 0], [L * Math.cos(beta), L * Math.sin(beta)]];
  for (let i = 0; i < n; i++) {
    const g = new THREE.Group();
    g.rotation.order = 'ZYX'; // rotate about the shared slant edge (local x) first, then step around the apex
    g.add(faceMesh(tri, smooth ? COLORS[0] : COLORS[i % 2]));
    if (!smooth) g.add(outline(tri));
    else g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(L, 0, 0), new THREE.Vector3(L * Math.cos(beta), L * Math.sin(beta), 0)]), new THREE.LineBasicMaterial({ color: 0x2a1405 })));
    parent.add(g);
    if (i > 0) hinges.push(g);
    parent = g;
  }

  // Base: hinged on triangle 0's base edge, on the side away from the apex.
  const capFolds = [];
  if (caps) {
    const p1 = new THREE.Vector3(L, 0, 0);
    const p2 = new THREE.Vector3(L * Math.cos(beta), L * Math.sin(beta), 0);
    const xAxis = p2.clone().sub(p1).normalize();
    const zAxis = new THREE.Vector3(0, 0, 1);
    const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis);
    const hinge = new THREE.Group();
    hinge.position.copy(p1);
    hinge.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis));
    const awayFromApex = yAxis.dot(p1.clone().negate()) > 0 ? -1 : 1;
    const fold = new THREE.Group();
    const poly = polygonOnEdge(n, r).map(([x, y]) => [x, awayFromApex * y]);
    fold.add(faceMesh(poly, 0xfdba74), outline(poly));
    hinge.add(fold);
    root.children[0].add(hinge);
    // Fold by (π − angle between face and base); pick the direction that puts the base centre right below the apex.
    const faceBase = Math.PI - Math.atan2(h, r * Math.cos(Math.PI / n));
    const center = new THREE.Vector3(a / 2, awayFromApex * r * Math.cos(Math.PI / n), 0);
    const test = (s) => {
      fold.rotation.x = s * faceBase;
      root.updateMatrixWorld(true);
      return Math.abs(fold.localToWorld(center.clone()).length() - h);
    };
    capFolds.push([fold, test(1) < test(-1) ? 1 : -1, faceBase]);
  }

  const labels = [];
  const theta = THREE.MathUtils.radToDeg(n * beta);
  const lLabel = makeLabel(`L = ${formatNumber(L)}`, new THREE.Vector3(L / 2, -0.3, 0), 0xffd9a8, 'dim-label');
  const tLabel = makeLabel(`θ = ${formatNumber(theta)}°`, new THREE.Vector3(0.6 * Math.cos(Math.min(n * beta, Math.PI * 1.9) / 2), 0.6 * Math.sin(Math.min(n * beta, Math.PI * 1.9) / 2), 0), 0xffd9a8, 'dim-label');
  root.add(lLabel, tLabel);
  labels.push(lLabel, tLabel);

  return {
    root,
    labels,
    setT(t) {
      for (const g of hinges) g.rotation.set(sign * (1 - t) * gamma, 0, beta);
      for (const [fold, s, angle] of capFolds) fold.rotation.x = s * (1 - t) * angle;
    },
  };
}
