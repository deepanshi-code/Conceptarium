// Physics: projectile motion. Aim a cannon, fire, and watch the velocity split into a horizontal part that never
// changes and a vertical part that gravity shrinks, flips and grows. Old throws stay as faint arcs to compare.
import * as THREE from 'three';
import { createStage, makeLabel, clearGroup, setArrow } from '../stage.js';
import { PLANETS, trajectory } from '../phys/projectile.js';
import { interact, screenDrag, rayOnPlane } from '../interact.js';
import { html, formatNumber } from '../ui.js';

const LEFT = -8; // world x of the cannon
const SPAN = 16; // world length of the longest possible throw
const V_MAX = 30;
const TRAIL_COLORS = [0xa78bfa, 0x22d3ee, 0xf472b6, 0xfacc15];

export function mountProjectile(root) {
  root.innerHTML = html`
    <div class="viewport" data-viewport></div>
    <aside class="panel">
      <h2>Projectile Motion</h2>
      <p class="lede">Once launched, only gravity acts (without air). So the <b>horizontal speed vₓ never changes</b>, while the <b>vertical speed v_y</b> drops by g every second, hits zero at the top, and grows again on the way down. Range R = v² sin 2θ / g.</p>

      <h3>Planet</h3>
      <div class="tabs" data-planets>${Object.entries(PLANETS).map(([k, p]) => `<button data-planet="${k}">${p.name}</button>`).join('')}</div>

      <h3>Launch</h3>
      <label class="slider-row wide"><span>Angle θ</span><input type="range" min="5" max="85" step="1" value="45" data-angle><output data-angle-out>45°</output></label>
      <label class="slider-row wide"><span>Speed v</span><input type="range" min="5" max="${V_MAX}" step="0.5" value="20" data-v><output data-v-out>20 m/s</output></label>
      <label class="slider-row wide"><span>Cliff height</span><input type="range" min="0" max="30" step="1" value="0" data-h><output data-h-out>0 m</output></label>
      <label class="check"><input type="checkbox" data-drag> Air resistance</label>
      <div class="btn-row">
        <button class="btn" data-fire>🚀 Fire</button>
        <button class="btn secondary" data-clear>Clear arcs</button>
      </div>

      <h3>Last throw</h3>
      <div class="readout" data-result><p class="hint">Press Fire.</p></div>
      <p class="hint" data-insight></p>
    </aside>
  `;

  const $ = (sel) => root.querySelector(sel);
  const stage = createStage($('[data-viewport]'), { cameraPosition: [0.5, 5.5, 21], axes: false, grid: false });
  stage.controls.target.set(0.5, 2.6, 0);
  const { scene } = stage;
  const state = { planet: 'earth', angle: 45, v: 20, h0: 0, drag: false, target: 0.6, flight: null, throws: [] };
  let scale = 1; // world units per metre

  // Ground with distance labels, rebuilt when the scale changes.
  const ground = new THREE.Group();
  scene.add(ground);
  const arcs = new THREE.Group();
  scene.add(arcs);

  // Cannon: a platform (for cliff launches), a base and a barrel that turns to the angle.
  const platform = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1, 1.4), new THREE.MeshStandardMaterial({ color: 0x3b3570, roughness: 0.8 }));
  platform.geometry.translate(0, 0.5, 0);
  const cannon = new THREE.Group();
  const base = new THREE.Mesh(new THREE.SphereGeometry(0.4, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x6d5bd0, metalness: 0.4, roughness: 0.4 }));
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 1.3, 20), new THREE.MeshStandardMaterial({ color: 0xc4b5fd, metalness: 0.5, roughness: 0.3, emissive: 0x2a1a66 }));
  barrel.geometry.rotateZ(-Math.PI / 2);
  barrel.geometry.translate(0.65, 0, 0);
  const pivot = new THREE.Group();
  pivot.add(barrel);
  cannon.add(base, pivot);
  scene.add(platform, cannon);

  const flag = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 8), new THREE.MeshStandardMaterial({ color: 0xffffff }));
  pole.position.y = 0.7;
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.38), new THREE.MeshStandardMaterial({ color: 0xff4d6d, side: THREE.DoubleSide }));
  cloth.position.set(0.3, 1.2, 0);
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.04, 32), new THREE.MeshStandardMaterial({ color: 0xff4d6d, transparent: true, opacity: 0.5 }));
  flag.add(pole, cloth, pad);
  const flagLabel = makeLabel('', new THREE.Vector3(0, 1.75, 0), 0xff8fa3, 'chart-label');
  flag.add(flagLabel);
  scene.add(flag);

  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 14), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x666666 }));
  ball.visible = false;
  scene.add(ball);
  const arrows = {
    vx: new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1, 0xff5c5c),
    vy: new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 1, 0x5cdb7f),
    v: new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1, 0xffffff),
  };
  Object.values(arrows).forEach((a) => { a.visible = false; scene.add(a); });
  const arrowLabels = {
    vx: makeLabel('vₓ', new THREE.Vector3(), 0xff8a8a, 'chart-label'),
    vy: makeLabel('v_y', new THREE.Vector3(), 0x8af0a8, 'chart-label'),
  };
  Object.values(arrowLabels).forEach((l) => { l.visible = false; scene.add(l); });

  const g = () => PLANETS[state.planet].g;
  const toWorld = (x, y) => new THREE.Vector3(LEFT + x * scale, y * scale, 0);

  function rebuildGround() {
    scale = SPAN / ((V_MAX * V_MAX) / g());
    clearGroup(ground);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(SPAN + 6, 6), new THREE.MeshStandardMaterial({ color: 0x14183a, roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(LEFT + SPAN / 2, 0, 0);
    ground.add(floor);
    const maxM = SPAN / scale;
    const step = [1, 2, 5, 10, 20, 50, 100, 200].find((s) => maxM / s <= 10);
    for (let m = 0; m <= maxM + 1e-6; m += step) {
      const tick = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.01, 0.5), new THREE.MeshBasicMaterial({ color: 0x5b5f9a }));
      tick.position.copy(toWorld(m, 0)).setZ(1.2);
      ground.add(tick, makeLabel(`${m} m`, toWorld(m, 0).setZ(1.7), 0x8a8fb8, 'chart-label'));
    }
    clearArcs();
  }

  function placeCannon() {
    platform.visible = state.h0 > 0;
    platform.scale.y = Math.max(0.001, state.h0 * scale);
    platform.position.set(LEFT, 0, 0);
    cannon.position.copy(toWorld(0, state.h0));
    pivot.rotation.z = THREE.MathUtils.degToRad(state.angle);
    flag.position.copy(toWorld(state.target * SPAN / scale, 0));
    flagLabel.element.textContent = `target ${formatNumber(state.target * SPAN / scale, 1)} m`;
  }

  function fire() {
    const r = trajectory({ v: state.v, angle: state.angle, g: g(), h0: state.h0, k: state.drag ? 0.012 : 0 });
    const color = TRAIL_COLORS[state.throws.length % TRAIL_COLORS.length];
    const line = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color }));
    arcs.add(line);
    state.throws.push({ r, line, angle: state.angle });
    if (state.throws.length > 4) {
      const old = state.throws.shift();
      arcs.remove(old.line);
      old.line.geometry.dispose();
      old.line.material.dispose();
    }
    // Play the flight in about 2.5 s whatever its real duration (shown in the readout).
    state.flight = { r, line, clock: 0, playback: r.time / 2.5 };
    ball.visible = true;
  }

  function clearArcs() {
    clearGroup(arcs);
    state.throws = [];
    state.flight = null;
    ball.visible = false;
    Object.values(arrows).forEach((a) => { a.visible = false; });
    Object.values(arrowLabels).forEach((l) => { l.visible = false; });
  }

  function showResult(r) {
    const target = state.target * SPAN / scale;
    const miss = r.range - target;
    const hit = Math.abs(miss) < 0.03 * SPAN / scale;
    $('[data-result]').innerHTML = `
      <div class="row-between"><span>Range</span><strong>${formatNumber(r.range, 1)} m</strong></div>
      <div class="row-between"><span>Highest point</span><strong>${formatNumber(r.peak, 1)} m</strong></div>
      <div class="row-between"><span>Time in the air</span><strong>${formatNumber(r.time, 2)} s</strong></div>
      <div class="row-between"><span>Target</span><strong>${hit ? '<span class="ok-text">🎯 Hit!</span>' : `${miss > 0 ? 'long' : 'short'} by ${formatNumber(Math.abs(miss), 1)} m`}</strong></div>`;
    const sameRange = state.throws.length >= 2 && !state.drag && state.h0 === 0;
    $('[data-insight]').innerHTML = state.drag ? 'With air resistance the arc is no longer symmetric: it comes down steeper than it went up, and the best angle drops below 45°.'
      : state.h0 > 0 ? 'From a cliff, the best angle is <b>less than 45°</b>: the ball already has extra time to fall.'
        : sameRange ? 'Try <b>30°</b> then <b>60°</b>: same range! Angles that add up to 90° land in the same place.'
          : 'Watch the red arrow vₓ: it never changes. Only the green v_y does.';
  }

  root.querySelectorAll('[data-planet]').forEach((b) => b.addEventListener('click', () => {
    state.planet = b.dataset.planet;
    root.querySelectorAll('[data-planet]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    rebuildGround();
    placeCannon();
  }));
  const bind = (sel, key, fmt) => $(sel).addEventListener('input', (e) => {
    state[key] = Number(e.target.value);
    $(`${sel}-out`).textContent = fmt(state[key]);
    placeCannon();
  });
  bind('[data-angle]', 'angle', (v) => `${v}°`);
  bind('[data-v]', 'v', (v) => `${v} m/s`);
  bind('[data-h]', 'h0', (v) => `${v} m`);
  $('[data-drag]').addEventListener('change', (e) => { state.drag = e.target.checked; });
  $('[data-fire]').addEventListener('click', fire);
  $('[data-clear]').addEventListener('click', clearArcs);

  // Drag the barrel up/down to aim, or drag the flag along the ground. Clicking the cannon fires.
  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const stopInteract = interact(stage, {
    pick: () => [barrel, base, pole, cloth, pad],
    onDown: (hit, e) => {
      if (hit.object === barrel) {
        const start = state.angle;
        return screenDrag(e, (_dx, dy) => {
          state.angle = THREE.MathUtils.clamp(Math.round(start - dy / 3), 5, 85);
          $('[data-angle]').value = state.angle;
          $('[data-angle-out]').textContent = `${state.angle}°`;
          placeCannon();
        });
      }
      if (hit.object === base) return null;
      return {
        move: (ray) => {
          const p = rayOnPlane(ray, floorPlane);
          if (p) state.target = THREE.MathUtils.clamp((p.x - LEFT) / SPAN, 0.05, 1.05);
          placeCannon();
        },
      };
    },
    onClick: (hit) => { if (hit.object === base) fire(); },
  });

  stage.onFrame((dt) => {
    const f = state.flight;
    if (!f) return;
    f.clock = Math.min(f.r.time, f.clock + dt * f.playback);
    const pts = f.r.points;
    let i = pts.findIndex((p) => p.t >= f.clock);
    if (i < 0) i = pts.length - 1;
    const p = pts[i];
    const shown = pts.filter((_, k) => k <= i && (k % 4 === 0 || k === i));
    f.line.geometry.setFromPoints(shown.map((q) => toWorld(q.x, q.y)));
    const at = toWorld(p.x, p.y);
    ball.position.copy(at);
    // Velocity arrows, scaled so the launch speed is about 1.6 world units long.
    const k = 1.6 / state.v;
    arrows.vx.position.copy(at);
    arrows.vy.position.copy(at);
    arrows.v.position.copy(at);
    setArrow(arrows.vx, new THREE.Vector3(p.vx * k, 0, 0));
    setArrow(arrows.vy, new THREE.Vector3(0, p.vy * k, 0));
    setArrow(arrows.v, new THREE.Vector3(p.vx * k, p.vy * k, 0));
    arrowLabels.vx.visible = arrowLabels.vy.visible = true;
    arrowLabels.vx.position.copy(at).add(new THREE.Vector3(p.vx * k + 0.25, 0, 0));
    arrowLabels.vy.position.copy(at).add(new THREE.Vector3(0, p.vy * k + (p.vy >= 0 ? 0.25 : -0.25), 0));
    if (f.clock >= f.r.time) {
      showResult(f.r);
      state.flight = null;
    }
  });

  root.querySelector('[data-planet="earth"]').setAttribute('aria-selected', 'true');
  rebuildGround();
  placeCannon();
  return () => {
    stopInteract();
    stage.dispose();
  };
}
