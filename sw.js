// Service worker: makes Conceptarium installable and lets it work offline.
//   • The site's own files: network first (always the latest when online), the saved copy when offline or when
//     the network is very slow. Every page you open is saved as you go, so concepts you have visited open offline.
//   • three.js from the CDN: a fixed version, so it is saved once and reused.
//   • Google Fonts: the saved copy straight away, refreshed in the background.
// Bump VERSION when the list below changes; old caches are deleted on activation.
const VERSION = 'v1';
const CACHE = `conceptarium-${VERSION}`;

// The home page and everything it needs, saved at install so the app opens offline right away.
const CORE = [
  './', './index.html', './css/style.css', './manifest.webmanifest',
  './icons/favicon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
  './js/boot.js', './js/main.js', './js/welcome.js', './js/tour.js', './js/catalog.js', './js/courses.js',
  './js/home.js', './js/sky.js', './js/stage.js', './js/interact.js', './js/coach.js', './js/toolbar.js',
  './js/quiz.js', './js/progress.js', './js/palette.js', './js/share.js', './js/ask.js', './js/ui.js',
  './js/practice/paths.js',
  'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js',
  'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js',
  'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/renderers/CSS2DRenderer.js',
];

const SLOW_NETWORK_MS = 3500;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('conceptarium-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) event.respondWith(networkFirst(request));
  else if (url.hostname === 'cdn.jsdelivr.net') event.respondWith(cacheFirst(request));
  else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') event.respondWith(staleWhileRevalidate(request));
  // Anything else (GitHub links, etc.) goes straight to the network.
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  const network = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  });
  const saved = await cache.match(request, { ignoreSearch: request.mode === 'navigate' });
  if (!saved) {
    try {
      return await network;
    } catch {
      // Offline and never saved: for a page, fall back to the app itself (its router shows a friendly message).
      return (request.mode === 'navigate' && (await cache.match('./index.html'))) || Response.error();
    }
  }
  // We have a saved copy: use the network if it answers in time, otherwise the saved copy.
  const timeout = new Promise((resolve) => setTimeout(() => resolve(saved), SLOW_NETWORK_MS));
  return Promise.race([network.catch(() => saved), timeout]);
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const saved = await cache.match(request);
  if (saved) return saved;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const saved = await cache.match(request);
  const network = fetch(request).then((response) => {
    if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
    return response;
  }).catch(() => saved);
  return saved ?? network;
}
