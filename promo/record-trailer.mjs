// Records a ~50 s trailer of Conceptarium in headless Chrome (real screen capture via the DevTools screencast),
// with big captions, then the frames are assembled into an MP4 by make-trailer.py.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:5175/';
const OUT = process.argv[3] ?? './trailer-frames';
const PORT = 9336;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', `--remote-debugging-port=${PORT}`, '--window-size=1280,720', '--hide-scrollbars', '--no-first-run', `--user-data-dir=${process.env.TEMP}/trailer-prof-${Date.now()}`, 'about:blank'], { stdio: 'ignore' });
let ws; let id = 0; const pending = new Map(); const frames = [];
let recording = false;
// Wall-clock time (s) at which each scene starts, so the narration can be synced (make-trailer.py, add-voice.py).
const marks = {};
const mark = (name) => { marks[name] = Date.now() / 1000; };
for (let i = 0; i < 50 && !ws; i++) { try { const p = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === 'page'); if (p) ws = new WebSocket(p.webSocketDebuggerUrl); } catch {} await sleep(200); }
if (ws.readyState !== 1) await new Promise((r) => ws.addEventListener('open', r));
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Page.screencastFrame') {
    if (recording) frames.push({ data: m.params.data, t: m.params.metadata.timestamp });
    send('Page.screencastFrameAck', { sessionId: m.params.sessionId });
  }
});
const js = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;

// Captions and fades, added to the page by the recorder (not part of the site). On concept pages the caption sits
// over the side panel, so it never covers the 3D model; elsewhere it sits low and centred.
const CSS = `
  .tr-cap { position: fixed; z-index: 9999; opacity: 0; transform: translateY(14px); transition: opacity .35s, transform .35s;
    padding: 22px 26px 24px; border-radius: 24px; background: rgba(6,7,26,.94); border: 1px solid rgba(251,191,36,.55);
    box-shadow: 0 30px 70px -20px #000, 0 0 50px -10px rgba(251,146,60,.45); font-family: Inter, system-ui, sans-serif; }
  .tr-cap.on { opacity: 1; transform: none; }
  .tr-cap.low { left: 50%; bottom: 40px; max-width: 80vw; text-align: center; transform: translate(-50%, 14px); }
  .tr-cap.low.on { transform: translate(-50%, 0); }
  .tr-cap .tag { display: inline-block; margin-bottom: 10px; padding: 5px 12px; border-radius: 999px; font: 700 13px/1 'JetBrains Mono', monospace; letter-spacing: .12em; text-transform: uppercase; color: #1a0f05; background: linear-gradient(120deg,#fde68a,#fbbf24 45%,#fb923c); }
  .tr-cap b { display: block; font-weight: 800; font-size: 44px; line-height: 1.08; color: #fff; letter-spacing: -.025em; }
  .tr-cap.low b { font-size: 50px; }
  .tr-cap b em { font-style: normal; background: linear-gradient(100deg,#fde68a,#fbbf24 40%,#fb923c); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .tr-cap small { display: block; margin-top: 10px; font-size: 20px; line-height: 1.35; color: #d6d1ff; font-weight: 500; }
  .tr-fade { position: fixed; inset: 0; z-index: 10000; background: #05061a; opacity: 0; pointer-events: none; transition: opacity .15s; }
  .tr-fade.on { opacity: 1; }
  .tr-end { position: fixed; inset: 0; z-index: 10001; display: grid; place-items: center; text-align: center; color: #fff;
    background: radial-gradient(120% 100% at 50% 35%, #1a1745 0%, #0b0c28 55%, #05061a 100%); opacity: 0; transition: opacity .5s; font-family: Inter, system-ui, sans-serif; }
  .tr-end.on { opacity: 1; }
  .tr-end .logo { display: inline-grid; place-items: center; width: 92px; height: 92px; border-radius: 26px; font-size: 44px; background: linear-gradient(120deg,#7c3aed,#8b5cf6 40%,#22d3ee); box-shadow: 0 0 80px rgba(139,92,246,.75); }
  .tr-end h1 { margin: 22px 0 8px; font-size: 76px; letter-spacing: -.035em; }
  .tr-end h1 em { font-style: normal; background: linear-gradient(100deg,#c4b5fd,#8b5cf6 45%,#5eead4); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .tr-end p { margin: 0; font-size: 28px; color: #d6d1ff; }
  .tr-end .url { display: inline-block; margin-top: 28px; padding: 14px 28px; border-radius: 999px; font: 700 26px/1 'JetBrains Mono', monospace; color: #fde68a; background: rgba(251,191,36,.08); border: 1px solid rgba(251,191,36,.6); }
  .tr-end .tags { margin-top: 20px; font-size: 20px; color: #b5b0e6; }
`;

