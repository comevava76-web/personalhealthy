// Renders the compliance dossier: node docs/compliance/render.cjs (needs Playwright + Chromium).
// docs/compliance/dossier.html -> HINT365-Compliance.pdf here and in worker/public/my/ (served at /my/HINT365-Compliance.pdf).
// The table of contents links every control, so Chromium writes a named destination per section (#C01…).
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('file://' + __dirname + '/dossier.html');
  const out = __dirname + '/HINT365-Compliance.pdf';
  await p.pdf({ path: out, format: 'A4', printBackground: true, outline: true, tagged: true });
  fs.copyFileSync(out, __dirname + '/../../worker/public/my/HINT365-Compliance.pdf');
  await b.close();
})();
