// Small DOM helpers shared by the visualizations.

// Tagged template that just joins strings. It exists so editors syntax-highlight the HTML.
export const html = (strings, ...values) => strings.reduce((out, s, i) => out + s + (values[i] ?? ''), '');

export function formatNumber(x, digits = 2) {
  if (Math.abs(x) < 0.005) return '0';
  const rounded = Number(x.toFixed(digits));
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(digits).replace(/0+$/, '');
}

/** Editable 3x3 grid of number inputs. Calls onChange with a fresh matrix whenever a valid entry changes. */
export function matrixInputs(container, matrix, onChange) {
  container.classList.add('matrix-grid');
  const inputs = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const input = document.createElement('input');
      input.type = 'number';
      input.step = '0.1';
      input.setAttribute('aria-label', `Row ${r + 1}, column ${c + 1}`);
      input.addEventListener('input', () => {
        if (input.value === '' || Number.isNaN(Number(input.value))) return;
        onChange(read());
      });
      container.appendChild(input);
      inputs.push(input);
    }
  }
  const read = () => [0, 1, 2].map((r) => [0, 1, 2].map((c) => Number(inputs[r * 3 + c].value)));
  const set = (m) => inputs.forEach((input, i) => { input.value = formatNumber(m[Math.floor(i / 3)][i % 3], 3); });
  set(matrix);
  return { set, read };
}

/**
 * Read-only matrix display. `rows` is an array of arrays of numbers.
 * `highlight(r, c)` may return a CSS class for individual cells.
 */
export function renderMatrix(container, rows, highlight = () => '') {
  const cols = rows[0].length;
  container.className = 'matrix-view';
  container.style.setProperty('--cols', cols);
  container.innerHTML = rows
    .flatMap((row, r) => row.map((v, c) => `<span class="${highlight(r, c)}">${formatNumber(v)}</span>`))
    .join('');
}
