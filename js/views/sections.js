// Engineering drawing: sections of solids. A cutting plane slices a cone, cylinder, pyramid or prism; the cut face
// is hatched, the top piece can be lifted off, and the true shape of the section is drawn flat beside it.
// For a cone, tilting the plane walks through the conic sections: circle, ellipse, parabola, hyperbola.
import * as THREE from 'three';
import { createStage, makeLabel } from '../stage.js';
import { interact, screenDrag } from '../interact.js';
import { html, formatNumber } from '../ui.js';

const H = 3;
const SOLIDS = {
  cone: { name: 'Cone', make: () => new THREE.ConeGeometry(1.3, H, 96, 1) },
  cylinder: { name: 'Cylinder', make: () => new THREE.CylinderGeometry(1.1, 1.1, H, 96, 1) },
  pyramid: { name: 'Pyramid', make: () => new THREE.ConeGeometry(1.5, H, 4, 1) },
  prism: { name: 'Hex prism', make: () => new THREE.CylinderGeometry(1.2, 1.2, H, 6, 1) },
};
const CONE_HALF = THREE.MathUtils.radToDeg(Math.atan(1.3 / H)); // ≈ 23.4°
const CONICS = { circle: [0, 1.2], ellipse: [30, 1.2], parabola: [90 - CONE_HALF, 1.6], hyperbola: [80, 0.3] };
const TRUE_X = 4.2;