// Runs inside the page (stringified), so it must not use anything from this file.
function pageHelpers(css) {
  if (window.__cap) return;
  const st = document.createElement('style');
  st.textContent = css;
  document.head.append(st);
  const cap = document.createElement('div'); cap.className = 'tr-cap'; document.body.append(cap);
  const fade = document.createElement('div'); fade.className = 'tr-fade'; document.body.append(fade);
  window.__cap = (title, sub = '', tag = '') => {
    cap.classList.remove('on');
    if (!title) return;
    setTimeout(() => {
      cap.innerHTML = (tag ? `<span class="tag">${tag}</span>` : '') + `<b>${title}</b>` + (sub ? `<small>${sub}</small>` : '');
      const panel = document.querySelector('.panel');
      const r = panel && panel.getBoundingClientRect();
      if (r && r.width > 200 && r.left > 300) {
        cap.className = 'tr-cap';
        Object.assign(cap.style, { left: `${r.left + 10}px`, width: `${r.width - 20}px`, bottom: '22px' });
      } else {
        cap.className = 'tr-cap low';
        Object.assign(cap.style, { left: '', width: '', bottom: '' });
      }
      requestAnimationFrame(() => cap.classList.add('on'));
    }, 120);
  };
  window.__fade = (on) => fade.classList.toggle('on', on);
  window.__end = () => {
    const end = document.createElement('div'); end.className = 'tr-end';
    end.innerHTML = '<div><span class="logo">✦</span><h1>Concept<em>arium</em></h1><p>Learn engineering concepts by moving them in 3D.</p><span class="url">deepanshi-code.github.io/Conceptarium</span><div class="tags">58 3D models · practice · quizzes · free · no sign-up · works offline</div></div>';
    document.body.append(end); requestAnimationFrame(() => end.classList.add('on'));
  };
  window.__orbit = async (speed = 1.2) => {
    const { stageFor } = await import('/js/stage.js');
    const s = stageFor(document.querySelector('.viewport'));
    if (s) { s.controls.autoRotate = true; s.controls.autoRotateSpeed = speed; }
  };
  window.__play = () => [...document.querySelectorAll('.panel button')].find((b) => /^▶|launch|fire|race|send|play/i.test(b.textContent.trim()))?.click();
  window.__slide = (sel, from, to, ms) => new Promise((res) => {
    const el = document.querySelector(sel); if (!el) { res(); return; }
    el.step = 'any'; const t0 = performance.now();
    const f = (t) => {
      const k = Math.min(1, (t - t0) / ms); const e = k < 0.5 ? 2 * k * k : 1 - ((-2 * k + 2) ** 2) / 2;
      el.value = from + (to - from) * e; el.dispatchEvent(new Event('input', { bubbles: true }));
      if (k < 1) requestAnimationFrame(f); else res();
    };
    requestAnimationFrame(f);
  });
  window.__type = async (sel, text, ms = 110) => {
    const el = document.querySelector(sel);
    for (const ch of text) { el.value += ch; el.dispatchEvent(new Event('input', { bubbles: true })); await new Promise((r) => setTimeout(r, ms)); }
  };
}
const helpers = () => js(`(${pageHelpers})(${JSON.stringify(CSS)})`);
const q = (s) => JSON.stringify(s);
const cap = (title, sub = '', tag = '') => js(`window.__cap(${q(title)}, ${q(sub)}, ${q(tag)})`);
const go = async (hash, wait = 900) => {
  await js(`window.__cap(''); window.__fade(true)`); await sleep(170);
  await js(`location.hash = ${q(hash)}`); await sleep(wait);
  await js(`document.querySelector('.panel') && (document.querySelector('.panel').scrollTop = 0); window.__fade(false)`);
};

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1.5, mobile: false });
await send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
// Warm the browser cache with every scene's code first (not recorded), so scene changes in the video are instant.
await send('Page.navigate', { url: `${BASE}#/beam` });
await sleep(2500);
for (const h of ['projectile', 'engine', 'eigen', 'sorting', 'orbitals', 'cell', 'circuits', 'truss', 'network', 'beam']) {
  await js(`location.hash = '#/${h}'`); await sleep(900);
}
await send('Page.navigate', { url: 'about:blank' });
await sleep(300);

