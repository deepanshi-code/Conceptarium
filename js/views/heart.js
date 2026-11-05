// Biology: the heart and double circulation. Blood cells stream along one closed route (body → right heart → lungs
// → left heart → body), turning red in the lungs and blue in the body. Chambers beat, valves open and close.
import * as THREE from 'three';
import { createStage, makeLabel } from '../stage.js';
import { ROUTE, circuitOf } from '../bio/heart.js';
import { interact } from '../interact.js';
import { html } from '../ui.js';

const BLUE = new THREE.Color(0x3b82f6);
const RED = new THREE.Color(0xef4444);
const CELLS = 140;

// Waypoints of the loop, tagged with the route part they belong to. The viewer faces the patient, so the
// patient's right heart is on the viewer's left.
const POINTS = [
  ['body', [0, -5.2, 0]], ['body', [-2.6, -4.8, 0]], ['vena', [-3, -2.6, 0]], ['vena', [-2.4, 0.2, 0.3]],
  ['ra', [-1.5, 0.9, 0.4]], ['tricuspid', [-1.3, -0.1, 0.4]], ['rv', [-0.9, -1.4, 0.5]], ['rv', [-0.2, -1.2, 0.6]],
  ['partery', [-0.2, 0.6, 0.8]], ['partery', [-1.2, 2.6, 0.6]], ['lungs', [-3, 4.2, 0]], ['lungs', [-1.5, 4.8, -0.3]],
  ['lungs', [1.5, 4.8, -0.3]], ['lungs', [3, 4.2, 0]], ['pvein', [2.6, 2.5, -0.2]], ['pvein', [2, 1.4, -0.1]],
  ['la', [1.4, 0.9, 0]], ['mitral', [1.2, -0.1, 0.1]], ['lv', [0.9, -1.5, 0.2]], ['lv', [0.4, -2, 0.2]],
  ['aorta', [0.1, 0.5, 0.2]], ['aorta', [0.6, 2.2, 0.1]], ['aorta', [2, 2.4, 0]], ['aorta', [3, 0, 0]],
  ['aorta', [2.8, -3.2, 0]], ['body', [2, -4.8, 0]],
];

