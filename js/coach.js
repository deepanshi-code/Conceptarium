// "Try this" strip over a visualization: one short tip at a time, with ‹ › to step through them.
// Dismissal is remembered per concept; a small "?" button brings it back.

// Bump the version when the steps change, so people who dismissed the old tips see the new ones once.
const storageKey = (path) => `conceptarium:coach:v3:${path}`;

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
    /* storage unavailable (private mode): the tips simply show again next time */
  }
}

export function showCoach(viewport, concept) {
  viewport.querySelector('.coach')?.remove();
  viewport.querySelector('.coach-reopen')?.remove();
  if (!concept?.steps) return;

  const card = document.createElement('div');
  card.className = 'coach';
  card.innerHTML = `
    <span class="coach-head" data-count></span>
    <span class="coach-text" data-text></span>
    <span class="coach-nav">
      <button class="coach-btn" data-prev aria-label="Previous tip">‹</button>
      <button class="coach-btn" data-next aria-label="Next tip">›</button>
      <button class="coach-btn" data-close aria-label="Close tips">×</button>
    </span>
  `;
  const reopen = document.createElement('button');
  reopen.className = 'coach-reopen';
  reopen.title = 'Show tips';
  reopen.textContent = '?';

  let i = 0;
  const show = () => {
    card.querySelector('[data-count]').textContent = `Try ${i + 1}/${concept.steps.length}`;
    const text = card.querySelector('[data-text]');
    text.innerHTML = concept.steps[i];
    text.classList.remove('swap');
    void text.offsetWidth; // restart the fade
    text.classList.add('swap');
    card.querySelector('[data-prev]').disabled = i === 0;
    card.querySelector('[data-next]').textContent = i === concept.steps.length - 1 ? '✓' : '›';
  };
  const hide = () => {
    card.hidden = true;
    reopen.hidden = false;
    remember(concept.path, true);
  };
  card.querySelector('[data-prev]').addEventListener('click', () => { i = Math.max(0, i - 1); show(); });
  card.querySelector('[data-next]').addEventListener('click', () => {
    if (i === concept.steps.length - 1) hide();
    else { i += 1; show(); }
  });
  card.querySelector('[data-close]').addEventListener('click', hide);
  reopen.addEventListener('click', () => {
    i = 0;
    show();
    card.hidden = false;
    reopen.hidden = true;
    remember(concept.path, false);
  });

  show();
  const isDismissed = dismissed(concept.path);
  card.hidden = isDismissed;
  reopen.hidden = !isDismissed;
  viewport.append(card, reopen);
}