// 1. "hello" (about 4 s), straight on to the site.
recording = true;
mark('start');
await send('Page.navigate', { url: BASE });
await sleep(1200);
mark('hello');
await sleep(3100);
await helpers();
await js(`document.querySelector('[data-start]')?.click()`);
await sleep(700);

// 2. Home and the concept sky.
mark('hero');
await cap('See the concepts you were <em>told to imagine</em>', '58 interactive 3D models for B.Tech &amp; BCA');
await sleep(2600);
await js(`(async () => {
  const app = document.querySelector('#app');
  const sc = app.scrollHeight > app.clientHeight + 5 ? app : document.scrollingElement;
  const target = document.querySelector('#sky').getBoundingClientRect().top - (sc === app ? app.getBoundingClientRect().top : 0) + sc.scrollTop - 10;
  const s0 = sc.scrollTop; const t0 = performance.now();
  await new Promise((res) => { const f = (t) => { const k = Math.min(1, (t - t0) / 1200); sc.scrollTop = s0 + (target - s0) * (1 - (1 - k) ** 3); if (k < 1) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
})()`);
mark('sky');
await cap('<em>15</em> subjects. One sky.', 'Every star is a concept you can open');
await sleep(3500);

// 3. Beams: move the load.
await go('#/beam');
mark('beam');
await js(`window.__orbit(1)`);
await cap('Move the load.<br><em>Watch the moment follow.</em>', 'Shear force &amp; bending moment, live', 'Mechanics');
await js(`window.__slide('[data-a]', 0.5, 0.15, 1600).then(() => window.__slide('[data-a]', 0.15, 0.85, 2200))`);
await sleep(4000);

// 4. A quick montage across subjects.
const montage = [
  ['projectile', 'Projectile motion', 'Physics'],
  ['engine', 'A four-stroke engine', 'Mechanical'],
  ['eigen', 'Eigenvectors you can <em>see</em>', 'Maths'],
  ['sorting', 'Sorting algorithms <em>race</em>', 'Data structures'],
  ['orbitals', 'Atomic orbitals', 'Chemistry'],
  ['cell', 'Inside a living cell', 'Biology'],
  ['circuits', 'Circuits you can <em>rewire</em>', 'Electrical'],
  ['truss', 'Forces in a truss bridge', 'Civil'],
  ['network', 'A packet’s journey', 'Networks'],
];
for (const [hash, title, tag] of montage) {
  await go(`#/${hash}`, 550);
  mark(hash);
  await js(`window.__orbit(1.8); window.__play()`);
  await cap(title, '', tag);
  await sleep(2100);
}

// 5. Practice: an exam-style problem, answered and checked.
await go('#/beam?p=4242', 1100);
mark('practice');
await js(`document.querySelector('.panel-tabs [data-show="practice"]')?.click()`);
await sleep(300);
await js(`window.__type('.practice [data-ans]', '30', 200)`);
await sleep(300);
await js(`document.querySelector('.practice [data-form]').requestSubmit()`);
await cap('<em>Exam-style</em> practice', 'Fresh numbers every time, step-by-step solutions');
await sleep(3300);

// 6. Ask.
mark('ask');
await js(`window.__cap(''); document.querySelector('[data-ask-open]').click()`);
await sleep(300);
await js(`window.__type('.ask [data-q]', 'how to find max BMD', 45)`);
await js(`document.querySelector('.ask [data-form]').requestSubmit()`);
await cap('Stuck? <em>Ask.</em>', 'Answers from the lessons and worked examples');
await sleep(2800);

// 7. End card.
mark('end');
await js(`window.__cap(''); window.__end()`);
await sleep(5500);

recording = false;
await send('Page.stopScreencast');
await sleep(300);
frames.forEach((f, i) => writeFileSync(`${OUT}/f${String(i).padStart(5, '0')}.jpg`, Buffer.from(f.data, 'base64')));
writeFileSync(`${OUT}/times.json`, JSON.stringify(frames.map((f) => f.t)));
writeFileSync(`${OUT}/marks.json`, JSON.stringify(marks));
console.log(`frames: ${frames.length}, seconds: ${(frames.at(-1).t - frames[0].t).toFixed(1)}`);
chrome.kill();
process.exit(0);
