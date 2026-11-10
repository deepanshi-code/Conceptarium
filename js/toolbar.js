// Small toolbar in the corner of every 3D view: reset the camera, go fullscreen, save a screenshot, copy a share link.
// Keyboard: R resets, F toggles fullscreen (see main.js).
import { stageFor } from './stage.js';
import { shareLink } from './share.js';

export function attachToolbar(viewport, concept) {
  viewport.querySelector('.view-tools')?.remove();
  const stage = stageFor(viewport);
  if (!stage) return;
  stage.saveHome();

  const bar = document.createElement('div');
  bar.className = 'view-tools';
  bar.innerHTML = `
    <button data-tool="reset" title="Reset view (R)" aria-label="Reset view">⟲</button>
    <button data-tool="full" title="Fullscreen (F)" aria-label="Fullscreen">⛶</button>
    <button data-tool="shot" title="Save a screenshot" aria-label="Save a screenshot">📷</button>
    <button data-tool="share" title="Copy a link to exactly this (settings + practice problem)" aria-label="Copy share link">🔗</button>
  `;
  bar.addEventListener('click', (e) => {
    const tool = e.target.closest('[data-tool]')?.dataset.tool;
    if (tool === 'reset') stage.resetView();
    if (tool === 'full') toggleFullscreen(viewport);
    if (tool === 'shot') saveShot(stage, concept);
    if (tool === 'share') copyLink(viewport, concept);
  });
  viewport.append(bar);
}

// Copy a link to this exact state. Falls back to showing the link if the clipboard is not available.
async function copyLink(viewport, concept) {
  const link = shareLink(viewport.closest('#app') ?? document, concept.path);
  let copied = false;
  try {
    await navigator.clipboard.writeText(link);
    copied = true;
  } catch {
    /* clipboard blocked (e.g. not https): show the link instead */
  }
  viewport.querySelector('.share-toast')?.remove();
  const toast = document.createElement('div');
  toast.className = 'share-toast';
  toast.innerHTML = copied ? '🔗 Link copied: it opens this concept with these settings and this practice problem.' : `Copy this link: <input readonly value="${link.replace(/"/g, '&quot;')}">`;
  viewport.append(toast);
  toast.querySelector('input')?.select();
  setTimeout(() => toast.remove(), copied ? 3500 : 15000);
}

export function toggleFullscreen(viewport) {
  if (document.fullscreenElement) document.exitFullscreen();
  else viewport.requestFullscreen?.();
}

function saveShot(stage, concept) {
  const a = document.createElement('a');
  a.href = stage.snapshot();
  a.download = `conceptarium-${concept.path.replace(/\//g, '-')}.png`;
  a.click();
}
