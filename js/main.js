// Hash router: each route mounts a view into #app and returns a cleanup function.
import { mountEigen } from './views/eigen.js';
import { mountTransforms } from './views/transforms.js';
import { mountDescent } from './views/descent.js';
import { mountStructures } from './views/structures.js';
import { html } from './ui.js';

const ROUTES = {
  eigen: mountEigen,
  transforms: mountTransforms,
  descent: mountDescent,
  structures: mountStructures,
};

const TOPICS = [
  {
    route: 'eigen',
    subject: 'Engineering Mathematics · Linear Algebra',
    title: 'Matrix & Eigenvectors',
    text: 'Watch a 3×3 matrix bend all of space, and see which directions refuse to turn.',
  },
  {
    route: 'transforms',
    subject: 'Computer Graphics',
    title: '3D Transformations',
    text: 'Build the 4×4 model matrix from translate, rotate and scale, and see why order matters.',
  },
  {
    route: 'descent',
    subject: 'Machine Learning · Optimization',
    title: 'Gradient Descent',
    text: 'Roll gradient descent, Momentum and Adam down a loss surface. Watch them zig-zag, stall on saddles and diverge.',
  },
  {
    route: 'structures',
    subject: 'Data Structures',
    title: 'Lists, Trees, Heaps, Graphs & Hashing',
    text: 'See lists scattered across memory, AVL rotations, B+ tree splits, BFS and Dijkstra rising by distance, and hash collisions stacking up, all step by step.',
  },
];

const app = document.getElementById('app');
let unmount = null;

function mountHome(root) {
  root.innerHTML = html`
    <section class="home">
      <h1>See the concepts you were told to <em>imagine</em>.</h1>
      <p>Interactive 3D models of engineering topics that are hard to picture from a textbook. Drag to orbit, scroll to zoom, change the numbers and watch what happens.</p>
      <div class="cards">
        ${TOPICS.map((t) => html`
          <a class="card" href="#/${t.route}">
            <small>${t.subject}</small>
            <h2>${t.title}</h2>
            <p>${t.text}</p>
            <span class="go">Open →</span>
          </a>`).join('')}
      </div>
    </section>
  `;
  return null;
}

function render() {
  const route = location.hash.replace(/^#\/?/, '');
  unmount?.();
  app.className = ROUTES[route] ? 'view' : '';
  unmount = (ROUTES[route] ?? mountHome)(app);
  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === route));
}

window.addEventListener('hashchange', render);
render();
