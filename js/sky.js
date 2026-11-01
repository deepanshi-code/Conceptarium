// The home page skies. Two modes share one scene recipe (night dome, northern lights, stars):
//  - 'hero': adds a glowing planet horizon that rises as the page scrolls; nothing to click.
//  - 'map':  adds the constellations of concepts; click a star to open it.
import * as THREE from 'three';
import { createStage, makeLabel } from './stage.js';
import { CATALOG, SUBJECTS } from './catalog.js';

const CAMERA_DIST = 18;

export function buildSky(container, { mode = 'map', scrollEl = null } = {}) {
  const stage = createStage(container, { cameraPosition: [0, 1.2, CAMERA_DIST], axes: false, grid: false });
  const { controls, scene: root } = stage;
  root.background = new THREE.Color(0x040616);
  controls.target.set(0, 0.6, 0);
  controls.enableZoom = false;
  controls.enablePan = false;
  // Let people look around a little without flipping the sky over.
  controls.minAzimuthAngle = -0.45;
  controls.maxAzimuthAngle = 0.45;
  controls.minPolarAngle = 1.25;
  controls.maxPolarAngle = 1.75;

  const shaders = [buildDome(), ...buildAurora()];
  root.add(...shaders, buildStarfield());

  if (mode === 'hero') {
    controls.enableRotate = false; // the hero is a backdrop; the page scrolls instead
    const planet = buildPlanet();
    // On tall, narrow screens the hero text runs lower, so sink the horizon a little further.
    if (container.clientWidth < 700) planet.baseY -= 5;
    planet.group.position.y = planet.baseY;
    root.add(planet.group);
    shaders.push(...planet.shaders);
    let rise = 0;
    stage.onFrame((dt) => {
      // Scrolling down lifts the planet towards the centre, like rising over a horizon.
      const scrolled = scrollEl ? Math.min(1, scrollEl.scrollTop / Math.max(1, container.clientHeight)) : 0;
      rise += (scrolled - rise) * Math.min(1, dt * 6);
      planet.group.position.y = planet.baseY + rise * 7;
      planet.group.rotation.y += dt * 0.02;
      for (const mesh of shaders) mesh.material.uniforms.uTime.value += dt;
    });
    return stage;
  }

  // Map mode: constellations centred in the section. Wide screens get an oval facing the camera,
  // phones a 2 × 3 grid, which keeps labels apart in a narrow frame.
  const aspect = container.clientWidth / Math.max(1, container.clientHeight);
  const halfH = CAMERA_DIST * Math.tan(THREE.MathUtils.degToRad(25));
  const halfW = halfH * aspect;
  const wide = container.clientWidth > 900;
  const map = wide
    ? { cx: 0, cy: 0.4, rx: Math.min(halfW * 0.55, 11), ry: Math.min(halfH * 0.58, 5), spread: 1 }
    : { cx: 0, cy: 0.6, colX: halfW * 0.47, rowGap: halfH * 0.5, spread: 0.6 };
  // Wide screens: an oval facing the camera. Phones: a 2 × 3 grid, which keeps labels apart in a narrow frame.
  const centerFor = (si, count) => {
    if (!wide) return new THREE.Vector3((si % 2 ? 1 : -1) * map.colX, (1 - Math.floor(si / 2)) * map.rowGap, 0);
    const angle = Math.PI / 2 + (si / count) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(angle) * map.rx, Math.sin(angle) * map.ry, (si % 2 ? -1 : 1) * 0.8);
  };

  const sky = new THREE.Group();
  sky.position.set(map.cx, map.cy, 0);
  root.add(sky);

  const glow = glowTexture();
  const stars = [];
  const subjects = Object.entries(SUBJECTS);
  subjects.forEach(([key, subject], si) => {
    // Evenly spaced and facing the camera, so no constellation can hide behind another.
    const center = centerFor(si, subjects.length);
    const color = new THREE.Color(subject.color);
    const members = CATALOG.filter((c) => c.subject === key);
    const radius = members.length === 1 ? 0 : (0.5 + 0.14 * members.length) * map.spread;
    const points = members.map((_, k) => {
      const a = si + (k / members.length) * Math.PI * 2;
      return center.clone().add(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius * 0.8, Math.sin(k * 2.1) * 0.5));
    });

    members.forEach((concept, k) => {
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 14), new THREE.MeshBasicMaterial({ color: color.clone().lerp(new THREE.Color(0xffffff), 0.35) }));
      orb.position.copy(points[k]);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      halo.scale.setScalar(1.2);
      orb.add(halo);
      const label = makeLabel(concept.title, new THREE.Vector3(0, 0.42, 0), 0xe6e9f2, 'star-label');
      orb.add(label);
      orb.userData = { concept, label, phase: Math.random() * Math.PI * 2 };
      sky.add(orb);
      stars.push(orb);
    });

    if (points.length > 1) {
      const loop = points.length > 2 ? [...points, points[0]] : points;
      sky.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(loop), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.25 })));
    }
    sky.add(makeLabel(subject.name, center.clone().add(new THREE.Vector3(0, -(radius + 0.65), 0)), color.getHex(), 'constellation-label'));
  });

  // Hover to highlight, click to open.
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const canvas = container.querySelector('canvas');
  let hovered = null;
  let downAt = null;
  const pick = (e) => {
    const rect = canvas.getBoundingClientRect();
    pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, stage.camera);
    return raycaster.intersectObjects(stars, false)[0]?.object ?? null;
  };
  canvas.addEventListener('pointermove', (e) => {
    const hit = pick(e);
    if (hit === hovered) return;
    hovered?.userData.label.element.classList.remove('hot');
    hovered = hit;
    hovered?.userData.label.element.classList.add('hot');
    canvas.style.cursor = hovered ? 'pointer' : 'grab';
  });
  canvas.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
  canvas.addEventListener('pointerup', (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return;
    const hit = pick(e);
    if (hit) location.hash = `#/${hit.userData.concept.path}`;
  });

  let time = 0;
  stage.onFrame((dt) => {
    time += dt;
    // A slow sway instead of a full spin keeps the layout readable.
    sky.rotation.y = Math.sin(time * 0.12) * 0.22;
    sky.rotation.x = Math.sin(time * 0.09) * 0.05;
    for (const orb of stars) {
      const target = orb === hovered ? 1.8 : 1 + 0.1 * Math.sin(time * 2 + orb.userData.phase);
      orb.scale.setScalar(THREE.MathUtils.lerp(orb.scale.x, target, 0.15));
    }
    for (const mesh of shaders) mesh.material.uniforms.uTime.value = time;
  });
  return stage;
}

