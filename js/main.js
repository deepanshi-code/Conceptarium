// Hash router. Routes look like #/drawing or #/structures/heap; each view mounts into #app and returns a cleanup.
import { mountEigen } from './views/eigen.js';
import { mountTransforms } from './views/transforms.js';
import { mountDescent } from './views/descent.js';
import { mountStructures } from './views/structures.js';
import { mountDrawing } from './views/drawing.js';
import { mountDevelopment } from './views/development.js';
import { mountBeam } from './views/beam.js';
import { mountFourier } from './views/fourier.js';
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
}

window.addEventListener('hashchange', render);
window.addEventListener('concept-change', refreshChrome);
render();
