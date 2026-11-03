// Data structures: stack (last in, first out) as a tube you drop plates into, and queue (first in, first out)
// as a conveyor. A third mode uses the stack to check balanced brackets, its classic application.
import * as THREE from 'three';
import { createStage, makeLabel, clearGroup } from '../stage.js';
import { checkBrackets } from '../ds/brackets.js';
import { interact } from '../interact.js';
import { html } from '../ui.js';

const PALETTE = [0xa78bfa, 0x22d3ee, 0xf472b6, 0xfacc15, 0x4ade80, 0xfb923c];
const MAX = 9;
const TEXT = {
  stack: { add: 'Push', remove: 'Pop', idea: '<b>LIFO</b>: last in, first out. You can only touch the <b>top</b>, like a stack of plates. Used for undo, the browser back button and function calls.' },
  queue: { add: 'Enqueue', remove: 'Dequeue', idea: '<b>FIFO</b>: first in, first out. Join at the <b>rear</b>, leave from the <b>front</b>, like a ticket line. Used for printer jobs, CPU scheduling and BFS.' },
};

export function mountStackQueue(root) {
  root.innerHTML = html`
    <div class="viewport" data-viewport></div>
    <aside class="panel">
      <h2>Stack &amp; Queue</h2>
      <p class="lede">Both store items in order. The only difference is <b>which end you remove from</b>. A stack removes the newest item; a queue removes the oldest. Push and pop are O(1) in both.</p>

      <div class="segmented" role="radiogroup">
        <label><input type="radio" name="mode" value="stack" checked> Stack</label>
        <label><input type="radio" name="mode" value="queue"> Queue</label>
        <label><input type="radio" name="mode" value="brackets"> Brackets</label>
      </div>

      <div data-basic>
        <div class="btn-row">
          <button class="btn" data-add>Push</button>
          <button class="btn secondary" data-remove>Pop</button>
        </div>
        <div class="notice" data-msg></div>
        <p class="hint" data-idea></p>
      </div>

      <div data-brackets hidden>
        <label class="field">Expression
          <input type="text" value="{ [ ( a + b ) * c ] }" maxlength="24" data-expr>
        </label>
        <div class="op-group">
          <button class="btn small secondary" data-try="{ [ ( a + b ) * c ] }">balanced</button>
          <button class="btn small secondary" data-try="( [ ) ]">crossed</button>
          <button class="btn small secondary" data-try="( ( a + b )">unclosed</button>
        </div>
        <div class="btn-row"><button class="btn" data-check>▶ Check with a stack</button></div>
        <div class="notice" data-bmsg>Opening brackets are pushed; each closing bracket must match the top.</div>
      </div>
    </aside>
  `;

  const $ = (sel) => root.querySelector(sel);
  const stage = createStage($('[data-viewport]'), { cameraPosition: [0, 4, 13.5], axes: false, grid: false });
  stage.controls.target.set(0, 2, 0);
  const scene = stage.scene;
  const scenery = new THREE.Group();
  scene.add(scenery);
  const state = { mode: 'stack', items: [], leaving: [], next: 1, run: null };
  const exprRow = new THREE.Group();
  scene.add(exprRow);

  function buildScenery() {
    clearGroup(scenery);
    if (state.mode === 'queue') {
      const belt = new THREE.Mesh(new THREE.BoxGeometry(MAX * 1.05 + 0.6, 0.2, 1.4), new THREE.MeshStandardMaterial({ color: 0x232048, roughness: 0.7 }));
      belt.position.set(0, -0.1, 0);
      scenery.add(belt);
      scenery.add(makeLabel('◀ FRONT (leave)', new THREE.Vector3(-(MAX * 1.05) / 2, -0.7, 0.9), 0x5eead4, 'chart-label'));
      scenery.add(makeLabel('REAR (join) ◀', new THREE.Vector3((MAX * 1.05) / 2, -0.7, 0.9), 0xf472b6, 'chart-label'));
    } else {
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, MAX * 0.5 + 0.4, 40, 1, true), new THREE.MeshStandardMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
      tube.position.y = (MAX * 0.5 + 0.4) / 2;
      const floor = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.15, 40), new THREE.MeshStandardMaterial({ color: 0x232048 }));
      floor.position.y = -0.075;
      scenery.add(tube, floor);
    }
  }

  // Target position of item k (0 = bottom of the stack / front of the queue).
  const slot = (k) => (state.mode === 'queue'
    ? new THREE.Vector3(-(MAX * 1.05) / 2 + 0.55 + k * 1.05, 0.45, 0)
    : new THREE.Vector3(0, 0.25 + k * 0.5, 0));

  function makeItem(text, color) {
    const geom = state.mode === 'queue' ? new THREE.BoxGeometry(0.9, 0.9, 0.9) : new THREE.CylinderGeometry(1, 1, 0.42, 40);
    const mesh = new THREE.Mesh(geom, new THREE.MeshStandardMaterial({ color, roughness: 0.35, transparent: true }));
    const label = makeLabel(text, new THREE.Vector3(0, 0, state.mode === 'queue' ? 0.5 : 1.05), 0x0b0720, 'gate-label');
    mesh.add(label);
    scene.add(mesh);
    return { mesh, label, text };
  }

  function add(text = String(state.next++)) {
    if (state.items.length >= MAX) return setMsg('Full! (This one holds 9.) Remove something first.');
    const item = makeItem(text, PALETTE[(state.items.length + state.next) % PALETTE.length]);
    // Stacks drop in from above; queues roll in from the right.
    item.mesh.position.copy(state.mode === 'queue' ? new THREE.Vector3(MAX * 0.6 + 1.5, 0.45, 0) : new THREE.Vector3(0, MAX * 0.5 + 2, 0));
    state.items.push(item);
    layout();
    setMsg(state.mode === 'queue' ? `Enqueued <b>${text}</b> at the rear.` : `Pushed <b>${text}</b> on top.`);
    return item;
  }

  function remove() {
    if (!state.items.length) return setMsg(state.mode === 'queue' ? 'The queue is empty (underflow).' : 'The stack is empty (underflow).');
    const item = state.mode === 'queue' ? state.items.shift() : state.items.pop();
    item.exit = state.mode === 'queue' ? new THREE.Vector3(-(MAX * 0.6) - 2, 0.45, 0) : new THREE.Vector3(2.8, MAX * 0.5 + 1.5, 0);
    state.leaving.push(item);
    layout();
    setMsg(state.mode === 'queue' ? `Dequeued <b>${item.text}</b> from the front: it was waiting longest.` : `Popped <b>${item.text}</b>: the newest item leaves first.`);
    return item;
  }

  function layout() {
    state.items.forEach((it, k) => {
      it.target = slot(k);
      const isEnd = state.mode === 'queue' ? k === 0 : k === state.items.length - 1;
      it.mesh.material.emissive.setHex(isEnd ? 0x3b2a7a : 0x000000);
    });
    $('[data-remove]').disabled = !state.items.length;
  }

  const setMsg = (m) => { $('[data-msg]').innerHTML = m; };

  function clearAll() {
    for (const it of [...state.items, ...state.leaving]) {
      scene.remove(it.mesh);
      it.label.element.remove();
      it.mesh.geometry.dispose();
      it.mesh.material.dispose();
    }
    state.items = [];
    state.leaving = [];
    state.run = null;
    clearGroup(exprRow);
  }

  function setMode(mode) {
    state.mode = mode;
    clearAll();
    state.next = 1;
    const basic = mode !== 'brackets';
    $('[data-basic]').hidden = !basic;
    $('[data-brackets]').hidden = basic;
    buildScenery(); // brackets mode uses the stack tube
    if (basic) {
      $('[data-add]').textContent = TEXT[mode].add;
      $('[data-remove]').textContent = TEXT[mode].remove;
      $('[data-idea]').innerHTML = TEXT[mode].idea;
      ['3', '7', '5'].forEach((v) => add(v));
      state.next = 1;
      setMsg(`Press <b>${TEXT[mode].add}</b> and <b>${TEXT[mode].remove}</b>, or click an item.`);
    }
    layout();
  }

  // Brackets: show the expression as a row of characters and replay the stack steps one per beat.
  function startCheck() {
    clearAll();
    const text = $('[data-expr]').value;
    const chars = [...text].filter((c) => c !== ' ');
    const { steps } = checkBrackets(chars.join(''));
    const cells = chars.map((c, i) => {
      const l = makeLabel(c, new THREE.Vector3((i - (chars.length - 1) / 2) * 0.55, MAX * 0.5 + 1.4, 0), 0x9b98c4, 'expr-char');
      exprRow.add(l);
      return l;
    });
    state.run = { steps, cells, i: 0, clock: 0.6 };
  }

  function applyBracketStep(step) {
    const run = state.run;
    run.cells.forEach((c, k) => c.element.classList.toggle('current', k === step.i));
    if (step.action === 'push') add(step.ch);
    if (step.action === 'pop') remove();
    $('[data-bmsg]').innerHTML = step.action === 'fail' ? `<span class="warn-text">✗</span> ${step.msg}` : step.action === 'ok' ? `<span class="ok-text">✓</span> ${step.msg}` : step.msg;
  }

  root.querySelectorAll('input[name=mode]').forEach((r) => r.addEventListener('change', () => setMode(r.value)));
  $('[data-add]').addEventListener('click', () => add());
  $('[data-remove]').addEventListener('click', () => remove());
  $('[data-check]').addEventListener('click', startCheck);
  root.querySelectorAll('[data-try]').forEach((b) => b.addEventListener('click', () => {
    $('[data-expr]').value = b.dataset.try;
    startCheck();
  }));

  // Clicking an item that is not at the removable end explains why it can't come out.
  const stopInteract = interact(stage, {
    pick: () => state.items.map((it) => it.mesh),
    cursor: 'pointer',
    onClick: (hit) => {
      if (state.mode === 'brackets') return;
      const k = state.items.findIndex((it) => it.mesh === hit.object);
      const end = state.mode === 'queue' ? 0 : state.items.length - 1;
      if (k === end) remove();
      else setMsg(state.mode === 'queue' ? `<b>${state.items[k].text}</b> has to wait: only the front item can leave.` : `<b>${state.items[k].text}</b> is stuck: only the top item can be popped.`);
    },
  });

  stage.onFrame((dt) => {
    const e = Math.min(1, dt * 9);
    for (const it of state.items) it.mesh.position.lerp(it.target, e);
    state.leaving = state.leaving.filter((it) => {
      it.mesh.position.lerp(it.exit, Math.min(1, dt * 5));
      it.mesh.material.opacity = Math.max(0, it.mesh.material.opacity - dt * 1.6);
      if (it.mesh.material.opacity > 0) return true;
      scene.remove(it.mesh);
      it.label.element.remove();
      it.mesh.geometry.dispose();
      it.mesh.material.dispose();
      return false;
    });
    const run = state.run;
    if (run && run.i < run.steps.length) {
      run.clock -= dt;
      if (run.clock <= 0) {
        applyBracketStep(run.steps[run.i++]);
        run.clock = 0.9;
      }
    }
  });

  setMode('stack');
  return () => {
    stopInteract();
    stage.dispose();
  };
}
