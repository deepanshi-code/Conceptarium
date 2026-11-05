// Biology: breathing and gas exchange. The diaphragm contracts and flattens, the chest gets bigger, the pressure
// inside drops below the air outside, and air rushes in. In each alveolus, O₂ diffuses into the blood and CO₂ out.
import * as THREE from 'three';
import { createStage, makeLabel } from '../stage.js';
import { minuteVentilation, lungVolume, alveolarPressure } from '../bio/processes.js';
import { html, formatNumber } from '../ui.js';

const AIR = 40;
const GAS = 24;

export function mountBreathing(root) {
  root.innerHTML = html`
    <div class="viewport" data-viewport></div>
    <aside class="panel">
      <h2>Breathing &amp; Gas Exchange</h2>
      <p class="lede">Breathing in: the <b>diaphragm</b> contracts and moves down, the ribs move up and out, the lungs expand and the pressure inside drops, so air flows in. Breathing out is the reverse. Deep in the lungs, millions of tiny air sacs (<b>alveoli</b>) pass O₂ into the blood and take CO₂ out, by diffusion.</p>

      <label class="slider-row wide"><span>Breaths / min</span><input type="range" min="6" max="40" step="1" value="12" data-rate><output data-rate-out>12</output></label>
      <label class="slider-row wide"><span>Breath depth</span><input type="range" min="0.3" max="3" step="0.1" value="0.5" data-tidal><output data-tidal-out>0.5 L</output></label>

      <div class="stroke-strip two" data-phase><span data-p="in">Breathing in</span><span data-p="out">Breathing out</span></div>
      <div class="readout" data-out></div>
      <div class="notice" data-msg></div>
    </aside>
  `;

  const $ = (sel) => root.querySelector(sel);
  const stage = createStage($('[data-viewport]'), { cameraPosition: [1.5, 0.5, 11], axes: false, grid: false });
  stage.controls.target.set(1.5, 0, 0);
  const scene = stage.scene;
  const state = { rate: 12, tidal: 0.5, t: 0 };

  // Chest: rib arcs, two lungs, trachea and the diaphragm dome.
  const lungMat = new THREE.MeshStandardMaterial({ color: 0xf9a8d4, roughness: 0.6, transparent: true, opacity: 0.85 });
  const lungs = [-1, 1].map((s) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), lungMat);
    m.position.set(s * 1.05 - 2, 0.2, 0);
    scene.add(m);
    return m;
  });
  const trachea = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 2.2, 16), new THREE.MeshStandardMaterial({ color: 0xfbcfe8 }));
  trachea.position.set(-2, 2.6, 0);
  scene.add(trachea);
  const ribs = Array.from({ length: 5 }, (_, i) => {
    const r = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.06, 8, 40, Math.PI), new THREE.MeshStandardMaterial({ color: 0xe5e7eb }));
    r.position.set(-2, 1.4 - i * 0.6, 0);
    r.rotation.x = Math.PI / 2;
    r.rotation.z = Math.PI;
    scene.add(r);
    return r;
  });
  const diaphragm = new THREE.Mesh(new THREE.SphereGeometry(2.4, 32, 12, 0, Math.PI * 2, 0, Math.PI / 3), new THREE.MeshStandardMaterial({ color: 0xdc2626, side: THREE.DoubleSide, roughness: 0.6 }));
  diaphragm.position.set(-2, -2.6, 0);
  scene.add(diaphragm, makeLabel('diaphragm', new THREE.Vector3(-2, -2.9, 1.6), 0xfca5a5, 'chart-label'));
  const air = Array.from({ length: AIR }, (_, i) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xbae6fd }));
    m.userData = { k: i / AIR, side: i % 2 ? 1 : -1, a: Math.random() * Math.PI * 2 };
    scene.add(m);
    return m;
  });

  // Close-up of one alveolus with a capillary wrapped around it.
  const alv = new THREE.Group();
  alv.position.set(3.4, 0, 0);
  scene.add(alv);
  const sac = new THREE.Mesh(new THREE.SphereGeometry(1.2, 32, 24), new THREE.MeshStandardMaterial({ color: 0xfbcfe8, transparent: true, opacity: 0.35, depthWrite: false }));
  const capillary = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.22, 12, 48), new THREE.MeshStandardMaterial({ color: 0xb91c1c, transparent: true, opacity: 0.7 }));
  capillary.rotation.x = Math.PI / 2.4;
  alv.add(sac, capillary, makeLabel('one alveolus (zoomed in)', new THREE.Vector3(0, 1.9, 0), 0xf9a8d4, 'chart-label'), makeLabel('capillary', new THREE.Vector3(1.9, -0.6, 0), 0xfca5a5, 'idx-label'));
  const gas = Array.from({ length: GAS }, (_, i) => {
    const o2 = i % 2 === 0;
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: o2 ? 0x60a5fa : 0x9ca3af }));
    m.userData = { o2, a: (i / GAS) * Math.PI * 2, t: Math.random() };
    alv.add(m);
    return m;
  });
  alv.add(makeLabel('O₂ → blood', new THREE.Vector3(-0.9, -1.7, 0), 0x60a5fa, 'idx-label'), makeLabel('CO₂ → air', new THREE.Vector3(0.9, -1.7, 0), 0x9ca3af, 'idx-label'));

  function readout() {
    const mv = minuteVentilation(state.rate, state.tidal);
    const row = (k, v) => `<div class="row-between"><span>${k}</span><strong>${v}</strong></div>`;
    $('[data-out]').innerHTML = [
      row('Air per breath (tidal volume)', `${formatNumber(state.tidal, 1)} L`),
      row('Air per minute = rate × depth', `${formatNumber(mv, 1)} L/min`),
      row('At rest, typically', '≈ 6 L/min (12 × 0.5 L)'),
    ].join('');
  }

  const bind = (sel, key, fmt) => $(sel).addEventListener('input', (e) => {
    state[key] = Number(e.target.value);
    $(sel.replace(']', '-out]')).textContent = fmt(state[key]);
    readout();
  });
  bind('[data-rate]', 'rate', (v) => v);
  bind('[data-tidal]', 'tidal', (v) => `${formatNumber(v, 1)} L`);

  stage.onFrame((dt) => {
    state.t += dt;
    const V = lungVolume(state.t, state.rate, state.tidal);
    const swell = (V - 2.4) / 3; // 0 .. ~1 for the deepest breaths
    const P = alveolarPressure(state.t, state.rate, state.tidal);
    const inhaling = P < 0;
    lungs.forEach((l) => l.scale.set(1 + swell * 0.35, 1.25 + swell * 0.35, 0.9 + swell * 0.2));
    diaphragm.position.y = -2.6 - swell * 0.7;
    diaphragm.scale.y = 1 - swell * 0.5; // contracts and flattens
    ribs.forEach((r, i) => { r.position.y = 1.4 - i * 0.6 + swell * 0.25; r.scale.set(1 + swell * 0.08, 1 + swell * 0.08, 1); });
    // Air streams down the trachea while inhaling, up while exhaling.
    const flow = Math.abs(P) / Math.max(0.3, state.tidal);
    air.forEach((m) => {
      m.userData.k = (m.userData.k + dt * (inhaling ? 1 : -1) * 0.6 * (0.2 + flow)) % 1;
      if (m.userData.k < 0) m.userData.k += 1;
      const k = m.userData.k;
      if (k < 0.45) m.position.set(-2 + Math.sin(m.userData.a) * 0.08, 3.7 - (k / 0.45) * 2.2, 0);
      else {
        const f = (k - 0.45) / 0.55;
        m.position.set(-2 + m.userData.side * (0.2 + f * 1.1), 1.4 - f * 1.6, Math.cos(m.userData.a) * 0.5 * f);
      }
    });
    gas.forEach((m) => {
      m.userData.t = (m.userData.t + dt * 0.35) % 1;
      const r = m.userData.o2 ? 0.4 + m.userData.t * 1.05 : 1.45 - m.userData.t * 1.05; // O₂ outwards to blood, CO₂ inwards
      m.position.set(Math.cos(m.userData.a) * r, Math.sin(m.userData.a) * r * 0.3, Math.sin(m.userData.a) * r);
    });
    root.querySelectorAll('[data-p]').forEach((el) => el.classList.toggle('current', (el.dataset.p === 'in') === inhaling));
    $('[data-msg]').innerHTML = inhaling
      ? 'Diaphragm <b>contracts</b> (flattens), ribs move up and out → chest volume ↑ → pressure inside ↓ → air flows <b>in</b>.'
      : 'Diaphragm <b>relaxes</b> (domes up), ribs move down and in → volume ↓ → pressure ↑ → air flows <b>out</b>.';
  });

  readout();
  return () => stage.dispose();
}
