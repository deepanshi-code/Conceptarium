// Biology: photosynthesis. A leaf takes in CO₂ through its stomata and water from the roots, uses light energy to
// make glucose, and gives out O₂. Change light, CO₂ and temperature: whichever is scarcest limits the rate.
import * as THREE from 'three';
import { createStage, makeLabel } from '../stage.js';
import { photosynthesisRate } from '../bio/processes.js';
import { html, formatNumber } from '../ui.js';

const MAX = 60;

export function mountPhotosynthesis(root) {
  root.innerHTML = html`
    <div class="viewport" data-viewport></div>
    <aside class="panel">
      <h2>Photosynthesis</h2>
      <p class="lede">Plants make their own food. In the <b>chloroplasts</b> of a leaf, light energy turns carbon dioxide and water into <b>glucose</b>, releasing <b>oxygen</b>. The rate depends on light, CO₂ and temperature, and is held back by whichever is in shortest supply: the <b>limiting factor</b>.</p>

      <div class="formula">6CO₂ + 6H₂O <span class="dim">— light, chlorophyll →</span> C₆H₁₂O₆ + 6O₂</div>

      <h3>Conditions</h3>
      <label class="slider-row wide"><span>Light</span><input type="range" min="0" max="100" step="1" value="60" data-light><output data-light-out>60%</output></label>
      <label class="slider-row wide"><span>CO₂</span><input type="range" min="0" max="1200" step="20" value="400" data-co2><output data-co2-out>400 ppm</output></label>
      <label class="slider-row wide"><span>Temperature</span><input type="range" min="0" max="50" step="1" value="25" data-temp><output data-temp-out>25 °C</output></label>

      <h3>Rate</h3>
      <div class="rate-bar"><span data-rate-fill></span></div>
      <div class="notice" data-msg></div>
      <div class="timing" data-graph></div>
    </aside>
  `;

  const $ = (sel) => root.querySelector(sel);
  const stage = createStage($('[data-viewport]'), { cameraPosition: [0, 1.5, 9], axes: false, grid: false });
  const scene = stage.scene;
  const state = { light: 60, co2: 400, temp: 25, rate: 0, limiting: '', glucose: 0 };

  // A big leaf with a midrib, a sun, and stomata on the underside.
  const leafShape = new THREE.Shape();
  leafShape.moveTo(-3.6, 0);
  leafShape.quadraticCurveTo(-1, 2.3, 3.6, 0);
  leafShape.quadraticCurveTo(-1, -2.3, -3.6, 0);
  const leaf = new THREE.Mesh(new THREE.ShapeGeometry(leafShape, 32), new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.6, side: THREE.DoubleSide }));
  leaf.rotation.x = -Math.PI / 2.6;
  scene.add(leaf);
  const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 7.2, 8), new THREE.MeshStandardMaterial({ color: 0x86efac }));
  rib.rotation.z = Math.PI / 2;
  leaf.add(rib);
  const sun = new THREE.Mesh(new THREE.SphereGeometry(0.6, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfde047 }));
  sun.position.set(-3.5, 3.6, -1);
  scene.add(sun, makeLabel('light', new THREE.Vector3(-3.5, 2.7, -1), 0xfde047, 'chart-label'));
  scene.add(makeLabel('CO₂ in (stomata)', new THREE.Vector3(2.6, -2.2, 0), 0x9ca3af, 'chart-label'));
  scene.add(makeLabel('O₂ out', new THREE.Vector3(2.4, 2.6, 0), 0x60a5fa, 'chart-label'));
  scene.add(makeLabel('H₂O from roots', new THREE.Vector3(-3.6, -1.4, 0), 0x38bdf8, 'chart-label'));
  const glucoseLabel = makeLabel('', new THREE.Vector3(0, -0.6, 1.3), 0xfacc15, 'chart-label');
  scene.add(glucoseLabel);

  // Light rays from the sun to the leaf.
  const rays = Array.from({ length: 6 }, (_, i) => {
    const target = new THREE.Vector3(-2 + i * 0.8, 0, (i % 2 ? 0.4 : -0.4));
    const ray = new THREE.Line(new THREE.BufferGeometry().setFromPoints([sun.position, target]), new THREE.LineBasicMaterial({ color: 0xfde047, transparent: true }));
    scene.add(ray);
    return ray;
  });

  // Molecules: CO₂ drifting up into the leaf, O₂ drifting away, glucose hexagons collecting on the leaf.
  const co2Geom = new THREE.SphereGeometry(0.08, 10, 8);
  const mk = (color) => {
    const g = new THREE.Group();
    const a = new THREE.Mesh(co2Geom, new THREE.MeshStandardMaterial({ color }));
    g.add(a);
    return g;
  };
  const co2 = Array.from({ length: MAX }, (_, i) => {
    const g = new THREE.Group();
    const c = new THREE.Mesh(co2Geom, new THREE.MeshStandardMaterial({ color: 0x374151 }));
    const o1 = new THREE.Mesh(co2Geom, new THREE.MeshStandardMaterial({ color: 0xef4444 }));
    const o2 = o1.clone();
    o1.position.x = -0.15;
    o2.position.x = 0.15;
    g.add(c, o1, o2);
    g.userData = { t: i / MAX, x: (Math.random() - 0.5) * 5, z: (Math.random() - 0.5) * 1.5 };
    scene.add(g);
    return g;
  });
  const o2 = Array.from({ length: MAX }, (_, i) => {
    const g = mk(0x60a5fa);
    const b = g.children[0].clone();
    b.position.x = 0.15;
    g.add(b);
    g.userData = { t: i / MAX, x: (Math.random() - 0.5) * 5, z: (Math.random() - 0.5) * 1.5 };
    scene.add(g);
    return g;
  });
  const hexes = new THREE.Group();
  scene.add(hexes);

  function update() {
    const r = photosynthesisRate(state.light, state.co2, state.temp);
    state.rate = r.rate;
    state.limiting = r.limiting;
    $('[data-rate-fill]').style.width = `${Math.round(r.rate * 100)}%`;
    const tips = {
      light: 'More light would speed it up. CO₂ and temperature are not the problem right now.',
      'carbon dioxide': 'More CO₂ would speed it up. Greenhouses pump in extra CO₂ for this reason.',
      temperature: state.temp > 30 ? 'Too hot: the enzymes that fix CO₂ are being damaged (denatured).' : 'Too cold: the enzymes work slowly. Warming it up would help.',
    };
    $('[data-msg]').innerHTML = r.rate < 0.02 ? 'Almost no photosynthesis.' : `Limiting factor: <b>${r.limiting}</b>. ${tips[r.limiting]}`;
    sun.material.color.setHSL(0.15, 1, 0.25 + 0.4 * (state.light / 100));
    rays.forEach((ray) => { ray.material.opacity = state.light / 100; });
    drawGraph();
  }

  // Rate against light at the current CO₂ and temperature: it rises, then flattens when something else limits.
  function drawGraph() {
    const w = 300;
    const h = 120;
    let d = '';
    for (let L = 0; L <= 100; L += 2) d += `${d ? 'L' : 'M'}${(L / 100) * w},${h - 8 - photosynthesisRate(L, state.co2, state.temp).rate * (h - 16)}`;
    const cx = (state.light / 100) * w;
    const cy = h - 8 - state.rate * (h - 16);
    $('[data-graph]').innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="Rate against light intensity"><path d="${d}" class="q"/><circle cx="${cx}" cy="${cy}" r="4" fill="#facc15"/><text x="4" y="12" class="tlabel">rate</text><text x="${w - 4}" y="${h - 2}" text-anchor="end" class="tlabel">light →</text></svg>`;
  }

  const bind = (sel, key, fmt) => $(sel).addEventListener('input', (e) => {
    state[key] = Number(e.target.value);
    $(sel.replace(']', '-out]')).textContent = fmt(state[key]);
    update();
  });
  bind('[data-light]', 'light', (v) => `${v}%`);
  bind('[data-co2]', 'co2', (v) => `${v} ppm`);
  bind('[data-temp]', 'temp', (v) => `${v} °C`);

  stage.onFrame((dt) => {
    const speed = 0.15 + state.rate * 0.6;
    const nIn = Math.round((state.co2 / 1200) * MAX);
    const nOut = Math.round(state.rate * MAX);
    co2.forEach((g, i) => {
      g.visible = i < nIn;
      g.userData.t = (g.userData.t + dt * speed * 0.5) % 1;
      g.position.set(g.userData.x, -2.6 + g.userData.t * 2.6, g.userData.z);
      g.rotation.z += dt;
    });
    o2.forEach((g, i) => {
      g.visible = i < nOut;
      g.userData.t = (g.userData.t + dt * speed * 0.5) % 1;
      g.position.set(g.userData.x, 0.2 + g.userData.t * 2.8, g.userData.z);
    });
    state.glucose += dt * state.rate * 0.8;
    // A glucose hexagon appears on the leaf for every unit made (up to a handful).
    const want = Math.min(12, Math.floor(state.glucose));
    while (hexes.children.length < want) {
      const k = hexes.children.length;
      const hx = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.06, 6), new THREE.MeshStandardMaterial({ color: 0xfacc15 }));
      hx.position.set(-2 + (k % 6) * 0.8, 0.25, k < 6 ? -0.3 : 0.4);
      hexes.add(hx);
    }
    glucoseLabel.element.textContent = `glucose made: ${formatNumber(state.glucose, 1)}`;
  });

  update();
  return () => stage.dispose();
}
