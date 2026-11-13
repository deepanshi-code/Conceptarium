// Hash router. Routes look like #/drawing or #/structures/heap (optionally ?settings, see share.js); each view
// mounts into #app and returns a cleanup. A view's code is only downloaded when it is first opened.
import { mountHome } from './home.js';
import { renderHowTo } from './coach.js';
import { attachToolbar, toggleFullscreen } from './toolbar.js';
import { renderQuiz } from './quiz.js';
import { renderPractice } from './practice.js';
import { coursesFor } from './courses.js';
import { markVisited } from './progress.js';
import { openPalette } from './palette.js';
import { stageFor } from './stage.js';
import { CATALOG, SUBJECTS, findByPath } from './catalog.js';
import { parseHash, applyState, shareLink, reportLink } from './share.js';

// Routes are file names in js/views/; each file exports one mountXxx(root, arg) function.
const ROUTES = new Set([
  'eigen',
  'transforms',
  'descent',
  'structures',
  'drawing',
  'development',
  'beam',
  'fourier',
  'sections',
  'sorting',
  'scheduling',
  'efield',
  'waves',
  'projectile',
  'logic',
  'sequential',
  'hanoi',
  'stackqueue',
  'network',
  'search',
  'shm',
  'perceptron',
  'paging',
  'orbitals',
  'vsepr',
  'crystal',
  'gears',
  'engine',
  'dna',
  'cell',
  'heart',
  'mitosis',
  'replication',
  'neuron',
  'periodic',
  'bonding',
  'gaslaws',
  'galvanic',
  'photosynthesis',
  'breathing',
  'meiosis',
  'enzymes',
  'rates',
  'acidbase',
  'circuits',
  'induction',
  'threephase',
  'truss',
  'fluid',
  'stressstrain',
  'pid',
  'sampling',
  'diode',
]);

async function loadView(route) {
  const mod = await import(`./views/${route}.js`);
  return Object.values(mod).find((v) => typeof v === 'function' && v.name.startsWith('mount'));
}

const webglSupported = (() => {
  try {
    const c = document.createElement('canvas');
    return Boolean(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
})();

const app = document.getElementById('app');
let unmount = null;

const currentPath = () => parseHash().path;
let renderId = 0;

async function render() {
  const id = ++renderId;
  const { path, params } = parseHash();
  const [route, arg] = path.split('/');
  unmount?.();
  unmount = null;
  const isView = ROUTES.has(route);
  app.className = isView ? 'view' : 'home-view';
  app.replaceChildren();
  window.scrollTo(0, 0);
  if (!isView) {
    unmount = mountHome(app);
    refreshChrome();
    return;
  }
  if (!webglSupported) {
    showProblem('webgl');
    return;
  }
  app.innerHTML = '<div class="view-loading" role="status"><span class="spinner"></span>Loading…</div>';
  let mount;
  try {
    mount = await loadView(route);
  } catch (err) {
    if (id === renderId) showProblem('load', err);
    return;
  }
  if (id !== renderId) return; // the user moved on while this view was downloading
  app.replaceChildren();
  try {
    unmount = mount(app, arg);
  } catch (err) {
    showProblem('crash', err);
    return;
  }
  refreshChrome(params);
  if ([...params.keys()].some((k) => k !== 'p')) applyState(app, params);
  // A shared practice problem opens on the Practice tab.
  const panel = app.querySelector('.panel');
  if (params.has('p') && panel?.querySelector(':scope > .pane[data-pane="practice"]')) showPane(panel, 'practice');
}

// A friendly card instead of a blank page when a view can't be shown.
function showProblem(kind, err) {
  const concept = findByPath(currentPath());
  app.className = 'home-view';
  const text = {
    webgl: ['Your browser can\'t show 3D here', 'This page needs WebGL. Try turning on <b>hardware acceleration</b> in your browser settings, updating your browser, or opening it in Chrome, Edge or Firefox.'],
    load: ['This concept didn\'t load', 'Check your internet connection and reload the page. If it keeps happening, please report it.'],
    crash: ['Something went wrong in this concept', 'It\'s a bug on our side, not yours. Please report it so it can be fixed.'],
  }[kind];
  const detail = err ? `\n**Error:** \`${String(err.message ?? err).slice(0, 300)}\`` : '';
  app.innerHTML = `<div class="problem-card"><h2>${text[0]}</h2><p>${text[1]}</p>
    <div class="btn-row"><a class="btn" href="#/">← All concepts</a>${concept ? `<a class="btn secondary" target="_blank" rel="noopener" href="${reportLink(concept, location.href, detail)}">Report it</a>` : ''}</div></div>`;
  refreshChrome();
}

// Errors after a view is running (e.g. inside its animation) get a small, dismissable note with a report link.
window.addEventListener('error', (e) => {
  const concept = findByPath(currentPath());
  if (!concept || document.querySelector('.error-toast')) return;
  const toast = document.createElement('div');
  toast.className = 'error-toast';
  toast.innerHTML = `Something went wrong. <a target="_blank" rel="noopener" href="${reportLink(concept, location.href, `\n**Error:** \`${String(e.message).slice(0, 300)}\``)}">Report it</a> <button aria-label="Dismiss">×</button>`;
  toast.querySelector('button').addEventListener('click', () => toast.remove());
  document.body.append(toast);
});

