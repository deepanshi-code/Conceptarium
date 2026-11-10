// "Practice problem" card in a concept panel: a fresh numerical problem, an answer box that checks within the
// stated tolerance, a worked solution revealed one step at a time, and a button that loads the numbers into the
// 3D model so students can see the situation they are calculating.
import { GENERATORS, checkAnswer, seeded } from './practice/problems.js';
import { recordPractice, progressFor } from './progress.js';

export const hasPractice = (path) => Boolean(GENERATORS[path]);

// `seed` (from a shared link) reproduces a specific problem; otherwise a random one is made.
export function renderPractice(panel, concept, viewRoot, seed) {
  panel.querySelector('.practice')?.remove();
  const gen = GENERATORS[concept.path];
  if (!gen) return;
  const section = document.createElement('section');
  section.className = 'practice';
  // Insert before the quiz so the order is: model controls → practice → quick check.
  const quiz = panel.querySelector('.quiz');
  if (quiz) quiz.before(section);
  else panel.append(section);

  let problem;
  let shown = 0;
  let solved = false;

  function newProblem(fromSeed) {
    const s = fromSeed ?? 1 + Math.floor(Math.random() * 999999);
    problem = gen(seeded(s));
    section.dataset.seed = s; // shareLink() puts this in the URL
    shown = 0;
    solved = false;
    const done = progressFor(concept.path).practice ?? 0;
    section.innerHTML = `
      <h3>Practice problem</h3>
      <div class="pq">${problem.question}</div>
      <form class="answer-row" data-form>
        <input type="text" inputmode="decimal" autocomplete="off" placeholder="Your answer" aria-label="Your answer" data-ans>
        <span class="unit">${problem.unit}</span>
        <button class="btn small" type="submit">Check</button>
      </form>
      <p class="feedback" data-fb></p>
      <ol class="steps" data-steps></ol>
      <div class="practice-actions">
        <button class="btn small secondary" type="button" data-step>💡 Show a step</button>
        ${problem.load.length ? '<button class="btn small secondary" type="button" data-load>🧊 Load into the model</button>' : ''}
        <button class="btn small secondary" type="button" data-new>↻ New problem</button>
      </div>
      <p class="hint">Solved so far: <b data-done>${done}</b>. Answers within ${problem.tol.rel !== undefined ? `${problem.tol.rel * 100}%` : problem.tol.abs === 0 ? 'exact' : `±${problem.tol.abs}`} are accepted.</p>`;
  }

  function revealStep() {
    if (shown >= problem.steps.length) return;
    const li = document.createElement('li');
    li.innerHTML = problem.steps[shown++];
    section.querySelector('[data-steps]').append(li);
    const btn = section.querySelector('[data-step]');
    if (shown >= problem.steps.length) btn.textContent = 'Full solution shown';
    btn.disabled = shown >= problem.steps.length;
  }

  // Drive the view's own controls, so the model and its readouts update exactly as if the student had set them.
  function loadIntoModel() {
    for (const [kind, sel, value] of problem.load) {
      const el = viewRoot.querySelector(sel);
      if (!el) continue;
      if (kind === 'click') el.click();
      else if (kind === 'radio') { el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); }
      else if (kind === 'check') { el.checked = value; el.dispatchEvent(new Event('change', { bubbles: true })); }
      else if (kind === 'select') { el.value = value; el.dispatchEvent(new Event('change', { bubbles: true })); }
      else {
        if (el.type === 'range') el.step = 'any'; // exact values, not rounded to the slider's step
        el.value = value;
        el.dispatchEvent(new Event(kind === 'change' ? 'change' : 'input', { bubbles: true }));
      }
    }
    const fb = section.querySelector('[data-fb]');
    fb.className = 'feedback';
    fb.textContent = 'Loaded: the model now shows this problem. Its readouts are a good way to check your working.';
  }

  section.addEventListener('submit', (e) => {
    e.preventDefault();
    const ok = checkAnswer(section.querySelector('[data-ans]').value, problem);
    const fb = section.querySelector('[data-fb]');
    if (ok === null) {
      fb.className = 'feedback';
      fb.textContent = 'Type a number (for example 12.5).';
      return;
    }
    fb.className = `feedback ${ok ? 'right' : 'wrong'}`;
    if (ok) {
      fb.innerHTML = `✓ Correct! ${problem.answer % 1 ? `Exact value: ${Number(problem.answer.toFixed(4))} ${problem.unit}.` : ''}`;
      if (!solved) {
        solved = true;
        const total = recordPractice(concept.path);
        section.querySelector('[data-done]').textContent = total;
      }
    } else {
      fb.textContent = shown ? '✗ Not yet. Compare with the steps below.' : '✗ Not yet. Try again, or press “Show a step”.';
    }
  });
  section.addEventListener('click', (e) => {
    if (e.target.closest('[data-step]')) revealStep();
    if (e.target.closest('[data-load]')) loadIntoModel();
    if (e.target.closest('[data-new]')) newProblem();
  });

  newProblem(seed);
}