export function mountHeart(root) {
  root.innerHTML = html`
    <div class="viewport" data-viewport></div>
    <aside class="panel">
      <h2>Heart &amp; Blood Flow</h2>
      <p class="lede">Your heart is <b>two pumps side by side</b>. The right side sends blue (oxygen-poor) blood to the <b>lungs</b>; it comes back red (oxygen-rich) to the left side, which pumps it to the whole <b>body</b>. So blood passes through the heart twice per loop: <b>double circulation</b>. Valves keep it flowing one way.</p>

      <label class="slider-row wide"><span>Heart rate</span><input type="range" min="40" max="180" step="5" value="72" data-bpm><output data-bpm-out>72 bpm</output></label>
      <div class="btn-row">
        <button class="btn" data-follow>🔴 Follow one blood cell</button>
      </div>
      <div class="notice" data-msg>Click any chamber or vessel to learn what it does.</div>

      <h3>The route</h3>
      <ol class="route-list" data-route>${ROUTE.map((s) => `<li data-id="${s.id}" class="${s.oxygen}">${s.name}</li>`).join('')}</ol>
    </aside>
  `;

  const $ = (sel) => root.querySelector(sel);
  const stage = createStage($('[data-viewport]'), { cameraPosition: [0, 0, 13], axes: false, grid: false });
  const scene = stage.scene;
  const state = { bpm: 72, beat: 0, follow: null, last: null };

  const curve = new THREE.CatmullRomCurve3(POINTS.map(([, p]) => new THREE.Vector3(...p)), true, 'centripetal');
  // Which route part each position along the loop (0..1, by distance) belongs to. Waypoint i sits at curve
  // parameter t = i / N, which is not evenly spaced by distance, so convert it with the curve's arc lengths.
  const SUB = 40;
  const lengths = curve.getLengths(POINTS.length * SUB);
  const startU = POINTS.map((_, i) => lengths[i * SUB] / lengths.at(-1));
  const partAt = (u) => {
    const w = ((u % 1) + 1) % 1;
    let k = 0;
    while (k + 1 < startU.length && startU[k + 1] <= w) k += 1;
    return POINTS[k][0];
  };

  // Vessels: a tube along the loop, coloured blue → red where the blood is oxygenated.
  const tubeGeom = new THREE.TubeGeometry(curve, 400, 0.22, 10, true);
  const colors = [];
  const pos = tubeGeom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const u = Math.floor(i / 11) / 400;
    const part = ROUTE.find((s) => s.id === partAt(u));
    const c = part.oxygen === 'high' || part.oxygen === 'lose' ? RED.clone() : BLUE.clone();
    colors.push(c.r * 0.55, c.g * 0.55, c.b * 0.55);
  }
  tubeGeom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const vessels = new THREE.Mesh(tubeGeom, new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.45, depthWrite: false }));
  scene.add(vessels);

  // Chambers: atria on top, ventricles below; the left ventricle has the thickest wall.
  const chamber = (id, x, y, sx, sy, color) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.55, roughness: 0.5 }));
    m.position.set(x, y, 0.2);
    m.scale.set(sx, sy, 0.8);
    m.userData = { id, base: new THREE.Vector3(sx, sy, 0.8) };
    scene.add(m);
    return m;
  };
  const chambers = [
    chamber('ra', -1.5, 0.9, 0.8, 0.7, 0x60a5fa),
    chamber('rv', -0.7, -1.4, 0.95, 1.15, 0x3b82f6),
    chamber('la', 1.4, 0.9, 0.8, 0.7, 0xf87171),
    chamber('lv', 0.7, -1.5, 1.05, 1.3, 0xdc2626),
  ];
  const septum = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.6, 1), new THREE.MeshStandardMaterial({ color: 0x7f1d1d, transparent: true, opacity: 0.5 }));
  septum.position.set(0, -0.4, 0.2);
  scene.add(septum);
  const valves = { tricuspid: [-1.3, -0.1], mitral: [1.2, -0.1] };
  const valveMeshes = Object.entries(valves).map(([id, [x, y]]) => {
    const v = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 24), new THREE.MeshStandardMaterial({ color: 0xfde68a }));
    v.position.set(x, y, 0.45);
    v.userData.id = id;
    scene.add(v);
    return v;
  });
  // Lungs and body as soft blobs at the ends of the loop.
  const blob = (id, x, y, sx, sy, color) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.22, depthWrite: false }));
    m.position.set(x, y, -0.4);
    m.scale.set(sx, sy, 0.6);
    m.userData.id = id;
    scene.add(m);
    return m;
  };
  const organs = [blob('lungs', -2.2, 4.4, 1.7, 1.1, 0xf9a8d4), blob('lungs', 2.2, 4.4, 1.7, 1.1, 0xf9a8d4), blob('body', 0, -5, 3.6, 0.9, 0xfca5a5)];
  scene.add(
    makeLabel('LUNGS', new THREE.Vector3(0, 5.9, 0), 0xf9a8d4, 'plane-label'),
    makeLabel('BODY', new THREE.Vector3(0, -6.2, 0), 0xfca5a5, 'plane-label'),
    makeLabel('right side', new THREE.Vector3(-2.3, -2.9, 0.6), 0x93c5fd, 'chart-label'),
    makeLabel('left side', new THREE.Vector3(2.2, -2.9, 0.6), 0xfca5a5, 'chart-label'),
  );

  // Blood cells: an instanced cloud travelling along the loop.
  const cellGeom = new THREE.SphereGeometry(0.11, 10, 8);
  cellGeom.scale(1, 0.55, 1); // a flattened disc, like a red blood cell
  const cells = new THREE.InstancedMesh(cellGeom, new THREE.MeshStandardMaterial({ roughness: 0.4 }), CELLS);
  const offsets = Array.from({ length: CELLS }, (_, i) => ({ u: i / CELLS, wobble: new THREE.Vector3((Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.25) }));
  scene.add(cells);
  const tracer = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  tracer.visible = false;
  scene.add(tracer);

  const oxygenAt = (u) => {
    const part = ROUTE.find((s) => s.id === partAt(u));
    return part.oxygen === 'high' || part.oxygen === 'lose' ? 1 : 0;
  };

  function show(id) {
    const s = ROUTE.find((r) => r.id === id);
    if (!s) return;
    root.querySelectorAll('[data-route] li').forEach((li) => li.classList.toggle('current', li.dataset.id === id));
    $('[data-msg]').innerHTML = `<b>${s.name}</b> <small>(${circuitOf(id)} circuit)</small><br>${s.info}`;
  }

  $('[data-bpm]').addEventListener('input', (e) => {
    state.bpm = Number(e.target.value);
    $('[data-bpm-out]').textContent = `${state.bpm} bpm`;
  });
  $('[data-follow]').addEventListener('click', () => {
    state.follow = { u: 0.02 };
    tracer.visible = true;
    $('[data-follow]').textContent = '↺ Follow again';
  });
  $('[data-route]').addEventListener('click', (e) => { const li = e.target.closest('[data-id]'); if (li) show(li.dataset.id); });

  const stopInteract = interact(stage, {
    pick: () => [...chambers, ...valveMeshes, ...organs, vessels],
    cursor: 'pointer',
    onClick: (hit) => {
      if (hit.object === vessels) {
        // Find the closest point on the loop to name the vessel.
        let best = 0;
        let bestD = Infinity;
        for (let i = 0; i <= 400; i++) {
          const d = curve.getPointAt(i / 400).distanceTo(hit.point);
          if (d < bestD) { bestD = d; best = i / 400; }
        }
        show(partAt(best));
      } else show(hit.object.userData.id);
    },
  });

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  const c = new THREE.Color();
  stage.onFrame((dt) => {
    const beatsPerSec = state.bpm / 60;
    state.beat = (state.beat + dt * beatsPerSec) % 1;
    // Atria squeeze first (0–0.2 of the beat), then ventricles (0.2–0.5).
    const squeeze = (from, to) => (state.beat > from && state.beat < to ? Math.sin(((state.beat - from) / (to - from)) * Math.PI) : 0);
    const atria = squeeze(0, 0.2);
    const vents = squeeze(0.2, 0.5);
    chambers.forEach((ch) => {
      const k = 1 - 0.14 * (ch.userData.id.endsWith('a') ? atria : vents);
      ch.scale.copy(ch.userData.base).multiplyScalar(k);
    });
    // Valves between atria and ventricles are open while the atria squeeze, shut while the ventricles do.
    valveMeshes.forEach((v) => { v.material.color.setHex(vents > 0 ? 0xf59e0b : 0x4ade80); v.scale.set(vents > 0 ? 1 : 0.55, 1, vents > 0 ? 1 : 0.55); });
    // Blood moves in surges with each ventricular squeeze.
    const speed = (0.025 + 0.06 * vents) * beatsPerSec;
    offsets.forEach((o, i) => {
      o.u = (o.u + dt * speed) % 1;
      const p = curve.getPointAt(o.u).add(o.wobble);
      m.compose(p, q, one);
      cells.setMatrixAt(i, m);
      cells.setColorAt(i, c.copy(BLUE).lerp(RED, oxygenAt(o.u)));
    });
    cells.instanceMatrix.needsUpdate = true;
    cells.instanceColor.needsUpdate = true;
    if (state.follow) {
      state.follow.u += dt * speed;
      if (state.follow.u >= 1) state.follow.u -= 1;
      tracer.position.copy(curve.getPointAt(state.follow.u));
      tracer.material.color.copy(BLUE).lerp(RED, oxygenAt(state.follow.u)).lerp(new THREE.Color(0xffffff), 0.35);
      const part = partAt(state.follow.u);
      if (part !== state.last) {
        state.last = part;
        show(part);
      }
    }
  });

  return () => {
    stopInteract();
    stage.dispose();
  };
}
