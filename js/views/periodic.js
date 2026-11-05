// Chemistry: periodic trends as a 3D bar chart. Each element of periods 1–4 stands in its place in the table,
// and its height is the chosen property, so the trends across periods and down groups become hills and valleys.
import * as THREE from 'three';
import { createStage, makeLabel, clearGroup } from '../stage.js';
import { ELEMENTS, PROPERTIES, CATEGORIES } from '../chem/periodic.js';
import { interact } from '../interact.js';
import { html, formatNumber } from '../ui.js';

const CELL = 0.62;
const MAX_H = 2.6;

export function mountPeriodic(root) {
  root.innerHTML = html`
    <div class="viewport" data-viewport></div>
    <aside class="panel">
      <h2>Periodic Trends</h2>
      <p class="lede">The periodic table is ordered by atomic number, and properties repeat in a pattern. Here each element's <b>bar height</b> is a property, so you can see the trends: what happens <b>across</b> a period (left → right) and <b>down</b> a group (top → bottom).</p>

      <div class="tabs" data-props>${Object.entries(PROPERTIES).map(([k, p]) => `<button data-prop="${k}">${p.name}</button>`).join('')}</div>
      <div class="segmented" role="radiogroup">
        <label><input type="radio" name="color" value="value" checked> Colour by value</label>
        <label><input type="radio" name="color" value="category"> By family</label>
      </div>
      <div class="notice" data-trend></div>
      <div class="organelle-card" data-card><p class="dim">Click an element to see its numbers.</p></div>
      <div class="cat-legend" data-legend hidden>${Object.values(CATEGORIES).map(([name, c]) => `<span><span class="swatch" style="--c:#${new THREE.Color(c).getHexString()}"></span>${name}</span>`).join('')}</div>
      <p class="hint">Data: Pauling electronegativity and first ionisation energy (CRC Handbook); covalent radii (Cordero et al., 2008).</p>
    </aside>
  `;

  const $ = (sel) => root.querySelector(sel);
  const stage = createStage($('[data-viewport]'), { cameraPosition: [0, 11, 9], axes: false, grid: false });
  stage.controls.target.set(0, 0, 0.6);
  const group = new THREE.Group();
  stage.scene.add(group);
  const state = { prop: 'radius', color: 'value', bars: [], selected: null };
  const pos = (e) => new THREE.Vector3((e.group - 9.5) * CELL, 0, (e.period - 2.5) * CELL * 1.25);
  const low = new THREE.Color(0x3b82f6);
  const high = new THREE.Color(0xf43f5e);

  function build() {
    clearGroup(group);
    const p = PROPERTIES[state.prop];
    const vals = ELEMENTS.map((e) => e[p.key]).filter((v) => v !== null);
    const max = Math.max(...vals);
    const min = Math.min(...vals);
    state.bars = ELEMENTS.map((e) => {
      const v = e[p.key];
      const h = v === null ? 0.06 : 0.15 + ((v - 0) / max) * MAX_H;
      const color = state.color === 'category' ? new THREE.Color(CATEGORIES[e.category][1]) : v === null ? new THREE.Color(0x3a3f6b) : low.clone().lerp(high, (v - min) / (max - min));
      const bar = new THREE.Mesh(new THREE.BoxGeometry(CELL * 0.86, h, CELL * 0.86), new THREE.MeshStandardMaterial({ color, roughness: 0.4 }));
      bar.geometry.translate(0, h / 2, 0);
      bar.position.copy(pos(e));
      bar.userData = { e, color: color.getHex() };
      bar.add(makeLabel(e.symbol, new THREE.Vector3(0, h + 0.18, 0), 0xffffff, 'idx-label base'));
      group.add(bar);
      return bar;
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(18 * CELL + 0.6, 4 * CELL * 1.25 + 0.6), new THREE.MeshStandardMaterial({ color: 0x14183a }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -0.01, 0);
    group.add(floor);
    for (let per = 1; per <= 4; per++) group.add(makeLabel(`period ${per}`, new THREE.Vector3(-9.6 * CELL - 0.4, 0, (per - 2.5) * CELL * 1.25), 0x8a8fb8, 'idx-label'));
    group.add(makeLabel('across a period →', new THREE.Vector3(0, 0, -2.5 * CELL * 1.25 - 0.3), 0x8a8fb8, 'chart-label'));
    root.querySelectorAll('[data-prop]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.prop === state.prop)));
    $('[data-trend]').innerHTML = p.trend + (state.prop === 'en' ? ' (Noble gases mostly have no value: they rarely bond.)' : '');
    $('[data-legend]').hidden = state.color !== 'category';
    if (state.selected) select(state.bars.find((b) => b.userData.e === state.selected));
  }

  function select(bar) {
    state.selected = bar?.userData.e ?? null;
    state.bars.forEach((b) => b.material.emissive.setHex(b === bar ? 0x444400 : 0x000000));
    if (!bar) return;
    const e = bar.userData.e;
    const row = (k, v) => `<div class="row-between"><span>${k}</span><strong>${v}</strong></div>`;
    $('[data-card]').innerHTML = `<h4>${e.z}. ${e.name} (${e.symbol})</h4>
      <p class="like">${CATEGORIES[e.category][0]} · group ${e.group}, period ${e.period}</p>
      ${row('Covalent radius', `${e.radius} pm`)}${row('Electronegativity', e.en === null ? '–' : formatNumber(e.en, 2))}${row('1st ionisation energy', `${e.ie} kJ/mol`)}`;
  }

  root.querySelectorAll('[data-prop]').forEach((b) => b.addEventListener('click', () => { state.prop = b.dataset.prop; build(); }));
  root.querySelectorAll('input[name=color]').forEach((r) => r.addEventListener('change', () => { state.color = r.value; build(); }));
  const stopInteract = interact(stage, {
    pick: () => state.bars,
    cursor: 'pointer',
    onClick: (hit) => select(hit.object),
  });

  build();
  return () => {
    stopInteract();
    stage.dispose();
  };
}
