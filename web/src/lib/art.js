const PALETTES = [
  ['#ff9a62', '#d1456b'], ['#6bc5a0', '#2b7a8c'], ['#f6c85f', '#e07a3f'], ['#8e9eef', '#5b3f9e'],
  ['#ef8fb4', '#8b3a62'], ['#7fd1c7', '#3a6ea5'], ['#f2a65a', '#9c4a3b'],
];

// Deterministic: the same listing id always gets the same colors.
export function paletteFor(id) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTES[h % PALETTES.length];
}

export const SCENES = ['exterior', 'living', 'kitchen', 'bedroom', 'bath'];
