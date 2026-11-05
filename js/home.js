// Home page, in three sections:
//  1. Hero: centred headline over the northern lights, with a 3D planet horizon that rises as you scroll.
//  2. The concept sky: constellations of concepts; click a star to open it.
//  3. All concepts: searchable, filterable cards that tilt in 3D.
import { CATALOG, SUBJECTS } from './catalog.js';
import { buildSky } from './sky.js';
import { progressFor, summary, resetProgress } from './progress.js';

const TRY = ['sections', 'sorting', 'waves', 'structures/tree'];

export function mountHome(root) {
  const tryChips = TRY.map((path) => CATALOG.find((c) => c.path === path)).filter(Boolean);
  root.innerHTML = `
    <section class="hero">
      <div class="hero-sky" data-sky></div>
      <div class="hero-grid" data-tiles aria-hidden="true"></div>
      <div class="hero-copy">
        <p class="eyebrow blur-in" style="--d:0s"><span class="dot"></span>A planetarium for engineering concepts</p>
        <h1 class="blur-in" style="--d:0.1s">See the concepts you were told to <em>imagine</em></h1>
        <p class="script blur-in" style="--d:0.3s">from textbook diagrams to living 3D</p>
        <p class="hero-sub blur-in" style="--d:0.45s">${CATALOG.length} interactive 3D models. Drag them, change the numbers, see what happens.</p>
        <form class="search-bar blur-in" style="--d:0.6s" data-hero-search>
          <span class="search-icon" aria-hidden="true">⌕</span>
          <input type="search" placeholder="Search a concept: projection, AVL, Fourier…" aria-label="Search concepts" data-hero-input>
          <button class="btn" type="submit">Explore →</button>
        </form>
        <div class="try blur-in" style="--d:0.75s">
          <span>Try:</span>
          ${tryChips.map((c) => `<a class="try-chip" href="#/${c.path}"><b>#</b> ${c.title}</a>`).join('')}
        </div>
      </div>
      <a class="scroll-cue" href="#sky" data-scroll="#sky">See the concept sky ↓</a>
    </section>

    <section class="sky-section" id="sky">
      <div class="section-head centered reveal">
        <span class="pill-tag"><span class="dot"></span>The concept sky</span>
        <h2>Every subject is a <em>constellation</em></h2>
        <p>Hover a star to see its name, click to open it. Drag to look around.</p>
      </div>
      <div class="sky-frame reveal" data-map></div>
    </section>

    <section class="catalog" id="catalog">
      <div class="section-head centered reveal">
        <span class="pill-tag"><span class="dot"></span>All concepts</span>
        <h2>Pick a concept. <em>Learn it by moving it.</em></h2>
      </div>
      <div class="progress-strip reveal" data-progress></div>
      <div class="catalog-tools reveal">
        <input type="search" placeholder="Filter concepts…" data-search aria-label="Filter concepts">
        <div class="chips" data-chips>
          <button class="chip active" data-subject="">All</button>
          ${Object.entries(SUBJECTS).map(([key, s]) => `<button class="chip" data-subject="${key}" style="--c:${s.color}">${s.name}</button>`).join('')}
        </div>
      </div>
      <div data-cards></div>
      <p class="empty" data-empty hidden>No concept matches that search yet.</p>
    </section>
  `;

  const $ = (sel) => root.querySelector(sel);
  const state = { query: '', subject: '' };

  // --- Cards -------------------------------------------------------------
  // With no search or filter, cards are grouped under a heading per subject; otherwise they form one grid.
  const cardHtml = (c, i) => {
    const s = SUBJECTS[c.subject];
    const p = progressFor(c.path);
    const badge = p.quiz && p.quiz === p.quizTotal ? '<span class="card-badge gold">★ Mastered</span>' : p.visited ? '<span class="card-badge">✓ Explored</span>' : '';
    return `
        <a class="card reveal" href="#/${c.path}" style="--c:${s.color}; --d:${(i % 4) * 0.06}s">
          <div class="card-top">
            <span class="card-icon" aria-hidden="true">${c.icon}</span>
            <small>${s.name}</small>
          </div>
          <h2>${c.title}</h2>
          <p>${c.idea ?? c.blurb}</p>
          <div class="card-foot"><span class="go">Explore →</span>${badge}</div>
        </a>`;
  };
  function renderCards() {
    const q = state.query.trim().toLowerCase();
    const list = CATALOG.filter((c) => (!state.subject || c.subject === state.subject)
      && (!q || `${c.title} ${c.idea} ${c.blurb} ${c.real} ${SUBJECTS[c.subject].name}`.toLowerCase().includes(q)));
    const grouped = !q && !state.subject;
    $('[data-cards]').innerHTML = grouped
      ? Object.entries(SUBJECTS).map(([key, s]) => {
        const members = list.filter((c) => c.subject === key);
        return `
          <section class="subject-group" style="--c:${s.color}">
            <h3 class="subject-head">${s.name} <span>${members.length}</span></h3>
            <div class="cards">${members.map(cardHtml).join('')}</div>
          </section>`;
      }).join('')
      : `<div class="cards">${list.map(cardHtml).join('')}</div>`;
    $('[data-empty]').hidden = list.length > 0;
    root.querySelectorAll('[data-cards] .reveal').forEach((el) => revealer.observe(el));
  }

  // Sections and cards blur-and-fade in the first time they scroll into view.
  const revealer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('in');
      revealer.unobserve(entry.target);
    }
  }, { root, threshold: 0.12 });
  root.querySelectorAll('.reveal').forEach((el) => revealer.observe(el));

  $('[data-search]').addEventListener('input', (e) => {
    state.query = e.target.value;
    renderCards();
  });
  root.querySelectorAll('[data-subject]').forEach((chip) => chip.addEventListener('click', () => {
    state.subject = chip.dataset.subject;
    root.querySelectorAll('[data-subject]').forEach((c) => c.classList.toggle('active', c === chip));
    renderCards();
  }));

  // The hero search filters the catalog and scrolls down to it.
  $('[data-hero-search]').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = $('[data-hero-input]').value;
    $('[data-search]').value = q;
    state.query = q;
    renderCards();
    $('#catalog').scrollIntoView({ behavior: 'smooth' });
  });
  root.querySelectorAll('[data-scroll]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    $(a.dataset.scroll).scrollIntoView({ behavior: 'smooth' });
  }));

  // 3D tilt: each card leans gently towards the pointer, and a soft glow in the subject colour follows the cursor. One delegated listener covers cards re-rendered by search.
  const MAX_TILT = 4; // degrees
  const cards = $('[data-cards]');
  cards.addEventListener('pointermove', (e) => {
    const card = e.target.closest('.card');
    if (!card || e.pointerType === 'touch') return;
    const r = card.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    card.style.transform = `perspective(900px) rotateY(${(px - 0.5) * 2 * MAX_TILT}deg) rotateX(${(0.5 - py) * 2 * MAX_TILT}deg) translateY(-2px)`;
    card.style.setProperty('--mx', `${px * 100}%`);
    card.style.setProperty('--my', `${py * 100}%`);
  });
  cards.addEventListener('pointerout', (e) => {
    const card = e.target.closest('.card');
    if (card && !card.contains(e.relatedTarget)) card.style.transform = '';
  });

  // Progress across all concepts (stored in this browser only).
  function renderProgress() {
    const { visited, mastered } = summary(CATALOG.map((c) => c.path));
    const pct = Math.round((visited / CATALOG.length) * 100);
    $('[data-progress]').innerHTML = visited
      ? `<div class="progress-text"><b>${visited}</b> of ${CATALOG.length} explored · <b>${mastered}</b> mastered <button class="link-btn" data-reset-progress>reset</button></div>
         <div class="progress-bar"><span style="width:${pct}%"></span></div>`
      : '<div class="progress-text">New here? Start anywhere. Each concept takes about 5 minutes, and ends with a 2-question check. Tip: press <kbd>Ctrl K</kbd> to jump to any concept.</div>';
  }
  $('[data-progress]').addEventListener('click', (e) => {
    if (!e.target.closest('[data-reset-progress]')) return;
    resetProgress();
    renderProgress();
    renderCards();
  });

  renderProgress();
  renderCards();
  scatterTiles($('[data-tiles]'));

  const hero = buildSky($('[data-sky]'), { mode: 'hero', scrollEl: root });
  const map = buildSky($('[data-map]'), { mode: 'map' });
  return () => {
    revealer.disconnect();
    hero.dispose();
    map.dispose();
  };
}

// A few grid squares that glow and fade at random, over the faint grid lines drawn in CSS.
function scatterTiles(container) {
  const CELL = 48;
  for (let i = 0; i < 22; i++) {
    const tile = document.createElement('span');
    tile.className = 'tile';
    tile.style.left = `${Math.floor(Math.random() * 40) * CELL}px`;
    tile.style.top = `${Math.floor(Math.random() * 16) * CELL}px`;
    tile.style.animationDelay = `${(Math.random() * 6).toFixed(2)}s`;
    tile.style.animationDuration = `${(4 + Math.random() * 4).toFixed(2)}s`;
    container.appendChild(tile);
  }
}
