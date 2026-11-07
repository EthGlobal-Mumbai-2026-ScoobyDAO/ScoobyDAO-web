// Screenshot QA helper: node scripts/shot.mjs <path> <out.png> [width] [height] [dark|light] [--full]
// Uses Playwright from deck/build (dev dependency there); expects the dev server on http://localhost:3000.
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../deck/build/package.json', import.meta.url));
const { chromium } = require('playwright');
const [path = '/', out = 'shot.png', w = '1440', h = '900', theme = 'dark', full] = process.argv.slice(2);
const base = process.env.SHOT_BASE || 'http://localhost:3000';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: +w, height: +h }, colorScheme: theme });
await page.addInitScript((t) => {
  try {
    localStorage.setItem('scoobydao:theme', t);
  } catch {}
}, theme);
await page.goto(base + path, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
await page.waitForTimeout(+(process.env.SHOT_WAIT || 2500));
await page.screenshot({ path: out, fullPage: full === '--full' });
await browser.close();
console.log(out);