// Breadcrumbs, prev/next and the concept panel's tabs all follow the current concept.
function refreshChrome(params = new URLSearchParams()) {
  const concept = findByPath(currentPath());
  const crumbs = document.querySelector('[data-crumbs]');
  const prev = document.querySelector('[data-prev]');
  const next = document.querySelector('[data-next]');
  document.body.classList.toggle('in-concept', Boolean(concept));
  if (!concept) {
    crumbs.innerHTML = '';
    document.title = 'Conceptarium';
    return;
  }
  const subject = SUBJECTS[concept.subject];
  crumbs.innerHTML = `<span class="crumb-subject" style="--c:${subject.color}">${subject.name}</span><span class="crumb-sep">›</span><span>${concept.title}</span>`;
  document.title = `${concept.title} · Conceptarium`;
  const i = CATALOG.indexOf(concept);
  const before = CATALOG[(i - 1 + CATALOG.length) % CATALOG.length];
  const after = CATALOG[(i + 1) % CATALOG.length];
  prev.href = `#/${before.path}`;
  prev.title = `Previous: ${before.title}`;
  next.href = `#/${after.path}`;
  next.innerHTML = `Next: ${after.title} →`;
  const viewport = app.querySelector('.viewport');
  if (viewport) attachToolbar(viewport, concept);
  const panel = app.querySelector('.panel');
  simplifyPanel(panel, concept);
  if (panel) {
    renderQuiz(panel, concept);
    const seed = Number(params.get('p'));
    renderPractice(panel, concept, app, Number.isInteger(seed) && seed > 0 ? seed : undefined);
    renderReport(panel, concept);
    layoutPanel(panel, concept);
  }
  markVisited(concept.path);
}

// The concept panel in three numbered tabs, so only one job shows at a time:
//   1 Explore (how-to steps, the model's controls and results) · 2 Practice (a numerical problem) · 3 Quiz.
// The title and the one-line idea stay above the tabs. Runs again on data-structure tab changes: idempotent.
const PANES = [['explore', 'Explore'], ['practice', 'Practice'], ['quiz', 'Quiz']];

function layoutPanel(panel, concept) {
  let explore = panel.querySelector(':scope > .pane[data-pane="explore"]');
  if (!explore) {
    const header = new Set([panel.querySelector(':scope > h2'), panel.querySelector(':scope > .big-idea'), panel.querySelector(':scope > details.more')]);
    explore = document.createElement('div');
    explore.className = 'pane';
    explore.dataset.pane = 'explore';
    for (const el of [...panel.children]) {
      if (!header.has(el) && !el.matches('.practice, .quiz, .report')) explore.append(el);
    }
    const tabs = document.createElement('nav');
    tabs.className = 'panel-tabs';
    tabs.setAttribute('role', 'tablist');
    tabs.addEventListener('click', (e) => {
      const b = e.target.closest('[data-show]');
      if (b) showPane(panel, b.dataset.show);
    });
    const last = [...header].filter(Boolean).at(-1);
    if (last) last.after(tabs, explore);
    else panel.prepend(tabs, explore);
  }
  // Practice and quiz are re-rendered on every refresh; put each into its own pane.
  for (const [name] of PANES.slice(1)) {
    const section = panel.querySelector(`.${name}`);
    let pane = panel.querySelector(`:scope > .pane[data-pane="${name}"]`);
    if (!section) { pane?.remove(); continue; }
    if (!pane) {
      pane = document.createElement('div');
      pane.className = 'pane';
      pane.dataset.pane = name;
      const report = panel.querySelector(':scope > .report');
      if (report) report.before(pane);
      else panel.append(pane);
    }
    pane.replaceChildren(section);
  }
  renderHowTo(explore, concept);
  const tabs = panel.querySelector('.panel-tabs');
  const available = PANES.filter(([name]) => panel.querySelector(`:scope > .pane[data-pane="${name}"]`));
  tabs.innerHTML = available.map(([name, label], i) => `<button role="tab" data-show="${name}"><b>${i + 1}</b> ${label}</button>`).join('');
  showPane(panel, available.some(([n]) => n === panel.dataset.pane) ? panel.dataset.pane : 'explore');
}

