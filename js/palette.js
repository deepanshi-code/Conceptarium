// Quick search: Ctrl+K (or /) opens a box to jump to any concept by typing part of its name, subject or idea.
import { CATALOG, SUBJECTS } from './catalog.js';
import { progressFor } from './progress.js';

let overlay = null;

export function openPalette() {
  if (overlay) return;
  overlay = document.createElement('div');
  overlay.className = 'palette-overlay';
  overlay.innerHTML = `
    <div class="palette" role="dialog" aria-label="Jump to a concept">
      <input type="text" placeholder="Jump to a concept…" aria-label="Search concepts" data-q>
      <ul data-list role="listbox"></ul>
      <p class="palette-foot">↑ ↓ to move · Enter to open · Esc to close</p>
    </div>`;
  document.body.append(overlay);
  const input = overlay.querySelector('[data-q]');
  const list = overlay.querySelector('[data-list]');
  let matches = [];
  let active = 0;

  const render = () => {
    const q = input.value.trim().toLowerCase();
    matches = CATALOG.filter((c) => !q || `${c.title} ${SUBJECTS[c.subject].name} ${c.idea} ${c.real}`.toLowerCase().includes(q));
    active = Math.min(active, Math.max(0, matches.length - 1));
    list.innerHTML = matches.length
      ? matches.map((c, i) => {
        const p = progressFor(c.path);
        const badge = p.quiz && p.quiz === p.quizTotal ? '★' : p.visited ? '✓' : '';
        return `<li role="option" data-i="${i}" class="${i === active ? 'active' : ''}" style="--c:${SUBJECTS[c.subject].color}">
          <span class="palette-icon">${c.icon}</span><span class="palette-title">${c.title}</span>
          <small>${SUBJECTS[c.subject].name}</small><span class="palette-badge">${badge}</span></li>`;
      }).join('')
      : '<li class="palette-empty">No concept matches that.</li>';
    list.querySelector('.active')?.scrollIntoView({ block: 'nearest' });
  };
  const go = (c) => {
    if (!c) return;
    close();
    location.hash = `#/${c.path}`;
  };

  input.addEventListener('input', () => { active = 0; render(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { active = Math.min(matches.length - 1, active + 1); render(); e.preventDefault(); }
    if (e.key === 'ArrowUp') { active = Math.max(0, active - 1); render(); e.preventDefault(); }
    if (e.key === 'Enter') go(matches[active]);
    if (e.key === 'Escape') close();
  });
  list.addEventListener('click', (e) => go(matches[Number(e.target.closest('[data-i]')?.dataset.i)]));
  overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) close(); });
  render();
  input.focus();
}

export function closePalette() {
  overlay?.remove();
  overlay = null;
}
const close = closePalette;
