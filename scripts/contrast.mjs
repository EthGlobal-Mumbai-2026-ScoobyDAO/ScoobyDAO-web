// Checks text/background token pairs against WCAG AA (4.5:1). `node scripts/contrast.mjs`
const L = (hex) => {
  const c = hex.replace('#', '').match(/../g).map((h) => parseInt(h, 16) / 255);
  const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const [x, y] = [L(a), L(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const pairs = {
  dark: { bg: ['#0b1026', '#151b3d', '#1d2550'], fg: { text: '#e8ecff', muted: '#9ba5d0', beam: '#ffc857', clue: '#2ec4b6', mask: '#ff7a52', ghost: '#b8a9ff' } },
  light: { bg: ['#f6f1e3', '#fffaf0'], fg: { text: '#0b1026', muted: '#4a5480', beam: '#8a5a00', clue: '#0b7369', mask: '#b23a17', ghost: '#5a45c9' } },
  paper: { bg: ['#f6f1e3'], fg: { ink: '#2a2418', muted: '#5b5140', beam: '#8a5a00', clue: '#0b7369', mask: '#a8361a', ghost: '#5a45c9' } },
  onBeam: { bg: ['#ffc857'], fg: { night: '#0b1026' } },
};
let fail = 0;
for (const [theme, { bg, fg }] of Object.entries(pairs))
  for (const b of bg) for (const [n, f] of Object.entries(fg)) {
    const r = ratio(f, b); if (r < 4.5) fail++;
    console.log(`${r < 4.5 ? 'FAIL' : 'ok  '} ${theme.padEnd(6)} ${n.padEnd(6)} on ${b}: ${r.toFixed(2)}`);
  }
process.exit(fail ? 1 : 0);
