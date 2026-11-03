// Algorithms: Tower of Hanoi and recursion. Solve it yourself by clicking pegs, or watch the recursive solution
// with its call stack beside it: "move n−1 out of the way, move the biggest, move n−1 back on top".
import * as THREE from 'three';
import { createStage, clearGroup, makeLabel } from '../stage.js';
import { hanoiMoves, applyMove, PEG_NAMES } from '../algo/hanoi.js';
import { interact } from '../interact.js';
import { html } from '../ui.js';

const PEG_X = [-3.4, 0, 3.4];
const DISK_H = 0.3;
const LIFT = 3.6;

export function mountHanoi(root) {
  root.innerHTML = html`
    <div class="viewport" data-viewport></div>
    <aside class="panel">
      <h2>Tower of Hanoi</h2>
      <p class="lede">Move the whole tower from A to C. Only one disk at a time, and never a bigger disk on a smaller one. The recursive idea: to move n disks, <b>move n−1 out of the way</b>, move the biggest, then <b>move n−1 back on top</b>. That takes 2ⁿ − 1 moves.</p>

      <label class="slider-row wide"><span>Disks</span><input type="range" min="2" max="7" step="1" value="3" data-n><output data-n-out>3</output></label>
      <div class="btn-row">
        <button class="btn" data-solve>▶ Watch it solve</button>
        <button class="btn secondary" data-reset>Reset</button>
      </div>
      <label class="slider-row wide"><span>Speed</span><input type="range" min="0.5" max="6" step="0.5" value="1.5" data-speed><output data-speed-out>1.5×</output></label>

      <div class="readout">
        <div class="row-between"><span>Moves</span><strong data-moves>0</strong></div>
        <div class="row-between"><span>Fewest possible (2ⁿ − 1)</span><strong data-min>7</strong></div>
      </div>
      <div class="notice" data-msg>Your turn: <b>click a peg</b> to pick up its top disk, then click where it should go.</div>

      <h3>Call stack</h3>
      <ol class="callstack" data-stack><li class="dim">Press “Watch it solve” to see the recursive calls.</li></ol>
    </aside>
  `;

  const $ = (sel) => root.querySelector(sel);
  const stage = createStage($('[data-viewport]'), { cameraPosition: [0, 5, 14.5], axes: false, grid: false });
  stage.controls.target.set(0, 1.2, 0);
  const scene = stage.scene;
  const state = { n: 3, pegs: [], meshes: new Map(), moves: 0, held: null, queue: [], anim: null, solving: false, speed: 1.5 };

  const boardGroup = new THREE.Group();
  scene.add(boardGroup);
  const base = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.25, 2.6), new THREE.MeshStandardMaterial({ color: 0x2a2350, roughness: 0.8 }));
  base.position.y = -0.125;
  scene.add(base);
  const pegs = PEG_X.map((x, i) => {
    const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3, 16), new THREE.MeshStandardMaterial({ color: 0xc4b5fd, emissive: 0x000000 }));
    peg.position.set(x, 1.5, 0);
    peg.userData.peg = i;
    // A wide invisible column around each peg makes it easy to click.
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 3.8, 12), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.set(x, 1.6, 0);
    hit.userData.peg = i;
    scene.add(peg, hit);
    return { peg, hit };
  });
  PEG_X.forEach((x, i) => scene.add(makeLabel(PEG_NAMES[i], new THREE.Vector3(x, -0.1, 1.5), 0xc4b5fd, 'chart-label')));

  const diskColor = (size) => new THREE.Color().setHSL(0.75 - (size / state.n) * 0.45, 0.75, 0.6);
  const restY = (peg, level) => DISK_H / 2 + level * DISK_H;

  function reset() {
    clearGroup(boardGroup);
    state.pegs = [Array.from({ length: state.n }, (_, i) => state.n - i), [], []];
    state.meshes = new Map();
    for (let size = 1; size <= state.n; size++) {
      const r = 0.35 + (size / state.n) * 1.05;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, DISK_H * 0.92, 40), new THREE.MeshStandardMaterial({ color: diskColor(size), roughness: 0.35, metalness: 0.1 }));
      m.position.set(PEG_X[0], restY(0, state.n - size), 0);
      boardGroup.add(m);
      state.meshes.set(size, m);
    }
    Object.assign(state, { moves: 0, held: null, queue: [], anim: null, solving: false });
    $('[data-solve]').textContent = '▶ Watch it solve';
    $('[data-min]').textContent = 2 ** state.n - 1;
    $('[data-moves]').textContent = 0;
    $('[data-stack]').innerHTML = '<li class="dim">Press “Watch it solve” to see the recursive calls.</li>';
    setMsg('Your turn: <b>click a peg</b> to pick up its top disk, then click where it should go.');
    highlight(null);
  }

  const setMsg = (m) => { $('[data-msg]').innerHTML = m; };
  function highlight(peg) {
    pegs.forEach(({ peg: p }, i) => p.material.emissive.setHex(i === peg ? 0x7c3aed : 0x000000));
  }

  // Animate one move: lift, slide across, drop.
  function startMove(from, to, after) {
    const disk = state.pegs[from].at(-1);
    const err = applyMove(state.pegs, from, to);
    if (err) return err;
    const mesh = state.meshes.get(disk);
    const start = mesh.position.clone();
    const end = new THREE.Vector3(PEG_X[to], restY(to, state.pegs[to].length - 1), 0);
    const pts = [start, new THREE.Vector3(start.x, LIFT, 0), new THREE.Vector3(end.x, LIFT, 0), end];
    const path = new THREE.CurvePath();
    for (let i = 0; i < 3; i++) if (pts[i].distanceTo(pts[i + 1]) > 1e-4) path.add(new THREE.LineCurve3(pts[i], pts[i + 1]));
    state.anim = { mesh, path, u: 0, after };
    state.moves += 1;
    $('[data-moves]').textContent = state.moves;
    return null;
  }

  function checkWin() {
    if (state.pegs[2].length !== state.n) return;
    const best = 2 ** state.n - 1;
    setMsg(state.moves === best ? `🎉 Solved in <b>${best}</b> moves, the minimum!` : `Solved in ${state.moves} moves. The minimum is ${best}: can you match it?`);
  }

  function nextAuto() {
    const m = state.queue.shift();
    if (!m) {
      state.solving = false;
      $('[data-solve]').textContent = '▶ Watch it solve';
      checkWin();
      return;
    }
    $('[data-stack]').innerHTML = m.stack.map((call, i) => `<li style="--depth:${i}" class="${i === m.stack.length - 1 ? 'current' : ''}">${call}</li>`).join('');
    setMsg(`Move disk <b>${m.disk}</b> from ${PEG_NAMES[m.from]} to ${PEG_NAMES[m.to]}.`);
    startMove(m.from, m.to, nextAuto);
  }

  $('[data-n]').addEventListener('input', (e) => {
    state.n = Number(e.target.value);
    $('[data-n-out]').textContent = state.n;
    reset();
  });
  $('[data-speed]').addEventListener('input', (e) => {
    state.speed = Number(e.target.value);
    $('[data-speed-out]').textContent = `${state.speed}×`;
  });
  $('[data-reset]').addEventListener('click', reset);
  $('[data-solve]').addEventListener('click', () => {
    if (state.solving) { // pause
      state.solving = false;
      $('[data-solve]').textContent = '▶ Continue';
      return;
    }
    if (!state.queue.length) {
      reset();
      state.queue = hanoiMoves(state.n);
    }
    state.solving = true;
    $('[data-solve]').textContent = '❚❚ Pause';
    if (!state.anim) nextAuto();
  });

  const stopInteract = interact(stage, {
    pick: () => pegs.map((p) => p.hit),
    cursor: 'pointer',
    onClick: (hit) => {
      if (state.solving || state.anim || state.queue.length) return;
      const peg = hit.object.userData.peg;
      if (state.held === null) {
        if (!state.pegs[peg].length) { setMsg(`Peg ${PEG_NAMES[peg]} is empty. Pick a peg with disks.`); return; }
        state.held = peg;
        highlight(peg);
        setMsg(`Holding disk <b>${state.pegs[peg].at(-1)}</b>. Click the peg to put it on.`);
        return;
      }
      const from = state.held;
      state.held = null;
      highlight(null);
      if (from === peg) { setMsg('Put back. Click a peg to pick up its top disk.'); return; }
      const err = startMove(from, peg, checkWin);
      setMsg(err ? `<span class="warn-text">Not allowed:</span> ${err}` : 'Nice. Keep going!');
    },
  });

  stage.onFrame((dt) => {
    const a = state.anim;
    if (!a || (!state.solving && state.queue.length)) return;
    a.u = Math.min(1, a.u + (dt * state.speed * 4) / a.path.getLength());
    const e = a.u < 0.5 ? 2 * a.u * a.u : 1 - (-2 * a.u + 2) ** 2 / 2; // ease in-out
    a.mesh.position.copy(a.path.getPointAt(e));
    if (a.u >= 1) {
      state.anim = null;
      a.after?.();
    }
  });

  reset();
  return () => {
    stopInteract();
    stage.dispose();
  };
}
