// Civil: a truss bridge. Every member is only pushed (compression, red) or pulled (tension, blue); its thickness
// shows how much. Drag the truck along the deck and watch the forces move: solved by the method of joints.
import * as THREE from 'three';
import { createStage, makeLabel, clearGroup } from '../stage.js';
import { solveTruss, prattTruss } from '../civil/truss.js';
import { interact, rayOnPlane } from '../interact.js';
import { html, formatNumber } from '../ui.js';

const DEPTH = 2.2; // distance between the two side trusses
const TENSION = new THREE.Color(0x3b82f6);
const COMPRESSION = new THREE.Color(0xef4444);

export function mountTruss(root) {
  root.innerHTML = html`
    <div class="viewport" data-viewport></div>
    <aside class="panel">
      <h2>Truss Bridge</h2>
      <p class="lede">A truss is made of straight members pinned into <b>triangles</b>, and a triangle can't change shape. So every member is simply <b>pulled</b> (tension, blue) or <b>pushed</b> (compression, red), never bent. Engineers find each force by balancing the forces at every joint (the <b>method of joints</b>).</p>

      <label class="slider-row wide"><span>Panels</span><input type="range" min="4" max="10" step="2" value="6" data-panels><output data-panels-out>6</output></label>
      <label class="slider-row wide"><span>Height</span><input type="range" min="1" max="4" step="0.25" value="2" data-h><output data-h-out>2 m</output></label>
      <label class="slider-row wide"><span>Truck load</span><input type="range" min="10" max="200" step="10" value="100" data-P><output data-P-out>100 kN</output></label>
      <p class="hint"><b>Drag the truck</b> along the deck, or click a member to see its force.</p>

      <div class="readout" data-out></div>
      <div class="organelle-card" data-card><p class="dim">Click a member.</p></div>
      <div class="notice" data-msg></div>
    </aside>
  `;

  const $ = (sel) => root.querySelector(sel);
  const stage = createStage($('[data-viewport]'), { cameraPosition: [-4, 6, 13], axes: false, grid: false });
  const group = new THREE.Group();
  stage.scene.add(group);
  const state = { panels: 6, w: 2, h: 2, P: 100, at: 3, members: [], truss: null, selected: null };
  const truck = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 1.2), new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 }));
  body.position.y = 0.45;
  const cab = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 1.1), new THREE.MeshStandardMaterial({ color: 0xf97316 }));
  cab.position.set(0.85, 0.4, 0);
  truck.add(body, cab);
  stage.scene.add(truck);

  function build() {
    clearGroup(group);
    const t = prattTruss(state.panels, state.w, state.h);
    state.truss = t;
    const span = state.panels * state.w;
    const x0 = -span / 2;
    state.at = Math.min(state.panels - 1, Math.max(1, state.at));
    // The truck's weight is shared by the two side trusses; each carries half at the joint under it.
    const r = solveTruss({ ...t, loads: [{ node: state.at, fy: -state.P / 2 }] });
    const maxF = Math.max(...r.forces.map(Math.abs), 1e-6);
    const toW = ([x, y], z) => new THREE.Vector3(x0 + x, y, z);
    state.members = [];
    for (const z of [-DEPTH / 2, DEPTH / 2]) {
      t.members.forEach(([i, j], k) => {
        const a = toW(t.nodes[i], z);
        const b = toW(t.nodes[j], z);
        const F = r.forces[k];
        const thick = 0.05 + 0.13 * (Math.abs(F) / maxF);
        const color = Math.abs(F) < 1e-6 * maxF ? new THREE.Color(0x6b7280) : (F > 0 ? TENSION : COMPRESSION).clone().lerp(new THREE.Color(0x6b7280), 0.6 * (1 - Math.abs(F) / maxF));
        const m = new THREE.Mesh(new THREE.CylinderGeometry(thick, thick, a.distanceTo(b), 10), new THREE.MeshStandardMaterial({ color, roughness: 0.4 }));
        m.position.copy(a).add(b).multiplyScalar(0.5);
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
        m.userData = { k, F, color: color.getHex(), len: a.distanceTo(b) };
        group.add(m);
        state.members.push(m);
      });
      t.nodes.forEach((n) => {
        const j = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), new THREE.MeshStandardMaterial({ color: 0xe5e7eb }));
        j.position.copy(toW(n, z));
        group.add(j);
      });
    }
    // Deck, cross-beams and supports.
    const deck = new THREE.Mesh(new THREE.BoxGeometry(span, 0.08, DEPTH), new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.8 }));
    deck.position.y = -0.06;
    deck.userData.deck = true;
    group.add(deck);
    state.deck = deck;
    for (const x of [x0, x0 + span]) {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.4, DEPTH + 0.6), new THREE.MeshStandardMaterial({ color: 0x78716c }));
      pier.position.set(x, -0.8, 0);
      group.add(pier);
    }
    group.add(makeLabel('pin', new THREE.Vector3(x0, -1.7, DEPTH / 2 + 0.4), 0x9b98c4, 'idx-label'), makeLabel('roller', new THREE.Vector3(x0 + span, -1.7, DEPTH / 2 + 0.4), 0x9b98c4, 'idx-label'));
    truck.position.set(x0 + state.at * state.w, 0, 0);
    stage.controls.target.set(0, state.h / 2, 0);

    const ry = r.reactions.filter((x) => x.dir === 'y');
    const maxT = Math.max(0, ...r.forces);
    const maxC = Math.min(0, ...r.forces);
    const row = (k, v) => `<div class="row-between"><span>${k}</span><strong>${v}</strong></div>`;
    $('[data-out]').innerHTML = [
      row('Support reactions (both trusses)', `${formatNumber(2 * ry[0].value, 1)} kN + ${formatNumber(2 * ry[1].value, 1)} kN`),
      row('Biggest tension', `<span style="color:#60a5fa">${formatNumber(maxT, 1)} kN</span>`),
      row('Biggest compression', `<span style="color:#f87171">${formatNumber(-maxC, 1)} kN</span>`),
    ].join('');
    const zero = r.forces.filter((f) => Math.abs(f) < 1e-6 * maxF).length;
    $('[data-msg]').innerHTML = `Top chord: <b>compression</b> (pushed together). Bottom chord: <b>tension</b> (pulled apart), just like a bending beam. The nearer support takes more of the truck's weight.${zero ? ` ${zero} member${zero > 1 ? 's carry' : ' carries'} <b>zero force</b> for this load (grey): still needed when the truck moves.` : ''} A taller truss means smaller chord forces.`;
    if (state.selected !== null) showMember(state.members[state.selected]);
  }

  function showMember(m) {
    state.selected = state.members.indexOf(m);
    state.members.forEach((x) => x.material.emissive.setHex(x === m ? 0x444400 : 0x000000));
    const F = m.userData.F;
    const kind = Math.abs(F) < 1e-6 ? 'no force' : F > 0 ? '<span style="color:#60a5fa">tension</span> (being pulled)' : '<span style="color:#f87171">compression</span> (being pushed)';
    $('[data-card]').innerHTML = `<h4>Member ${m.userData.k + 1}</h4><p>${formatNumber(Math.abs(F), 1)} kN, ${kind}</p><small>Length ${formatNumber(m.userData.len, 2)} m${F < 0 ? '. Long members in compression can buckle, so they are made thicker.' : ''}</small>`;
  }

  const bind = (sel, key, fmt) => $(sel).addEventListener('input', (e) => {
    state[key] = Number(e.target.value);
    $(sel.replace(']', '-out]')).textContent = fmt(state[key]);
    state.selected = null;
    build();
  });
  bind('[data-panels]', 'panels', (v) => v);
  bind('[data-h]', 'h', (v) => `${v} m`);
  bind('[data-P]', 'P', (v) => `${v} kN`);

  // Drag the truck along the deck; it snaps to the joints (loads are applied at joints in a truss).
  const deckPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const stopInteract = interact(stage, {
    pick: () => [body, cab, ...state.members],
    onDown: (hit) => {
      if (hit.object !== body && hit.object !== cab) return null;
      return {
        move: (ray) => {
          const p = rayOnPlane(ray, deckPlane);
          if (!p) return;
          const at = Math.round((p.x + (state.panels * state.w) / 2) / state.w);
          if (at !== state.at && at >= 1 && at <= state.panels - 1) {
            state.at = at;
            build();
          }
        },
      };
    },
    onClick: (hit) => { if (state.members.includes(hit.object)) showMember(hit.object); },
  });

  build();
  stage.saveHome();
  return () => {
    stopInteract();
    stage.dispose();
  };
}
