// Biology: enzymes. Substrate molecules fit into the enzyme's active site (lock and key), get split, and leave as
// products. More substrate speeds it up until every enzyme is busy; too hot or the wrong pH changes the active
// site's shape (denaturing), so nothing fits.
import * as THREE from 'three';
import { createStage, makeLabel } from '../stage.js';
import { ENZYMES, enzymeRate, michaelis, tempFactor, pHFactor } from '../bio/processes.js';
import { html, formatNumber } from '../ui.js';

const SUBSTRATES = 14;

export function mountEnzymes(root) {
  root.innerHTML = html`
    <div class="viewport" data-viewport></div>
    <aside class="panel">
      <h2>Enzymes</h2>
      <p class="lede">Enzymes are proteins that <b>speed up reactions</b> without being used up. The substrate fits into the <b>active site</b> like a key in a lock. Each enzyme works best at one temperature and pH; too hot, or the wrong pH, and the active site changes shape (it is <b>denatured</b>), so the substrate no longer fits.</p>

      <div class="tabs" data-enz>${Object.entries(ENZYMES).map(([k, e]) => `<button data-e="${k}">${e.name}</button>`).join('')}</div>
      <p class="hint" data-where></p>
      <label class="slider-row wide"><span>Substrate</span><input type="range" min="0" max="20" step="0.5" value="6" data-S><output data-S-out>6</output></label>
      <label class="slider-row wide"><span>Temperature</span><input type="range" min="0" max="80" step="1" value="37" data-T><output data-T-out>37 °C</output></label>
      <label class="slider-row wide"><span>pH</span><input type="range" min="0" max="14" step="0.1" value="6.8" data-pH><output data-pH-out>6.8</output></label>

      <h3>Reaction rate</h3>
      <div class="rate-bar"><span data-rate-fill></span></div>
      <div class="segmented" role="radiogroup">
        <label><input type="radio" name="graph" value="S" checked> vs substrate</label>
        <label><input type="radio" name="graph" value="T"> vs temp</label>
        <label><input type="radio" name="graph" value="pH"> vs pH</label>
      </div>
      <div class="timing" data-graph></div>
      <div class="notice" data-msg></div>
    </aside>
  `;

  const $ = (sel) => root.querySelector(sel);
  const stage = createStage($('[data-viewport]'), { cameraPosition: [0, 1.5, 9], axes: false, grid: false });
  const scene = stage.scene;
  const state = { enzyme: 'amylase', S: 6, T: 37, pH: 6.8, graph: 'S', rate: 0, products: 0 };

  // Enzyme: a big blob with a wedge cut out (the active site), facing the incoming substrates.
  // The sphere is missing a 90° wedge around azimuth 0 (which three.js puts on −x). Turning it by 135° points
  // the opening at the front-right, towards both the camera and the substrates. Double-sided so the inside of the
  // notch is visible.
  const enzymeMat = new THREE.MeshStandardMaterial({ color: 0x8b5cf6, roughness: 0.45, side: THREE.DoubleSide });
  const enzyme = new THREE.Mesh(new THREE.SphereGeometry(1.6, 48, 32, Math.PI / 4, Math.PI * 1.5), enzymeMat);
  enzyme.rotation.y = (3 * Math.PI) / 4;
  scene.add(enzyme, makeLabel('enzyme', new THREE.Vector3(-1.2, -2, 0), 0xc4b5fd, 'chart-label'), makeLabel('active site', new THREE.Vector3(1.5, 1.2, 1.2), 0xfacc15, 'idx-label'));

  // Substrates: two-part molecules that drift in, sit in the site, split, and drift away as products.
  const subs = Array.from({ length: SUBSTRATES }, (_, i) => {
    const g = new THREE.Group();
    const a = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), new THREE.MeshStandardMaterial({ color: 0xfacc15 }));
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), new THREE.MeshStandardMaterial({ color: 0xf97316 }));
    a.position.x = -0.18;
    b.position.x = 0.18;
    g.add(a, b);
    g.userData = { a, b, phase: 'free', t: Math.random(), home: new THREE.Vector3(3 + Math.random() * 2.5, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 2), v: new THREE.Vector3((Math.random() - 0.5), (Math.random() - 0.5), 0).multiplyScalar(0.6) };
    g.position.copy(g.userData.home);
    scene.add(g);
    return g;
  });
  const site = new THREE.Vector3(0.75, 0, 0.75); // inside the notch

  function update() {
    const e = ENZYMES[state.enzyme];
    state.rate = enzymeRate(state.S, state.T, state.pH, state.enzyme);
    $('[data-rate-fill]').style.width = `${Math.round(state.rate * 100 / michaelis(20))}%`;
    $('[data-where]').innerHTML = `Found in the ${e.where}; breaks ${e.substrate} into ${e.product}. Best pH about <b>${e.pH}</b>, best temperature about <b>37 °C</b> (body temperature).`;
    root.querySelectorAll('[data-e]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.e === state.enzyme)));
    const tf = tempFactor(state.T, 37, 14);
    const pf = pHFactor(state.pH, e.pH);
    const denatured = tf < 0.15 || pf < 0.15;
    // The active site warps as the enzyme denatures.
    const warp = 1 - Math.min(tf, pf);
    enzyme.scale.set(1 + warp * 0.25, 1 - warp * 0.3, 1);
    enzymeMat.color.setHex(denatured ? 0x6b7280 : 0x8b5cf6);
    $('[data-msg]').innerHTML = denatured
      ? (tf < 0.15 && state.T > 37 ? '<b>Denatured</b> by heat: the active site has lost its shape. Cooling it down will not fix it.' : tf < 0.15 ? 'Too cold: molecules move so slowly that they rarely meet the enzyme.' : `<b>Wrong pH</b> for ${e.name}: the active site changes shape. Try pH near ${e.pH}.`)
      : michaelis(state.S) > 0.85 * michaelis(20) ? 'Lots of substrate: almost every active site is busy, so adding more barely helps (the enzyme is <b>saturated</b>).'
        : 'More substrate → more collisions with the enzyme → faster, until every active site is busy.';
    drawGraph();
  }

  function drawGraph() {
    const w = 300;
    const h = 120;
    const e = state.enzyme;
    const pts = [];
    const [lo, hi, cur] = { S: [0, 20, state.S], T: [0, 80, state.T], pH: [0, 14, state.pH] }[state.graph];
    const f = (x) => enzymeRate(state.graph === 'S' ? x : state.S, state.graph === 'T' ? x : state.T, state.graph === 'pH' ? x : state.pH, e);
    const max = Math.max(0.01, ...Array.from({ length: 81 }, (_, i) => f(lo + ((hi - lo) * i) / 80)));
    for (let i = 0; i <= 80; i++) {
      const x = lo + ((hi - lo) * i) / 80;
      pts.push(`${i ? 'L' : 'M'}${(i / 80) * w},${h - 8 - (f(x) / max) * (h - 16)}`);
    }
    const label = { S: 'substrate →', T: 'temperature →', pH: 'pH →' }[state.graph];
    $('[data-graph]').innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="Reaction rate graph"><path d="${pts.join('')}" class="q"/><circle cx="${((cur - lo) / (hi - lo)) * w}" cy="${h - 8 - (f(cur) / max) * (h - 16)}" r="4" fill="#facc15"/><text x="4" y="12" class="tlabel">rate</text><text x="${w - 4}" y="${h - 2}" text-anchor="end" class="tlabel">${label}</text></svg>`;
  }

  $('[data-enz]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-e]');
    if (!b) return;
    state.enzyme = b.dataset.e;
    state.pH = ENZYMES[state.enzyme].pH;
    $('[data-pH]').value = state.pH;
    $('[data-pH-out]').textContent = state.pH;
    update();
  });
  const bind = (sel, key, fmt) => $(sel).addEventListener('input', (e) => {
    state[key] = Number(e.target.value);
    $(sel.replace(']', '-out]')).textContent = fmt(state[key]);
    update();
  });
  bind('[data-S]', 'S', (v) => formatNumber(v, 1));
  bind('[data-T]', 'T', (v) => `${v} °C`);
  bind('[data-pH]', 'pH', (v) => formatNumber(v, 1));
  root.querySelectorAll('input[name=graph]').forEach((r) => r.addEventListener('change', () => { state.graph = r.value; drawGraph(); }));

  let busy = null;
  let clock = 0;
  stage.onFrame((dt) => {
    const shown = Math.round((state.S / 20) * SUBSTRATES);
    const speed = 0.4 + 0.6 * Math.sqrt(Math.max(0.05, state.T) / 37); // molecules move faster when warmer
    subs.forEach((g, i) => {
      g.visible = i < shown || g.userData.phase !== 'free';
      const u = g.userData;
      if (u.phase === 'free') {
        g.position.addScaledVector(u.v, dt * speed);
        if (g.position.x < 2.4 || g.position.x > 6) u.v.x *= -1;
        if (Math.abs(g.position.y) > 2.4) u.v.y *= -1;
        g.rotation.z += dt;
      } else if (u.phase === 'in') {
        u.t = Math.min(1, u.t + dt * 1.5);
        g.position.lerpVectors(u.from, site, u.t);
        if (u.t >= 1) { u.phase = 'split'; u.t = 0; }
      } else if (u.phase === 'split') {
        u.t += dt * 1.2;
        u.a.position.set(-0.18 - u.t * 2, u.t * 1.5, 0);
        u.b.position.set(0.18 + u.t * 2.2, -u.t * 1.2, 0);
        u.a.material.color.setHex(0x4ade80);
        u.b.material.color.setHex(0x22d3ee);
        if (u.t > 1.2) {
          u.phase = 'free';
          u.a.position.set(-0.18, 0, 0);
          u.b.position.set(0.18, 0, 0);
          u.a.material.color.setHex(0xfacc15);
          u.b.material.color.setHex(0xf97316);
          g.position.copy(u.home);
          busy = null;
          state.products += 1;
        }
      }
    });
    // Catalysis: at a rate set by the model, pull the nearest free substrate into the active site.
    clock -= dt;
    if (!busy && clock <= 0 && state.rate > 0.03 && shown > 0) {
      const free = subs.filter((g, i) => i < shown && g.userData.phase === 'free');
      const g = free.sort((a, b) => a.position.distanceTo(site) - b.position.distanceTo(site))[0];
      if (g) {
        busy = g;
        g.userData.phase = 'in';
        g.userData.t = 0;
        g.userData.from = g.position.clone();
      }
      clock = 1.4 / Math.max(0.05, state.rate * 2);
    }
  });

  update();
  return () => stage.dispose();
}
