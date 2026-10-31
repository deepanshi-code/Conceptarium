// Helpers shared by the data-structure tabs.

/** Reads an integer from an <input>; returns null (and flags the field) when it is not a whole number in range. */
export function readInt(input, min = 0, max = 99) {
  const v = Number(input.value);
  const ok = input.value.trim() !== '' && Number.isInteger(v) && v >= min && v <= max;
  input.classList.toggle('invalid', !ok);
  return ok ? v : null;
}

export function randomInts(count, max = 99, exclude = []) {
  const taken = new Set(exclude);
  const out = [];
  while (out.length < count && taken.size < max) {
    const v = 1 + Math.floor(Math.random() * max);
    if (!taken.has(v)) {
      taken.add(v);
      out.push(v);
    }
  }
  return out;
}

export const stat = (label, value) => `<div class="row-between"><span>${label}</span><strong>${value}</strong></div>`;
