// "Ask": a question box that answers from Conceptarium's own lessons (see ask/engine.js). Not an AI: it shows the
// best matching passages (big idea, how to use the model, quiz explanations, a worked example) with their source,
// and says plainly when a topic isn't covered. Everything runs in the browser, so it works offline too.
import { CATALOG, SUBJECTS, findByPath } from './catalog.js';

const KINDS = {
  idea: ['💡', 'Big idea'],
  steps: ['🧭', 'How to use the model'],
  quiz: ['✓', 'Explained'],
  example: ['✎', 'Worked example'],
};
const REPO_ISSUES = 'https://github.com/deepanshi-code/Conceptarium/issues/new';

let overlay = null;
let opener = null;
let indexPromise = null;

// The practice generators and quiz are only downloaded when Ask is first opened.
function loadIndex() {
  indexPromise ??= Promise.all([
    import('./ask/engine.js'),
    import('./quiz.js'),
    import('./practice/problems.js'),
  ]).then(([engine, { QUIZ }, { GENERATORS, seeded }]) => {
    const docs = engine.buildDocs({ catalog: CATALOG, subjects: SUBJECTS, quiz: QUIZ, practice: GENERATORS, seeded });
    return { engine, index: engine.buildIndex(docs) };
  });
  return indexPromise;
}

const currentPath = () => decodeURIComponent(location.hash.replace(/^#\/?/, '').split('?')[0]);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function suggestions(concept) {
  if (concept) {
    return [`What is ${concept.title}?`, 'How do I use this model?', 'Show a worked example', `Where is ${concept.title} used?`];
  }
  return ['What is bending moment?', 'Round robin scheduling', 'What is pH?', 'Learning rate too high'];
}

export function openAsk() {
  if (overlay) return;
  opener = document.activeElement;
  const concept = findByPath(currentPath());
  overlay = document.createElement('div');
  overlay.className = 'palette-overlay ask-overlay';
  overlay.innerHTML = `
    <div class="palette ask" role="dialog" aria-modal="true" aria-labelledby="ask-title">
      <header class="ask-head">
        <h2 id="ask-title"><span class="logo" aria-hidden="true">✦</span> Ask Conceptarium</h2>
        <button class="ask-close" type="button" aria-label="Close" data-close>×</button>
      </header>
      <form class="ask-form" data-form>
        <input type="search" placeholder="${concept ? `Ask about ${esc(concept.title)}, or any topic…` : 'Ask about any concept…'}" aria-label="Your question" data-q enterkeyhint="search" autocomplete="off">
        <button class="btn small" type="submit">Ask</button>
      </form>
      <div class="ask-chips" data-chips>${suggestions(concept).map((s) => `<button type="button" class="chip" data-suggest>${esc(s)}</button>`).join('')}</div>
      <div class="ask-results" data-results aria-live="polite"></div>
      <p class="palette-foot">Answers come from Conceptarium's own lessons, quizzes and worked examples · not AI · works offline</p>
    </div>`;
  document.body.append(overlay);
  const input = overlay.querySelector('[data-q]');
  const results = overlay.querySelector('[data-results]');

  const ask = async (question) => {
    const q = question.trim();
    if (!q) return;
    results.innerHTML = '<p class="ask-note">Looking…</p>';
    const { engine, index } = await loadIndex();
    if (!overlay) return; // closed while loading
    const hits = engine.search(index, q, { current: concept?.path ?? null, limit: 3 });
    if (!hits.length) {
      const issue = `${REPO_ISSUES}?title=${encodeURIComponent(`[Topic request] ${q.slice(0, 80)}`)}&body=${encodeURIComponent(`I asked: "${q}"\n\nWhat I hoped to learn:\n`)}`;
      results.innerHTML = `<div class="ask-empty">
        <p><b>That isn't covered in Conceptarium yet.</b> Try other words (for example the topic's name), or browse the concepts.</p>
        <p><a href="#/" data-close>Browse all concepts</a> · <a href="${issue}" target="_blank" rel="noopener">Suggest this topic</a></p>
      </div>`;
      return;
    }
    results.innerHTML = hits.map(({ doc }) => {
      const [icon, label] = KINDS[doc.kind];
      const here = doc.path === concept?.path;
      const color = SUBJECTS[findByPath(doc.path)?.subject]?.color ?? 'var(--accent)';
      const link = doc.kind === 'example'
        ? (here ? '<button type="button" class="ask-link" data-practice>Try a fresh one in Practice →</button>' : `<a class="ask-link" href="#/${doc.path}" data-close>Open ${esc(doc.title)} →</a>`)
        : (here ? '' : `<a class="ask-link" href="#/${doc.path}" data-close>Open ${esc(doc.title)} →</a>`);
      return `<article class="ask-card" style="--c:${color}">
        <p class="ask-kind"><span aria-hidden="true">${icon}</span> ${label} · <span class="ask-src">${esc(doc.title)}</span></p>
        <div class="ask-body">${doc.html}</div>
        ${link}
      </article>`;
    }).join('');
  };

  overlay.querySelector('[data-form]').addEventListener('submit', (e) => {
    e.preventDefault();
    ask(input.value);
  });
  overlay.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-suggest]');
    if (chip) {
      input.value = chip.textContent;
      ask(chip.textContent);
    }
    if (e.target.closest('[data-practice]')) {
      closeAsk();
      document.querySelector('.panel-tabs [data-show="practice"]')?.click();
    }
    if (e.target.closest('[data-close]')) closeAsk();
  });
  overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) closeAsk(); });
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAsk();
    // Keep Tab inside the dialog.
    if (e.key === 'Tab') {
      const items = [...overlay.querySelectorAll('button, a[href], input')].filter((el) => !el.disabled && el.offsetParent);
      const first = items[0];
      const last = items.at(-1);
      if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
    }
  });
  input.focus();
  loadIndex(); // start downloading while the student types
}

export function closeAsk() {
  if (!overlay) return;
  overlay.remove();
  overlay = null;
  opener?.focus?.();
}

export const isAskOpen = () => Boolean(overlay);
