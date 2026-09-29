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
for (let d=0;d<3;d++) assert.equal((await call(phone,'POST','/v1/labs',{id:crypto.randomUUID(),takenAt:Date.now()-(d+1)*30*864e5,confirmed:true,items:[{code:'wbc',value:(6.4+d*.2).toFixed(1),unit:'10^9/L',reference:'4-10'}]})).status,200);
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
  assert.equal(await page.locator('main tbody tr').count(),3);
  assert.equal(await page.locator('main polyline').count(),1);
  assert.deepEqual(errors,[]);
  if (lang==='en' && width===1280) {
   const waiting=page.waitForEvent('download');await page.locator('#btn-pdf').click();
   const download=await waiting;await download.saveAs(out+'/lab-results.pdf');
   assert.ok(fs.statSync(out+'/lab-results.pdf').size>1000);
  }
  await page.screenshot({path:`${out}/labs-${lang}-${width}.png`,fullPage:true});
  await ctx.close();
 }
 console.log('PASS: 8 browser views, localized names, 3 dated results, trend, PDF and no CSV button');
} finally {await browser.close()}
