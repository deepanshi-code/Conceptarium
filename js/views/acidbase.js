// Chemistry: acids, bases and pH. A beaker coloured by universal indicator, with H⁺ and OH⁻ ions to show which
// is in excess. In titration mode, NaOH drips from a burette into HCl and the pH curve is drawn as you add it.
import * as THREE from 'three';
import { createStage, makeLabel } from '../stage.js';
import { SUBSTANCES, pH, titrationPH, indicatorColor } from '../chem/acidbase.js';
import { html, formatNumber } from '../ui.js';

const IONS = 40;
const VA = 25; // mL of 0.1 M HCl in the flask
const C = 0.1;

export function mountAcidBase(root) {
  root.innerHTML = html`
    <div class="viewport" data-viewport></div>
    <aside class="panel">
      <h2>Acids, Bases &amp; pH</h2>
      <p class="lede">Acids release <b>H⁺</b> ions in water; bases release <b>OH⁻</b>. <b>pH = −log[H⁺]</b>: below 7 is acidic, 7 is neutral, above 7 is basic, and each step of 1 is a <b>10×</b> change. Strong acids split up completely; weak acids only partly, so the same concentration gives a higher pH.</p>

      <div class="segmented" role="radiogroup">
        <label><input type="radio" name="mode" value="explore" checked> pH explorer</label>
        <label><input type="radio" name="mode" value="titrate"> Titration</label>
      </div>

      <div data-explore>
        <label class="field">Substance
          <select data-sub>${Object.entries(SUBSTANCES).map(([k, s]) => `<option value="${k}">${s.name}</option>`).join('')}</select>
        </label>
        <label class="slider-row wide"><span>Concentration</span><input type="range" min="-4" max="0" step="0.1" value="-1" data-c><output data-c-out>0.1 M</output></label>
      </div>
      <div data-titrate hidden>
        <p class="hint">Flask: ${VA} mL of ${C} M HCl. Burette: ${C} M NaOH, with phenolphthalein (turns pink above pH ≈ 8.2).</p>
        <label class="slider-row wide"><span>NaOH added</span><input type="range" min="0" max="50" step="0.1" value="0" data-vb><output data-vb-out>0 mL</output></label>
        <div class="btn-row"><button class="btn" data-drip>💧 Drip slowly</button></div>
        <div class="timing" data-curve></div>
      </div>

      <div class="ph-meter" data-meter></div>
      <div class="ph-scale"><i data-marker></i></div>
      <div class="notice" data-msg></div>
    </aside>
  `;

  const $ = (sel) => root.querySelector(sel);
  const stage = createStage($('[data-viewport]'), { cameraPosition: [0, 1.5, 8], axes: false, grid: false });
  stage.controls.target.set(0, 0.6, 0);
  const scene = stage.scene;
  const state = { mode: 'explore', sub: 'HCl', c: 0.1, vb: 0, dripping: false, pH: 7 };

  const glass = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.35, 3, 40, 1, true), new THREE.MeshStandardMaterial({ color: 0xc4b5fd, transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false }));
  const liquid = new THREE.Mesh(new THREE.CylinderGeometry(1.42, 1.3, 2, 40), new THREE.MeshStandardMaterial({ color: 0x22c55e, transparent: true, opacity: 0.55, depthWrite: false }));
  liquid.position.y = -0.45;
  scene.add(glass, liquid);
  const burette = new THREE.Group();
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 3, 16), new THREE.MeshStandardMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.4 }));
  tube.position.y = 3.4;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.4, 16), tube.material);
  tip.rotation.x = Math.PI;
  tip.position.y = 1.7;
  burette.add(tube, tip, makeLabel('NaOH', new THREE.Vector3(0.45, 3.6, 0), 0xbae6fd, 'chart-label'));
  scene.add(burette);
  const drop = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), new THREE.MeshStandardMaterial({ color: 0xe0f2fe }));
  drop.visible = false;
  scene.add(drop);

  const ions = Array.from({ length: IONS }, () => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    m.userData = { p: new THREE.Vector3((Math.random() - 0.5) * 2.2, -1.3 + Math.random() * 1.7, (Math.random() - 0.5) * 2.2), v: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5) };
    scene.add(m);
    return m;
  });
  const ionLabels = [makeLabel('H⁺', new THREE.Vector3(-2.1, 0.4, 0), 0xf87171, 'chart-label'), makeLabel('OH⁻', new THREE.Vector3(2.1, 0.4, 0), 0x60a5fa, 'chart-label')];
  scene.add(...ionLabels);

  function update() {
    const p = state.mode === 'explore' ? pH(state.sub, state.c) : titrationPH(VA, C, state.vb, C);
    state.pH = p;
    const indicatorTitration = state.mode === 'titrate';
    liquid.material.color.setHex(indicatorTitration ? (p >= 8.2 ? 0xf472b6 : 0xf8fafc) : indicatorColor(p));
    liquid.material.opacity = indicatorTitration && p < 8.2 ? 0.25 : 0.55;
    burette.visible = indicatorTitration;
    // Ion split: share of H⁺ vs OH⁻ drawn from how far pH is from 7 (one step = 10×, so this is a log picture).
    const hShare = 1 / (1 + 10 ** ((p - 7) * 0.5));
    ions.forEach((m, i) => m.material.color.setHex(i / IONS < hShare ? 0xf87171 : 0x60a5fa));
    $('[data-meter]').innerHTML = `pH <span>${p.toFixed(2)}</span> <em>${p < 6.5 ? 'acidic' : p > 7.5 ? 'basic' : 'neutral'}</em>`;
    $('[data-marker]').style.left = `${(p / 14) * 100}%`;
    const hConc = 10 ** -p;
    if (state.mode === 'explore') {
      const s = SUBSTANCES[state.sub];
      const strongWeak = s.kind.startsWith('weak') ? ` It is <b>weak</b>: only some molecules split into ions, so the pH is closer to 7 than a strong ${s.kind.endsWith('acid') ? 'acid' : 'base'} at the same concentration (${s.kind.endsWith('acid') ? pH('HCl', state.c).toFixed(2) : pH('NaOH', state.c).toFixed(2)}).` : '';
      $('[data-msg]').innerHTML = s.kind === 'neutral'
        ? 'Pure water: [H⁺] = [OH⁻] = 1 × 10⁻⁷ mol/L, so pH 7, however much water you have.'
        : `[H⁺] = ${hConc.toExponential(1)} mol/L.${strongWeak} Dilute it 10× and the pH moves by ${s.kind.startsWith('strong') ? 'about 1' : 'about ½'}.`;
    } else {
      const eq = Math.abs(state.vb - VA) < 0.05;
      $('[data-msg]').innerHTML = eq ? '<b>Equivalence point</b>: all the HCl has been neutralised. HCl + NaOH → NaCl + H₂O, pH 7.'
        : state.vb < VA ? `Still acidic: ${formatNumber(VA - state.vb, 1)} mL more NaOH to neutralise. Watch the huge pH jump near 25 mL.` : 'Past equivalence: extra NaOH makes it basic, and the indicator turns pink.';
      drawCurve();
    }
  }

  function drawCurve() {
    const w = 300;
    const h = 130;
    const x = (v) => (v / 50) * w;
    const y = (p) => h - 8 - (p / 14) * (h - 16);
    let d = '';
    for (let v = 0; v <= state.vb + 1e-9; v += 0.25) d += `${d ? 'L' : 'M'}${x(v).toFixed(1)},${y(titrationPH(VA, C, v, C)).toFixed(1)}`;
    $('[data-curve]').innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="Titration curve">
      <line x1="0" x2="${w}" y1="${y(7)}" y2="${y(7)}" class="edge"/><line x1="${x(25)}" x2="${x(25)}" y1="0" y2="${h}" class="edge"/>
      <path d="${d}" class="q"/><circle cx="${x(state.vb)}" cy="${y(state.pH)}" r="4" fill="#facc15"/>
      <text x="4" y="12" class="tlabel">pH</text><text x="${x(25) + 4}" y="${h - 4}" class="tlabel">25 mL</text><text x="${w - 4}" y="${h - 4}" text-anchor="end" class="tlabel">NaOH (mL) →</text></svg>`;
  }

  root.querySelectorAll('input[name=mode]').forEach((r) => r.addEventListener('change', () => {
    state.mode = r.value;
    $('[data-explore]').hidden = state.mode !== 'explore';
    $('[data-titrate]').hidden = state.mode !== 'titrate';
    update();
  }));
  $('[data-sub]').addEventListener('change', (e) => { state.sub = e.target.value; update(); });
  $('[data-c]').addEventListener('input', (e) => {
    state.c = 10 ** Number(e.target.value);
    $('[data-c-out]').textContent = state.c >= 0.01 ? `${formatNumber(state.c, 3)} M` : `${state.c.toExponential(0)} M`;
    update();
  });
  $('[data-vb]').addEventListener('input', (e) => {
    state.vb = Number(e.target.value);
    $('[data-vb-out]').textContent = `${formatNumber(state.vb, 1)} mL`;
    state.dripping = false;
    update();
  });
  $('[data-drip]').addEventListener('click', () => {
    if (state.vb >= 50) state.vb = 0;
    state.dripping = !state.dripping;
    $('[data-drip]').textContent = state.dripping ? '❚❚ Stop' : '💧 Drip slowly';
  });

  let dropT = 0;
  stage.onFrame((dt) => {
    for (const m of ions) {
      const u = m.userData;
      u.p.addScaledVector(u.v, dt * 0.6);
      if (Math.hypot(u.p.x, u.p.z) > 1.15) { u.v.x *= -1; u.v.z *= -1; }
      if (u.p.y < -1.35 || u.p.y > 0.45) u.v.y *= -1;
      m.position.copy(u.p);
    }
    if (state.mode === 'titrate' && state.dripping) {
      dropT += dt * 2.5;
      drop.visible = true;
      drop.position.set(0, 1.5 - (dropT % 1) * 1.1, 0);
      // Slow down near the equivalence point, as you would in the lab.
      const near = Math.abs(state.vb - VA) < 2;
      state.vb = Math.min(50, state.vb + dt * (near ? 0.6 : 3));
      $('[data-vb]').value = state.vb;
      $('[data-vb-out]').textContent = `${formatNumber(state.vb, 1)} mL`;
      update();
      if (state.vb >= 50) {
        state.dripping = false;
        $('[data-drip]').textContent = '↺ Start again';
      }
    } else drop.visible = false;
  });

  update();
  return () => stage.dispose();
}
