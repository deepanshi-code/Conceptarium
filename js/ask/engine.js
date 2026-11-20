// The "Ask" helper's search engine. It is not an AI: it ranks Conceptarium's own written material (each concept's
// idea and description, its how-to steps, the quiz explanations and a worked practice example) against the
// student's question with BM25, the classic search-engine scoring, and returns the best passages with their source.
// Pure functions, so it runs (and is tested) in Node too.

const STOP = new Set(`a an the is are was were be been being am do does did of to in on at by for with from as and or
  but if then than so that this these those it its it's i me my we you your he she they them what which who whom whose
  when where why how can could should would will shall may might must about into over under between there here
  please tell explain show give mean means meaning define definition happen happens happening occur occurs
  work works working actually really basically simple simply describe understand`.split(/\s+/));

// Short forms students type → the words used in the lessons.
const SYNONYMS = {
  bmd: 'bending moment', sfd: 'shear force', kvl: 'kirchhoff voltage loop', kcl: 'kirchhoff current junction',
  emf: 'electromotive voltage', ac: 'alternating', dc: 'direct', cpu: 'processor scheduling', fcfs: 'first come',
  sjf: 'shortest job', rr: 'round robin', lru: 'least recently used', fifo: 'first in', bst: 'binary search tree',
  avl: 'balanced tree rotation', dfs: 'depth first', bfs: 'breadth first', nn: 'neural network', ml: 'machine learning',
  gd: 'gradient descent', lr: 'learning rate', ph: 'acid base', atp: 'energy', rbc: 'red blood', dna: 'dna gene',
  rna: 'rna', mux: 'multiplexer', demux: 'demultiplexer', ff: 'flip flop', ip: 'internet protocol', tcp: 'transport',
  osi: 'layer', pid: 'proportional integral derivative', shm: 'simple harmonic oscillation', fft: 'fourier',
};

/** Rough English stemmer: enough that "bending", "bends" and "bend" match. */
export function stem(word) {
  if (word.length <= 3 || /\d/.test(word)) return word;
  for (const [suffix, keep] of [['ies', 'y'], ['ing', ''], ['ed', ''], ['es', ''], ['s', ''], ['ly', '']]) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 3) {
      const base = word.slice(0, -suffix.length) + keep;
      return base.replace(/(.)\1$/, '$1'); // "running" → "runn" → "run"
    }
  }
  return word;
}

export const stripHtml = (html) => String(html).replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();

export function tokenize(text, { expand = false } = {}) {
  const words = stripHtml(text).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/);
  const out = [];
  for (const w of words) {
    if (!w || STOP.has(w)) continue;
    if (expand && SYNONYMS[w]) out.push(...SYNONYMS[w].split(' ').map(stem));
    out.push(stem(w));
  }
  return out;
}

/**
 * Turns the site's content into searchable passages.
 *   catalog: CATALOG entries; quiz: { path: [[question, options, right, why], …] };
 *   practice: { path: generator } (one worked example is made per concept with a fixed seed).
 */
export function buildDocs({ catalog, subjects = {}, quiz = {}, practice = {}, seeded }) {
  const docs = [];
  for (const c of catalog) {
    const subject = subjects[c.subject]?.name ?? '';
    docs.push({
      path: c.path, kind: 'idea', title: c.title,
      html: `<p><b>${c.idea}</b></p><p>${c.blurb ?? ''}</p><p class="ask-real">Used in: ${c.real}</p>`,
      keywords: `${c.title} ${c.title} ${c.title} ${subject} what is idea concept`,
      text: `${c.idea} ${c.blurb ?? ''} ${c.real}`,
    });
    if (c.steps?.length) {
      docs.push({
        path: c.path, kind: 'steps', title: c.title,
        html: `<ol>${c.steps.map((s) => `<li>${s}</li>`).join('')}</ol>`,
        keywords: `${c.title} how use model start try begin control drag`,
        text: c.steps.join(' '),
      });
    }
    for (const [q, options, right, why] of quiz[c.path] ?? []) {
      docs.push({
        path: c.path, kind: 'quiz', title: c.title,
        html: `<p>${q}</p><p><b>${options[right]}</b>: ${why}</p>`,
        keywords: `${c.title}`,
        text: `${q} ${options[right]} ${why}`,
      });
    }
    const gen = practice[c.path];
    if (gen && seeded) {
      const p = gen(seeded(1));
      docs.push({
        path: c.path, kind: 'example', title: c.title,
        html: `<p>${p.question}</p><ol>${p.steps.map((s) => `<li>${s}</li>`).join('')}</ol>`,
        keywords: `${c.title} example solve calculate find formula numerical problem worked solution steps`,
        text: `${p.question} ${p.steps.join(' ')}`,
      });
    }
  }
  return docs;
}

