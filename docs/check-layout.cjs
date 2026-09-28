// Layout check for the HTML documents rendered to PDF: every text of a diagram must stay inside the box it
// starts in, and every page must end before its footer. Exits 1 and lists what overflows.
// Run: node docs/check-layout.cjs docs/architecture/architecture.html [more.html]   (needs Playwright + Chromium)
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const files = process.argv.slice(2);
  const b = await chromium.launch();
  let bad = 0;
  for (const f of files) {
    const p = await b.newPage({ viewport: { width: 794, height: 1123 } });
    await p.goto('file://' + path.resolve(f));
    const issues = await p.evaluate(() => {
      const out = [];
      // 1. texts inside SVG boxes
      document.querySelectorAll('svg').forEach((svg, si) => {
        const rects = [...svg.querySelectorAll('rect')].map((r) => ({ r, b: r.getBBox() })).filter((x) => x.b.width > 20 && x.b.height > 10);
        svg.querySelectorAll('text').forEach((t) => {
          const tb = t.getBBox();
          const x0 = tb.x + 0.5, y0 = tb.y + tb.height / 2;
          // the smallest box the text starts in
          const home = rects.filter(({ b }) => x0 >= b.x && x0 <= b.x + b.width && y0 >= b.y && y0 <= b.y + b.height)
            .sort((a, c) => a.b.width * a.b.height - c.b.width * c.b.height)[0];
          if (home && tb.x + tb.width > home.b.x + home.b.width - 1.5)
            out.push(`svg ${si + 1}: "${t.textContent.slice(0, 40)}" runs ${(tb.x + tb.width - home.b.x - home.b.width + 1.5).toFixed(1)} past its box`);
          const vb = svg.viewBox.baseVal;
          if (vb && vb.width && (tb.x < vb.x - 0.5 || tb.x + tb.width > vb.x + vb.width + 0.5))
            out.push(`svg ${si + 1}: "${t.textContent.slice(0, 40)}" leaves the drawing`);
        });
      });
      // 2. page content must end above the footer and inside the page
      document.querySelectorAll('.page').forEach((pg, pi) => {
        const foot = pg.querySelector('.foot'); if (!foot) return;
        const fTop = foot.getBoundingClientRect().top;
        const pr = pg.getBoundingClientRect();
        [...pg.children].filter((c) => c !== foot).forEach((c) => {
          const r = c.getBoundingClientRect();
          if (r.bottom > fTop - 2) out.push(`page ${pi + 1}: <${c.tagName.toLowerCase()}> "${(c.textContent || '').trim().slice(0, 40)}" reaches the footer`);
          if (r.right > pr.right + 1) out.push(`page ${pi + 1}: <${c.tagName.toLowerCase()}> is wider than the page`);
        });
        if (pg.scrollHeight > pg.clientHeight + 2) out.push(`page ${pi + 1}: content taller than the page`);
      });
      return out;
    });
    for (const i of issues) console.log(`${f}: ${i}`);
    bad += issues.length;
    await p.close();
  }
  await b.close();
  console.log(bad ? `${bad} layout problem(s)` : 'layout ok');
  process.exit(bad ? 1 : 0);
})();
