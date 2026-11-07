// Electrical: electromagnetic induction. Move a magnet through a coil and a voltage appears, but only while the
// magnetic flux is changing (Faraday's law). A transformer uses the same effect with AC: two coils on one iron core.
import * as THREE from 'three';
import { createStage, makeLabel, clearGroup } from '../stage.js';
import { emf, transformer } from '../elec/machines.js';
import { html, formatNumber } from '../ui.js';

const TRACE = 260;

export function mountInduction(root) {
  root.innerHTML = html`
    <div class="viewport" data-viewport></div>
    <aside class="panel">
      <h2>Induction &amp; Transformers</h2>
      <p class="lede"><b>Faraday's law</b>: a changing magnetic field through a coil makes a voltage, emf = −N dΦ/dt. Push a magnet in and the meter swings one way; pull it out and it swings back; hold it still and there's nothing. Generators and transformers both run on this.</p>

      <div class="segmented" role="radiogroup">
        <label><input type="radio" name="mode" value="magnet" checked> Magnet &amp; coil</label>
        <label><input type="radio" name="mode" value="transformer"> Transformer</label>
      </div>

      <div data-magnet>
        <label class="slider-row wide"><span>Magnet speed</span><input type="range" min="0" max="3" step="0.1" value="1" data-speed><output data-speed-out>1×</output></label>
        <label class="slider-row wide"><span>Turns N</span><input type="range" min="5" max="40" step="1" value="15" data-N><output data-N-out>15</output></label>
      </div>
      <div data-transformer hidden>
        <label class="slider-row wide"><span>Input Vp</span><input type="range" min="10" max="240" step="10" value="230" data-Vp><output data-Vp-out>230 V</output></label>
        <label class="slider-row wide"><span>Primary Np</span><input type="range" min="2" max="20" step="1" value="10" data-Np><output data-Np-out>10</output></label>
        <label class="slider-row wide"><span>Secondary Ns</span><input type="range" min="1" max="20" step="1" value="2" data-Ns><output data-Ns-out>2</output></label>
        <p class="hint">Coil turns are drawn scaled down (real transformers have hundreds or thousands); only the ratio matters.</p>
      </div>

      <div class="readout" data-out></div>
      <div class="timing" data-graph></div>
      <div class="notice" data-msg></div>
    </aside>
  `;

  const $ = (sel) => root.querySelector(sel);
  const stage = createStage($('[data-viewport]'), { cameraPosition: [0, 2.5, 9], axes: false, grid: false });
  const group = new THREE.Group();
  stage.scene.add(group);
  const state = { mode: 'magnet', speed: 1, N: 15, Vp: 230, Np: 10, Ns: 2, t: 0, trace: [], magnet: null, needle: null, fluxDots: [] };

  const coil = (turns, radius, length, color, x = 0, axis = 'x') => {
    const pts = Array.from({ length: turns * 24 + 1 }, (_, i) => {
      const a = (i / 24) * Math.PI * 2;
      const u = (i / (turns * 24) - 0.5) * length;
      return axis === 'x' ? new THREE.Vector3(x + u, Math.sin(a) * radius, Math.cos(a) * radius) : new THREE.Vector3(x + Math.sin(a) * radius, u, Math.cos(a) * radius);
    });
    return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 24, 0.035, 6), new THREE.MeshStandardMaterial({ color, metalness: 0.5, roughness: 0.3 }));
  };

  function buildMagnet() {
    clearGroup(group);
    group.add(coil(state.N, 0.9, 2.6, 0xd97706));
    // Bar magnet: red north, blue south.
    const magnet = new THREE.Group();
    const n = new THREE.Mesh(new THREE.BoxGeometry(1, 0.5, 0.5), new THREE.MeshStandardMaterial({ color: 0xef4444 }));
    const s = new THREE.Mesh(new THREE.BoxGeometry(1, 0.5, 0.5), new THREE.MeshStandardMaterial({ color: 0x3b82f6 }));
    n.position.x = 0.5;
    s.position.x = -0.5;
    n.add(makeLabel('N', new THREE.Vector3(0, 0, 0.3), 0xffffff, 'gate-label light'));
    s.add(makeLabel('S', new THREE.Vector3(0, 0, 0.3), 0xffffff, 'gate-label light'));
    magnet.add(n, s);
    group.add(magnet);
    state.magnet = magnet;
    // Galvanometer: a dial with a needle, wired to the coil ends.
    const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.12, 40), new THREE.MeshStandardMaterial({ color: 0x1e1b4b }));
    dial.rotation.x = Math.PI / 2;
    dial.position.set(0, -2.3, 0);
    const needle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.7, 0.03), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
    needle.geometry.translate(0, 0.35, 0);
    needle.position.set(0, -2.6, 0.1);
    group.add(dial, needle, makeLabel('meter', new THREE.Vector3(0, -3.3, 0), 0x9b98c4, 'chart-label'));
    for (const x of [-1.3, 1.3]) group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(x, -0.9, 0), new THREE.Vector3(x, -1.8, 0), new THREE.Vector3(x * 0.4, -2.3, 0)]), 12, 0.03, 6), new THREE.MeshStandardMaterial({ color: 0xd97706 })));
    state.needle = needle;
    stage.camera.position.set(0, 1.5, 9);
    stage.controls.target.set(0, -0.6, 0);
    stage.saveHome();
  }

  function buildTransformer() {
    clearGroup(group);
    // Laminated iron core: a square frame.
    const core = new THREE.Group();
    const bar = (w, h, x, y) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.7), new THREE.MeshStandardMaterial({ color: 0x6b7280, metalness: 0.6, roughness: 0.4 }));
      m.position.set(x, y, 0);
      core.add(m);
    };
    bar(4.2, 0.6, 0, 1.8);
    bar(4.2, 0.6, 0, -1.8);
    bar(0.6, 3, -1.8, 0);
    bar(0.6, 3, 1.8, 0);
    group.add(core);
    group.add(coil(state.Np, 0.55, 2.4, 0xd97706, -1.8, 'y'), coil(state.Ns, 0.55, 2.4, 0x22d3ee, 1.8, 'y'));
    group.add(makeLabel(`primary · ${state.Np} turns`, new THREE.Vector3(-1.8, -2.6, 0), 0xfbbf24, 'chart-label'), makeLabel(`secondary · ${state.Ns} turns`, new THREE.Vector3(1.8, -2.6, 0), 0x67e8f9, 'chart-label'));
    // Flux: dots that circulate around the core, reversing with the AC.
    const loop = new THREE.CatmullRomCurve3([new THREE.Vector3(-1.8, 1.8, 0.4), new THREE.Vector3(1.8, 1.8, 0.4), new THREE.Vector3(1.8, -1.8, 0.4), new THREE.Vector3(-1.8, -1.8, 0.4)], true, 'catmullrom', 0.05);
    state.fluxLoop = loop;
    state.fluxDots = Array.from({ length: 24 }, (_, i) => {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xa78bfa }));
      d.userData.u = i / 24;
      group.add(d);
      return d;
    });
    stage.camera.position.set(0, 0.5, 8.5);
    stage.controls.target.set(0, -0.3, 0);
    stage.saveHome();
  }

  function build() {
    state.trace = [];
    state.t = 0;
    $('[data-magnet]').hidden = state.mode !== 'magnet';
    $('[data-transformer]').hidden = state.mode !== 'transformer';
    if (state.mode === 'magnet') buildMagnet();
    else buildTransformer();
    readout();
  }

  function readout(e = 0, entering = false) {
    const row = (k, v) => `<div class="row-between"><span>${k}</span><strong>${v}</strong></div>`;
    if (state.mode === 'magnet') {
      $('[data-out]').innerHTML = row('Induced emf now', `${formatNumber(e, 1)} (arb. units)`) + row('Turns N', state.N);
      $('[data-msg]').innerHTML = Math.abs(e) < 0.5 ? 'No change in flux → no voltage. The magnet is far away, or right in the middle where Φ is at its peak.'
        : entering ? 'Magnet <b>approaching</b>: flux through the coil rising → the needle swings one way. (Lenz: the induced current opposes the change.)' : 'Magnet <b>moving away</b>: flux falling → the needle swings the <b>other</b> way.';
    } else {
      const t = transformer(state.Vp, state.Np, state.Ns, 10);
      $('[data-out]').innerHTML = row('Vs = Vp × Ns / Np', `${formatNumber(t.Vs, 1)} V`) + row('Type', t.kind) + row('With a 10 Ω load: Is, Ip', `${formatNumber(t.Is, 2)} A, ${formatNumber(t.Ip, 2)} A`) + row('Power in = power out (ideal)', `${formatNumber(t.P, 0)} W`);
      $('[data-msg]').innerHTML = t.kind === 'step-up' ? 'More turns on the secondary: voltage goes <b>up</b>, current goes down. Power stations do this to send electricity far with little loss.'
        : t.kind === 'step-down' ? 'Fewer turns on the secondary: voltage goes <b>down</b>, current goes up. Phone chargers and the transformer outside your home do this.'
          : 'Same turns: same voltage. Used to isolate circuits for safety.';
    }
  }

  function drawGraph() {
    const w = 300;
    const h = 110;
    const tr = state.trace;
    const max = state.mode === 'magnet' ? Math.max(5, ...tr.map((p) => Math.abs(p[1]))) : Math.max(state.Vp, transformer(state.Vp, state.Np, state.Ns, 10).Vs);
    const y = (v) => h / 2 - (v / max) * (h / 2 - 6);
    const path = (k) => tr.map((p, i) => `${i ? 'L' : 'M'}${((i / TRACE) * w).toFixed(1)},${y(p[k]).toFixed(1)}`).join('');
    $('[data-graph]').innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="Voltage graph"><line x1="0" x2="${w}" y1="${h / 2}" y2="${h / 2}" class="edge"/>
      ${state.mode === 'magnet' ? `<path d="${path(1)}" class="q"/><text x="4" y="12" class="tlabel">emf</text>` : `<path d="${path(1)}" class="in"/><path d="${path(2)}" class="q"/><text x="4" y="12" class="tlabel">Vp (yellow), Vs (green)</text>`}</svg>`;
  }

  root.querySelectorAll('input[name=mode]').forEach((r) => r.addEventListener('change', () => { state.mode = r.value; build(); }));
  const bind = (sel, key, fmt, rebuild) => $(sel).addEventListener('input', (e) => {
    state[key] = Number(e.target.value);
    $(sel.replace(']', '-out]')).textContent = fmt(state[key]);
    if (rebuild) build();
    else readout();
  });
  bind('[data-speed]', 'speed', (v) => `${v}×`, false);
  bind('[data-N]', 'N', (v) => v, true);
  bind('[data-Vp]', 'Vp', (v) => `${v} V`, false);
  bind('[data-Np]', 'Np', (v) => v, true);
  bind('[data-Ns]', 'Ns', (v) => v, true);

  stage.onFrame((dt) => {
    state.t += dt;
    if (state.mode === 'magnet') {
      // The magnet swings in and out of the coil: x = 4 sin(ωt).
      const w = 0.9 * state.speed;
      const x = 4 * Math.sin(state.t * w);
      const v = 4 * w * Math.cos(state.t * w);
      state.magnet.position.x = x;
      const e = emf(x, v, state.N) * 2;
      state.needle.rotation.z = -Math.max(-1.2, Math.min(1.2, e / 25));
      state.trace.push([state.t, e]);
      if (state.trace.length > TRACE) state.trace.shift();
      readout(e, x * v < 0); // approaching the coil when moving towards x = 0
    } else {
      const ph = state.t * 2.5;
      const t = transformer(state.Vp, state.Np, state.Ns, 10);
      state.trace.push([state.t, state.Vp * Math.sin(ph), t.Vs * Math.sin(ph)]);
      if (state.trace.length > TRACE) state.trace.shift();
      const dir = Math.cos(ph); // flux follows the current, reversing every half cycle
      for (const d of state.fluxDots) {
        d.userData.u = (d.userData.u + dt * 0.25 * dir + 1) % 1;
        d.position.copy(state.fluxLoop.getPointAt(d.userData.u));
      }
    }
    drawGraph();
  });

  build();
  return () => stage.dispose();
}
