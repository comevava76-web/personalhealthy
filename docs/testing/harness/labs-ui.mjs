// Synthetic lab history in four browser languages, mobile and desktop, PDF download and share scope.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { call, newPhone, register, BASE } from './lib.mjs';
import { NOTICE_TEXT, NOTICE_VERSION } from '../../../worker/src/notices.ts';
const {chromium}=createRequire(import.meta.url)('playwright');
const phone=newPhone(); assert.equal((await register(phone)).status,200);
assert.equal((await call(phone,'POST','/v1/accept',{doc:'disclaimer',version:NOTICE_VERSION,lang:'en',healthConsent:true,textSha256:crypto.createHash('sha256').update(NOTICE_TEXT.en).digest('hex')})).status,200);
// Three synthetic reports with different tests: the table grows to the union, a missing test shows N/A.
const zurichDay = (daysAgo) => { const d = new Date(Date.now() - daysAgo * 864e5); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - 2 * 3600e3; };
const reports = [
 [700, [{code:'wbc',value:'6.4',unit:'10^9/L',reference:'4-10'},{code:'hgb',value:'141',unit:'g/L',reference:'130 - 170'}]],
 [60, [{code:'wbc',value:'6.6',unit:'10^9/L',reference:'4-10'},{code:'hgb',value:'128',unit:'g/L',reference:'130 - 170'},{code:'plt',value:'450',unit:'10^9/L',reference:'130 - 400'},{code:'',name:'FIBRINOGÈNO',value:'3,1',unit:'g/L',reference:'2,0 - 4,0'}]],
 [30, [{code:'wbc',value:'6.8',unit:'10^9/L',reference:'4-10'},{code:'',name:'Fibrinogeno',value:'310',unit:'mg/dL',reference:'200 - 400'},{code:'',name:'INR',value:'1,02',unit:'',reference:'0,80 - 1,20'},{code:'urine_culture',value:'NEGATIVA',unit:'',reference:''}]],
];
for (const [ago, items] of reports) {
 const r = await call(phone,'POST','/v1/labs',{id:crypto.randomUUID(),takenAt:zurichDay(ago),auto:true,fileHash:crypto.randomBytes(32).toString('hex'),items});
 assert.equal(r.status,200,r.text);
}
const browser=await chromium.launch({executablePath:process.env.HINT_CHROMIUM});
const out=process.env.HINT_SHOTS || '/tmp/hint-lab-shots';fs.mkdirSync(out,{recursive:true});
const labels={it:['Referti','Globuli bianchi'],en:['Lab results','White blood cells'],de:['Laborbefunde','Leukozyten'],fr:['Analyses','Leucocytes']};
try {
 for (const [lang,[tab,analyte]] of Object.entries(labels)) for (const width of [390,1280]) {
  const ctx=await browser.newContext({locale:lang,viewport:{width,height:900},acceptDownloads:true});
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const code=await call(phone,'POST','/v1/web/code',{});
  await page.goto(code.json.url.replace(/^https?:\/\/[^/]+/,BASE));
  await page.locator('button[data-v="yes"]').click();
  await page.locator('button[data-m="labs"]').click();
  await page.getByRole('heading',{name:tab,exact:true}).waitFor();
  assert.ok(await page.locator('main').innerText().then(s=>s.includes(analyte)));
  assert.equal(await page.locator('#btn-csv').count(),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'mobile width');
  assert.equal(await page.locator('main tbody tr').count(),6,'one row per test ever measured');
  assert.equal(await page.locator('main thead th.lab-day').count(),3,'one column per report date');
  assert.equal(await page.locator('main td.na').count(),8,'another laboratory’s name and unit for the same test stay on one row; a test missing on a date is not available');
  assert.equal(await page.locator('main td.na').first().innerText(),'–','a missing value is a dash');
  assert.ok(await page.locator('main').innerText().then(s=>s.includes('FIBRINOGÈNO') && s.includes('3,1 g/L') && s.includes('310 mg/dL') && s.includes('NEGATIVA')));
  assert.equal(await page.locator('main polyline').count(),0,'no charts: the table only');
  assert.equal(await page.locator('main td.out').count(),2,'results outside the printed reference');
  assert.deepEqual(await page.locator('main td.out .arrow').allInnerTexts(),['↓','↑']);
  assert.deepEqual(errors,[]);
  if (lang==='en' && width===1280) {
   const waiting=page.waitForEvent('download');await page.locator('#btn-pdf').click();
   const download=await waiting;await download.saveAs(out+'/lab-results.pdf');
   assert.ok(fs.statSync(out+'/lab-results.pdf').size>1000);
  }
  await page.screenshot({path:`${out}/labs-${lang}-${width}.png`,fullPage:true});
  if (lang==='fr' && width===1280) {   // the last view deletes the oldest column
   page.once('dialog',d=>d.accept());
   await page.locator('.lab-del').first().click();
   await page.waitForFunction(()=>document.querySelectorAll('main thead th.lab-day').length===2);
   assert.equal(await page.locator('main tbody tr').count(),6);
  }
  await ctx.close();
 }
 console.log('PASS: 8 browser views, localized names, dynamic table (union of tests, dash when missing), old report date, custom tests, out-of-range arrows, no charts, PDF, column deletion, no CSV button');
} finally {await browser.close()}
