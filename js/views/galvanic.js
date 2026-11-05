// Chemistry: a galvanic (Daniell) cell. The more reactive metal (anode) dissolves and sends electrons through
// the wire to the other metal (cathode), where its ions plate out. The salt bridge lets ions move to keep both
// beakers neutral. The voltage is E°cell = E°cathode − E°anode, corrected for concentration by the Nernst equation.
import * as THREE from 'three';
import { createStage, makeLabel } from '../stage.js';
import { METALS, cell } from '../chem/electrochem.js';
import { html, formatNumber } from '../ui.js';

const BEAKER_X = 2.4;

export function mountGalvanic(root) {
  root.innerHTML = html`
    <div class="viewport" data-viewport></div>
    <aside class="panel">
      <h2>Galvanic Cell</h2>
      <p class="lede">A battery turns a chemical reaction into electricity. The metal that gives up electrons more easily (lower E°) is the <b>anode</b>: it dissolves. Its electrons flow through the wire to the <b>cathode</b>, where metal ions take them and plate out. The <b>salt bridge</b> closes the circuit with moving ions.</p>

      <div class="op-inputs">
        <label>Left metal<select data-m1>${Object.keys(METALS).map((m) => `<option ${m === 'Zn' ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
        <label>Right metal<select data-m2>${Object.keys(METALS).map((m) => `<option ${m === 'Cu' ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
      </div>
      <label class="slider-row wide"><span>Left [ion]</span><input type="range" min="-3" max="0.3" step="0.1" value="0" data-c1><output data-c1-out>1 M</output></label>
      <label class="slider-row wide"><span>Right [ion]</span><input type="range" min="-3" max="0.3" step="0.1" value="0" data-c2><output data-c2-out>1 M</output></label>

      <div class="voltmeter" data-volt></div>
      <div class="readout" data-out></div>
      <div class="notice" data-msg></div>
    </aside>
  `;

  const $ = (sel) => root.querySelector(sel);
  const stage = createStage($('[data-viewport]'), { cameraPosition: [0, 2.5, 10], axes: false, grid: false });
  stage.controls.target.set(0, 1, 0);
  const scene = stage.scene;
  const state = { m1: 'Zn', m2: 'Cu', c1: 1, c2: 1, info: null, t: 0, mass: [1, 1] };

  const beakers = [-1, 1].map((side) => {
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.2, 2.6, 40, 1, true), new THREE.MeshStandardMaterial({ color: 0xc4b5fd, transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false }));
    glass.position.set(side * BEAKER_X, 0, 0);
    const liquid = new THREE.Mesh(new THREE.CylinderGeometry(1.22, 1.15, 1.9, 40), new THREE.MeshStandardMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.35, depthWrite: false }));
    liquid.position.set(side * BEAKER_X, -0.32, 0);
    const electrode = new THREE.Mesh(new THREE.BoxGeometry(0.45, 3, 0.12), new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.7, roughness: 0.3 }));
    electrode.position.set(side * BEAKER_X, 0.6, 0);
    const label = makeLabel('', new THREE.Vector3(side * BEAKER_X, -1.75, 0), 0xffffff, 'plane-label');
    const role = makeLabel('', new THREE.Vector3(side * BEAKER_X, 2.55, 0), 0xfacc15, 'chart-label');
    scene.add(glass, liquid, electrode, label, role);
    return { liquid, electrode, label, role, side };
  });
  // Salt bridge: an upside-down U tube between the beakers.
  const bridgeCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(-BEAKER_X + 0.6, -0.4, 0), new THREE.Vector3(-BEAKER_X + 0.6, 1.2, 0), new THREE.Vector3(0, 1.45, 0), new THREE.Vector3(BEAKER_X - 0.6, 1.2, 0), new THREE.Vector3(BEAKER_X - 0.6, -0.4, 0)]);
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(bridgeCurve, 60, 0.18, 10), new THREE.MeshStandardMaterial({ color: 0xfde68a, transparent: true, opacity: 0.35, depthWrite: false })));
  scene.add(makeLabel('salt bridge (KNO₃)', new THREE.Vector3(0, 1.85, 0), 0xfde68a, 'chart-label'));
  // Wire over the top with a voltmeter in the middle.
  const wireCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(-BEAKER_X, 2.1, 0), new THREE.Vector3(-BEAKER_X, 3.4, 0), new THREE.Vector3(0, 3.6, 0), new THREE.Vector3(BEAKER_X, 3.4, 0), new THREE.Vector3(BEAKER_X, 2.1, 0)]);
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(wireCurve, 60, 0.05, 8), new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.5 })));
  const meter = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.75, 0.3), new THREE.MeshStandardMaterial({ color: 0x1e1b4b }));
  meter.position.set(0, 3.6, 0);
  const meterLabel = makeLabel('', new THREE.Vector3(0, 0, 0.2), 0x4ade80, 'bit-label');
  meter.add(meterLabel);
  scene.add(meter);

  // Moving charges: electrons in the wire, anions and cations in the salt bridge.
  const electrons = Array.from({ length: 14 }, (_, i) => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
    e.userData.u = i / 14;
    scene.add(e);
    return e;
  });
  const ions = Array.from({ length: 10 }, (_, i) => {
    const anion = i % 2 === 0;
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: anion ? 0x60a5fa : 0xf472b6 }));
    m.userData = { u: i / 10, anion };
    scene.add(m);
    return m;
  });

  function update() {
    const info = cell(state.m1, state.c1, state.m2, state.c2);
    state.info = info;
    const leftIsAnode = info.anode === state.m1;
    beakers.forEach((b) => {
      const metal = b.side < 0 ? state.m1 : state.m2;
      const conc = b.side < 0 ? state.c1 : state.c2;
      b.electrode.material.color.setHex(METALS[metal].color);
      b.label.element.textContent = `${metal} in ${METALS[metal].ion}`;
      const isAnode = (b.side < 0) === leftIsAnode;
      b.role.element.textContent = state.m1 === state.m2 ? '' : isAnode ? 'ANODE (−) oxidation' : 'CATHODE (+) reduction';
      b.liquid.material.color.setHex(metal === 'Cu' ? 0x2563eb : 0x93c5fd);
      b.liquid.material.opacity = 0.15 + 0.3 * Math.min(1, conc / 2);
    });
    const same = state.m1 === state.m2;
    const E = same ? 0 : info.E;
    meterLabel.element.textContent = `${E.toFixed(2)} V`;
    $('[data-volt]').innerHTML = `<span>${E.toFixed(3)}</span> V`;
    const row = (k, v) => `<div class="row-between"><span>${k}</span><strong>${v}</strong></div>`;
    $('[data-out]').innerHTML = same ? '' : [
      row(`E° ${info.cathode} (cathode)`, `${formatNumber(METALS[info.cathode].E, 2)} V`),
      row(`E° ${info.anode} (anode)`, `${formatNumber(METALS[info.anode].E, 2)} V`),
      row('E°cell = E°cathode − E°anode', `${formatNumber(info.E0, 2)} V`),
      row(`Nernst: E = E° − (0.0592/${info.n}) log Q`, `Q = ${formatNumber(info.Q, 3)}`),
    ].join('');
    $('[data-msg]').innerHTML = same
      ? 'Both sides are the same metal: nothing pushes electrons either way, so 0 V.'
      : `${info.anode} → ${METALS[info.anode].ion} + electrons (it dissolves). The electrons travel to ${info.cathode}, where ${METALS[info.cathode].ion} becomes ${info.cathode} metal. `
        + (Math.abs(info.E - info.E0) > 0.005 ? `Changing the concentrations shifted the voltage by ${formatNumber((info.E - info.E0) * 1000, 0)} mV.` : 'At 1 M on both sides, E = E°.');
  }

  const conc = (v) => 10 ** v;
  const fmtC = (c) => (c >= 0.1 ? `${formatNumber(c, 2)} M` : `${c.toExponential(0)} M`);
  $('[data-m1]').addEventListener('change', (e) => { state.m1 = e.target.value; state.t = 0; update(); });
  $('[data-m2]').addEventListener('change', (e) => { state.m2 = e.target.value; state.t = 0; update(); });
  $('[data-c1]').addEventListener('input', (e) => { state.c1 = conc(Number(e.target.value)); $('[data-c1-out]').textContent = fmtC(state.c1); update(); });
  $('[data-c2]').addEventListener('input', (e) => { state.c2 = conc(Number(e.target.value)); $('[data-c2-out]').textContent = fmtC(state.c2); update(); });

  stage.onFrame((dt) => {
    const info = state.info;
    const flowing = info && state.m1 !== state.m2;
    // Electrons go anode → cathode through the wire. The wire curve runs left → right.
    const dir = info && info.anode === state.m1 ? 1 : -1;
    for (const e of electrons) {
      e.visible = flowing;
      e.userData.u = (e.userData.u + dir * dt * 0.18 + 1) % 1;
      e.position.copy(wireCurve.getPointAt(e.userData.u));
    }
    // In the bridge, anions drift towards the anode, cations towards the cathode.
    for (const m of ions) {
      m.visible = flowing;
      const towardAnode = m.userData.anion;
      const step = (towardAnode ? -dir : dir) * dt * 0.08;
      m.userData.u = (m.userData.u + step + 1) % 1;
      m.position.copy(bridgeCurve.getPointAt(m.userData.u));
    }
    // The anode slowly thins and the cathode thickens.
    if (!flowing) beakers.forEach((b) => { b.electrode.scale.x = 1; });
    if (flowing) {
      state.t = Math.min(1, state.t + dt * 0.01);
      beakers.forEach((b) => {
        const isAnode = (b.side < 0) === (info.anode === state.m1);
        b.electrode.scale.x = isAnode ? 1 - 0.35 * state.t : 1 + 0.25 * state.t;
      });
    }
  });

  update();
  return () => stage.dispose();
}
