// Electronics & communication: sampling and aliasing. A spinning wheel filmed by a camera that takes fs pictures
// per second can look slow, stopped or even backwards (the "wagon wheel" effect). The same thing happens to any
// signal sampled too slowly: it turns into a fake, lower frequency. Nyquist: sample faster than 2 × the signal.
import * as THREE from 'three';
import { createStage, makeLabel } from '../stage.js';
import { aliasFrequency, apparentRotation } from '../ece/signals.js';
import { html, formatNumber } from '../ui.js';

export function mountSampling(root) {
  root.innerHTML = html`
    <div class="viewport" data-viewport></div>
    <aside class="panel">
      <h2>Sampling &amp; Aliasing</h2>
      <p class="lede">Digital systems (phones, audio, video) only see a signal at <b>sample instants</b>, fs times per second. If fs is less than <b>twice</b> the signal frequency (the <b>Nyquist rate</b>), the samples trace out a different, slower wave: an <b>alias</b>. That's why filmed wheels sometimes seem to spin backwards.</p>

      <label class="slider-row wide"><span>Signal f</span><input type="range" min="0.2" max="12" step="0.1" value="1" data-f><output data-f-out>1 Hz</output></label>
      <label class="slider-row wide"><span>Sampling fs</span><input type="range" min="1" max="20" step="0.5" value="10" data-fs><output data-fs-out>10 Hz</output></label>
      <div class="op-group">
        <button class="btn small secondary" data-try="1,10">Fine (f ≪ fs)</button>
        <button class="btn small secondary" data-try="5,10">Exactly Nyquist</button>
        <button class="btn small secondary" data-try="9,10">Backwards wheel</button>
        <button class="btn small secondary" data-try="10,10">Frozen</button>
      </div>
      <p class="hint">Everything runs 10× slower than the numbers say, so you can see it.</p>

      <div class="timing" data-graph></div>
      <div class="readout" data-out></div>
      <div class="notice" data-msg></div>
    </aside>
  `;

  const $ = (sel) => root.querySelector(sel);
  const stage = createStage($('[data-viewport]'), { cameraPosition: [0, 1, 9], axes: false, grid: false });
  const scene = stage.scene;
  const state = { f: 1, fs: 10, t: 0, lastSample: -1 };
  const SLOW = 0.1; // on-screen time runs at a tenth of real time

  const wheel = (x, label) => {
    const g = new THREE.Group();
    g.position.x = x;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.08, 10, 48), new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.5 }));
    g.add(rim);
    for (let k = 0; k < 6; k++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.4, 0.06), new THREE.MeshStandardMaterial({ color: k === 0 ? 0xef4444 : 0x6b7280 }));
      spoke.geometry.translate(0, 0.7, 0);
      spoke.rotation.z = (k / 6) * Math.PI * 2;
      g.add(spoke);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.2, 16), new THREE.MeshStandardMaterial({ color: 0xe5e7eb }));
    hub.rotation.x = Math.PI / 2;
    g.add(hub);
    scene.add(g, makeLabel(label, new THREE.Vector3(x, -2, 0), 0x9b98c4, 'chart-label'));
    return g;
  };
  const real = wheel(-2.2, 'real wheel');
  const seen = wheel(2.2, 'what the camera sees');
  const flash = new THREE.Mesh(new THREE.CircleGeometry(0.25, 20), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }));
  flash.position.set(2.2, 1.9, 0);
  scene.add(flash, makeLabel('📷', new THREE.Vector3(2.2, 1.95, 0), 0xffffff, 'chart-label'));

  function readout() {
    const alias = aliasFrequency(state.f, state.fs);
    const ok = state.fs > 2 * state.f;
    const app = apparentRotation(state.f, state.fs);
    const row = (k, v) => `<div class="row-between"><span>${k}</span><strong>${v}</strong></div>`;
    $('[data-out]').innerHTML = [
      row('Nyquist rate 2f', `${formatNumber(2 * state.f, 1)} Hz`),
      row('Sampling fs', `${state.fs} Hz ${ok ? '<span class="ok-text">✓ enough</span>' : '<span class="warn-text">✗ too slow</span>'}`),
      row('Frequency you see', `${formatNumber(alias, 2)} Hz${!ok && alias !== state.f ? ' (alias!)' : ''}`),
    ].join('');
    $('[data-msg]').innerHTML = Math.abs(state.fs - 2 * state.f) < 1e-9 ? '<b>Exactly 2f:</b> two samples per cycle. For a sine they can land on the zero crossings every time and see a flat line, so you need <b>more</b> than 2f, not equal.'
      : Math.abs(app) < 1e-9 ? '<b>Frozen:</b> the wheel turns exactly a whole number of times between pictures, so every photo looks the same.'
      : ok ? 'fs is more than 2f: the samples follow the real wave and the wheel looks right. This is why CD audio samples at 44.1 kHz: just over twice the ~20 kHz humans can hear.'
        : app < 0 ? '<b>Backwards!</b> Between two pictures the wheel turns <i>almost</i> a full turn, which looks like a small turn the other way.'
          : `<b>Aliasing:</b> the samples trace a slower ${formatNumber(alias, 2)} Hz wave. Once sampled, there is no way to tell it from a real ${formatNumber(alias, 2)} Hz signal. That's why audio gear filters out high frequencies before sampling.`;
  }

  function drawGraph() {
    const w = 300;
    const h = 120;
    const span = 2; // seconds of real signal shown
    const x = (t) => (t / span) * w;
    const y = (v) => h / 2 - v * (h / 2 - 10);
    let real = '';
    for (let i = 0; i <= 400; i++) { const t = (i / 400) * span; real += `${i ? 'L' : 'M'}${x(t).toFixed(1)},${y(Math.sin(2 * Math.PI * state.f * t)).toFixed(1)}`; }
    const app = apparentRotation(state.f, state.fs);
    let alias = '';
    for (let i = 0; i <= 400; i++) { const t = (i / 400) * span; alias += `${i ? 'L' : 'M'}${x(t).toFixed(1)},${y(Math.sin(2 * Math.PI * app * t)).toFixed(1)}`; }
    let dots = '';
    for (let t = 0; t <= span + 1e-9; t += 1 / state.fs) dots += `<circle cx="${x(t).toFixed(1)}" cy="${y(Math.sin(2 * Math.PI * state.f * t)).toFixed(1)}" r="3" fill="#facc15"/>`;
    $('[data-graph]').innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="Signal and samples"><path d="${real}" class="edge" style="stroke:#a78bfa;stroke-dasharray:none;opacity:.6"/><path d="${alias}" class="q" style="stroke-dasharray:4 3"/>${dots}
      <text x="4" y="12" class="tlabel">real signal (violet), samples (yellow), what they trace (green)</text></svg>`;
  }

  const update = () => { readout(); drawGraph(); };
  $('[data-f]').addEventListener('input', (e) => { state.f = Number(e.target.value); $('[data-f-out]').textContent = `${state.f} Hz`; update(); });
  $('[data-fs]').addEventListener('input', (e) => { state.fs = Number(e.target.value); $('[data-fs-out]').textContent = `${state.fs} Hz`; update(); });
  root.querySelectorAll('[data-try]').forEach((b) => b.addEventListener('click', () => {
    const [f, fs] = b.dataset.try.split(',').map(Number);
    state.f = f;
    state.fs = fs;
    $('[data-f]').value = f;
    $('[data-fs]').value = fs;
    $('[data-f-out]').textContent = `${f} Hz`;
    $('[data-fs-out]').textContent = `${fs} Hz`;
    update();
  }));

  stage.onFrame((dt) => {
    state.t += dt * SLOW;
    const angle = -2 * Math.PI * state.f * state.t; // clockwise
    real.rotation.z = angle;
    // The camera wheel only updates at each sample instant.
    const k = Math.floor(state.t * state.fs);
    if (k !== state.lastSample) {
      state.lastSample = k;
      seen.rotation.z = -2 * Math.PI * state.f * (k / state.fs);
      flash.material.opacity = 1;
    }
    flash.material.opacity = Math.max(0, flash.material.opacity - dt * 6);
  });

  update();
  return () => stage.dispose();
}
