// Guided tour: dims the page, spotlights one real part of the site at a time, and explains it in a small card
// ("3 of 10", Back / Next, Skip tour). It walks the home page, then opens a concept to show the 3D model, its
// toolbar and the Explore / Practice / Quiz tabs. Esc skips; ← → move between steps.

const STEPS = [
  { route: '', sel: '.hero .search-bar', title: 'Search any concept', text: 'Type a topic you are studying, like <b>beams</b>, <b>AVL tree</b> or <b>Fourier</b>, and press Explore.' },
  { route: '', sel: '.sky-frame', title: 'The concept sky', text: 'Every subject is a constellation of stars. Hover a star to see its name, click it to open that concept.' },
  { route: '', sel: '.catalog-tools', title: 'Filter the list', text: 'Narrow the concepts by subject or by your course, or show only the ones with practice problems.' },
  { route: '', sel: '[data-cards] .card', title: 'One card, one concept', text: 'Each card gives the idea in one line. Badges show what you have explored ✓ and mastered ★.' },
  { route: '', sel: '[data-ask-open]', title: 'Ask a question', text: 'Stuck? Ask in plain words. Answers come from the lessons, quiz explanations and worked examples.' },
  { route: 'beam', sel: '.viewport', title: 'This is the 3D model', text: 'Drag empty space to rotate, scroll to zoom. Here, drag the <b>red load arrow</b> and watch the bending moment follow it.' },
  { route: 'beam', sel: '.view-tools', title: 'Model tools', text: 'Reset the camera, go full screen, save a picture, or copy a link that opens exactly this setup.' },
  { route: 'beam', sel: '.panel-tabs', title: 'Explore, Practice, Quiz', text: 'Every concept has the same three tabs. Start in <b>Explore</b>: move the controls and read the results.' },
  { route: 'beam', sel: '.panel-tabs [data-show="practice"]', title: 'Practice like the exam', text: 'A fresh numerical problem each time, with a step-by-step solution and a button that loads it into the model.' },
  { route: 'beam', sel: '[data-next]', title: 'Keep going', text: 'Move to the next concept from here, or use the ← → keys. That\'s it: enjoy exploring!' },
];

let state = null;

