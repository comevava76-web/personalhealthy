// Renders the owner's costs and earnings as an A4 PDF from its Markdown source (needs Playwright with Chromium):
//   node docs/business/render.cjs   →   docs/business/HINT365-Owner-Economics.pdf
// The Markdown stays the source; this small converter knows only what that file uses: headings, paragraphs,
// lists, tables, bold, italics and code.
const fs = require('fs');
const { chromium } = require('playwright');
const md = fs.readFileSync(__dirname + '/owner-economics.md', 'utf8');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\*([^*]+)\*/g, '<i>$1</i>');
const out = []; const lines = md.split('\n'); let i = 0;
while (i < lines.length) {
  const l = lines[i];
  if (/^#{1,3} /.test(l)) { const n = l.match(/^#+/)[0].length; out.push(`<h${n}>${inline(l.slice(n + 1))}</h${n}>`); i++; continue; }
  if (l.startsWith('|')) {
    const rows = []; while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++]);
    const cells = (r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    out.push('<table><thead><tr>' + cells(rows[0]).map((c) => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>' +
      rows.slice(2).map((r) => '<tr>' + cells(r).map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table>');
    continue;
  }
  if (/^(\d+\.|-) /.test(l)) {
    const ol = /^\d+\./.test(l); const items = [];
    while (i < lines.length && (/^(\d+\.|-) /.test(lines[i]) || /^  +\S/.test(lines[i]))) {
      if (/^(\d+\.|-) /.test(lines[i])) items.push(lines[i].replace(/^(\d+\.|-) /, '')); else items[items.length - 1] += ' ' + lines[i].trim();
      i++;
    }
    out.push(`<${ol ? 'ol' : 'ul'}>` + items.map((t) => `<li>${inline(t)}</li>`).join('') + `</${ol ? 'ol' : 'ul'}>`); continue;
  }
  if (!l.trim()) { i++; continue; }
  const para = []; while (i < lines.length && lines[i].trim() && !/^(#|\||\d+\. |- )/.test(lines[i])) para.push(lines[i++]);
  out.push(`<p>${inline(para.join(' '))}</p>`);
}
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><style>
@page { size: A4; margin: 16mm 15mm; }
body { font: 10pt/1.45 -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #13223F; }
h1 { font-size: 18pt; margin: 0 0 8pt; padding-bottom: 6pt; border-bottom: 3pt solid; border-image: linear-gradient(90deg, #6D5BD0, #0F9C8E) 1; }
h2 { font-size: 12.5pt; color: #6D5BD0; margin: 14pt 0 5pt; page-break-after: avoid; }
table { border-collapse: collapse; width: 100%; margin: 6pt 0 8pt; page-break-inside: avoid; font-size: 9pt; }
th { background: #0F9C8E; color: #fff; text-align: left; padding: 4pt 6pt; }
td { padding: 3.5pt 6pt; border-bottom: 0.5pt solid #d5dbe8; }
tr:nth-child(even) td { background: #F4F6FB; }
code { font-size: 8.5pt; background: #EBEFF7; padding: 0 2pt; border-radius: 2pt; }
li { margin: 2pt 0; }
</style><body>${out.join('\n')}</body></html>`;
(async () => {
  const b = await chromium.launch({ executablePath: process.env.HINT_CHROMIUM || undefined });
  const p = await b.newPage();
  await p.setContent(html);
  await p.pdf({ path: __dirname + '/HINT365-Owner-Economics.pdf', format: 'A4', printBackground: true, preferCSSPageSize: true });
  await b.close();
  console.log('docs/business/HINT365-Owner-Economics.pdf');
})();