// A huge planet below the view whose sunlit rim shows as a glowing arc at the bottom of the hero:
// purple on the left, white at the top, cyan on the right. An outer shell adds the soft atmosphere halo.
// Placement: with the camera at y = 1.2 looking level, a radius-60 sphere centred 78 units lower and
// 43 units ahead has its top edge about 19° below the view centre, i.e. near the bottom of the hero.
function buildPlanet() {
  const R = 60;
  const rimColor = /* glsl */ `
    vec3 rimColor(float x) {
      float t = x * 0.5 + 0.5;
      vec3 purple = vec3(0.62, 0.30, 1.0);
      vec3 white = vec3(0.95, 0.93, 1.0);
      vec3 cyan = vec3(0.25, 0.85, 1.0);
      return mix(mix(purple, white, smoothstep(0.2, 0.5, t)), cyan, smoothstep(0.5, 0.85, t));
    }`;
  const vertex = /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vView;
    varying vec3 vWorldNormal;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vNormal = normalize(normalMatrix * normal);
      vView = normalize(-mv.xyz);
      vWorldNormal = normalize(mat3(modelMatrix) * normal);
      gl_Position = projectionMatrix * mv;
    }`;
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(R, 128, 64),
    new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: vertex,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        varying vec3 vNormal;
        varying vec3 vView;
        varying vec3 vWorldNormal;
        ${NOISE_GLSL}
        ${rimColor}
        void main() {
          float fres = pow(1.0 - max(dot(vNormal, vView), 0.0), 3.0);
          float bands = fbm(vec2(vWorldNormal.x * 3.0 + uTime * 0.01, vWorldNormal.y * 9.0));
          vec3 surface = vec3(0.012, 0.014, 0.04) + vec3(0.02, 0.015, 0.05) * bands;
          gl_FragColor = vec4(surface + rimColor(vWorldNormal.x) * fres * 1.8, 1.0);
        }`,
    }),
  );
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.06, 128, 64),
    new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      vertexShader: vertex,
      fragmentShader: /* glsl */ `
        varying vec3 vNormal;
        varying vec3 vView;
        varying vec3 vWorldNormal;
        ${rimColor}
        void main() {
          // 0 at the halo's outer edge, rising towards the planet's surface.
          float glow = smoothstep(0.0, 0.34, abs(dot(vNormal, vView)));
          gl_FragColor = vec4(rimColor(vWorldNormal.x) * glow * 0.8, glow * 0.8);
        }`,
    }),
  );
  const group = new THREE.Group();
  group.add(body, halo);
  const baseY = 1.2 - 78;
  group.position.set(0, baseY, -25);
  return { group, baseY, shaders: [body, halo] };
}

