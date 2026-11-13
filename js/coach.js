// "How to use this model": the concept's three suggested steps, shown at the top of the Explore tab (not over the
// 3D view, so nothing covers the model). Folding it away is remembered per concept.

// Bump the version when the steps change, so people who folded the old tips see the new ones once.
const storageKey = (path) => `conceptarium:howto:v1:${path}`;

function folded(path) {
  try {
    return localStorage.getItem(storageKey(path)) === '1';
  } catch {
    return false;
  }
}

function remember(path, isFolded) {
  try {
    if (isFolded) localStorage.setItem(storageKey(path), '1');
    else localStorage.removeItem(storageKey(path));
  } catch {
    /* storage unavailable (private mode): it simply opens again next time */
  }
}

export function renderHowTo(pane, concept) {
  pane.querySelector('.howto')?.remove();
  if (!concept?.steps) return;
  const box = document.createElement('details');
  box.className = 'howto';
  box.open = !folded(concept.path);
  box.innerHTML = `
    <summary>How to use this model</summary>
    <ol>${concept.steps.map((s) => `<li>${s}</li>`).join('')}</ol>
    <p class="howto-foot">Drag empty space to rotate · scroll to zoom · right-drag to pan</p>`;
  box.addEventListener('toggle', () => remember(concept.path, !box.open));
  pane.prepend(box);
}
