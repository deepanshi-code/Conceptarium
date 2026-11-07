// Electronics: the PN-junction diode. Where p-type (spare holes, +) meets n-type (spare electrons, −), carriers cross
// and cancel, leaving a depletion region with no free charges. Forward bias squeezes it so current flows (after
// about 0.7 V for silicon); reverse bias widens it so almost nothing flows. A one-way valve for current.
import * as THREE from 'three';
import { createStage, makeLabel } from '../stage.js';
import { diodeCurrent, depletionWidth } from '../ece/signals.js';
import { html, formatNumber } from '../ui.js';

const W = 7;
const CARRIERS = 70;

export function mountDiode(root) {
  root.innerHTML = html`
    <div class="viewport" data-viewport></div>
    <aside class="panel">
      <h2>PN Junction Diode</h2>
      <p class="lede">A diode is two kinds of silicon joined together: <b>p-type</b> has spare holes (+), <b>n-type</b> spare electrons (−). Near the join they cancel out, leaving a <b>depletion region</b> that blocks current. Push the right way (<b>forward bias</b>) and it shrinks so current flows; push the wrong way (<b>reverse bias</b>) and it grows. Current flows one way only.</p>

      <label class="slider-row wide"><span>Battery V</span><input type="range" min="-5" max="0.8" step="0.01" value="0" data-V><output data-V-out>0 V</output></label>
      <div class="op-group">
        <button class="btn small secondary" data-v="-3">Reverse −3 V</button>
        <button class="btn small secondary" data-v="0">0 V</button>
        <button class="btn small secondary" data-v="0.5">0.5 V</button>
        <button class="btn small secondary" data-v="0.75">0.75 V</button>
      </div>

      <div class="timing" data-graph></div>
      <div class="readout" data-out></div>
      <div class="notice" data-msg></div>
    </aside>
  `;

  const $ = (sel) => root.querySelector(sel);
  const stage = createStage($('[data-viewport]'), { cameraPosition: [0, 3, 8], axes: false, grid: false });
  const scene = stage.scene;
  const state = { V: 0 };

  const slab = (x, w, color) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 1.6, 1.6), new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.25, depthWrite: false }));
    m.position.x = x;
    scene.add(m);
    return m;
  };
  slab(-W / 4, W / 2, 0xf472b6);
  slab(W / 4, W / 2, 0x60a5fa);
  const depletion = new THREE.Mesh(new THREE.BoxGeometry(1, 1.64, 1.64), new THREE.MeshStandardMaterial({ color: 0xfde68a, transparent: true, opacity: 0.25, depthWrite: false }));
  scene.add(depletion);
  scene.add(makeLabel('p-type (holes +)', new THREE.Vector3(-W / 4, 1.3, 0), 0xf9a8d4, 'chart-label'), makeLabel('n-type (electrons −)', new THREE.Vector3(W / 4, 1.3, 0), 0x93c5fd, 'chart-label'));
  const depLabel = makeLabel('depletion region', new THREE.Vector3(0, -1.2, 0), 0xfde68a, 'chart-label');
  scene.add(depLabel);
  // Battery and wires: + terminal on the p side means forward bias.
  const wire = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-W / 2, 0, 0), new THREE.Vector3(-W / 2 - 0.6, 0, 0), new THREE.Vector3(-W / 2 - 0.6, -2.2, 0), new THREE.Vector3(W / 2 + 0.6, -2.2, 0), new THREE.Vector3(W / 2 + 0.6, 0, 0), new THREE.Vector3(W / 2, 0, 0)], false, 'catmullrom', 0.01), 64, 0.04, 6), new THREE.MeshStandardMaterial({ color: 0xd97706 }));
  scene.add(wire);
  const battery = new THREE.Mesh(new THREE.BoxGeometry(1, 0.5, 0.4), new THREE.MeshStandardMaterial({ color: 0x4ade80 }));
  battery.position.set(0, -2.2, 0);
  const battLabel = makeLabel('', new THREE.Vector3(0, -2.75, 0), 0x4ade80, 'chart-label');
  scene.add(battery, battLabel);

  // Mobile carriers: holes on the p side, electrons on the n side. Fixed ions sit inside the depletion region.
  const carriers = Array.from({ length: CARRIERS }, (_, i) => {
    const hole = i % 2 === 0;
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: hole ? 0xf472b6 : 0x60a5fa }));
    m.userData = { hole, x: hole ? -Math.random() * (W / 2) : Math.random() * (W / 2), y: (Math.random() - 0.5) * 1.4, z: (Math.random() - 0.5) * 1.4, jitter: Math.random() * 10 };
    scene.add(m);
    return m;
  });
  const ions = Array.from({ length: 24 }, (_, i) => {
    const neg = i % 2 === 0; // negative acceptor ions on the p side of the junction, positive donors on the n side
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial({ color: neg ? 0xbe185d : 0x1d4ed8 }));
    m.userData = { neg, u: Math.random(), y: (Math.random() - 0.5) * 1.4, z: (Math.random() - 0.5) * 1.4 };
    scene.add(m);
    return m;
  });

  function update() {
    const V = state.V;
    const I = diodeCurrent(V);
    const w = depletionWidth(V) * 0.8;
    depletion.scale.x = w;
    battLabel.element.textContent = V >= 0 ? `${formatNumber(V, 2)} V  (+ to p: forward)` : `${formatNumber(-V, 2)} V  (+ to n: reverse)`;
    ions.forEach((m) => {
      const side = m.userData.neg ? -1 : 1;
      m.position.set(side * m.userData.u * w * 0.5, m.userData.y, m.userData.z);
    });
    const fmtI = (a) => (Math.abs(a) >= 1e-3 ? `${formatNumber(a * 1000, 2)} mA` : Math.abs(a) >= 1e-6 ? `${formatNumber(a * 1e6, 2)} µA` : `${formatNumber(a * 1e9, 3)} nA`);
    const row = (k, v) => `<div class="row-between"><span>${k}</span><strong>${v}</strong></div>`;
    $('[data-out]').innerHTML = row('Current', fmtI(I)) + row('Depletion width', `${formatNumber(depletionWidth(V) * 100, 0)}% of zero-bias`);
    $('[data-msg]').innerHTML = V < -0.05 ? '<b>Reverse bias:</b> the battery pulls holes and electrons <b>away</b> from the junction, so the depletion region widens and only a tiny leakage current flows.'
      : V < 0.55 ? 'Forward, but below about 0.6 V the barrier still blocks almost all carriers. Current grows <b>exponentially</b> as you push on.'
        : '<b>Conducting:</b> the barrier is nearly gone; holes and electrons stream across and meet. Silicon diodes "turn on" at about <b>0.7 V</b>.';
    drawGraph(I);
  }

  function drawGraph(I) {
    const w = 300;
    const h = 120;
    const x = (v) => ((v + 5) / 5.8) * w;
    const maxI = diodeCurrent(0.8);
    const y = (i) => h - 20 - Math.max(0, i / maxI) * (h - 30);
    let d = '';
    for (let i = 0; i <= 300; i++) { const v = -5 + (i / 300) * 5.8; d += `${i ? 'L' : 'M'}${x(v).toFixed(1)},${y(diodeCurrent(v)).toFixed(1)}`; }
    $('[data-graph]').innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="Diode I–V curve"><line x1="${x(0)}" x2="${x(0)}" y1="0" y2="${h}" class="edge"/><line x1="0" x2="${w}" y1="${h - 20}" y2="${h - 20}" class="edge"/><path d="${d}" class="q"/><circle cx="${x(state.V)}" cy="${y(I)}" r="4" fill="#facc15"/>
      <text x="4" y="12" class="tlabel">current</text><text x="${w - 4}" y="${h - 6}" text-anchor="end" class="tlabel">voltage →</text><text x="${x(0) + 4}" y="${h - 6}" class="tlabel">0</text></svg>`;
  }

  $('[data-V]').addEventListener('input', (e) => { state.V = Number(e.target.value); $('[data-V-out]').textContent = `${formatNumber(state.V, 2)} V`; update(); });
  root.querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', () => {
    state.V = Number(b.dataset.v);
    $('[data-V]').value = state.V;
    $('[data-V-out]').textContent = `${state.V} V`;
    update();
  }));

  stage.onFrame((dt) => {
    const I = diodeCurrent(state.V);
    const flow = Math.min(1, Math.max(0, Math.log10(Math.max(I, 1e-12) / 1e-6) / 4)); // 0 below ~1 µA, 1 above ~10 mA
    const w = depletionWidth(state.V) * 0.8;
    for (const m of carriers) {
      const u = m.userData;
      u.jitter += dt;
      if (flow > 0) {
        // Holes drift right, electrons drift left; when they cross the junction they recombine and re-enter.
        u.x += (u.hole ? 1 : -1) * dt * 2.2 * flow;
        if (u.hole && u.x > 0.3) u.x = -W / 2;
        if (!u.hole && u.x < -0.3) u.x = W / 2;
      } else {
        // No current: carriers jiggle but stay out of the depletion region.
        const edge = w * 0.5;
        if (u.hole) u.x = Math.min(-edge, Math.max(-W / 2, u.x));
        else u.x = Math.max(edge, Math.min(W / 2, u.x));
      }
      m.position.set(u.x + Math.sin(u.jitter * 3) * 0.03, u.y + Math.cos(u.jitter * 2.3) * 0.03, u.z);
    }
  });

  update();
  return () => stage.dispose();
}