const currentRoute = () => decodeURIComponent(location.hash.replace(/^#\/?/, '').split('?')[0]);
const visible = (el) => el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';

// Wait for a step's element (its page may still be loading).
function waitFor(sel, ms = 6000) {
  return new Promise((resolve) => {
    const start = performance.now();
    const tick = () => {
      const el = [...document.querySelectorAll(sel)].find(visible);
      if (el) resolve(el);
      else if (performance.now() - start > ms) resolve(null);
      else setTimeout(tick, 100);
    };
    tick();
  });
}

export function startTour() {
  if (state) return;
  const root = document.createElement('div');
  root.className = 'gt';
  root.innerHTML = `
    <div class="gt-block"></div>
    <div class="gt-spot" aria-hidden="true"></div>
    <div class="gt-card" role="dialog" aria-modal="true" aria-labelledby="gt-title" aria-describedby="gt-text">
      <span class="gt-arrow" aria-hidden="true"></span>
      <div class="gt-top"><span class="gt-count" data-count></span><button type="button" class="gt-skip" data-skip>Skip tour</button></div>
      <h3 id="gt-title" data-title></h3>
      <p id="gt-text" data-text></p>
      <div class="gt-foot">
        <div class="gt-dots" aria-hidden="true">${STEPS.map(() => '<i></i>').join('')}</div>
        <div class="gt-btns">
          <button type="button" class="gt-back" data-back>Back</button>
          <button type="button" class="gt-next" data-next-step>Next <span aria-hidden="true">›</span></button>
        </div>
      </div>
    </div>`;
  document.body.append(root);
  document.body.classList.add('touring');
  state = { root, i: -1, el: null, raf: 0, token: 0 };

  root.querySelector('[data-skip]').addEventListener('click', endTour);
  root.querySelector('[data-back]').addEventListener('click', () => go(state.i - 1));
  root.querySelector('[data-next-step]').addEventListener('click', () => (state.i >= STEPS.length - 1 ? endTour() : go(state.i + 1)));
  document.addEventListener('keydown', onKey, true);
  addEventListener('resize', place);
  addEventListener('scroll', place, true);
  go(0);
}

function onKey(e) {
  if (!state) return;
  if (e.key === 'Escape') endTour();
  else if (e.key === 'ArrowRight') state.root.querySelector('[data-next-step]').click();
  else if (e.key === 'ArrowLeft' && state.i > 0) go(state.i - 1);
  else if (e.key === 'Tab') return; // let Tab move between the card's buttons
  else return;
  e.preventDefault();
  e.stopPropagation();
}

async function go(i) {
  if (!state || i < 0 || i >= STEPS.length) return;
  const token = ++state.token;
  const step = STEPS[i];
  state.i = i;
  const { root } = state;
  root.classList.add('moving');
  if (currentRoute() !== step.route) location.hash = `#/${step.route}`;
  const el = await waitFor(step.sel);
  if (!state || token !== state.token) return;
  if (!el) { // not on this screen size: skip it
    if (i < STEPS.length - 1) go(i + 1); else endTour();
    return;
  }
  state.el = el;
  // Home-page pieces fade in as they scroll into view; show this one now so the spotlight isn't empty.
  for (const r of [el.closest('.reveal'), ...el.querySelectorAll('.reveal')]) r?.classList.add('in');
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  // A long smooth scroll, or a card still sliding in, can move the element after the first placement.
  setTimeout(place, 900);
  setTimeout(place, 1600);
  root.querySelector('[data-count]').textContent = `${i + 1} of ${STEPS.length}`;
  root.querySelector('[data-title]').textContent = step.title;
  root.querySelector('[data-text]').innerHTML = step.text;
  root.querySelectorAll('.gt-dots i').forEach((d, k) => d.classList.toggle('on', k === i));
  root.querySelector('[data-back]').hidden = i === 0;
  root.querySelector('[data-next-step]').innerHTML = i === STEPS.length - 1 ? 'Finish' : 'Next <span aria-hidden="true">›</span>';
  // Let the smooth scroll settle, then place the spotlight and card.
  await new Promise((r) => setTimeout(r, 450));
  if (!state || token !== state.token) return;
  place();
  root.classList.remove('moving');
  root.querySelector('[data-next-step]').focus({ preventScroll: true });
}

// Spotlight around the element; the card goes below it, or above when there is more room there.
function place() {
  if (!state?.el) return;
  cancelAnimationFrame(state.raf);
  state.raf = requestAnimationFrame(() => {
    const { root, el } = state;
    const pad = 8;
    const r = el.getBoundingClientRect();
    const vw = innerWidth;
    const vh = innerHeight;
    const top = Math.max(6, r.top - pad);
    const left = Math.max(6, r.left - pad);
    const bottom = Math.min(vh - 6, r.bottom + pad);
    const right = Math.min(vw - 6, r.right + pad);
    Object.assign(root.querySelector('.gt-spot').style, { top: `${top}px`, left: `${left}px`, width: `${right - left}px`, height: `${bottom - top}px` });

    const card = root.querySelector('.gt-card');
    const cw = card.offsetWidth;
    const ch = card.offsetHeight;
    const below = vh - bottom;
    const above = top;
    let y;
    let side;
    if (below >= ch + 22) { y = bottom + 16; side = 'below'; }
    else if (above >= ch + 22) { y = top - ch - 16; side = 'above'; }
    else { // a big element (the 3D view, the concept sky) leaves no room: float the card inside it, near the bottom
      y = Math.max(10, Math.min(vh - ch - 10, bottom - ch - 20));
      side = 'inside';
    }
    const cx = Math.min(vw - cw - 10, Math.max(10, (left + right) / 2 - cw / 2));
    Object.assign(card.style, { top: `${y}px`, left: `${cx}px` });
    card.dataset.side = side;
    const ax = Math.min(cw - 24, Math.max(24, (left + right) / 2 - cx));
    card.style.setProperty('--ax', `${ax}px`);
  });
}

export function endTour() {
  if (!state) return;
  const { root } = state;
  state.token++;
  cancelAnimationFrame(state.raf);
  document.removeEventListener('keydown', onKey, true);
  removeEventListener('resize', place);
  removeEventListener('scroll', place, true);
  document.body.classList.remove('touring');
  root.classList.add('leaving');
  setTimeout(() => root.remove(), 250);
  state = null;
}

export const isTouring = () => Boolean(state);
