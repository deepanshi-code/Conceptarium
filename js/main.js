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
import { mountHanoi } from './views/hanoi.js';
import { mountStackQueue } from './views/stackqueue.js';
import { mountNetwork } from './views/network.js';
import { mountHome } from './home.js';
import { showCoach } from './coach.js';
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
  hanoi: mountHanoi,
  stackqueue: mountStackQueue,
  network: mountNetwork,
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
  if (viewport) showCoach(viewport, concept);
  simplifyPanel(app.querySelector('.panel'), concept);
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

window.addEventListener('hashchange', render);
window.addEventListener('concept-change', refreshChrome);
render();