export function mountSections(root) {
  root.innerHTML = html`
    <div class="viewport" data-viewport></div>
    <aside class="panel">
      <h2>Sections of Solids</h2>
      <p class="lede">A <b>section</b> is the face you see after cutting a solid with a plane, drawn with hatching lines. Its <b>true shape</b> is that face seen straight on. Cutting a cone at different angles gives the conic sections; the plane's angle compared with the cone's side decides which one.</p>

      <h3>Solid</h3>
      <div class="tabs" data-solids>${Object.entries(SOLIDS).map(([k, s]) => `<button data-solid="${k}">${s.name}</button>`).join('')}</div>

      <h3>Cutting plane</h3>
      <label class="slider-row wide"><span>Tilt θ</span><input type="range" min="0" max="90" step="0.5" value="0" data-tilt><output data-tilt-out>0°</output></label>
      <label class="slider-row wide"><span>Height</span><input type="range" min="0.15" max="2.85" step="0.01" value="1.2" data-h><output data-h-out>1.2</output></label>
      <label class="check"><input type="checkbox" data-lift checked> Lift the top piece off</label>
      <div class="op-group" data-conics>
        <span class="op-title" style="--c:#a78bfa">Cone shortcuts</span>
        ${Object.keys(CONICS).map((k) => `<button class="btn small secondary" data-conic="${k}">${k}</button>`).join('')}
      </div>

      <h3>The section is</h3>
      <div class="shape-name" data-shape></div>
      <p class="hint" data-insight></p>
    </aside>
  `;

  const $ = (sel) => root.querySelector(sel);
  const stage = createStage($('[data-viewport]'), { cameraPosition: [-1.5, 4.5, 9.5], axes: false, grid: true });
  stage.controls.target.set(1.8, 1.4, 0);
  const { scene } = stage;
  const state = { solid: 'cone', tilt: 0, h: 1.2, lift: 1, liftTarget: 1 };

  // Diagonal hatching, the drawing-board convention for a cut surface.
  const hatch = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#fb923c';
    g.fillRect(0, 0, 64, 64);
    g.strokeStyle = '#3b1405';
    g.lineWidth = 5;
    for (let k = -64; k <= 64; k += 21) { g.beginPath(); g.moveTo(k, 64); g.lineTo(k + 64, 0); g.stroke(); }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2.5, 2.5);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();

  const keepPlane = new THREE.Plane();
  const ghostPlane = new THREE.Plane();
  const lower = new THREE.Mesh(undefined, new THREE.MeshStandardMaterial({ color: 0x8b7cf6, roughness: 0.45, metalness: 0.1, clippingPlanes: [keepPlane], side: THREE.DoubleSide }));
  const upper = new THREE.Mesh(undefined, new THREE.MeshStandardMaterial({ color: 0xc4b5fd, transparent: true, opacity: 0.22, depthWrite: false, clippingPlanes: [ghostPlane], side: THREE.DoubleSide }));
  const cap = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ map: hatch, side: THREE.DoubleSide, roughness: 0.8 }));
  const cutter = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 4.4), new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
  const cutterEdge = new THREE.LineSegments(new THREE.EdgesGeometry(cutter.geometry), new THREE.LineBasicMaterial({ color: 0x22d3ee }));
  cutter.add(cutterEdge);
  scene.add(lower, upper, cap, cutter);

  const trueShape = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ map: hatch, side: THREE.DoubleSide }));
  const trueOutline = new THREE.LineLoop(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffffff }));
  const trueGroup = new THREE.Group();
  trueGroup.position.set(TRUE_X, 1.5, 0);
  trueGroup.add(trueShape, trueOutline, makeLabel('true shape', new THREE.Vector3(0, -1.9, 0), 0xfb923c, 'plane-label'));
  scene.add(trueGroup);

  let solidGeom = null;
  function setSolid(key) {
    state.solid = key;
    solidGeom?.dispose();
    solidGeom = SOLIDS[key].make();
    solidGeom.translate(0, H / 2, 0);
    lower.geometry = solidGeom;
    upper.geometry = solidGeom;
    root.querySelectorAll('[data-solid]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.solid === key)));
    $('[data-conics]').hidden = key !== 'cone';
    update();
  }

  // Plane basis: n is the normal, u runs up the tilt, w is along z. The plane passes through (0, h, 0).
  function basis() {
    const t = THREE.MathUtils.degToRad(state.tilt);
    const n = new THREE.Vector3(-Math.sin(t), Math.cos(t), 0);
    const u = new THREE.Vector3(Math.cos(t), Math.sin(t), 0);
    const w = new THREE.Vector3(0, 0, 1);
    return { n, u, w, p0: new THREE.Vector3(0, state.h, 0) };
  }

  // Slice every triangle with the plane; the section of a convex solid is the convex polygon through those points.
  function sectionPolygon({ n, u, w, p0 }) {
    const pos = solidGeom.attributes.position;
    const index = solidGeom.index;
    const tri = index ? index.count / 3 : pos.count / 3;
    const v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    const pts = [];
    for (let i = 0; i < tri; i++) {
      for (let k = 0; k < 3; k++) v[k].fromBufferAttribute(pos, index ? index.getX(i * 3 + k) : i * 3 + k);
      const d = v.map((p) => n.dot(p.clone().sub(p0)));
      for (let k = 0; k < 3; k++) {
        const a = k;
        const b = (k + 1) % 3;
        if ((d[a] < 0) !== (d[b] < 0)) {
          const p = v[a].clone().lerp(v[b], d[a] / (d[a] - d[b])).sub(p0);
          pts.push([p.dot(u), p.dot(w)]);
        }
      }
    }
    return convexHull(pts);
  }

  function update() {
    const b = basis();
    const { n, u, w, p0 } = b;
    keepPlane.set(n.clone().negate(), n.dot(p0));
    cutter.position.copy(p0);
    cutter.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(u, w, n.clone().negate()));

    const poly = sectionPolygon(b);
    cap.visible = trueGroup.visible = poly.length >= 3;
    if (poly.length >= 3) {
      const shapeGeom = new THREE.ShapeGeometry(new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x, y))));
      cap.geometry.dispose();
      cap.geometry = shapeGeom;
      cap.matrixAutoUpdate = false;
      cap.matrix.makeBasis(u, w, n.clone().negate()).setPosition(p0.clone().addScaledVector(n, -0.002));

      // True shape: the same polygon, centred and seen face-on.
      const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length;
      const cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
      const flat = poly.map(([x, y]) => new THREE.Vector2(x - cx, y - cy));
      trueShape.geometry.dispose();
      trueShape.geometry = new THREE.ShapeGeometry(new THREE.Shape(flat));
      trueOutline.geometry.dispose();
      trueOutline.geometry = new THREE.BufferGeometry().setFromPoints(flat.map((p) => new THREE.Vector3(p.x, p.y, 0.01)));
      const span = Math.max(...flat.map((p) => Math.max(Math.abs(p.x), Math.abs(p.y))));
      trueGroup.scale.setScalar(Math.min(1, 1.6 / span));
    }
    describe(poly);
  }

  function describe(poly) {
    const s = state.solid;
    // Height of each section corner (y = h + x·sin θ along u): does the cut also run through an end face?
    const ys = poly.map(([x]) => state.h + x * Math.sin(THREE.MathUtils.degToRad(state.tilt)));
    const cutsEnd = poly.length >= 3 && (Math.min(...ys) < 0.01 || (s !== 'cone' && s !== 'pyramid' && Math.max(...ys) > H - 0.01));
    let name;
    let insight;
    if (poly.length < 3) {
      name = 'Nothing';
      insight = 'The plane misses the solid. Move it down or reduce the tilt.';
    } else if (s === 'cone') {
      const steep = 90 - CONE_HALF;
      if (state.tilt < 0.5) name = 'Circle';
      else if (state.tilt > 89.5) name = 'Triangle (through the apex)';
      else if (Math.abs(state.tilt - steep) < 1) name = 'Parabola';
      else if (state.tilt < steep) name = cutsEnd ? 'Ellipse, cut off by the base' : 'Ellipse';
      else name = 'Hyperbola';
      insight = `The cone's side is at ${formatNumber(steep, 1)}° to the base. A flatter plane gives an ellipse, the same angle gives a parabola, and a steeper plane gives a hyperbola.`;
    } else if (s === 'cylinder') {
      name = state.tilt < 0.5 ? 'Circle' : state.tilt > 89.5 ? 'Rectangle' : cutsEnd ? 'Ellipse, cut off by an end' : 'Ellipse';
      insight = 'Tilting stretches the circle into an ellipse. The short axis stays equal to the diameter d, and the long axis grows to d / cos θ.';
    } else {
      name = `${simplify(poly).length}-sided polygon`;
      insight = s === 'pyramid' ? 'Cut parallel to the base and you get a smaller square. Each side of the section is where the plane crosses one face.'
        : 'Every face the plane crosses adds one side, so a hex prism can give 4, 5 or 6 sides, or more when the cut also crosses an end.';
    }
    $('[data-shape]').textContent = name;
    $('[data-insight]').innerHTML = insight;
  }

  root.querySelectorAll('[data-solid]').forEach((b) => b.addEventListener('click', () => setSolid(b.dataset.solid)));
  const setTilt = (v) => {
    state.tilt = v;
    $('[data-tilt]').value = v;
    $('[data-tilt-out]').textContent = `${formatNumber(v, 1)}°`;
  };
  const setH = (v) => {
    state.h = THREE.MathUtils.clamp(v, 0.15, 2.85);
    $('[data-h]').value = state.h;
    $('[data-h-out]').textContent = formatNumber(state.h);
  };
  $('[data-tilt]').addEventListener('input', (e) => { setTilt(Number(e.target.value)); update(); });
  $('[data-h]').addEventListener('input', (e) => { setH(Number(e.target.value)); update(); });
  $('[data-lift]').addEventListener('change', (e) => { state.liftTarget = e.target.checked ? 1 : 0; });
  root.querySelectorAll('[data-conic]').forEach((b) => b.addEventListener('click', () => {
    const [tilt, h] = CONICS[b.dataset.conic];
    setTilt(Number(tilt.toFixed(1)));
    setH(h);
    update();
  }));

  // Drag the cutting plane up and down directly.
  const stopInteract = interact(stage, {
    pick: () => [cutter],
    onDown: (_hit, e) => {
      const start = state.h;
      return screenDrag(e, (_dx, dy) => { setH(start - dy / 90); update(); });
    },
  });

  stage.onFrame((dt) => {
    state.lift += (state.liftTarget - state.lift) * Math.min(1, dt * 5);
    const { n, p0 } = basis();
    const off = n.clone().multiplyScalar(state.lift * 1.3);
    upper.position.copy(off);
    ghostPlane.set(n, -n.dot(p0) - state.lift * 1.3);
    trueGroup.quaternion.copy(stage.camera.quaternion); // a true shape is always seen face-on
  });

  setSolid('cone');
  return () => {
    stopInteract();
    hatch.dispose();
    stage.dispose();
  };
}

// Andrew's monotone chain. Points closer than 1e-4 are merged first.
function convexHull(points) {
  const pts = [...new Map(points.map((p) => [`${p[0].toFixed(4)},${p[1].toFixed(4)}`, p])).values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list) => {
    const out = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out.at(-2), out.at(-1), p) <= 1e-9) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...half(pts), ...half([...pts].reverse())];
}

// Drop vertices where the polygon barely turns, so the side count matches what a student would count.
function simplify(poly) {
  return poly.filter((p, i) => {
    const a = poly.at(i - 1);
    const b = poly[(i + 1) % poly.length];
    const v1 = [p[0] - a[0], p[1] - a[1]];
    const v2 = [b[0] - p[0], b[1] - p[1]];
    const sin = (v1[0] * v2[1] - v1[1] * v2[0]) / (Math.hypot(...v1) * Math.hypot(...v2));
    return Math.abs(sin) > 0.05;
  });
}
