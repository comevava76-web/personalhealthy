// Rigenera il PDF del documento funzionale e architetturale:  node docs/architecture/render.cjs
// (serve Playwright con Chromium). Scrive HINT-Architettura.pdf e le anteprime PNG delle due pagine.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 2 });
  await p.goto('file://' + __dirname + '/architettura.html');
  await p.pdf({ path: __dirname + '/HINT-Architettura.pdf', format: 'A4', printBackground: true, preferCSSPageSize: true });
  const pages = p.locator('.page');
  for (let i = 0; i < await pages.count(); i++) await pages.nth(i).screenshot({ path: __dirname + `/pagina-${i + 1}.png` });
  await b.close();
})();
