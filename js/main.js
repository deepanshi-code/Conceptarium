// Hash router. Routes look like #/drawing or #/structures/heap; each view mounts into #app and returns a cleanup.
import { mountEigen } from './views/eigen.js';
import { mountTransforms } from './views/transforms.js';
import { mountDescent } from './views/descent.js';
import { mountStructures } from './views/structures.js';
import { mountDrawing } from './views/drawing.js';
import { mountDevelopment } from './views/development.js';
import { mountBeam } from './views/beam.js';
import { mountFourier } from './views/fourier.js';
import { mountSections } from './views/sections.js';
import { mountSorting } from './views/sorting.js';
import { mountScheduling } from './views/scheduling.js';
import { mountEfield } from './views/efield.js';
import { mountWaves } from './views/waves.js';
import { mountProjectile } from './views/projectile.js';
import { mountLogic } from './views/logic.js';
import { mountSequential } from './views/sequential.js';
import { mountHanoi } from './views/hanoi.js';
import { mountStackQueue } from './views/stackqueue.js';
import { mountNetwork } from './views/network.js';
import { mountSearch } from './views/search.js';
import { mountShm } from './views/shm.js';
import { mountPerceptron } from './views/perceptron.js';
import { mountPaging } from './views/paging.js';
import { mountOrbitals } from './views/orbitals.js';
import { mountVsepr } from './views/vsepr.js';
import { mountCrystal } from './views/crystal.js';
import { mountGears } from './views/gears.js';
import { mountEngine } from './views/engine.js';
import { mountDna } from './views/dna.js';
import { mountCell } from './views/cell.js';
import { mountHeart } from './views/heart.js';
import { mountMitosis } from './views/mitosis.js';
import { mountReplication } from './views/replication.js';
import { mountNeuron } from './views/neuron.js';
import { mountPeriodic } from './views/periodic.js';
import { mountBonding } from './views/bonding.js';
import { mountGasLaws } from './views/gaslaws.js';
import { mountGalvanic } from './views/galvanic.js';
import { mountPhotosynthesis } from './views/photosynthesis.js';
import { mountBreathing } from './views/breathing.js';
import { mountMeiosis } from './views/meiosis.js';
import { mountEnzymes } from './views/enzymes.js';
import { mountRates } from './views/rates.js';
import { mountAcidBase } from './views/acidbase.js';
import { mountHome } from './home.js';
import { showCoach } from './coach.js';
import { attachToolbar, toggleFullscreen } from './toolbar.js';
import { renderQuiz } from './quiz.js';
import { markVisited } from './progress.js';
import { openPalette } from './palette.js';
import { stageFor } from './stage.js';
import { CATALOG, SUBJECTS, findByPath } from './catalog.js';

const VIEWS = {
  eigen: mountEigen,
  transforms: mountTransforms,
  descent: mountDescent,
  structures: mountStructures,
  drawing: mountDrawing,
  development: mountDevelopment,
  beam: mountBeam,
  fourier: mountFourier,
  sections: mountSections,
  sorting: mountSorting,
  scheduling: mountScheduling,
  efield: mountEfield,
  waves: mountWaves,
  projectile: mountProjectile,
  logic: mountLogic,
  sequential: mountSequential,
  hanoi: mountHanoi,
  stackqueue: mountStackQueue,
  network: mountNetwork,
  search: mountSearch,
  shm: mountShm,
  perceptron: mountPerceptron,
  paging: mountPaging,
  orbitals: mountOrbitals,
  vsepr: mountVsepr,
  crystal: mountCrystal,
  gears: mountGears,
  engine: mountEngine,
  dna: mountDna,
  cell: mountCell,
  heart: mountHeart,
  mitosis: mountMitosis,
  replication: mountReplication,
  neuron: mountNeuron,
  periodic: mountPeriodic,
  bonding: mountBonding,
  gaslaws: mountGasLaws,
  galvanic: mountGalvanic,
  photosynthesis: mountPhotosynthesis,
  breathing: mountBreathing,
  meiosis: mountMeiosis,
  enzymes: mountEnzymes,
  rates: mountRates,
  acidbase: mountAcidBase,
};

const app = document.getElementById('app');
let unmount = null;

const currentPath = () => location.hash.replace(/^#\/?/, '');

function render() {
  const path = currentPath();
  const [route, arg] = path.split('/');
  unmount?.();
  unmount = null;
  const mount = VIEWS[route];
  app.className = mount ? 'view' : 'home-view';
  app.replaceChildren();
  unmount = mount ? mount(app, arg) : mountHome(app);
  window.scrollTo(0, 0);
  refreshChrome();
}

// Breadcrumbs, prev/next and the "Start here" coach all follow the current concept.
function refreshChrome() {
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
  if (viewport) {
    showCoach(viewport, concept);
    attachToolbar(viewport, concept);
  }
  const panel = app.querySelector('.panel');
  simplifyPanel(panel, concept);
  if (panel) renderQuiz(panel, concept);
  markVisited(concept.path);
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
  idea.innerHTML = `<p>${concept.idea}</p><small><span aria-hidden="true">🌍</span> Used in: ${concept.real}</small>`;
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
  else if (e.key === '?') viewport.querySelector('.coach-reopen:not([hidden])')?.click();
  else return;
  e.preventDefault();
});
document.querySelector('[data-search-open]')?.addEventListener('click', openPalette);

window.addEventListener('hashchange', render);
window.addEventListener('concept-change', refreshChrome);
render();
