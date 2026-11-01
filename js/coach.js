// "Start here" card shown over a visualization: three short steps telling a first-time visitor what to try.
// Dismissal is remembered per concept; a small "?" button brings it back.

// Bump the version when the steps change, so people who dismissed the old card see the new tips once.
const storageKey = (path) => `conceptarium:coach:v2:${path}`;

function dismissed(path) {
  try {
    return localStorage.getItem(storageKey(path)) === '1';
  } catch {
    return false;
  }
}

function remember(path, value) {
  try {
    if (value) localStorage.setItem(storageKey(path), '1');
    else localStorage.removeItem(storageKey(path));
  } catch {
    /* storage unavailable (private mode): the coach simply shows again next time */
  }
}

export function showCoach(viewport, concept) {
  viewport.querySelector('.coach')?.remove();
  viewport.querySelector('.coach-reopen')?.remove();
  if (!concept?.steps) return;

  const card = document.createElement('div');
  card.className = 'coach';
  card.innerHTML = `
    <div class="coach-head"><span>Start here</span><button class="coach-close" aria-label="Close">×</button></div>
    <ol>${concept.steps.map((s) => `<li>${s}</li>`).join('')}</ol>
    <p class="coach-foot">Drag to orbit · scroll to zoom · right-drag to pan</p>
    <button class="btn small" data-got-it>Got it</button>
  `;
  const reopen = document.createElement('button');
  reopen.className = 'coach-reopen';
  reopen.title = 'How to use this';
  reopen.textContent = '?';

  const hide = () => {
    card.hidden = true;
    reopen.hidden = false;
    remember(concept.path, true);
  };
  card.querySelector('[data-got-it]').addEventListener('click', hide);
  card.querySelector('.coach-close').addEventListener('click', hide);
  reopen.addEventListener('click', () => {
    card.hidden = false;
    reopen.hidden = true;
    remember(concept.path, false);
  });

  const isDismissed = dismissed(concept.path);
  card.hidden = isDismissed;
  reopen.hidden = !isDismissed;
  viewport.append(card, reopen);
}