/** Precomputes term statistics. Keywords (titles) count three times as much as body text. */
export function buildIndex(docs) {
  const df = new Map();
  const entries = docs.map((doc) => {
    const tf = new Map();
    const add = (t, w) => tf.set(t, (tf.get(t) ?? 0) + w);
    for (const t of tokenize(doc.keywords)) add(t, 3);
    for (const t of tokenize(doc.text)) add(t, 1);
    for (const t of tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
    const len = [...tf.values()].reduce((a, b) => a + b, 0);
    return { doc, tf, len };
  });
  const avg = entries.reduce((a, e) => a + e.len, 0) / Math.max(1, entries.length);
  return { entries, df, n: entries.length, avg };
}

const KIND_HINTS = {
  steps: ['use', 'start', 'try', 'control', 'drag', 'begin', 'work'],
  example: ['example', 'solv', 'solve', 'calculat', 'calculate', 'find', 'formula', 'numerical', 'problem', 'sum'],
  idea: ['what', 'idea', 'mean', 'concept', 'real', 'life', 'where'],
};

/**
 * Best passages for a question. `current` (the open concept's path) gets a boost, so "what is the formula?"
 * answers about the concept on screen. Returns [{ doc, score }], at most `limit`, strongest first.
 */
export function search(index, query, { current = null, limit = 3 } = {}) {
  const terms = [...new Set(tokenize(query, { expand: true }))];
  // Each word the student typed, with its synonyms: used to check how much of the question a passage covers.
  const groups = tokenize(query).map((t) => {
    const word = Object.keys(SYNONYMS).find((k) => stem(k) === t);
    return new Set([t, ...(word ? SYNONYMS[word].split(' ').map(stem) : [])]);
  });
  const raw = String(query).toLowerCase();
  if (!terms.length && !current) return [];
  // "How do I use this?" or "show an example" names no topic: answer about the concept on screen only.
  const generic = new Set(Object.values(KIND_HINTS).flat().map(stem).concat(['example', 'step', 'model', 'answer', 'question']));
  const onlyCurrent = current && terms.every((t) => generic.has(t));
  const k1 = 1.2;
  const b = 0.75;
  const scored = [];
  for (const { doc, tf, len } of index.entries) {
    if (onlyCurrent && doc.path !== current) continue;
    let score = 0;
    for (const t of terms) {
      const f = tf.get(t);
      if (!f) continue;
      const idf = Math.log(1 + (index.n - index.df.get(t) + 0.5) / (index.df.get(t) + 0.5));
      score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * len) / index.avg)));
    }
    // Question words ("how do I…", "solve…") pick the kind of passage; the concept on screen is preferred.
    const hints = KIND_HINTS[doc.kind];
    if (hints?.some((h) => raw.includes(h))) score = score * 1.25 + 0.6;
    if (doc.path === current) score = score * 1.4 + (terms.length ? 0.8 : 1);
    // A passage must contain at least half of what was asked ("sky blue" should not match "blue" alone).
    const covered = groups.filter((g) => [...g].some((t) => tf.has(t))).length;
    if (groups.length && covered / groups.length < 0.6 && doc.path !== current) continue;
    if (score > 0) scored.push({ doc, score });
  }
  scored.sort((x, y) => y.score - x.score);
  // Weak matches are noise: keep results within reach of the best one.
  const best = scored[0]?.score ?? 0;
  const out = [];
  for (const s of scored) {
    if (out.length >= limit || s.score < Math.max(1.2, best * 0.45)) break;
    out.push(s);
  }
  return out;
}
