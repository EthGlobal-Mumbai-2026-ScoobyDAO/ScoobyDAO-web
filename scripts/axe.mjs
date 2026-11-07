// Accessibility check: node scripts/axe.mjs [path ...]  (dev server on http://localhost:3000, or SHOT_BASE)
// Injects axe-core into each page with Playwright (from ../deck/build) and prints serious/critical violations.
// Exit code 1 when any serious or critical violation is found.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(new URL('../../deck/build/package.json', import.meta.url));
const { chromium } = require('playwright');
const axeSource = readFileSync(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
const base = process.env.SHOT_BASE || 'http://localhost:3000';
const paths = process.argv.slice(2).length ? process.argv.slice(2) : ['/', '/cases', '/reports', '/markets', '/me', '/admin', '/approve/demo-pending'];
const browser = await chromium.launch();
let bad = 0;
for (const theme of ['dark', 'light']) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript((t) => {
    try {
      localStorage.setItem('scoobydao:theme', t);
    } catch {}
  }, theme);
  for (const p of paths) {
    await page.goto(base + p, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(2500);
    await page.addScriptTag({ content: axeSource });
    const res = await page.evaluate(async () => {
      const r = await axe.run(document, { resultTypes: ['violations'] });
      return r.violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }));
    });
    bad += res.length;
    console.log(`${theme} ${p}: ${res.length ? '' : 'ok'}`);
    for (const v of res) console.log(`  [${v.impact}] ${v.id}: ${v.help}\n    ${v.nodes.join('\n    ')}`);
  }
  await page.close();
}
await browser.close();
process.exit(bad ? 1 : 0);
