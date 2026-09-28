// Renders the vulnerability loop drawing: node docs/security/render.cjs (needs Playwright + Chromium).
// Writes vulnerability-flow.png (full page, light theme) and vulnerability-flow.pdf (one landscape page).
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  await p.emulateMedia({ colorScheme: 'light' });
  await p.goto('file://' + __dirname + '/vulnerability-flow.html');
  await p.waitForTimeout(800);   // web fonts
  await p.screenshot({ path: __dirname + '/vulnerability-flow.png', fullPage: true });
  const h = await p.evaluate(() => document.documentElement.scrollHeight);
  await p.pdf({ path: __dirname + '/vulnerability-flow.pdf', width: '1280px', height: h + 'px', printBackground: true, pageRanges: '1' });
  await b.close();
})();
