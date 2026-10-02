// Renders the terms of use and the privacy policy as A4 PDFs, light colours (needs Playwright with Chromium):
//   cd worker && node scripts/export-docs.mjs   (first: the HTML from the site code)
//   node docs/legal/render.cjs   →   docs/legal/HINT365-Terms.pdf, docs/legal/HINT365-Privacy.pdf
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.HINT_CHROMIUM || undefined });
  const p = await b.newPage();
  await p.emulateMedia({ colorScheme: 'light' });
  for (const [src, pdf] of [['terms.html', 'HINT365-Terms.pdf'], ['privacy.html', 'HINT365-Privacy.pdf']]) {
    await p.goto('file://' + __dirname + '/' + src);
    await p.pdf({ path: __dirname + '/' + pdf, format: 'A4', printBackground: true, margin: { top: '14mm', bottom: '14mm', left: '12mm', right: '12mm' } });
    console.log('docs/legal/' + pdf);
  }
  await b.close();
})();
