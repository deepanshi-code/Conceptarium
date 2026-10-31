// Generic animated node-and-edge renderer for the data-structure views.
// Call show(layout) with {nodes, edges}; nodes are matched by id, so anything that moved between two
// layouts glides to its new place, new nodes grow in and removed ones shrink away.
//
// Node spec: {id, kind: 'ball'|'box'|'marker', pos: [x,y,z], size: radius | [w,h,d], label, tag,
//             color, state: 'visit'|'active'|'new'|'warn'|'found'|undefined, pillar: length | undefined}
// Edge spec: {from, to, color, arrow, dashed, curve, opacity, fromOffset: [x,y,z], toOffset: [x,y,z]}
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

export const STATE_COLORS = { visit: 0x5c9dff, active: 0xffc845, new: 0x5cdb7f, warn: 0xff5c5c, found: 0x4fd1c5 };
const DARK_TEXT_STATES = new Set(['active', 'new', 'found']);
const DURATION = 0.55;
const SEGMENTS = 24;
const CONE_HEIGHT = 0.24;
const coneGeometry = new THREE.ConeGeometry(0.085, CONE_HEIGHT, 12);
const UP = new THREE.Vector3(0, 1, 0);
const ease = (t) => t * t * (3 - 2 * t);

export function createGraphRenderer(stage) {
  const root = new THREE.Group();
  stage.scene.add(root);
  const nodes = new Map();
  const edges = new Map();
  let progress = 1;
  let edgesDirty = false;
  const fit = { t: 1, fromTarget: new THREE.Vector3(), toTarget: new THREE.Vector3(), fromPos: new THREE.Vector3(), toPos: new THREE.Vector3(), lastCenter: null, lastSize: 0, force: true, viewDir: null };

  // --- Nodes ---------------------------------------------------------------
  function buildMesh(spec) {
    if (spec.kind === 'marker') return null;
    const geom = spec.kind === 'ball' ? new THREE.SphereGeometry(spec.size, 32, 20) : new THREE.BoxGeometry(...spec.size);
    return new THREE.Mesh(geom, new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.1 }));
  }

  function createNode(spec) {
    const group = new THREE.Group();
    const el = document.createElement('div');
    const tagEl = document.createElement('div');
    tagEl.className = 'ds-tag';
    const label = new CSS2DObject(el);
    const tag = new CSS2DObject(tagEl);
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x5c9dff, transparent: true, opacity: 0.35 }));
    group.add(label, tag, pillar);
    root.add(group);
    const node = { group, mesh: null, el, tagEl, label, tag, pillar, spec: {}, from: new THREE.Vector3(), to: new THREE.Vector3(), fromScale: 0, toScale: 1, leaving: false };
    group.position.set(...spec.pos);
    group.scale.setScalar(0.01);
    return node;
  }

  const halfExtents = (spec) => (spec.kind === 'box' ? spec.size.map((s) => s / 2) : spec.kind === 'ball' ? [spec.size, spec.size, spec.size] : [0.3, 0.2, 0.2]);

  function applySpec(node, spec) {
    if (node.spec.kind !== spec.kind || JSON.stringify(node.spec.size) !== JSON.stringify(spec.size)) {
      if (node.mesh) {
        node.group.remove(node.mesh);
        node.mesh.geometry.dispose();
        node.mesh.material.dispose();
      }
      node.mesh = buildMesh(spec);
      if (node.mesh) node.group.add(node.mesh);
    }
    node.spec = spec;
    const half = halfExtents(spec);
    if (node.mesh) {
      const color = STATE_COLORS[spec.state] ?? spec.color ?? 0x3a4a6b;
      node.mesh.material.color.setHex(color);
      node.mesh.material.emissive.setHex(spec.state ? color : 0x000000);
      node.mesh.material.emissiveIntensity = spec.state ? 0.3 : 0;
    }
    node.el.className = `ds-label${spec.kind === 'marker' ? ' marker' : ''}${DARK_TEXT_STATES.has(spec.state) ? ' dark' : ''}`;
    node.el.innerHTML = spec.label ?? '';
    node.tagEl.innerHTML = spec.tag ?? '';
    node.tag.visible = Boolean(spec.tag);
    node.tag.position.set(0, half[1] + 0.32, 0);
    node.pillar.visible = Boolean(spec.pillar);
    if (spec.pillar) {
      node.pillar.scale.set(0.16, 0.16, spec.pillar);
      node.pillar.position.set(0, 0, -(half[2] + spec.pillar / 2));
    }
  }

  function removeNode(id, node) {
    node.el.remove();
    node.tagEl.remove();
    node.group.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
    root.remove(node.group);
    nodes.delete(id);
  }

  // --- Edges ---------------------------------------------------------------
  function createEdge(spec) {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array((SEGMENTS + 1) * 3), 3));
    const common = { color: spec.color ?? 0x55607a, transparent: true, opacity: spec.opacity ?? 0.9 };
    const material = spec.dashed ? new THREE.LineDashedMaterial({ ...common, dashSize: 0.14, gapSize: 0.09 }) : new THREE.LineBasicMaterial(common);
    const line = new THREE.Line(geom, material);
    line.frustumCulled = false;
    root.add(line);
    let head = null;
    if (spec.arrow) {
      head = new THREE.Mesh(coneGeometry, new THREE.MeshBasicMaterial({ color: common.color, transparent: true, opacity: common.opacity }));
      root.add(head);
    }
    return { spec, line, head };
  }

  function removeEdge(key, edge) {
    edge.line.geometry.dispose();
    edge.line.material.dispose();
    root.remove(edge.line);
    if (edge.head) {
      edge.head.material.dispose();
      root.remove(edge.head);
    }
    edges.delete(key);
  }

  // Point where the ray from a node's centre towards `toward` leaves the node's box or sphere.
  function boundary(node, toward) {
    const c = node.group.position;
    const dir = toward.clone().sub(c);
    if (dir.lengthSq() < 1e-9) return c.clone();
    dir.normalize();
    const k = node.group.scale.x;
    const half = halfExtents(node.spec).map((h) => h * k);
    if (node.spec.kind === 'ball') return c.clone().addScaledVector(dir, half[0]);
    const t = Math.min(...[0, 1, 2].map((i) => (Math.abs(dir.getComponent(i)) < 1e-6 ? Infinity : half[i] / Math.abs(dir.getComponent(i)))));
    return c.clone().addScaledVector(dir, t);
  }

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  function updateEdge(edge) {
    const from = nodes.get(edge.spec.from);
    const to = nodes.get(edge.spec.to);
    const visible = Boolean(from && to && from.group.scale.x > 0.3 && to.group.scale.x > 0.3);
    edge.line.visible = visible;
    if (edge.head) edge.head.visible = visible;
    if (!visible) return;

    const pa = from.group.position;
    const pb = to.group.position;
    const ctrl = pa.clone().add(pb).multiplyScalar(0.5);
    ctrl.y += edge.spec.curve ?? 0;
    const start = edge.spec.fromOffset ? pa.clone().add(a.fromArray(edge.spec.fromOffset)) : boundary(from, edge.spec.curve ? ctrl : pb);
    const end = edge.spec.toOffset ? pb.clone().add(b.fromArray(edge.spec.toOffset)) : boundary(to, edge.spec.curve ? ctrl : pa);
    if (!edge.spec.curve) ctrl.copy(start).add(end).multiplyScalar(0.5);

    const pos = edge.line.geometry.attributes.position;
    const p = new THREE.Vector3();
    for (let i = 0; i <= SEGMENTS; i++) {
      const t = i / SEGMENTS;
      // Quadratic Bézier: (1−t)²·start + 2(1−t)t·ctrl + t²·end
      p.copy(start).multiplyScalar((1 - t) ** 2).addScaledVector(ctrl, 2 * (1 - t) * t).addScaledVector(end, t * t);
      pos.setXYZ(i, p.x, p.y, p.z);
    }
    pos.needsUpdate = true;
    if (edge.spec.dashed) edge.line.computeLineDistances();

    if (edge.head) {
      const tangent = end.clone().sub(ctrl).normalize(); // derivative of the Bézier at t = 1
      edge.head.position.copy(end).addScaledVector(tangent, -CONE_HEIGHT / 2);
      edge.head.quaternion.setFromUnitVectors(UP, tangent);
    }
  }

  // --- Camera framing ------------------------------------------------------
  function frameCamera(layout) {
    if (!layout.nodes.length) return;
    const box = new THREE.Box3();
    for (const n of layout.nodes) {
      const half = halfExtents(n);
      box.expandByPoint(new THREE.Vector3(n.pos[0] - half[0], n.pos[1] - half[1], n.pos[2] - half[2]));
      box.expandByPoint(new THREE.Vector3(n.pos[0] + half[0], n.pos[1] + half[1] + 0.5, n.pos[2] + half[2]));
    }
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    // Only reframe on big changes, so the camera does not twitch on every step.
    const similar = fit.lastCenter && center.distanceTo(fit.lastCenter) < 1 && Math.abs(size.length() - fit.lastSize) < 0.2 * fit.lastSize;
    if (similar && !fit.force) return;
    const forced = fit.force;
    fit.force = false;
    fit.lastCenter = center;
    fit.lastSize = size.length();

    const cam = stage.camera;
    const tanHalf = Math.tan(THREE.MathUtils.degToRad((cam.fov ?? 50) / 2));
    const aspect = cam.aspect ?? 1.6;
    const dist = Math.max(6, Math.max(size.y / (2 * tanHalf), size.x / (2 * tanHalf * aspect)) * 1.05 + size.z / 2);
    // After a tab switch use the tab's preferred angle; otherwise keep whatever angle the user orbited to.
    const dir = forced && fit.viewDir ? fit.viewDir.clone() : cam.position.clone().sub(stage.controls.target).normalize();
    fit.fromTarget.copy(stage.controls.target);
    fit.toTarget.copy(center);
    fit.fromPos.copy(cam.position);
    fit.toPos.copy(center).addScaledVector(dir, dist);
    fit.t = 0;
  }

  return {
    show(layout, { instant = false } = {}) {
      const seen = new Set();
      for (const spec of layout.nodes) {
        seen.add(spec.id);
        let node = nodes.get(spec.id);
        if (!node) {
          node = createNode(spec);
          nodes.set(spec.id, node);
        }
        applySpec(node, spec);
        node.leaving = false;
        node.from.copy(node.group.position);
        node.to.fromArray(spec.pos);
        node.fromScale = node.group.scale.x;
        node.toScale = 1;
      }
      for (const node of nodes.values()) {
        if (seen.has(node.spec.id)) continue;
        node.leaving = true;
        node.from.copy(node.group.position);
        node.to.copy(node.group.position);
        node.fromScale = node.group.scale.x;
        node.toScale = 0.01;
      }

      const wanted = new Map(layout.edges.map((e) => [`${e.from}>${e.to}:${e.color ?? ''}:${e.dashed ? 'd' : ''}`, e]));
      for (const [key, edge] of edges) if (!wanted.has(key)) removeEdge(key, edge);
      for (const [key, spec] of wanted) {
        const existing = edges.get(key);
        if (existing) existing.spec = spec;
        else edges.set(key, createEdge(spec));
      }

      progress = instant ? 0.999 : 0;
      edgesDirty = true;
      frameCamera(layout);
    },

    update(dt) {
      if (progress < 1) {
        progress = Math.min(1, progress + dt / DURATION);
        const e = ease(progress);
        for (const [id, node] of nodes) {
          node.group.position.lerpVectors(node.from, node.to, e);
          node.group.scale.setScalar(node.fromScale + (node.toScale - node.fromScale) * e);
          if (progress === 1 && node.leaving) removeNode(id, node);
        }
        edgesDirty = true;
      }
      if (edgesDirty) {
        for (const edge of edges.values()) updateEdge(edge);
        edgesDirty = progress < 1;
      }
      if (fit.t < 1) {
        fit.t = Math.min(1, fit.t + dt / 0.8);
        const e = ease(fit.t);
        stage.controls.target.lerpVectors(fit.fromTarget, fit.toTarget, e);
        stage.camera.position.lerpVectors(fit.fromPos, fit.toPos, e);
      }
    },

    clear() {
      for (const [id, node] of nodes) removeNode(id, node);
      for (const [key, edge] of edges) removeEdge(key, edge);
      fit.force = true;
    },

    /** Camera direction (from target towards camera) used the next time the view is reframed after clear(). */
    setViewDirection(x, y, z) {
      fit.viewDir = new THREE.Vector3(x, y, z).normalize();
    },
  };
}
