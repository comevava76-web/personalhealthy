// Renders the general document "HINT 365 · How it works" as an A4 PDF (needs Playwright with Chromium):
//   node docs/overview/render.cjs   →   docs/HINT365-How-it-works.pdf
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.HINT_CHROMIUM || undefined });
  const p = await b.newPage();
  await p.goto('file://' + __dirname + '/overview.html');
  await p.pdf({ path: __dirname + '/../HINT365-How-it-works.pdf', format: 'A4', printBackground: true, preferCSSPageSize: true,
    displayHeaderFooter: true, headerTemplate: '<span></span>',
    footerTemplate: '<div style="font-size:7pt;color:#5B6B88;width:100%;text-align:center">HINT 365 · How it works · <span class="pageNumber"></span>/<span class="totalPages"></span></div>' });
  await b.close();
  console.log('docs/HINT365-How-it-works.pdf');
})();
