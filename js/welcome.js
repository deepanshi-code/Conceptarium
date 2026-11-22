// Welcome intro: a cursive "hello" writes itself in one continuous pen stroke, then opens into
// "Welcome to Conceptarium". About four seconds in all. Plays each time the site is opened on the home page; #/hello replays it.
// Skippable at any moment (button, Esc), and replaced by a still welcome card if the device asks for less motion.
import { CATALOG, SUBJECTS } from './catalog.js';
import { startTour } from './tour.js';

// "hello" as one hand-drawn line (our own lettering), drawn from start to end by animating its dash offset.
const HELLO = 'M 28 200 C 60 185, 105 130, 112 85 C 117 55, 92 48, 86 75 C 79 108, 76 160, 74 205 C 84 168, 100 142, 120 143 C 140 144, 136 178, 140 196 C 145 212, 165 206, 180 190 C 198 172, 214 150, 198 140 C 182 131, 165 155, 168 180 C 171 205, 200 212, 226 190 C 252 166, 276 112, 276 82 C 276 56, 253 56, 251 86 C 248 122, 246 176, 256 198 C 263 212, 282 206, 296 190 C 322 166, 346 112, 346 82 C 346 56, 323 56, 321 86 C 318 122, 316 176, 326 198 C 333 212, 352 206, 368 188 C 382 168, 398 142, 418 142 C 443 142, 448 176, 433 196 C 418 214, 386 206, 389 180 C 392 158, 421 140, 446 150 C 462 156, 476 152, 492 140';

let active = null;

export function showWelcome() {
  if (active) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const opener = document.activeElement;
  const el = document.createElement('div');
  el.className = 'welcome';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'Welcome to Conceptarium');
  el.innerHTML = `
    <canvas class="welcome-sky" aria-hidden="true"></canvas>
    <div class="welcome-glow" aria-hidden="true"></div>
    <div class="welcome-stage" aria-hidden="true">
      <svg class="welcome-word" viewBox="0 0 520 260">
        <defs>
          <linearGradient id="welcome-ink" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" class="ink-1"/><stop offset="0.5" class="ink-2"/><stop offset="1" class="ink-3"/>
          </linearGradient>
        </defs>
        <path d="${HELLO}" data-word/>
      </svg>
    </div>
    <div class="welcome-final" data-final hidden>
      <div class="welcome-mark"><span class="welcome-ring"></span><span class="logo">✦</span></div>
      <h1>Welcome to Concept<em>arium</em></h1>
      <p class="welcome-tag">${CATALOG.length} interactive 3D models across ${Object.keys(SUBJECTS).length} subjects. New here? A one-minute tour shows you around.</p>
      <div class="welcome-actions">
        <button class="btn welcome-start" type="button" data-tour>Take a quick tour →</button>
        <button class="welcome-later" type="button" data-start>Skip, I'll explore</button>
      </div>
      <p class="welcome-foot">Free · no sign-up · your progress stays on this device</p>
    </div>
    <button class="welcome-skip" type="button" data-skip>Skip intro</button>`;
  document.body.append(el);
  document.body.classList.add('welcome-open');
  active = el;

  const timers = [];
  const later = (ms, fn) => timers.push(setTimeout(fn, ms));
  const stopSky = reduce ? () => {} : startSky(el.querySelector('canvas'));
  const word = el.querySelector('[data-word]');
  const stage = el.querySelector('.welcome-stage');
  const final = el.querySelector('[data-final]');
  const skip = el.querySelector('[data-skip]');

  function showFinal() {
    timers.forEach(clearTimeout);
    stage.hidden = true;
    skip.hidden = true;
    final.hidden = false;
    el.classList.add('is-final');
    el.querySelector('[data-tour]').focus();
  }

  function close() {
    if (!active) return;
    timers.forEach(clearTimeout);
    active = null;
    el.classList.add('leaving');
    document.body.classList.remove('welcome-open');
    window.dispatchEvent(new Event('welcome-closed')); // the home page builds its 3D skies now (see home.js)
    document.removeEventListener('keydown', onKey, true);
    const done = () => { stopSky(); el.remove(); };
    if (reduce) done();
    else setTimeout(done, 650);
    if (opener && opener !== document.body) opener.focus?.();
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Tab') { // keep focus inside
      const items = [...el.querySelectorAll('button')].filter((b) => !b.hidden && b.offsetParent);
      if (items.length) { e.preventDefault(); items[(items.indexOf(document.activeElement) + 1) % items.length].focus(); }
    }
  }
  document.addEventListener('keydown', onKey, true);
  skip.addEventListener('click', showFinal);
  el.querySelector('[data-start]').addEventListener('click', close);
  // The tour starts once the welcome screen has faded away.
  el.querySelector('[data-tour]').addEventListener('click', () => { close(); setTimeout(startTour, reduce ? 0 : 500); });

  if (reduce) {
    showFinal();
    return;
  }
  skip.focus();

  // Write "hello" in one stroke, hold it a moment, then melt into the welcome screen.
  const length = Math.ceil(word.getTotalLength());
  word.style.strokeDasharray = `${length}`;
  word.style.strokeDashoffset = `${length}`;
  later(350, () => stage.classList.add('in'));
  later(350 + 2600 + 700, () => stage.classList.add('out'));
  later(350 + 2600 + 700 + 500, showFinal);
}

// Slowly rising, twinkling stars behind the greeting.
function startSky(canvas) {
  const ctx = canvas.getContext('2d');
  // Mostly white stars with a few lavender and aqua ones, like the home page sky.
  const colors = ['#ffffff', '#ffffff', '#ffffff', '#e0d7ff', '#c4b5fd', '#a5f3fc'];
  let w = 0;
  let h = 0;
  let raf = 0;
  const dpr = Math.min(2, devicePixelRatio || 1);
  const resize = () => {
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  addEventListener('resize', resize);
  const count = Math.round(Math.min(90, (w * h) / 14000));
  // One glowing-dot image per colour, drawn once; each frame only stamps them (a live canvas blur per star
  // every frame was the slowest part of the intro).
  const sprites = Object.fromEntries([...new Set(colors)].map((c) => {
    const size = 32;
    const sp = document.createElement('canvas');
    sp.width = sp.height = size;
    const g = sp.getContext('2d');
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, c);
    grad.addColorStop(0.18, c);
    grad.addColorStop(0.4, `${c}55`);
    grad.addColorStop(1, `${c}00`);
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    return [c, sp];
  }));
  const dots = Array.from({ length: count }, () => ({
    x: Math.random(), y: Math.random(), r: 0.6 + Math.random() * 2.2, v: 0.004 + Math.random() * 0.012,
    c: colors[Math.floor(Math.random() * colors.length)], p: Math.random() * Math.PI * 2,
  }));
  const frame = (t) => {
    ctx.clearRect(0, 0, w, h);
    for (const d of dots) {
      d.y -= d.v / 60;
      if (d.y < -0.02) { d.y = 1.02; d.x = Math.random(); }
      ctx.globalAlpha = 0.35 + 0.45 * Math.sin(t / 900 + d.p);
      const size = d.r * 7;
      ctx.drawImage(sprites[d.c], d.x * w - size / 2, d.y * h - size / 2, size, size);
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => { cancelAnimationFrame(raf); removeEventListener('resize', resize); };
}