function showPane(panel, name) {
  panel.dataset.pane = name;
  for (const pane of panel.querySelectorAll(':scope > .pane')) pane.hidden = pane.dataset.pane !== name;
  for (const b of panel.querySelectorAll('.panel-tabs [data-show]')) b.setAttribute('aria-selected', String(b.dataset.show === name));
  const tabs = panel.querySelector('.panel-tabs');
  if (tabs && panel.scrollTop > tabs.offsetTop) panel.scrollTop = tabs.offsetTop - 8;
}

// "?" opens the how-to steps (Explore tab).
function showHowTo() {
  const panel = app.querySelector('.panel');
  if (!panel) return;
  showPane(panel, 'explore');
  const box = panel.querySelector('.howto');
  if (box) {
    box.open = true;
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// "Report a mistake" at the bottom of every concept: opens a pre-filled GitHub issue with a link to this exact state.
function renderReport(panel, concept) {
  panel.querySelector('.report')?.remove();
  const p = document.createElement('p');
  p.className = 'report';
  p.innerHTML = '<a target="_blank" rel="noopener" href="#">⚑ Spotted a mistake? Report it</a>';
  p.querySelector('a').addEventListener('click', (e) => { e.currentTarget.href = reportLink(concept, shareLink(app, concept.path)); });
  panel.append(p);
}

// Keep the side panel light: the one-line idea and a real-world use come first, and the longer
// explanation is folded under "Explain more". Runs again on data-structure tab changes, so it is idempotent.
function simplifyPanel(panel, concept) {
  if (!panel || !concept.idea) return;
  let idea = panel.querySelector('.big-idea');
  if (!idea) {
    idea = document.createElement('div');
    idea.className = 'big-idea';
    const lede = panel.querySelector('.lede');
    if (lede) {
      lede.before(idea);
      const more = document.createElement('details');
      more.className = 'more';
      more.innerHTML = '<summary>Explain more</summary>';
      lede.replaceWith(more);
      more.append(lede);
    } else {
      panel.querySelector('h2').after(idea);
    }
  }
  const courses = coursesFor(concept.path);
  idea.innerHTML = `<p>${concept.idea}</p><small><span aria-hidden="true">🌍</span> Used in: ${concept.real}</small>`
    + (courses.length ? `<small class="course-line"><span aria-hidden="true">📘</span> Course: ${courses.join(', ')}</small>` : '');
}

// Long hints are clamped to two lines in CSS; a click shows the rest.
app.addEventListener('click', (e) => e.target.closest('.panel .hint')?.classList.toggle('open'));

// Keyboard shortcuts. Ctrl/⌘ + K or / opens quick search anywhere; the rest only apply inside a concept and
// never while typing in a field (arrow keys still move sliders when a slider has focus).
window.addEventListener('keydown', (e) => {
  const typing = e.target.closest?.('input, textarea, select, [contenteditable]');
  if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) {
    e.preventDefault();
    openPalette();
    return;
  }
  if (typing || e.ctrlKey || e.metaKey || e.altKey || !document.body.classList.contains('in-concept')) return;
  const viewport = app.querySelector('.viewport');
  if (e.key === 'ArrowRight') document.querySelector('[data-next]').click();
  else if (e.key === 'ArrowLeft') document.querySelector('[data-prev]').click();
  else if (e.key === 'r' || e.key === 'R') stageFor(viewport)?.resetView();
  else if (e.key === 'f' || e.key === 'F') toggleFullscreen(viewport);
  else if (e.key === '?') showHowTo();
  else return;
  e.preventDefault();
});
document.querySelector('[data-search-open]')?.addEventListener('click', openPalette);

window.addEventListener('hashchange', render);
window.addEventListener('concept-change', () => refreshChrome());
render();
