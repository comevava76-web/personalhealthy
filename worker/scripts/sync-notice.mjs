// Writes the app's disc_body (4 languages) from worker/src/notices.ts, so the text accepted on the phone hashes the same as
// the server's. Usage: node --experimental-strip-types worker/scripts/sync-notice.mjs ./worker/src/notices.ts android/app/src/main/res [check]
import fs from 'node:fs';
const [,, noticesPath, resDir, mode] = process.argv;
const { NOTICE_TEXT } = await import(noticesPath);
const dirs = { en: 'values', it: 'values-it', de: 'values-de', fr: 'values-fr' };
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n');
const unesc = (s) => s.replace(/\\n/g, '\n').replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\\\/g, '\\').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
let ok = true;
for (const [lang, d] of Object.entries(dirs)) {
  const p = `${resDir}/${d}/strings.xml`; let s = fs.readFileSync(p, 'utf8');
  const title = unesc(s.match(/<string name="disc_title">([\s\S]*?)<\/string>/)[1]);
  const text = NOTICE_TEXT[lang];
  if (!text.startsWith(title + '\n\n')) { console.log(lang, 'title differs:', JSON.stringify(title)); ok = false; continue; }
  const body = text.slice(title.length + 2);
  const cur = unesc(s.match(/<string name="disc_body">([\s\S]*?)<\/string>/)[1]);
  if (mode === 'check') { console.log(lang, cur === body ? 'same' : 'DIFFERENT'); if (cur !== body) ok = false; continue; }
  s = s.replace(/<string name="disc_body">[\s\S]*?<\/string>/, () => `<string name="disc_body">${esc(body)}</string>`);
  fs.writeFileSync(p, s);
}
process.exit(ok ? 0 : 1);
