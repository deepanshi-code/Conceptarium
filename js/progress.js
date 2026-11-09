// Per-browser learning progress: which concepts were opened, and the best quiz score for each.
// Stored in localStorage only; everything still works (without memory) if storage is unavailable.

const KEY = 'conceptarium:progress:v1';

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? {};
  } catch {
    return {};
  }
}

function save(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* private mode or storage full: progress just isn't remembered */
  }
}

export const progressFor = (path) => load()[path] ?? {};

export function markVisited(path) {
  const data = load();
  data[path] = { ...data[path], visited: true };
  save(data);
}

export function recordQuiz(path, score, total) {
  const data = load();
  const best = Math.max(score, data[path]?.quiz ?? 0);
  data[path] = { ...data[path], visited: true, quiz: best, quizTotal: total };
  save(data);
}

/** Count one more solved practice problem for a concept; returns the new total. */
export function recordPractice(path) {
  const data = load();
  const total = (data[path]?.practice ?? 0) + 1;
  data[path] = { ...data[path], visited: true, practice: total };
  save(data);
  return total;
}

export function summary(paths) {
  const data = load();
  return {
    visited: paths.filter((p) => data[p]?.visited).length,
    mastered: paths.filter((p) => data[p]?.quiz && data[p].quiz === data[p].quizTotal).length,
    solved: paths.reduce((n, p) => n + (data[p]?.practice ?? 0), 0),
  };
}

export function resetProgress() {
  save({});
}
