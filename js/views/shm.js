// Physics: simple harmonic motion. A mass on a spring bobs exactly like the shadow of a point going round a circle,
// and its position traced against time is a sine wave. A pendulum does the same, but only for small swings.
import * as THREE from 'three';
import { createStage, makeLabel } from '../stage.js';
import { springPeriod, smallAnglePeriod, pendulum, truePeriod } from '../phys/shm.js';
import { interact, screenDrag } from '../interact.js';
import { html, formatNumber } from '../ui.js';

const TRAIL = 420;
const PEN_X = 1.6; // where the pen writes on the graph
const DX = 0.022; // graph units per sample
const SCALE = 1.6; // world units per metre (spring) / per radian-ish (pendulum)

export function mountShm(root) {
  root.innerHTML = html`
    <div class="viewport" data-viewport></div>
    <aside class="panel">
      <h2>Simple Harmonic Motion</h2>
      <p class="lede">When the pull back is proportional to how far something is pushed (F = −kx), it oscillates in <b>SHM</b>. Its position is a sine wave in time, exactly the <b>shadow of a point moving round a circle</b>. A pendulum is SHM only for small swings.</p>

      <div class="segmented" role="radiogroup">
        <label><input type="radio" name="sys" value="spring" checked> Spring</label>
        <label><input type="radio" name="sys" value="pendulum"> Pendulum</label>
      </div>

      <div data-spring-controls>
        <label class="slider-row wide"><span>Mass m</span><input type="range" min="0.2" max="3" step="0.1" value="1" data-m><output data-m-out>1 kg</output></label>
        <label class="slider-row wide"><span>Stiffness k</span><input type="range" min="5" max="80" step="1" value="20" data-k><output data-k-out>20 N/m</output></label>
      </div>
      <div data-pendulum-controls hidden>
        <label class="slider-row wide"><span>Length L</span><input type="range" min="0.3" max="2.5" step="0.05" value="1" data-L><output data-L-out>1 m</output></label>
        <label class="slider-row wide"><span>Swing θ₀</span><input type="range" min="5" max="85" step="1" value="15" data-th><output data-th-out>15°</output></label>
        <label class="check"><input type="checkbox" data-moon> On the Moon (g = 1.62)</label>
      </div>
      <label class="check"><input type="checkbox" data-circle checked> Show the reference circle</label>
      <p class="hint"><b>Drag the mass</b> to pull it, then let go.</p>

      <h3>Period</h3>
      <div class="readout" data-period></div>
      <p class="hint" data-insight></p>
    </aside>
  `;

  const $ = (sel) => root.querySelector(sel);
  const stage = createStage($('[data-viewport]'), { cameraPosition: [1.5, 0.5, 11], axes: false, grid: false });
  stage.controls.target.set(1.5, -0.3, 0);
  const scene = stage.scene;
  const state = { sys: 'spring', m: 1, k: 20, A: 0.6, L: 1, th0: 15, moon: false, t: 0, held: false, circle: true, trail: new Float32Array(TRAIL), times: new Float32Array(TRAIL), filled: 0, pend: null, sign: 1 };
  const g = () => (state.moon ? 1.62 : 9.81);

  // Spring system: ceiling, coil, mass.
  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.8), new THREE.MeshStandardMaterial({ color: 0x4a4580 }));
  ceiling.position.set(-1.2, 2.6, 0);
  const coilGeom = new THREE.BufferGeometry();
  const coil = new THREE.Line(coilGeom, new THREE.LineBasicMaterial({ color: 0xc4b5fd }));
  const mass = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.7), new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35, emissive: 0x3a2a00 }));
  const springGroup = new THREE.Group();
  springGroup.add(ceiling, coil, mass);
  scene.add(springGroup);

  // Pendulum: pivot, rod, bob.
  const pivot = new THREE.Group();
  pivot.position.set(-1.2, 2.6, 0);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 8), new THREE.MeshStandardMaterial({ color: 0xc4b5fd }));
  const bob = new THREE.Mesh(new THREE.SphereGeometry(0.28, 24, 16), new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35, emissive: 0x3a2a00 }));
  pivot.add(rod, bob);
  scene.add(pivot);

  // Reference circle: a point going round at the same ω; its height matches the mass.
  const circleGroup = new THREE.Group();
  circleGroup.position.set(-3.6, 0, 0);
  const ring = new THREE.LineLoop(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x5eead4, transparent: true, opacity: 0.6 }));
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), new THREE.MeshBasicMaterial({ color: 0x5eead4 }));
  const radius = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x5eead4 }));
  const link = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: 0x5eead4, dashSize: 0.1, gapSize: 0.07 }));
  circleGroup.add(ring, dot, radius);
  scene.add(circleGroup, link);

  // Graph: newest sample at the pen, older samples drift right.
  const graphGeom = new THREE.BufferGeometry();
  graphGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3));
  const graph = new THREE.Line(graphGeom, new THREE.LineBasicMaterial({ color: 0xfacc15 }));
  graph.frustumCulled = false;
  const ideal = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.08, gapSize: 0.08, transparent: true, opacity: 0.45 }));
  ideal.frustumCulled = false;
  const axis = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(PEN_X, 0, -0.01), new THREE.Vector3(PEN_X + TRAIL * DX, 0, -0.01)]), new THREE.LineBasicMaterial({ color: 0x3a3f6b }));
  const penLink = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: 0xfacc15, dashSize: 0.1, gapSize: 0.07 }));
  scene.add(graph, ideal, axis, penLink, makeLabel('time →', new THREE.Vector3(PEN_X + TRAIL * DX - 0.4, -0.25, 0), 0x8a8fb8, 'chart-label'));

  // Position x(t) in world units (spring: displacement; pendulum: angle drawn as its horizontal swing).
  const omega = () => (state.sys === 'spring' ? Math.sqrt(state.k / state.m) : Math.sqrt(g() / state.L));
  const restY = () => 2.6 - 2.2; // spring equilibrium height of the mass centre

  function reset() {
    state.t = 0;
    state.filled = 0;
    state.pend = pendulum(state.L, g(), state.sign * THREE.MathUtils.degToRad(state.th0));
    springGroup.visible = state.sys === 'spring';
    pivot.visible = state.sys === 'pendulum';
    const r = state.sys === 'spring' ? state.A * SCALE : THREE.MathUtils.degToRad(state.th0) * SCALE;
    ring.geometry.setFromPoints(Array.from({ length: 64 }, (_, i) => new THREE.Vector3(Math.cos((i / 64) * Math.PI * 2) * r, Math.sin((i / 64) * Math.PI * 2) * r, 0)));
    circleGroup.position.y = state.sys === 'spring' ? restY() : 0;
    graph.position.y = state.sys === 'spring' ? restY() : 0;
    ideal.position.y = graph.position.y;
    axis.position.y = graph.position.y;
    rod.scale.y = state.L * 1.4;
    rod.position.y = -(state.L * 1.4) / 2;
    bob.position.y = -state.L * 1.4;
    updateReadout();
  }

  function updateReadout() {
    if (state.sys === 'spring') {
      const T = springPeriod(state.m, state.k);
      $('[data-period]').innerHTML = `<div class="row-between"><span>T = 2π√(m/k)</span><strong>${formatNumber(T, 2)} s</strong></div>
        <div class="row-between"><span>Does the swing size change T?</span><strong>No</strong></div>`;
      $('[data-insight]').innerHTML = 'Heavier mass → slower. Stiffer spring → faster. Pull it further: it swings wider, but the period stays the same.';
    } else {
      const T0 = smallAnglePeriod(state.L, g());
      const T = truePeriod(state.L, g(), THREE.MathUtils.degToRad(state.th0), 5e-4);
      const extra = (T / T0 - 1) * 100;
      $('[data-period]').innerHTML = `<div class="row-between"><span>Formula 2π√(L/g)</span><strong>${formatNumber(T0, 2)} s</strong></div>
        <div class="row-between"><span>Real period at ${state.th0}°</span><strong>${formatNumber(T, 2)} s <small>(+${formatNumber(extra, 1)}%)</small></strong></div>`;
      $('[data-insight]').innerHTML = state.th0 > 40
        ? 'Big swing: the yellow trace falls behind the dashed sine. The formula only holds for small angles (sin θ ≈ θ).'
        : 'Small swing: the real motion matches the dashed ideal sine. Try 70° and watch them drift apart.';
    }
  }

  function writeTrail(x) {
    state.trail.copyWithin(1, 0);
    state.trail[0] = x;
    state.times.copyWithin(1, 0);
    state.times[0] = state.t;
    state.filled = Math.min(TRAIL, state.filled + 1);
    const pos = graphGeom.attributes.position;
    for (let i = 0; i < TRAIL; i++) pos.setXYZ(i, PEN_X + i * DX, state.trail[Math.min(i, state.filled - 1)], 0);
    pos.needsUpdate = true;
    graphGeom.setDrawRange(0, state.filled);
    // Ideal sine (dashed) for the pendulum, so the large-angle drift is visible.
    if (state.sys === 'pendulum') {
      const w = omega();
      const amp = state.sign * THREE.MathUtils.degToRad(state.th0) * SCALE;
      ideal.visible = true;
      ideal.geometry.setFromPoints(Array.from({ length: state.filled }, (_, i) => new THREE.Vector3(PEN_X + i * DX, amp * Math.cos(w * state.times[i]), 0)));
      ideal.computeLineDistances();
    } else ideal.visible = false;
  }

  function sync(x, phase) {
    // Mass / bob
    if (state.sys === 'spring') {
      const y = restY() + x;
      mass.position.set(-1.2, y, 0);
      const top = 2.54;
      const bottom = y + 0.28;
      coilGeom.setFromPoints(Array.from({ length: 121 }, (_, i) => {
        const f = i / 120;
        const wiggle = i < 6 || i > 114 ? 0 : Math.sin(f * Math.PI * 24) * 0.22;
        return new THREE.Vector3(-1.2 + wiggle, top + (bottom - top) * f, Math.cos(f * Math.PI * 24) * 0.12 * (wiggle ? 1 : 0));
      }));
    } else {
      pivot.rotation.z = x / SCALE;
    }
    // Reference circle dot: angle φ = ωt (so its height is A cos ωt, like the mass).
    const r = state.sys === 'spring' ? state.A * SCALE : THREE.MathUtils.degToRad(state.th0) * SCALE;
    const dp = new THREE.Vector3(Math.sin(phase) * r, Math.cos(phase) * r, 0);
    dot.position.copy(dp);
    radius.geometry.setFromPoints([new THREE.Vector3(), dp]);
    const objY = state.sys === 'spring' ? restY() + x : circleGroup.position.y + x;
    link.visible = circleGroup.visible = state.circle && state.sys === 'spring';
    link.geometry.setFromPoints([dp.clone().add(circleGroup.position), new THREE.Vector3(-1.6, objY, 0)]);
    link.computeLineDistances();
    const penY = graph.position.y + x;
    const from = state.sys === 'spring' ? new THREE.Vector3(-0.85, penY, 0) : bob.getWorldPosition(new THREE.Vector3());
    penLink.geometry.setFromPoints([from, new THREE.Vector3(PEN_X, penY, 0)]);
    penLink.computeLineDistances();
  }

  root.querySelectorAll('input[name=sys]').forEach((r) => r.addEventListener('change', () => {
    state.sys = r.value;
    $('[data-spring-controls]').hidden = state.sys !== 'spring';
    $('[data-pendulum-controls]').hidden = state.sys !== 'pendulum';
    reset();
  }));
  const bind = (sel, key, fmt) => $(sel).addEventListener('input', (e) => {
    state[key] = Number(e.target.value);
    $(sel.replace(']', '-out]')).textContent = fmt(state[key]);
    reset();
  });
  bind('[data-m]', 'm', (v) => `${v} kg`);
  bind('[data-k]', 'k', (v) => `${v} N/m`);
  bind('[data-L]', 'L', (v) => `${v} m`);
  bind('[data-th]', 'th0', (v) => `${v}°`);
  $('[data-moon]').addEventListener('change', (e) => { state.moon = e.target.checked; reset(); });
  $('[data-circle]').addEventListener('change', (e) => { state.circle = e.target.checked; });

  // Drag the mass (or bob) to set the amplitude; releasing starts the motion from rest there.
  const stopInteract = interact(stage, {
    pick: () => [state.sys === 'spring' ? mass : bob],
    onDown: (_hit, e) => {
      state.held = true;
      const startA = state.A;
      const startTh = state.th0;
      return {
        ...screenDrag(e, (dx, dy) => {
          if (state.sys === 'spring') {
            state.A = THREE.MathUtils.clamp(startA - dy / 140, -1.1, 1.1);
            state.t = 0;
            sync(state.A * SCALE, 0);
          } else {
            state.th0 = THREE.MathUtils.clamp(Math.round(state.sign * startTh + dx / 4), -85, 85);
            pivot.rotation.z = THREE.MathUtils.degToRad(state.th0);
          }
        }),
        end: () => {
          state.held = false;
          // Released from rest wherever it was let go: x = A cos ωt with A possibly negative.
          if (state.sys === 'pendulum') {
            state.sign = state.th0 < 0 ? -1 : 1;
            state.th0 = Math.max(5, Math.abs(state.th0));
            $('[data-th]').value = state.th0;
            $('[data-th-out]').textContent = `${state.th0}°`;
          }
          reset();
        },
      };
    },
  });

  stage.onFrame((dt) => {
    if (state.held) return;
    const steps = 4;
    for (let i = 0; i < steps; i++) {
      state.t += dt / steps;
      if (state.sys === 'pendulum') state.pend.step(dt / steps);
    }
    const phase = omega() * state.t;
    const x = state.sys === 'spring' ? state.A * SCALE * Math.cos(phase) : state.pend.angle * SCALE;
    // The reference circle starts where the motion starts (top for +A, bottom for −A).
    const shown = state.sys === 'pendulum' && state.sign < 0 ? phase + Math.PI : phase;
    sync(x, shown);
    writeTrail(x);
  });

  reset();
  return () => {
    stopInteract();
    stage.dispose();
  };
}
