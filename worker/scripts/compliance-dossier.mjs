// HINT 365 compliance dossier: one section per control of worker/src/ops/compliance.json, with the exact text of the
// terms of use where it is declared. Each section has an anchor (C01…), so Admin → Observability links land on it:
// /my/HINT365-Compliance.pdf#C05. Usage: node --experimental-strip-types worker/scripts/compliance-dossier.mjs
// then node docs/compliance/render.cjs (PDF, copied next to the Web Dashboard).
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const C = JSON.parse(fs.readFileSync(path.join(ROOT, 'worker/src/ops/compliance.json'), 'utf8'));
const { NOTICE_TEXT, NOTICE_VERSION } = await import(path.join(ROOT, 'worker/src/notices.ts'));
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const terms = Object.fromEntries(NOTICE_TEXT.en.split('\n\n').slice(1).map((p) => { const [h, ...r] = p.split('\n'); return [h, r.join(' ')]; }));
const LABEL = { compliant: 'Compliant', partial: 'Partial', open: 'Open' };
const n = (s) => C.controls.filter((c) => c.status === s).length;
const rows = C.controls.map((c) => `<tr><td><a href="#${c.id}">${c.id}</a></td><td>${esc(c.area)}</td><td class="st ${c.status}">${LABEL[c.status]}</td></tr>`).join('');
const sections = C.controls.map((c) => {
  const decl = (c.declared || []).map((h) => {
    if (!terms[h]) throw new Error(`${c.id}: no terms section "${h}"`);
    return `<blockquote><p class="src">Terms of use, version ${NOTICE_VERSION} (English) · section “${esc(h)}” · also at /terms</p><p>${esc(terms[h])}</p></blockquote>`;
  }).join('');
  return `<section id="${c.id}"><h2><span class="id">${c.id}</span> ${esc(c.area)} <span class="st ${c.status}">${LABEL[c.status]}</span></h2>
    <table class="kv"><tr><th>Requirement</th><td>${esc(c.requirement)}</td></tr><tr><th>Law</th><td>${esc(c.law)}</td></tr>
    <tr><th>Evidence</th><td>${esc(c.evidence)}</td></tr>${c.next ? `<tr><th>Next step</th><td>${esc(c.next)}</td></tr>` : ''}
    <tr><th>Source document</th><td>${esc(c.doc)}</td></tr></table>
    ${decl ? `<h3>Where it is declared to users</h3>${decl}` : `<p class="muted">Not declared to users: an internal control${c.status === 'open' ? ', still open' : ''}.</p>`}</section>`;
}).join('\n');
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>HINT 365 Compliance Dossier</title>
<style>
 @page { size: A4; margin: 16mm 14mm; }
 body { font: 10.5pt/1.45 -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #14161A; margin: 0; }
 h1 { font-size: 20pt; margin: 0 0 4px; } h2 { font-size: 13pt; margin: 0 0 8px; border-bottom: 1px solid #ccd; padding-bottom: 4px; }
 h3 { font-size: 10.5pt; margin: 10px 0 4px; } .muted { color: #667; } .id { color: #667; font-weight: 600; margin-right: 4px; }
 section { break-inside: avoid; margin: 0 0 16px; padding-top: 4px; }
 .st { display: inline-block; font-size: 8.5pt; font-weight: 700; padding: 1px 7px; border-radius: 9px; border: 1px solid; vertical-align: middle; }
 .st.compliant { color: #146c40; border-color: #1E9A5B; background: #e6f5ec; } .st.partial { color: #8a4f0c; border-color: #E08A2E; background: #fcf0e2; }
 .st.open { color: #4b3fb0; border-color: #8C7BF2; background: #efecfe; }
 table { border-collapse: collapse; width: 100%; } td, th { text-align: left; vertical-align: top; padding: 3px 6px; border-bottom: 1px solid #e3e4ea; }
 .kv th { width: 120px; color: #556; font-weight: 600; } blockquote { margin: 4px 0 6px; padding: 6px 10px; border-left: 3px solid #8C7BF2; background: #f6f5fc; }
 blockquote p { margin: 0 0 4px; } .src { font-size: 8.5pt; color: #556; } .toc td { padding: 2px 6px; } .toc a { color: #3d31a8; text-decoration: none; font-weight: 600; }
</style></head><body>
<h1>HINT 365 · Compliance dossier</h1>
<p class="muted">EU GDPR · Swiss FADP · ePrivacy · MDR boundary — reviewed ${esc(C.reviewed)} · terms version ${NOTICE_VERSION}. ${esc(C.note)}</p>
<p><b>${n('compliant')}</b> compliant · <b>${n('partial')}</b> partial · <b>${n('open')}</b> open, out of ${C.controls.length} controls.</p>
<table class="toc">${rows}</table>
${sections}
</body></html>
`;
const out = path.join(ROOT, 'docs/compliance/dossier.html');
if (process.argv[2] === 'check') { if (fs.readFileSync(out, 'utf8') !== html) { console.error('docs/compliance/dossier.html is out of date: run worker/scripts/compliance-dossier.mjs'); process.exit(1); } process.exit(0); }
fs.writeFileSync(out, html);
console.log('written', out);
