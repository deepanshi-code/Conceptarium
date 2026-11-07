// Mechanical / materials: the tensile test. A specimen is pulled until it breaks while the stress–strain curve is
// drawn: straight elastic line (Hooke's law), yield, strain hardening up to the ultimate strength, necking, fracture.
import * as THREE from 'three';
import { createStage, makeLabel } from '../stage.js';
import { MATERIALS, stressAt, toughness } from '../mech/material.js';
import { html, formatNumber } from '../ui.js';

const GAUGE = 3; // world length of the gauge section at rest
const R = 0.32;

export function mountStressStrain(root) {
  root.innerHTML = html`
    <div class="viewport" data-viewport></div>
    <aside class="panel">
      <h2>Stress–Strain (Tensile Test)</h2>
      <p class="lede">Pull a bar and measure the force. <b>Stress</b> = force / area, <b>strain</b> = stretch / length. At first it springs back (<b>elastic</b>, stress = E × strain). Past the <b>yield point</b> it stays stretched (plastic). It gets stronger until the <b>ultimate strength</b>, then a <b>neck</b> forms and it breaks.</p>

      <div class="tabs" data-mats>${Object.entries(MATERIALS).map(([k, m]) => `<button data-m="${k}">${m.name.split(' (')[0]}</button>`).join('')}</div>
      <div class="btn-row">
        <button class="btn" data-pull>▶ Pull</button>
        <button class="btn secondary" data-reset>Reset</button>
      </div>
      <label class="slider-row wide"><span>Strain</span><input type="range" min="0" max="1" step="0.001" value="0" data-e><output data-e-out>0%</output></label>

      <div class="timing" data-graph></div>
      <div class="readout" data-out></div>
      <div class="notice" data-msg></div>
      <p class="hint">Typical values; the exact numbers vary with grade and heat treatment.</p>
    </aside>
  `;

  const $ = (sel) => root.querySelector(sel);
  const stage = createStage($('[data-viewport]'), { cameraPosition: [3, 1, 7.5], axes: false, grid: false });
  const scene = stage.scene;
  const state = { mat: 'steel', f: 0, pulling: false, broken: false };

  // Machine: two grips; the specimen between them is a lathe of revolution so it can neck in the middle.
  const gripMat = new THREE.MeshStandardMaterial({ color: 0x374151, metalness: 0.6 });
  const grips = [0, 1].map(() => {
    const g = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 1.1), gripMat);
    scene.add(g);
    return g;
  });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.25, 7, 0.25), gripMat);
  frame.position.set(-1.5, 0, -0.6);
  const frame2 = frame.clone();
  frame2.position.x = 1.5;
  scene.add(frame, frame2);
  const halves = [0, 1].map(() => {
    const m = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.7, roughness: 0.3 }));
    scene.add(m);
    return m;
  });
  const forceLabel = makeLabel('', new THREE.Vector3(1.2, 0, 0.8), 0xfacc15, 'chart-label');
  scene.add(forceLabel);

  const mat = () => MATERIALS[state.mat];
  const strain = () => state.f * mat().ef;

  // Profile of the specimen (radius along its length) for a given strain: uniform until UTS, then a neck.
  function specimen(e) {
    const m = mat();
    const L = GAUGE * (1 + e * 1.6); // exaggerated so small strains are visible
    const neck = m.ductile && e > m.eu ? Math.min(1, (e - m.eu) / (m.ef - m.eu)) : 0;
    const uniform = R / Math.sqrt(1 + Math.min(e, m.eu) * 1.6); // volume stays the same: longer means thinner
    const pts = [];
    for (let i = 0; i <= 60; i++) {
      const u = i / 60;
      const y = -L / 2 + u * L;
      const r = uniform * (1 - 0.55 * neck * Math.exp(-(((u - 0.5) / 0.08) ** 2)));
      pts.push(new THREE.Vector2(r, y));
    }
    return { L, pts };
  }

  function draw() {
    const m = mat();
    const e = strain();
    const s = stressAt(state.mat, e);
    state.broken = s === null || state.f >= 1;
    const { L, pts } = specimen(Math.min(e, m.ef));
    if (state.broken) {
      // Two pieces, pulled slightly apart at the neck (ductile: cup-and-cone; brittle: flat).
      const mid = pts.length >> 1;
      halves[0].geometry.dispose();
      halves[1].geometry.dispose();
      halves[0].geometry = new THREE.LatheGeometry(pts.slice(0, mid + 1), 32);
      halves[1].geometry = new THREE.LatheGeometry(pts.slice(mid), 32);
      halves[0].position.y = -0.15;
      halves[1].position.y = 0.15;
    } else {
      halves[0].geometry.dispose();
      halves[0].geometry = new THREE.LatheGeometry(pts, 32);
      halves[0].position.y = 0;
      halves[1].geometry.dispose();
      halves[1].geometry = new THREE.BufferGeometry();
    }
    grips[0].position.y = -L / 2 - 0.45 - (state.broken ? 0.15 : 0);
    grips[1].position.y = L / 2 + 0.45 + (state.broken ? 0.15 : 0);
    halves.forEach((h) => h.material.color.setHex(m.color));
    forceLabel.element.textContent = state.broken ? 'BROKEN' : `σ = ${formatNumber(s, 0)} MPa`;

    drawGraph(e, state.broken ? null : s);
    const row = (k, v) => `<div class="row-between"><span>${k}</span><strong>${v}</strong></div>`;
    $('[data-out]').innerHTML = [
      row("Young's modulus E", `${m.E} GPa`),
      row('Yield strength', m.yield ? `${m.yield} MPa` : 'none (brittle)'),
      row('Ultimate tensile strength', `${m.uts} MPa`),
      row('Elongation at break', `${formatNumber(m.ef * 100, 1)}%`),
      row('Toughness (area under curve)', `${formatNumber(toughness(state.mat), 1)} MJ/m³`),
    ].join('');
    const ey = m.yield ? m.yield / (m.E * 1000) : 0;
    $('[data-msg]').innerHTML = state.broken ? (m.ductile ? `<b>Fracture</b> after ${formatNumber(m.ef * 100, 0)}% stretch, at the neck. Ductile metals warn you before failing.` : '<b>Snapped</b> with almost no stretch: brittle. No yielding, no warning. That is why cast iron is not used where things get pulled hard.')
      : !m.ductile ? 'Cast iron stays almost straight-line until it suddenly breaks.'
        : e <= ey ? '<b>Elastic</b>: let go now and it returns to its original length. Stress ∝ strain (Hooke\'s law).'
          : e <= m.eu ? '<b>Plastic</b>: it is now permanently stretched, and getting harder to stretch further (strain hardening).'
            : '<b>Necking</b>: past the ultimate strength the bar thins in one spot. The force needed falls until it breaks.';
  }

  function drawGraph(e, s) {
    const w = 300;
    const h = 150;
    const m = mat();
    const maxE = Math.max(...Object.values(MATERIALS).map((x) => x.ef)) * 1.05;
    const maxS = 450;
    const x = (v) => 30 + (v / maxE) * (w - 40);
    const y = (v) => h - 20 - (v / maxS) * (h - 30);
    let others = '';
    for (const [k, other] of Object.entries(MATERIALS)) {
      if (k === state.mat) continue;
      let d = '';
      for (let i = 0; i <= 120; i++) { const ee = (i / 120) * other.ef; d += `${i ? 'L' : 'M'}${x(ee).toFixed(1)},${y(stressAt(k, ee)).toFixed(1)}`; }
      others += `<path d="${d}" class="edge"/>`;
    }
    let d = '';
    const upto = Math.min(e, m.ef);
    for (let i = 0; i <= 200; i++) { const ee = (i / 200) * upto; d += `${i ? 'L' : 'M'}${x(ee).toFixed(1)},${y(stressAt(state.mat, ee)).toFixed(1)}`; }
    $('[data-graph]').innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="Stress–strain curve">${others}<path d="${d}" class="q"/>
      ${s !== null ? `<circle cx="${x(e)}" cy="${y(s)}" r="4" fill="#facc15"/>` : ''}
      <line x1="30" x2="${w - 6}" y1="${h - 20}" y2="${h - 20}" class="edge"/><line x1="30" x2="30" y1="6" y2="${h - 20}" class="edge"/>
      <text x="34" y="14" class="tlabel">stress (MPa)</text><text x="${w - 6}" y="${h - 6}" text-anchor="end" class="tlabel">strain →</text>
      <text x="26" y="${y(400) + 3}" text-anchor="end" class="tlabel">400</text><text x="26" y="${y(200) + 3}" text-anchor="end" class="tlabel">200</text></svg>`;
  }

  function setF(f) {
    state.f = Math.min(1, Math.max(0, f));
    $('[data-e]').value = state.f;
    $('[data-e-out]').textContent = `${formatNumber(strain() * 100, 1)}%`;
    draw();
  }

  $('[data-mats]').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-m]');
    if (!b) return;
    state.mat = b.dataset.m;
    root.querySelectorAll('[data-m]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    state.pulling = false;
    setF(0);
  });
  $('[data-pull]').addEventListener('click', () => {
    if (state.f >= 1) setF(0);
    state.pulling = !state.pulling;
    $('[data-pull]').textContent = state.pulling ? '❚❚ Pause' : '▶ Pull';
  });
  $('[data-reset]').addEventListener('click', () => { state.pulling = false; $('[data-pull]').textContent = '▶ Pull'; setF(0); });
  $('[data-e]').addEventListener('input', (ev) => { state.pulling = false; setF(Number(ev.target.value)); });

  stage.onFrame((dt) => {
    if (!state.pulling) return;
    setF(state.f + dt * 0.12);
    if (state.f >= 1) {
      state.pulling = false;
      $('[data-pull]').textContent = '↺ Again';
    }
  });

  root.querySelector('[data-m="steel"]').setAttribute('aria-selected', 'true');
  setF(0);
  return () => stage.dispose();
}
