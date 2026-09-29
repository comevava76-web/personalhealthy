// Rebuilds the user guides as A4 PDFs from their HTML sources (needs Playwright with Chromium):
//   node docs/render-guides.cjs   →   docs/HINT-Guida-IT.pdf, docs/HINT-Guide-EN.pdf
// The build serves both PDFs next to the app, linked from the home page.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.HINT_CHROMIUM || undefined });
  const p = await b.newPage();
  for (const [src, pdf] of [['guide-it.html', 'HINT-Guida-IT.pdf'], ['guide-en.html', 'HINT-Guide-EN.pdf']]) {
    await p.goto('file://' + __dirname + '/' + src);
    await p.pdf({ path: __dirname + '/' + pdf, format: 'A4', printBackground: true, preferCSSPageSize: true });
    console.log('docs/' + pdf);
  }
  await b.close();
})();
