// Shared 3D stage: renderer, cameras, orbit controls, axes, labels and a render loop.
// Every visualization mounts one stage and disposes it when the user navigates away.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

export const COLORS = {
  x: 0xff5c5c,
  y: 0x5cdb7f,
  z: 0x5c9dff,
  accent: 0xffc845,
  muted: 0x8892a6,
};

export function createStage(container, { cameraPosition = [4, 3.5, 5], axisLength = 3.5, axes = true, grid = true } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.className = 'label-layer';
  container.appendChild(labelRenderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070a1a);

  const perspective = new THREE.PerspectiveCamera(50, 1, 0.05, 200);
  perspective.position.set(...cameraPosition);
  const orthographic = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 200);
  let camera = perspective;

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(0, 0, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(5, 8, 6);
  scene.add(sun);

  if (grid) scene.add(new THREE.GridHelper(10, 20, 0x2a2f55, 0x161a36));
  if (axes) scene.add(createAxes(axisLength));

  function resize() {
    const { clientWidth: w, clientHeight: h } = container;
    if (!w || !h) return;
    renderer.setSize(w, h);
    labelRenderer.setSize(w, h);
    perspective.aspect = w / h;
    perspective.updateProjectionMatrix();
    updateOrthoFrustum();
  }

  // Size the orthographic frustum so switching cameras keeps the object roughly the same size.
  function updateOrthoFrustum() {
    const { clientWidth: w, clientHeight: h } = container;
    const dist = camera.position.distanceTo(controls.target);
    const halfH = dist * Math.tan(THREE.MathUtils.degToRad(perspective.fov / 2));
    const halfW = halfH * (w / h || 1);
    orthographic.left = -halfW;
    orthographic.right = halfW;
    orthographic.top = halfH;
    orthographic.bottom = -halfH;
    orthographic.updateProjectionMatrix();
  }

  function setProjection(mode) {
    const next = mode === 'orthographic' ? orthographic : perspective;
    if (next === camera) return;
    next.position.copy(camera.position);
    next.quaternion.copy(camera.quaternion);
    if (next === orthographic) {
      updateOrthoFrustum();
      orthographic.zoom = 1;
      orthographic.updateProjectionMatrix();
    }
    camera = next;
    controls.object = camera;
    controls.update();
  }

  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  const frameCallbacks = [];
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = clock.getDelta();
    for (const fn of frameCallbacks) fn(dt);
    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  });

  return {
    scene,
    controls,
    container,
    canvas: renderer.domElement,
    get camera() { return camera; },
    setProjection,
    setFov(fov) {
      perspective.fov = fov;
      perspective.updateProjectionMatrix();
    },
    onFrame(fn) { frameCallbacks.push(fn); },
    dispose() {
      renderer.setAnimationLoop(null);
      observer.disconnect();
      controls.dispose();
      scene.traverse((obj) => {
        obj.geometry?.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => m?.dispose());
      });
      renderer.dispose();
      container.replaceChildren();
    },
  };
}

function createAxes(length) {
  const group = new THREE.Group();
  const axes = [
    ['x', new THREE.Vector3(1, 0, 0), COLORS.x],
    ['y', new THREE.Vector3(0, 1, 0), COLORS.y],
    ['z', new THREE.Vector3(0, 0, 1), COLORS.z],
  ];
  for (const [name, dir, color] of axes) {
    const geom = new THREE.BufferGeometry().setFromPoints([
      dir.clone().multiplyScalar(-length),
      dir.clone().multiplyScalar(length),
    ]);
    const line = new THREE.Line(geom, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.45 }));
    group.add(line);
    group.add(makeLabel(name, dir.clone().multiplyScalar(length + 0.25), color));
  }
  return group;
}

export function makeLabel(text, position, color = 0xffffff, className = 'axis-label') {
  const el = document.createElement('div');
  el.className = className;
  el.textContent = text;
  el.style.color = `#${new THREE.Color(color).getHexString()}`;
  const label = new CSS2DObject(el);
  label.position.copy(position);
  return label;
}

/**
 * Empty a group: dispose GPU resources and remove HTML labels. three.js only removes a label's element when the
 * label itself is removed, not when an ancestor group is, so nested labels would otherwise linger on screen.
 */
export function clearGroup(group) {
  group.traverse((o) => {
    o.geometry?.dispose();
    o.material?.dispose();
    if (o.isCSS2DObject) o.element.remove();
  });
  group.clear();
}

/** Show or hide an object together with any HTML labels inside it (labels ignore their parents' visibility). */
export function setVisible(object, visible) {
  object.visible = visible;
  object.traverse((o) => {
    if (o.isCSS2DObject) o.visible = visible;
  });
}

// ArrowHelper breaks visually when its length is shorter than its head, so clamp the head
// and hide arrows that have collapsed to (almost) zero.
export function setArrow(arrow, vec) {
  const len = vec.length();
  arrow.visible = len > 1e-3;
  if (!arrow.visible) return;
  const head = Math.min(0.22, len * 0.35);
  arrow.setDirection(vec.clone().divideScalar(len));
  arrow.setLength(len, head, head * 0.55);
}
