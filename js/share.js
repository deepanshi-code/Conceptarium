// Shareable links. A concept's URL can carry its control settings and the current practice problem, e.g.
//   #/beam?type=simply&L=8&P=30&a=0.25&p=123456
// so a teacher can send everyone exactly the same model and the same problem.

export const REPO_URL = 'https://github.com/deepanshi-code/Conceptarium';

/** Split the hash into the route path and its query parameters. */
export function parseHash(hash = location.hash) {
  const raw = hash.replace(/^#\/?/, '');
  const q = raw.indexOf('?');
  return { path: q < 0 ? raw : raw.slice(0, q), params: new URLSearchParams(q < 0 ? '' : raw.slice(q + 1)) };
}

// Controls that belong to the model (not the practice card, quiz or tips).
const controls = (root) => [...root.querySelectorAll('.panel input, .panel select')]
  .filter((el) => !el.closest('.practice, .quiz, .coach'));

// A control's key: its radio group name, or its first data-* attribute (with the value when it has one).
function keyOf(el) {
  if (el.type === 'radio') return el.name ? `r.${el.name}` : null;
  const attr = [...el.attributes].find((a) => a.name.startsWith('data-'));
  if (!attr) return null;
  return attr.value ? `${attr.name.slice(5)}.${attr.value}` : attr.name.slice(5);
}

/** The current model settings as URL parameters. */
export function captureState(root) {
  const params = new URLSearchParams();
  // Selected tab buttons (circuit layout, algorithm, molecule …).
  for (const b of root.querySelectorAll('.panel [aria-selected="true"]')) {
    const attr = [...b.attributes].find((a) => a.name.startsWith('data-') && a.value);
    if (attr) params.set(`t.${attr.name.slice(5)}`, attr.value);
  }
  for (const el of controls(root)) {
    const key = keyOf(el);
    if (!key) continue;
    if (el.type === 'radio') { if (el.checked) params.set(key, el.value); }
    else if (el.type === 'checkbox') params.set(key, el.checked ? '1' : '0');
    else if (el.value !== '' && el.value.length <= 120) params.set(key, el.value);
  }
  return params;
}

/** Restore settings from URL parameters by driving the view's own controls (tabs, then choices, then values). */
export function applyState(root, params) {
  const fire = (el, type) => el.dispatchEvent(new Event(type, { bubbles: true }));
  for (const [key, value] of params) {
    if (!key.startsWith('t.')) continue;
    root.querySelector(`.panel [data-${CSS.escape(key.slice(2))}="${CSS.escape(value)}"]`)?.click();
  }
  const els = controls(root);
  const ordered = [...els.filter((e) => e.type === 'radio' || e.tagName === 'SELECT' || e.type === 'checkbox'), ...els.filter((e) => !(e.type === 'radio' || e.tagName === 'SELECT' || e.type === 'checkbox'))];
  for (const el of ordered) {
    if (!el.isConnected) continue; // a tab click may have rebuilt the controls
    const key = keyOf(el);
    if (!key || !params.has(key)) continue;
    const value = params.get(key);
    if (el.type === 'radio') {
      if (el.value === value && !el.checked) { el.checked = true; fire(el, 'change'); }
    } else if (el.type === 'checkbox') {
      const want = value === '1';
      if (el.checked !== want) { el.checked = want; fire(el, 'change'); }
    } else if (el.value !== value) {
      el.value = value;
      fire(el, el.type === 'range' ? 'input' : 'change');
    }
  }
  // Controls rebuilt by a tab or mode change (e.g. gear teeth sliders) get one more pass.
  for (const el of controls(root)) {
    const key = keyOf(el);
    if (key && params.has(key) && el.type === 'range' && el.value !== params.get(key)) {
      el.value = params.get(key);
      fire(el, 'input');
    }
  }
}

/** A full link to this concept with its current settings (and practice problem, if one is showing). */
export function shareLink(root, path) {
  const params = captureState(root);
  const seed = root.querySelector('.practice')?.dataset.seed;
  if (seed) params.set('p', seed);
  const base = `${location.origin}${location.pathname}`;
  const q = params.toString();
  return `${base}#/${path}${q ? `?${q}` : ''}`;
}

/** Pre-filled GitHub issue for "report a mistake". Opens GitHub; nothing is sent until the user submits it there. */
export function reportLink(concept, link, extra = '') {
  const title = `[${concept.title}] `;
  const body = `**Concept:** ${concept.title}\n**Link (with my settings):** ${link}\n\n**What looks wrong?**\n\n\n**What did you expect?**\n\n${extra}`;
  return `${REPO_URL}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}
