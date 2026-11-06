// Checks text/background token pairs against WCAG AA (4.5:1). `node scripts/contrast.mjs`
const L = (hex) => {
  const c = hex.replace('#', '').match(/../g).map((h) => parseInt(h, 16) / 255);
  const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const [x, y] = [L(a), L(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const pairs = {
  dark: { bg: ['#0b1026', '#151b3d', '#1d2550'], fg: { text: '#e8ecff', muted: '#9ba5d0', beam: '#ffc857', clue: '#2ec4b6', mask: '#ff7a52', ghost: '#b8a9ff' } },
  light: { bg: ['#f6f1e3', '#fffaf0'], fg: { text: '#0b1026', muted: '#4a5480', beam: '#8a5a00', clue: '#0b7369', mask: '#9c2d0f', ghost: '#5a45c9' } },
  // Status chips: ink on its own 12–14% tint over the light page.
  lightChips: { bg: [], fg: {} },
  paper: { bg: ['#f6f1e3'], fg: { ink: '#2a2418', muted: '#5b5140', beam: '#8a5a00', clue: '#0b7369', mask: '#a8361a', ghost: '#5a45c9' } },
  onBeam: { bg: ['#ffc857'], fg: { night: '#0b1026' } },
};
const mix = (a, b, t) => '#' + [0, 2, 4].map((i) => Math.round(parseInt(a.slice(1 + i, 3 + i), 16) * t + parseInt(b.slice(1 + i, 3 + i), 16) * (1 - t)).toString(16).padStart(2, '0')).join('');
// Every status chip tone (src/components/StatusChip.tsx), ink on its tint, both themes.
// Draft/Denied/Expired/Void use muted on a ≤12% fog tint; Final · No uses text on fog-100 8%.
const STATUS_TONES = {
  fog: { dark: ['#9ba5d0', '#7a86b8', 0.12], light: ['#4a5480', '#7a86b8', 0.12] },
  ghost: { dark: ['#b8a9ff', '#b8a9ff', 0.12], light: ['#5a45c9', '#b8a9ff', 0.12] },
  clue: { dark: ['#2ec4b6', '#2ec4b6', 0.12], light: ['#0b7369', '#2ec4b6', 0.12] },
  beam: { dark: ['#ffc857', '#ffc857', 0.14], light: ['#8a5a00', '#ffc857', 0.14] },
  mask: { dark: ['#ff7a52', '#e4572e', 0.14], light: ['#9c2d0f', '#e4572e', 0.14] },
  cleared: { dark: ['#e8ecff', '#e8ecff', 0.08], light: ['#0b1026', '#e8ecff', 0.08] },
};
const PAGE = { dark: '#0b1026', light: '#f6f1e3' };
const chipPairs = [
  ['mask-chip', '#9c2d0f', mix('#e4572e', '#f6f1e3', 0.14)],
  ['beam-chip', '#8a5a00', mix('#ffc857', '#f6f1e3', 0.14)],
  ['clue-chip', '#0b7369', mix('#2ec4b6', '#f6f1e3', 0.12)],
  ['ghost-chip', '#5a45c9', mix('#b8a9ff', '#f6f1e3', 0.12)],
  ['dark-mask-chip', '#ff7a52', mix('#e4572e', '#151b3d', 0.14)],
  ['dark-clue-chip', '#2ec4b6', mix('#2ec4b6', '#151b3d', 0.12)],
];
for (const [tone, themes] of Object.entries(STATUS_TONES))
  for (const [theme, [ink, tint, t]] of Object.entries(themes)) chipPairs.push([`status-${tone}-${theme}`, ink, mix(tint, PAGE[theme], t)]);
let fail = 0;
for (const [n, f, b] of chipPairs) {
  const r = ratio(f, b); if (r < 4.5) fail++;
  console.log(`${r < 4.5 ? 'FAIL' : 'ok  '} chip   ${n.padEnd(14)} on ${b}: ${r.toFixed(2)}`);
}
for (const [theme, { bg, fg }] of Object.entries(pairs))
  for (const b of bg) for (const [n, f] of Object.entries(fg)) {
    const r = ratio(f, b); if (r < 4.5) fail++;
    console.log(`${r < 4.5 ? 'FAIL' : 'ok  '} ${theme.padEnd(6)} ${n.padEnd(6)} on ${b}: ${r.toFixed(2)}`);
  }
process.exit(fail ? 1 : 0);
