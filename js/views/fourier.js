// Maths: Fourier series as rotating vectors (epicycles). Time runs into the screen along −z, so the tip of the
// chain traces a 3D spring. Its shadow on the side wall is the wave itself: each sine term is the shadow of a helix.
import * as THREE from 'three';
import { createStage, makeLabel } from '../stage.js';
import { WAVES, coefficients, target, maxHarmonic } from '../maths/fourier.js';
import { html, formatNumber } from '../ui.js';

const SCALE = 1.4; // world units per unit amplitude
const WALL_X = 4.2;
const TRAIL = 700; // samples kept along the time axis
const Z_PER_RAD = 0.32; // how far back one radian of time is drawn

export function mountFourier(root) {
  root.innerHTML = html`
    <div class="viewport" data-viewport></div>
    <aside class="panel">
      <h2>Fourier Series</h2>
      <p class="lede">Any periodic signal can be built from sine waves. Picture each sine as a <b>spinning arrow</b>: stack them tip-to-tail and the last tip draws the wave. Here time flows <b>into the screen</b>, so every arrow traces a <b>helix</b>, and a sine wave is just that helix's shadow on the wall.</p>

      <label class="field">Wave
        <select data-wave>${Object.entries(WAVES).map(([k, w]) => `<option value="${k}">${w.name}</option>`).join('')}</select>
      </label>
      <div class="formula" data-formula></div>

      <h3>Build it</h3>
      <label class="slider-row wide"><span>Terms</span><input type="range" min="1" max="40" step="1" value="1" data-k><output data-k-out>1</output></label>
      <label class="slider-row wide"><span>Speed</span><input type="range" min="0.1" max="2" step="0.05" value="0.6" data-speed><output data-speed-out>0.6×</output></label>
      <div class="btn-row">
        <button class="btn secondary" data-pause>❚❚ Pause</button>
        <button class="btn secondary" data-view-side>Look at the wall</button>
      </div>
      <label class="check"><input type="checkbox" data-target checked> Show the exact wave for comparison</label>

      <h3>Terms in use</h3>
      <table class="stats"><thead><tr><th>harmonic n</th><th>amplitude</th><th>spins per period</th></tr></thead><tbody data-terms></tbody></table>
      <p class="hint" data-insight></p>
    </aside>
  `;

  const $ = (sel) => root.querySelector(sel);
  const stage = createStage($('[data-viewport]'), { cameraPosition: [-6.5, 3.2, 6.5], axes: false, grid: false });
  stage.controls.target.set(1.2, 0, -4);
  const { scene } = stage;
  const state = { wave: 'square', k: 1, speed: 0.6, paused: false, t: 0, terms: [] };

  // The wall the wave is projected onto, and a faint floor for the time axis.
  const wallLength = TRAIL * 0.03 * Z_PER_RAD;
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(wallLength + 1, 4.4), new THREE.MeshBasicMaterial({ color: 0x1a1a1a, side: THREE.DoubleSide }));
  wall.rotation.y = Math.PI / 2;
  wall.position.set(WALL_X + 0.01, 0, -wallLength / 2);
  scene.add(wall);
  const timeAxis = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0.5), new THREE.Vector3(0, 0, -wallLength)]), new THREE.LineBasicMaterial({ color: 0x444444 }));
  scene.add(timeAxis, makeLabel('time →', new THREE.Vector3(0, -0.3, -wallLength + 0.5), 0x8a8a8a, 'chart-label'));
  scene.add(makeLabel('shadow on the wall = f(t)', new THREE.Vector3(WALL_X, 2.5, -1.5), 0xb197fc, 'chart-label'));
  for (const v of [1, -1]) {
    const ref = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(WALL_X, v * SCALE, 0), new THREE.Vector3(WALL_X, v * SCALE, -wallLength)]), new THREE.LineDashedMaterial({ color: 0x3a3a3a, dashSize: 0.15, gapSize: 0.1 }));
    ref.computeLineDistances();
    scene.add(ref);
  }

  // Dynamic parts: circles + arms (rebuilt when the term count changes), and three polylines updated every frame.
  const chain = new THREE.Group();
  scene.add(chain);
  const line = (color, opacity = 1) => {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3));
    const l = new THREE.Line(geom, new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity }));
    l.frustumCulled = false;
    scene.add(l);
    return l;
  };
  const spring = line(0xb197fc);
  const shadow = line(0xffffff);
  const exact = line(0xff8a5c, 0.55);
  const connector = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineDashedMaterial({ color: 0xb197fc, dashSize: 0.08, gapSize: 0.06 }));
  scene.add(connector);
  const tipDot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), new THREE.MeshBasicMaterial({ color: 0xb197fc }));
  scene.add(tipDot);
  let arms = [];

  function rebuildChain() {
    chain.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
    chain.clear();
    state.terms = coefficients(state.wave, maxHarmonic(state.wave, state.k));
    arms = state.terms.map((term, i) => {
      const r = Math.abs(term.amp) * SCALE;
      const ring = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(Array.from({ length: 64 }, (_, j) => new THREE.Vector3(Math.cos((j / 64) * Math.PI * 2) * r, Math.sin((j / 64) * Math.PI * 2) * r, 0))),
        new THREE.LineBasicMaterial({ color: 0x5c9dff, transparent: true, opacity: i < 8 ? 0.45 : 0.15 }),
      );
      const arm = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xffffff }));
      chain.add(ring, arm);
      return { term, ring, arm };
    });
    const w = WAVES[state.wave];
    $('[data-formula]').textContent = w.formula;
    const shown = state.terms.slice(0, 6);
    $('[data-terms]').innerHTML = shown.map((t) => `<tr><td>${t.n}</td><td>${formatNumber(t.amp, 3)}</td><td>${t.n}</td></tr>`).join('')
      + (state.terms.length > 6 ? `<tr><td colspan="3">… and ${state.terms.length - 6} more</td></tr>` : '');
    $('[data-insight]').innerHTML = state.wave === 'square'
      ? (state.k >= 8 ? 'See the spikes at each jump? That ~9% overshoot is the <b>Gibbs phenomenon</b>: it gets narrower with more terms but never smaller.' : 'With one term it is just a sine wave. Add terms: the odd harmonics (3, 5, 7, …) square off the corners.')
      : state.wave === 'sawtooth'
        ? 'The sawtooth needs every harmonic, odd and even, with alternating signs. Its jump also shows the Gibbs overshoot.'
        : 'The triangle has no jumps, so its amplitudes fall as 1/n² (much faster than 1/n). A handful of terms already looks almost perfect.';
  }

  // Tip-to-tail position of the chain at time t, as points in the circles' plane.
  function chainPoints(t) {
    const pts = [[0, 0]];
    let x = 0;
    let y = 0;
    for (const { n, amp, phase } of state.terms) {
      x += amp * SCALE * Math.cos(n * t + phase);
      y += amp * SCALE * Math.sin(n * t + phase);
      pts.push([x, y]);
    }
    return pts;
  }

  function draw() {
    const pts = chainPoints(state.t);
    arms.forEach(({ ring, arm }, i) => {
      const [cx, cy] = pts[i];
      const [tx, ty] = pts[i + 1];
      ring.position.set(cx, cy, 0);
      arm.geometry.setFromPoints([new THREE.Vector3(cx, cy, 0), new THREE.Vector3(tx, ty, 0)]);
    });
    const [tipX, tipY] = pts.at(-1);
    tipDot.position.set(tipX, tipY, 0);
    connector.geometry.setFromPoints([new THREE.Vector3(tipX, tipY, 0), new THREE.Vector3(WALL_X, tipY, 0)]);
    connector.computeLineDistances();

    // History: sample i is (i × dt) radians in the past, drawn i × dt × Z_PER_RAD into the screen.
    const dt = 0.03;
    const sp = spring.geometry.attributes.position;
    const sh = shadow.geometry.attributes.position;
    const ex = exact.geometry.attributes.position;
    for (let i = 0; i < TRAIL; i++) {
      const tau = state.t - i * dt;
      const z = -i * dt * Z_PER_RAD;
      let x = 0;
      let y = 0;
      for (const { n, amp, phase } of state.terms) {
        x += amp * Math.cos(n * tau + phase);
        y += amp * Math.sin(n * tau + phase);
      }
      sp.setXYZ(i, x * SCALE, y * SCALE, z);
      sh.setXYZ(i, WALL_X, y * SCALE, z);
      ex.setXYZ(i, WALL_X - 0.005, target(state.wave, tau) * SCALE, z);
    }
    sp.needsUpdate = true;
    sh.needsUpdate = true;
    ex.needsUpdate = true;
  }

  $('[data-wave]').addEventListener('change', (e) => { state.wave = e.target.value; rebuildChain(); draw(); });
  $('[data-k]').addEventListener('input', (e) => {
    state.k = Number(e.target.value);
    $('[data-k-out]').textContent = state.k;
    rebuildChain();
    draw();
  });
  $('[data-speed]').addEventListener('input', (e) => {
    state.speed = Number(e.target.value);
    $('[data-speed-out]').textContent = `${state.speed}×`;
  });
  $('[data-pause]').addEventListener('click', () => {
    state.paused = !state.paused;
    $('[data-pause]').textContent = state.paused ? '▶ Play' : '❚❚ Pause';
  });
  $('[data-target]').addEventListener('change', (e) => { exact.visible = e.target.checked; });
  // Look straight at the wall: the 3D spring collapses to the familiar 2D graph of f(t).
  let camMove = null;
  $('[data-view-side]').addEventListener('click', () => {
    camMove = { from: stage.camera.position.clone(), to: new THREE.Vector3(-9, 0, -wallLength / 2), fromT: stage.controls.target.clone(), toT: new THREE.Vector3(WALL_X, 0, -wallLength / 2), k: 0 };
  });

  stage.onFrame((dt) => {
    if (!state.paused) {
      state.t += dt * state.speed * 2;
      draw();
    }
    if (camMove) {
      camMove.k = Math.min(1, camMove.k + dt / 1);
      const e = camMove.k * camMove.k * (3 - 2 * camMove.k);
      stage.camera.position.lerpVectors(camMove.from, camMove.to, e);
      stage.controls.target.lerpVectors(camMove.fromT, camMove.toT, e);
      if (camMove.k === 1) camMove = null;
    }
  });

  rebuildChain();
  draw();
  return () => stage.dispose();
}