// Small value-noise + fractal Brownian motion, shared by the dome and aurora shaders.
const NOISE_GLSL = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
    return v;
  }
`;

// Night-sky dome: near-black overhead, a faint teal glow at the horizon and soft violet nebula patches.
function buildDome() {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      ${NOISE_GLSL}
      void main() {
        float h = vDir.y;
        vec3 top = vec3(0.012, 0.016, 0.05);
        vec3 horizon = vec3(0.07, 0.035, 0.16);
        vec3 col = mix(horizon, top, smoothstep(-0.15, 0.55, h));
        float neb = fbm(vDir.xy * 2.2 + vec2(3.0, 1.0));
        col += vec3(0.04, 0.07, 0.18) * smoothstep(0.55, 0.85, neb) * smoothstep(-0.2, 0.4, h);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(120, 48, 32), material);
}

// Aurora: tall translucent curtains whose folds drift and whose vertical rays shimmer. A bright teal-violet
// lower edge fades up into magenta, the purple end of a real aurora.
function buildAurora() {
  const curtains = [
    { z: -38, y: 2, width: 120, height: 30, hue: 0.75, speed: 1, strength: 1.5 },
    { z: -48, y: 6, width: 140, height: 34, hue: 0.2, speed: 0.7, strength: 1.0 },
    { z: -30, y: -1, width: 90, height: 22, hue: 1, speed: 1.3, strength: 0.75 },
  ];
  return curtains.map((c, i) => {
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uSeed: { value: i * 7.13 },
        uHue: { value: c.hue },
        uSpeed: { value: c.speed },
        uStrength: { value: c.strength },
      },
      vertexShader: /* glsl */ `
        uniform float uTime;
        uniform float uSeed;
        uniform float uSpeed;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec3 p = position;
          // The curtain's folds sway slowly back and forth.
          p.z += sin(p.x * 0.08 + uTime * 0.25 * uSpeed + uSeed) * 6.0 + sin(p.x * 0.21 - uTime * 0.17 * uSpeed) * 2.5;
          p.y += sin(p.x * 0.05 + uTime * 0.1 + uSeed) * 2.0;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uSeed;
        uniform float uHue;
        uniform float uSpeed;
        uniform float uStrength;
        varying vec2 vUv;
        ${NOISE_GLSL}
        void main() {
          float t = uTime * uSpeed;
          // Vertical rays: noise stretched tall and drifting sideways.
          float rays = smoothstep(0.25, 0.95, fbm(vec2(vUv.x * 28.0 + uSeed + t * 0.12, vUv.y * 1.5 - t * 0.2)));
          // Sharp lower edge, long fade upwards, soft ends left and right, slowly travelling bright bands.
          float edge = smoothstep(0.0, 0.08, vUv.y) * pow(1.0 - vUv.y, 1.8);
          float sides = smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x);
          float band = 0.55 + 0.45 * sin(vUv.x * 9.0 + t * 0.3 + uSeed);
          vec3 teal = vec3(0.18, 0.85, 0.85);
          vec3 violet = vec3(0.52, 0.36, 1.0);
          vec3 magenta = vec3(0.86, 0.36, 0.95);
          vec3 col = mix(mix(teal, violet, uHue), magenta, smoothstep(0.3, 0.95, vUv.y));
          float a = edge * sides * band * (0.25 + 0.75 * rays) * uStrength;
          gl_FragColor = vec4(col * a, a);
        }`,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(c.width, c.height, 160, 1), material);
    mesh.position.set(0, c.y + c.height / 2 - 6, c.z);
    return mesh;
  });
}

// Two layers of stars with slightly different tints, for depth.
function buildStarfield() {
  const group = new THREE.Group();
  for (const [count, size, tint] of [[1600, 0.16, 0xcfd8ff], [500, 0.28, 0xe4d8ff]]) {
    const pos = [];
    for (let i = 0; i < count; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(55 + Math.random() * 50);
      if (v.z > 10) v.z *= -1; // keep stars in front of the camera, where they can be seen
      pos.push(v.x, v.y, v.z);
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    group.add(new THREE.Points(geom, new THREE.PointsMaterial({ color: tint, size, transparent: true, opacity: 0.85, depthWrite: false })));
  }
  return group;
}

function glowTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}
