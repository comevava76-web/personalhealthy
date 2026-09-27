// Rebuilds the PDF of the functional and architecture document:  node docs/architecture/render.cjs
// (needs Playwright with Chromium). Writes HINT-Architecture.pdf and PNG previews of both pages.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 2 });
  await p.goto('file://' + __dirname + '/architecture.html');
  await p.pdf({ path: __dirname + '/HINT-Architecture.pdf', format: 'A4', printBackground: true, preferCSSPageSize: true });
  const pages = p.locator('.page');
  for (let i = 0; i < await pages.count(); i++) await pages.nth(i).screenshot({ path: __dirname + `/page-${i + 1}.png` });
  await b.close();
})();
