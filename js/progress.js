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

export function summary(paths) {
  const data = load();
  return {
    visited: paths.filter((p) => data[p]?.visited).length,
    mastered: paths.filter((p) => data[p]?.quiz && data[p].quiz === data[p].quizTotal).length,
  };
}

export function resetProgress() {
  save({});
}
