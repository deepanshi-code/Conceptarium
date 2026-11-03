// Computer networks: how a message crosses the network. Going down the sender's layers, each layer wraps the data
// in its own header (encapsulation); the router opens it only up to the IP header; the receiver unwraps it upward.
import * as THREE from 'three';
import { createStage, makeLabel, clearGroup } from '../stage.js';
import { MODELS, journey } from '../net/packet.js';
import { html } from '../ui.js';

const STATIONS = { sender: -5.6, router: 0, receiver: 5.6 };
const SLAB_H = 0.62;
const LAYER_COLORS = [0xf472b6, 0xa78bfa, 0x818cf8, 0x22d3ee, 0x4ade80, 0xfacc15, 0xfb923c];
const PACKET_Z = 1.9;

export function mountNetwork(root) {
  root.innerHTML = html`
    <div class="viewport" data-viewport></div>
    <aside class="panel">
      <h2>Packet Journey</h2>
      <p class="lede">Networking is split into <b>layers</b>, each with one job. Sending, every layer adds its own <b>header</b> to the front (encapsulation), like putting a letter in envelope after envelope. A <b>router</b> only opens the envelopes down to the IP address, then sends it on. The receiver opens them all.</p>

      <div class="segmented" role="radiogroup">
        <label><input type="radio" name="model" value="tcpip" checked> TCP/IP</label>
        <label><input type="radio" name="model" value="osi"> OSI 7</label>
      </div>
      <label class="field">Message
        <input type="text" value="Hi!" maxlength="12" data-text>
      </label>
      <div class="btn-row">
        <button class="btn" data-play>▶ Send</button>
        <button class="btn secondary" data-step>Next step</button>
      </div>
      <label class="slider-row wide"><span>Speed</span><input type="range" min="0.5" max="3" step="0.25" value="1" data-speed><output data-speed-out>1×</output></label>

      <div class="notice" data-msg>Press Send.</div>
      <h3>Layers</h3>
      <ol class="layer-list" data-layers></ol>
    </aside>
  `;

  const $ = (sel) => root.querySelector(sel);
  const stage = createStage($('[data-viewport]'), { cameraPosition: [0, 5, 19], axes: false, grid: false });
  stage.controls.target.set(0, 1.8, 0);
  const scene = stage.scene;
  const world = new THREE.Group();
  scene.add(world);
  const packet = new THREE.Group();
  scene.add(packet);
  const state = { model: 'tcpip', steps: [], i: -1, playing: false, clock: 0, speed: 1, blocks: new Map(), leaving: [], anchor: new THREE.Vector3() };

  const layers = () => MODELS[state.model].layers;
  const layerY = (i) => (layers().length - 1 - i) * SLAB_H + SLAB_H / 2;
  const color = (header) => {
    if (header === 'DATA') return 0xffffff;
    return LAYER_COLORS[layers().findIndex((l) => l.header === header) % LAYER_COLORS.length];
  };

  function buildWorld() {
    clearGroup(world);
    const L = layers();
    const net = MODELS[state.model].networkLayer;
    for (const [node, x] of Object.entries(STATIONS)) {
      const from = node === 'router' ? net : 0;
      for (let i = from; i < L.length; i++) {
        const slab = new THREE.Mesh(new THREE.BoxGeometry(2.4, SLAB_H * 0.9, 1.6), new THREE.MeshStandardMaterial({ color: LAYER_COLORS[i % LAYER_COLORS.length], transparent: true, opacity: 0.28, roughness: 0.5 }));
        slab.position.set(x, layerY(i), 0);
        slab.userData = { node, layer: i };
        world.add(slab);
        if (node !== 'router') {
          const label = makeLabel(L[i].name, new THREE.Vector3(x + (node === 'sender' ? -1.35 : 1.35), layerY(i), 0), LAYER_COLORS[i % LAYER_COLORS.length], 'chart-label');
          label.center.set(node === 'sender' ? 1 : 0, 0.5);
          world.add(label);
        }
      }
      const title = node === 'router' ? 'Router' : node === 'sender' ? 'Your laptop' : 'Web server';
      world.add(makeLabel(title, new THREE.Vector3(x, L.length * SLAB_H + 0.45, 0), 0xffffff, 'plane-label'));
    }
    for (const [a, b] of [['sender', 'router'], ['router', 'receiver']]) {
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, STATIONS[b] - STATIONS[a] - 2.4, 12), new THREE.MeshStandardMaterial({ color: 0x5b5f9a }));
      cable.rotation.z = Math.PI / 2;
      cable.position.set((STATIONS[a] + STATIONS[b]) / 2, 0.15, 0);
      world.add(cable);
    }
    $('[data-layers]').innerHTML = L.map((l, i) => `<li data-layer="${i}" style="--c:#${new THREE.Color(LAYER_COLORS[i % LAYER_COLORS.length]).getHexString()}"><b>${l.name}</b> <span class="tag-chip">${l.header}</span></li>`).join('');
  }

  function reset() {
    clearGroup(packet);
    state.blocks = new Map();
    state.leaving = [];
    state.steps = journey(state.model);
    state.i = -1;
    state.playing = false;
    $('[data-play]').textContent = '▶ Send';
    // The bare data waits at the top of the sender.
    state.anchor.set(STATIONS.sender, layerY(0), PACKET_Z);
    packet.position.copy(state.anchor);
    syncBlocks([]);
    world.children.forEach((o) => { if (o.userData.node) o.material.opacity = 0.28; });
    root.querySelectorAll('[data-layer]').forEach((li) => li.classList.remove('current'));
    $('[data-msg]').innerHTML = `Your message “<b>${$('[data-text]').value || 'Hi!'}</b>” is ready at the Application layer. Press Send.`;
  }

  // The packet is a row of blocks: outermost header on the left, the data on the right.
  function syncBlocks(headers) {
    const order = [...headers].reverse().concat('DATA');
    const widths = order.map((h) => (h === 'DATA' ? 1.1 : 0.62));
    const total = widths.reduce((s, w) => s + w + 0.04, 0);
    let x = -total / 2;
    for (const [h, block] of state.blocks) {
      if (order.includes(h)) continue;
      state.blocks.delete(h);
      state.leaving.push(block);
    }
    order.forEach((h, k) => {
      let block = state.blocks.get(h);
      if (!block) {
        block = new THREE.Mesh(new THREE.BoxGeometry(widths[k], 0.5, 0.5), new THREE.MeshStandardMaterial({ color: color(h), roughness: 0.35, transparent: true }));
        const text = h === 'DATA' ? ($('[data-text]').value || 'Hi!') : h;
        block.add(makeLabel(text, new THREE.Vector3(0, 0, 0.3), 0x0b0720, 'gate-label'));
        block.position.set(x - 0.8, 0.9, 0); // new headers swoop in from the upper left
        packet.add(block);
        state.blocks.set(h, block);
      }
      block.userData.target = new THREE.Vector3(x + widths[k] / 2, 0, 0);
      x += widths[k] + 0.04;
    });
  }

  function describe(step) {
    const L = layers();
    const l = L[step.layer];
    const where = { sender: 'Your laptop', router: 'Router', receiver: 'Web server', wire1: 'Cable', wire2: 'Cable' }[step.node];
    if (step.action === 'wrap') return `<b>${where} · ${l.name}</b>: adds the <b>${l.header}</b> header. ${l.what}`;
    if (step.action === 'unwrap') return `<b>${where} · ${l.name}</b>: reads and removes the <b>${l.header}</b> header.`;
    if (step.action === 'route') return '<b>Router · reads the IP header</b>: the destination address says where to go, so it picks the next cable. It never looks at TCP or your data.';
    return `<b>${where}</b>: travels as electrical, light or radio signals.`;
  }

  function advance() {
    if (state.i >= state.steps.length - 1) {
      state.playing = false;
      $('[data-play]').textContent = '▶ Send again';
      return;
    }
    const step = state.steps[++state.i];
    const x = step.node === 'wire1' ? (STATIONS.sender + STATIONS.router) / 2 : step.node === 'wire2' ? (STATIONS.router + STATIONS.receiver) / 2 : STATIONS[step.node];
    state.anchor.set(x, step.node.startsWith('wire') ? 0.6 : layerY(step.layer), PACKET_Z);
    syncBlocks(step.headers);
    world.children.forEach((o) => {
      if (o.userData.node) o.material.opacity = o.userData.node === step.node && o.userData.layer === step.layer ? 0.85 : 0.28;
    });
    root.querySelectorAll('[data-layer]').forEach((li) => li.classList.toggle('current', Number(li.dataset.layer) === step.layer && !step.node.startsWith('wire')));
    $('[data-msg]').innerHTML = describe(step) + (state.i === state.steps.length - 1 ? `<br><span class="ok-text">✓ Delivered: the server's app reads “${$('[data-text]').value || 'Hi!'}”.</span>` : '');
  }

  root.querySelectorAll('input[name=model]').forEach((r) => r.addEventListener('change', () => {
    state.model = r.value;
    buildWorld();
    reset();
  }));
  $('[data-text]').addEventListener('change', reset);
  $('[data-play]').addEventListener('click', () => {
    if (state.i >= state.steps.length - 1) reset();
    state.playing = !state.playing;
    $('[data-play]').textContent = state.playing ? '❚❚ Pause' : '▶ Continue';
    state.clock = 0;
  });
  $('[data-step]').addEventListener('click', () => {
    state.playing = false;
    $('[data-play]').textContent = '▶ Continue';
    if (state.i >= state.steps.length - 1) reset();
    advance();
  });
  $('[data-speed]').addEventListener('input', (e) => {
    state.speed = Number(e.target.value);
    $('[data-speed-out]').textContent = `${state.speed}×`;
  });

  stage.onFrame((dt) => {
    if (state.playing) {
      state.clock -= dt * state.speed;
      if (state.clock <= 0) {
        advance();
        state.clock = 1.4;
      }
    }
    packet.position.lerp(state.anchor, Math.min(1, dt * 4 * state.speed));
    for (const block of state.blocks.values()) block.position.lerp(block.userData.target, Math.min(1, dt * 7));
    state.leaving = state.leaving.filter((b) => {
      b.position.y += dt * 2;
      b.material.opacity -= dt * 1.8;
      if (b.material.opacity > 0) return true;
      clearGroup(b);
      packet.remove(b);
      b.geometry.dispose();
      b.material.dispose();
      return false;
    });
  });

  buildWorld();
  reset();
  return () => stage.dispose();
}
