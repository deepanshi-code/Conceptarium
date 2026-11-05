// Biology: from DNA to protein. A double helix with paired bases, its mRNA copy (transcription), and a ribosome
// reading the mRNA three letters at a time to chain amino acids (translation). Mutate one base and see the effect.
import * as THREE from 'three';
import { createStage, makeLabel, clearGroup, setVisible } from '../stage.js';
import { AMINO, clean, complement, transcribe, translate, mutationEffect } from '../bio/dna.js';
import { html } from '../ui.js';

const BASE_COLOR = { A: 0xef4444, T: 0xfacc15, U: 0xfb923c, G: 0x22c55e, C: 0x3b82f6 };
const RISE = 0.42; // world units per base pair along the axis
const TWIST = (36 * Math.PI) / 180; // one full turn every 10 base pairs
const RADIUS = 1;
const PRESETS = {
  demo: 'CCATGGCCTTTAAAGGGTGACC',
  long: 'ATGAAACGCATTAGCACCACCATTACCACCACCATCACCATTACCACAGGTAACGGTGCGGGCTGA',
};

export function mountDna(root) {
  root.innerHTML = html`
    <div class="viewport" data-viewport></div>
    <aside class="panel">
      <h2>DNA to Protein</h2>
      <p class="lede">DNA is two strands twisted into a <b>double helix</b>; A always pairs with T, G with C. To make a protein, the cell copies a gene into <b>mRNA</b> (transcription, T becomes U), then a <b>ribosome</b> reads it three letters (one <b>codon</b>) at a time, adding one amino acid per codon, from AUG (start) to a stop codon.</p>

      <label class="field">Gene (coding strand)
        <input type="text" data-seq value="${PRESETS.demo}" maxlength="72">
      </label>
      <div class="op-group">
        <button class="btn small secondary" data-preset="demo">Short gene</button>
        <button class="btn small secondary" data-preset="long">Longer gene</button>
        <button class="btn small secondary" data-mutate>🎲 Mutate one base</button>
      </div>
      <div class="btn-row">
        <button class="btn" data-play>▶ Make the protein</button>
      </div>

      <h3>Strands</h3>
      <div class="seq-box" data-strands></div>
      <h3>Protein</h3>
      <div class="protein" data-protein></div>
      <div class="notice" data-msg></div>
    </aside>
  `;

  const $ = (sel) => root.querySelector(sel);
  const stage = createStage($('[data-viewport]'), { cameraPosition: [0, 2, 14], axes: false, grid: false });
  const helix = new THREE.Group();
  const rna = new THREE.Group();
  const protein = new THREE.Group();
  stage.scene.add(helix, rna, protein);
  const ribosome = new THREE.Mesh(new THREE.SphereGeometry(0.75, 24, 16), new THREE.MeshStandardMaterial({ color: 0xa78bfa, transparent: true, opacity: 0.55 }));
  ribosome.scale.set(1.2, 0.9, 0.9);
  stage.scene.add(ribosome);
  const state = { seq: clean(PRESETS.demo), stage: 0, clock: 0, rnaShown: 0, aaShown: 0, rnaCells: [], aaBeads: [], codons: [], start: -1, prevSeq: null };

  const xOf = (i, n) => (i - (n - 1) / 2) * RISE;

  function buildHelix() {
    clearGroup(helix);
    const s = state.seq;
    const n = s.length;
    const comp = complement(s);
    const strandPts = [[], []];
    for (let i = 0; i < n; i++) {
      const a = i * TWIST;
      const x = xOf(i, n);
      const p1 = new THREE.Vector3(x, Math.cos(a) * RADIUS, Math.sin(a) * RADIUS);
      const p2 = new THREE.Vector3(x, Math.cos(a + Math.PI * 0.8) * RADIUS, Math.sin(a + Math.PI * 0.8) * RADIUS);
      strandPts[0].push(p1);
      strandPts[1].push(p2);
      // Each rung is two half-bars, one per base, meeting in the middle.
      const mid = p1.clone().add(p2).multiplyScalar(0.5);
      [[p1, s[i]], [p2, comp[i]]].forEach(([p, b]) => {
        const len = p.distanceTo(mid);
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, len, 8), new THREE.MeshStandardMaterial({ color: BASE_COLOR[b], roughness: 0.4 }));
        bar.position.copy(p.clone().add(mid).multiplyScalar(0.5));
        bar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), mid.clone().sub(p).normalize());
        helix.add(bar);
      });
      if (n <= 30) {
        helix.add(makeLabel(s[i], p1.clone().multiplyScalar(1).add(new THREE.Vector3(0, Math.sign(p1.y) * 0.25, 0)), BASE_COLOR[s[i]], 'idx-label base'));
      }
    }
    for (const pts of strandPts) {
      if (pts.length < 2) continue;
      helix.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 8, 0.09, 8), new THREE.MeshStandardMaterial({ color: 0xc4b5fd, roughness: 0.4 })));
    }
    helix.position.y = 2.2;
  }

  function buildRnaAndProtein() {
    clearGroup(rna);
    clearGroup(protein);
    const mrna = transcribe(state.seq);
    const n = mrna.length;
    state.rnaCells = [...mrna].map((b, i) => {
      const cell = new THREE.Mesh(new THREE.BoxGeometry(RISE * 0.9, 0.5, 0.3), new THREE.MeshStandardMaterial({ color: BASE_COLOR[b], roughness: 0.4 }));
      cell.position.set(xOf(i, n), 0, 0);
      if (n <= 30) cell.add(makeLabel(b, new THREE.Vector3(0, 0, 0.2), 0x0b0720, 'gate-label'));
      setVisible(cell, false);
      rna.add(cell);
      return cell;
    });
    rna.position.y = -0.6;
    const t = translate(mrna);
    state.start = t.start;
    state.codons = t.codons;
    state.aaBeads = t.codons.map(({ aa }, k) => {
      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 14), new THREE.MeshStandardMaterial({ color: aa === '*' ? 0xff4d6d : new THREE.Color().setHSL((k * 0.13) % 1, 0.65, 0.6), roughness: 0.35 }));
      bead.add(makeLabel(aa === '*' ? 'STOP' : threeLetter(aa), new THREE.Vector3(0, 0.55, 0), 0xe6e9f2, 'idx-label'));
      const center = xOf(t.start + k * 3 + 1, n);
      bead.position.set(center, -2.3, 0);
      setVisible(bead, false);
      protein.add(bead);
      return bead;
    });
    ribosome.visible = false;
  }

  const threeLetter = (aa) => ({ A: 'Ala', R: 'Arg', N: 'Asn', D: 'Asp', C: 'Cys', Q: 'Gln', E: 'Glu', G: 'Gly', H: 'His', I: 'Ile', L: 'Leu', K: 'Lys', M: 'Met', F: 'Phe', P: 'Pro', S: 'Ser', T: 'Thr', W: 'Trp', Y: 'Tyr', V: 'Val' }[aa]);

  function renderPanel() {
    const s = state.seq;
    const mrna = transcribe(s);
    const codonSplit = (str) => {
      if (state.start < 0) return str;
      const before = str.slice(0, state.start);
      const coding = str.slice(state.start).match(/.{1,3}/g) ?? [];
      return `<span class="dim">${before}</span>${coding.map((c, k) => `<span class="codon ${k < state.codons.length ? 'in' : ''}">${c}</span>`).join('')}`;
    };
    $('[data-strands]').innerHTML = `
      <div><small>DNA coding</small><code>${codonSplit(s)}</code></div>
      <div><small>DNA template</small><code>${complement(s)}</code></div>
      <div><small>mRNA</small><code>${codonSplit(mrna)}</code></div>`;
    $('[data-protein]').innerHTML = state.codons.length
      ? state.codons.map(({ codon, aa }) => `<span class="aa ${aa === '*' ? 'stop' : ''}" title="${codon} → ${AMINO[aa]}">${aa === '*' ? 'STOP' : threeLetter(aa)}</span>`).join('<span class="bond">–</span>')
      : '<span class="dim">No AUG start codon, so no protein.</span>';
  }

  function rebuild(message) {
    state.seq = clean($('[data-seq]').value).slice(0, 72);
    $('[data-seq]').value = state.seq;
    state.stage = 0;
    buildHelix();
    buildRnaAndProtein();
    renderPanel();
    const span = state.seq.length * RISE;
    stage.camera.position.set(0, 0.5, Math.max(9, span * 0.95 + 3));
    stage.controls.target.set(0, 0, 0);
    stage.saveHome();
    $('[data-msg]').innerHTML = message ?? 'Press <b>Make the protein</b> to watch transcription, then translation.';
    $('[data-play]').textContent = '▶ Make the protein';
  }

  root.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
    $('[data-seq]').value = PRESETS[b.dataset.preset];
    rebuild();
  }));
  $('[data-seq]').addEventListener('change', () => rebuild());
  $('[data-mutate]').addEventListener('click', () => {
    const before = state.seq;
    const start = before.indexOf('ATG');
    if (start < 0) { rebuild('No ATG start codon to mutate after.'); return; }
    const i = start + 3 + Math.floor(Math.random() * Math.max(1, before.length - start - 3));
    const options = 'ACGT'.replace(before[i], '');
    const after = before.slice(0, i) + options[Math.floor(Math.random() * 3)] + before.slice(i + 1);
    $('[data-seq]').value = after;
    const effect = mutationEffect(before.slice(start), after.slice(start));
    const what = {
      silent: 'a <b>silent</b> mutation: the codon changed but still codes for the same amino acid. The protein is unchanged.',
      missense: 'a <b>missense</b> mutation: one amino acid is swapped for another. This can change how the protein folds (sickle-cell anaemia is one).',
      nonsense: 'a <b>nonsense</b> mutation: it created an early STOP, so the protein is cut short.',
      'stop-loss': 'a <b>stop-loss</b> mutation: the STOP codon itself changed, so the ribosome reads on and the protein comes out too long.',
    }[effect];
    rebuild(`Base ${i + 1} changed ${before[i]} → ${after[i]}. That is ${what}`);
  });
  $('[data-play]').addEventListener('click', () => {
    buildRnaAndProtein();
    state.stage = 1;
    state.rnaShown = 0;
    state.aaShown = 0;
    state.clock = 0;
    $('[data-play]').textContent = '↺ Again';
    $('[data-msg]').innerHTML = '<b>Transcription:</b> RNA polymerase reads the template strand and builds mRNA, with U in place of T.';
  });

  stage.onFrame((dt) => {
    helix.rotation.x += dt * 0.25;
    if (state.stage === 0) return;
    state.clock -= dt;
    if (state.clock > 0) return;
    if (state.stage === 1) {
      if (state.rnaShown < state.rnaCells.length) {
        setVisible(state.rnaCells[state.rnaShown++], true);
        state.clock = 0.08;
      } else {
        state.stage = 2;
        state.clock = 0.6;
        $('[data-msg]').innerHTML = state.start < 0 ? 'There is no AUG start codon, so the ribosome never starts.' : '<b>Translation:</b> the ribosome starts at AUG and adds one amino acid per codon.';
      }
    } else if (state.stage === 2 && state.start >= 0) {
      if (state.aaShown < state.aaBeads.length) {
        const k = state.aaShown++;
        ribosome.visible = true;
        ribosome.position.set(xOf(state.start + k * 3 + 1, state.seq.length), -0.6, 0);
        setVisible(state.aaBeads[k], true);
        state.clock = 0.7;
      } else {
        state.stage = 3;
        const last = state.codons.at(-1);
        $('[data-msg]').innerHTML = last?.aa === '*' ? `Reached a <b>stop codon</b> (${last.codon}). The ribosome lets go: a chain of ${state.codons.length - 1} amino acids is ready to fold.` : 'The mRNA ran out before a stop codon.';
      }
    }
  });

  rebuild();
  return () => stage.dispose();
}
