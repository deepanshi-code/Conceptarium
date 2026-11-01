// Mechanics: a loaded beam that visibly bends, with its shear force and bending moment diagrams standing
// as "fins" behind it, so the three line up along the span.
import * as THREE from 'three';
import { createStage, makeLabel, clearGroup } from '../stage.js';
import { analyzeBeam } from '../mech/beam.js';
import { interact, rayOnPlane } from '../interact.js';
import { html, formatNumber } from '../ui.js';

const WORLD_L = 8; // the beam is always drawn this long, whatever the span
const SFD_Z = -1.8;
const BMD_Z = -3.6;
const EI = 10000; // kN·m², roughly a medium steel I-section (E = 200 GPa, I ≈ 5000 cm⁴)

export function mountBeam(root) {
  root.innerHTML = html`
    <div class="viewport" data-viewport></div>
    <aside class="panel">
      <h2>Beams: SFD, BMD &amp; Deflection</h2>
      <p class="lede">A beam carries loads by bending. The <b>shear force</b> V(x) and <b>bending moment</b> M(x) tell you where it is most stressed, and the <b>deflection</b> tells you how much it sags. The diagrams stand behind the beam so you can line them up along the span.</p>

      <h3>Support</h3>
      <div class="segmented" role="radiogroup">
        <label><input type="radio" name="type" value="simply" checked> Simply supported</label>
        <label><input type="radio" name="type" value="cantilever"> Cantilever</label>
      </div>

      <h3>Loads</h3>
      <label class="slider-row wide"><span>Span L (m)</span><input type="range" min="2" max="12" step="0.5" value="6" data-L><output data-L-out>6</output></label>
      <label class="slider-row wide"><span>Point load P (kN)</span><input type="range" min="0" max="40" step="1" value="20" data-P><output data-P-out>20</output></label>
      <label class="slider-row wide"><span>Position a (m)</span><input type="range" min="0" max="1" step="0.01" value="0.5" data-a><output data-a-out>3</output></label>
      <label class="check"><input type="checkbox" data-udl-on> Add a uniformly distributed load (UDL)</label>
      <label class="slider-row wide" data-udl-row hidden><span>UDL w (kN/m)</span><input type="range" min="1" max="10" step="0.5" value="4" data-w><output data-w-out>4</output></label>

      <h3>Results</h3>
      <div class="readout" data-results></div>
      <p class="hint" data-insight></p>

      <details class="legend">
        <summary>Conventions used</summary>
        <ul>
          <li>Sagging moment (beam smiles) is positive; hogging (frowns) is negative.</li>
          <li>Shear is positive when the left part is pushed up relative to the right.</li>
          <li>EI = ${EI.toLocaleString()} kN·m², roughly a medium steel I-beam. Deflection is exaggerated on screen; the true value is in the results.</li>
        </ul>
      </details>
    </aside>
  `;

  const $ = (sel) => root.querySelector(sel);
  const stage = createStage($('[data-viewport]'), { cameraPosition: [-3, 4.5, 10.5], axes: false, grid: false });
  stage.controls.target.set(0, 0.3, -1.6);
  const state = { type: 'simply', L: 6, P: 20, a: 0.5, udl: false, w: 4 };
  const dynamic = new THREE.Group();
  stage.scene.add(dynamic);

  // The beam: a finely segmented box whose vertices are shifted by the deflection curve.
  const beamGeom = new THREE.BoxGeometry(WORLD_L, 0.32, 0.5, 160, 1, 1);
  const restY = Float32Array.from(beamGeom.attributes.position.array.filter((_, i) => i % 3 === 1));
  const beam = new THREE.Mesh(beamGeom, new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.6, roughness: 0.35 }));
  stage.scene.add(beam);
  const ghost = new THREE.Mesh(new THREE.BoxGeometry(WORLD_L, 0.32, 0.5), new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.08 }));
  stage.scene.add(ghost);

  // Floor planes for the two diagrams, with titles.
  for (const [z, title] of [[SFD_Z, 'Shear force diagram  V (kN)'], [BMD_Z, 'Bending moment diagram  M (kN·m)']]) {
    const axis = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-WORLD_L / 2, 0, z), new THREE.Vector3(WORLD_L / 2, 0, z)]), new THREE.LineBasicMaterial({ color: 0x555555 }));
    const label = makeLabel(title, new THREE.Vector3(-WORLD_L / 2, 1.9, z), 0x9a9a9a, 'chart-label');
    label.center.set(0, 1); // anchored at its left end, above the diagram, so it never runs off-screen
    stage.scene.add(axis, label);
  }

  function update() {
    const L = state.L;
    const a = state.a * L;
    const loads = [{ kind: 'point', a, P: state.P }];
    if (state.udl) loads.push({ kind: 'udl', start: 0, end: L, w: state.w });
    const r = analyzeBeam({ type: state.type, L, loads, EI });
    const sx = WORLD_L / L;
    const wx = (x) => x * sx - WORLD_L / 2;

    // Bend the beam: exaggerate so the largest sag shows as about 0.7 units.
    const maxDefl = Math.abs(r.maxDeflection.value);
    const exaggeration = maxDefl > 1e-9 ? 0.7 / maxDefl : 0;
    const pos = beamGeom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = (pos.getX(i) + WORLD_L / 2) / sx;
      const k = Math.min(r.x.length - 1, Math.round((x / L) * (r.x.length - 1)));
      pos.setY(i, restY[i] + r.y[k] * exaggeration);
    }
    pos.needsUpdate = true;
    beamGeom.computeVertexNormals();

    clearGroup(dynamic);

    drawSupports(dynamic, state.type);
    // Point load arrow, sitting on the deflected beam.
    if (state.P > 0) {
      const k = Math.round((a / L) * (r.x.length - 1));
      const top = 0.16 + r.y[k] * exaggeration;
      const len = 0.6 + (state.P / 40) * 1.2;
      const arrow = new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), new THREE.Vector3(wx(a), top + len, 0), len, 0xff5c5c, 0.3, 0.18);
      // A fat invisible handle along the arrow, so it is easy to grab.
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, len, 8), new THREE.MeshBasicMaterial({ visible: false }));
      handle.position.set(wx(a), top + len / 2, 0);
      dynamic.add(arrow, handle);
      state.loadHandle = handle;
      dynamic.add(makeLabel(`P = ${state.P} kN`, new THREE.Vector3(wx(a), top + len + 0.25, 0), 0xff8a8a, 'chart-label'));
    }
    if (state.udl) {
      for (let i = 0; i <= 16; i++) {
        const x = (i / 16) * L;
        const k = Math.round((i / 16) * (r.x.length - 1));
        const top = 0.16 + r.y[k] * exaggeration;
        dynamic.add(new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), new THREE.Vector3(wx(x), top + 0.55, 0.12), 0.55, 0x5c9dff, 0.14, 0.08));
      }
      dynamic.add(makeLabel(`w = ${state.w} kN/m`, new THREE.Vector3(0, 0.95, 0.12), 0x8ab8ff, 'chart-label'));
    }

    // Diagrams scaled so their largest value is about 1.4 units tall.
    drawDiagram(dynamic, r.x.map(wx), r.V, SFD_Z, 0x5c9dff, 0xff8a5c);
    drawDiagram(dynamic, r.x.map(wx), r.M, BMD_Z, 0xb197fc, 0xff5c8a);
    const vPeak = r.maxShear;
    const mPeak = r.maxMoment;
    const vs = 1.4 / Math.max(1e-9, Math.max(...r.V.map(Math.abs)));
    const ms = 1.4 / Math.max(1e-9, Math.max(...r.M.map(Math.abs)));
    dynamic.add(makeLabel(`${formatNumber(vPeak.value)} kN`, new THREE.Vector3(wx(vPeak.x), vPeak.value * vs + Math.sign(vPeak.value || 1) * 0.25, SFD_Z), 0x8ab8ff, 'chart-label'));
    dynamic.add(makeLabel(`${formatNumber(mPeak.value)} kN·m`, new THREE.Vector3(wx(mPeak.x), mPeak.value * ms + Math.sign(mPeak.value || 1) * 0.25, BMD_Z), 0xd6c8ff, 'chart-label'));

    // Where V crosses zero, M peaks: a vertical marker through beam, SFD and BMD.
    for (const x0 of r.zeroShear) {
      const pts = [new THREE.Vector3(wx(x0), -1.6, BMD_Z), new THREE.Vector3(wx(x0), 1.6, BMD_Z), new THREE.Vector3(wx(x0), 1.6, 0.3)];
      const marker = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: 0xffd9a8, dashSize: 0.1, gapSize: 0.08 }));
      marker.computeLineDistances();
      dynamic.add(marker);
    }

    renderResults(r, exaggeration);
  }

  function renderResults(r, exaggeration) {
    const f = formatNumber;
    const { RA, RB, MA } = r.reactions;
    const rows = state.type === 'simply'
      ? [['Reaction at A', `${f(RA)} kN`], ['Reaction at B', `${f(RB)} kN`]]
      : [['Wall reaction', `${f(RA)} kN`], ['Wall moment', `${f(MA)} kN·m`]];
    rows.push(
      ['Max shear |V|', `${f(Math.abs(r.maxShear.value))} kN`],
      ['Max moment |M|', `${f(Math.abs(r.maxMoment.value))} kN·m at x = ${f(r.maxMoment.x)} m`],
      ['Max deflection', `${f(Math.abs(r.maxDeflection.value) * 1000)} mm at x = ${f(r.maxDeflection.x)} m`],
      // Screen sag ÷ true sag drawn at the same scale as the span (world units per metre = WORLD_L / L).
      ['On-screen exaggeration', `× ${Math.round(exaggeration / (WORLD_L / state.L)).toLocaleString()}`],
    );
    $('[data-results]').innerHTML = rows.map(([k, v]) => `<div class="row-between"><span>${k}</span><strong>${v}</strong></div>`).join('');
    $('[data-insight]').innerHTML = state.type === 'simply'
      ? 'The dashed marker is where the shear force crosses zero: exactly where the bending moment peaks. That is the section to design for. Slide the load: with only a point load, the peak always sits under the load.'
      : 'A cantilever hogs: the moment is negative everywhere and largest at the wall, which is why cantilevers are deepest at the support. Sag grows with L³: double the span and the tip deflects 8× as much.';
  }

  // --- Wiring --------------------------------------------------------------
  const bind = (key, fmt = (v) => v) => $(`[data-${key}]`).addEventListener('input', (e) => {
    state[key] = Number(e.target.value);
    $(`[data-${key}-out]`).textContent = fmt(state[key]);
    if (key === 'L') $('[data-a-out]').textContent = formatNumber(state.a * state.L);
    update();
  });
  bind('L');
  bind('P');
  bind('a', (v) => formatNumber(v * state.L));
  bind('w');
  $('[data-udl-on]').addEventListener('change', (e) => {
    state.udl = e.target.checked;
    $('[data-udl-row]').hidden = !state.udl;
    update();
  });
  root.querySelectorAll('input[name="type"]').forEach((radio) => radio.addEventListener('change', () => {
    state.type = radio.value;
    if (state.type === 'cantilever' && state.a === 0.5) {
      state.a = 1; // a tip load is the classic cantilever case
      $('[data-a]').value = 1;
      $('[data-a-out]').textContent = formatNumber(state.L);
    }
    update();
  }));

  // Drag the load arrow, or grab the beam anywhere: the point load follows the pointer along the span.
  const span = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const moveLoadTo = (worldX) => {
    state.a = THREE.MathUtils.clamp((worldX + WORLD_L / 2) / WORLD_L, 0, 1);
    $('[data-a]').value = state.a;
    $('[data-a-out]').textContent = formatNumber(state.a * state.L);
    update();
  };
  const stopInteract = interact(stage, {
    pick: () => [state.loadHandle, beam],
    onDown: (hit) => {
      if (state.P === 0) return null;
      moveLoadTo(hit.point.x);
      return { move: (ray) => { const p = rayOnPlane(ray, span); if (p) moveLoadTo(p.x); } };
    },
  });

  update();
  return () => {
    stopInteract();
    stage.dispose();
  };
}

function drawSupports(group, type) {
  const steel = new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.6 });
  if (type === 'simply') {
    const pin = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.45, 3), steel);
    pin.position.set(-WORLD_L / 2, -0.4, 0);
    const roller = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.45, 3), steel.clone());
    roller.position.set(WORLD_L / 2, -0.4, 0);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 16), steel.clone());
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(WORLD_L / 2, -0.7, 0);
    group.add(pin, roller, wheel);
    group.add(makeLabel('A (pin)', new THREE.Vector3(-WORLD_L / 2, -1, 0), 0x9a9a9a, 'chart-label'));
    group.add(makeLabel('B (roller)', new THREE.Vector3(WORLD_L / 2, -1, 0), 0x9a9a9a, 'chart-label'));
  } else {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.2, 1.4), steel);
    wall.position.set(-WORLD_L / 2 - 0.15, 0, 0);
    group.add(wall, makeLabel('fixed wall', new THREE.Vector3(-WORLD_L / 2 - 0.15, -1.35, 0), 0x9a9a9a, 'chart-label'));
  }
}

// A filled "fin" for V(x) or M(x): positive parts and negative parts in different colours.
function drawDiagram(group, xs, values, z, posColor, negColor) {
  const peak = Math.max(1e-9, ...values.map(Math.abs));
  const scale = 1.4 / peak;
  for (const [sign, color] of [[1, posColor], [-1, negColor]]) {
    const shape = new THREE.Shape();
    shape.moveTo(xs[0], 0);
    xs.forEach((x, i) => shape.lineTo(x, sign > 0 ? Math.max(0, values[i]) * scale : Math.min(0, values[i]) * scale));
    shape.lineTo(xs.at(-1), 0);
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
    mesh.position.z = z;
    group.add(mesh);
  }
  const curve = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(xs.map((x, i) => new THREE.Vector3(x, values[i] * scale, z))),
    new THREE.LineBasicMaterial({ color: 0xffffff }),
  );
  group.add(curve);
}
