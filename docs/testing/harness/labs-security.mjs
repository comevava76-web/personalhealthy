// Local-only security regressions and structured lab import checks. Synthetic data only.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { call, newPhone, register, web, webLogin, localDb, sign } from './lib.mjs';
import { NOTICE_TEXT, NOTICE_VERSION } from '../../../worker/src/notices.ts';
import { validateLabImport } from '../../../worker/src/labs.ts';
const db = localDb();
const owner = newPhone(), other = newPhone();
assert.equal((await register(owner)).status, 200);
assert.equal((await register(other)).status, 200);
assert.equal((await call(owner,'GET','/v1/me')).json.isAdmin, false);
const input = { id: crypto.randomUUID(), takenAt: Date.now()-864e5, confirmed:true, items:[{code:'wbc',value:'6.4',unit:'10^9/L',reference:'4.0-10.0'}] };
assert.equal((await call(owner,'POST','/v1/labs',input)).status,403,'current notice required');
assert.equal((await call(owner,'POST','/v1/accept',{doc:'disclaimer',version:NOTICE_VERSION,lang:'en',healthConsent:true,textSha256:'0'.repeat(64)})).status,400);
for (const phone of [owner,other]) assert.equal((await call(phone,'POST','/v1/accept',{doc:'disclaimer',version:NOTICE_VERSION,lang:'en',healthConsent:true,textSha256:crypto.createHash('sha256').update(NOTICE_TEXT.en).digest('hex')})).status,200);
assert.equal(validateLabImport({...input,patient:'Synthetic Person'}),null);
for (const value of ['NEGATIVA','POSITIVA','negative','positive','negativ','positiv','négative','positif']) {
  assert.ok(validateLabImport({...input, items:[{code:'urine_culture',value,unit:'',reference:''}]}));
}
assert.equal(validateLabImport({...input,items:[{code:'urine_culture',value:'NEGATIVA Jane Doe',unit:'',reference:''}]}),null);
assert.equal(validateLabImport({...input,items:[{code:'urine_culture',value:'NEGATIVA',unit:'mg/dL',reference:''}]}),null);

assert.equal(validateLabImport({...input,items:[{...input.items[0],code:'Jane Doe'}]}),null);
assert.equal((await call(owner,'POST','/v1/labs',{...input,text:'Synthetic Patient'})).status,400);
assert.equal((await call(owner,'POST','/v1/labs',input)).status,200);
assert.equal((await call(owner,'POST','/v1/labs',input)).status,200,'stable import id is idempotent');
assert.equal((await call(other,'GET','/v1/labs')).json.items.length,0,'account isolation');
const history=(await call(owner,'GET','/v1/labs')).json.items;
assert.equal(history.length,1); assert.equal(history[0].items[0].code,'wbc');
const ts=Date.now(), body={...input,id:crypto.randomUUID()};
const bodyBuf=Buffer.from(JSON.stringify(body));
assert.equal((await call(owner,'POST','/v1/labs',body,{ts})).status,200);
assert.equal((await call(owner,'POST','/v1/labs',body,{ts,sigOverride:sign(owner,'POST','/v1/labs',String(ts),bodyBuf)})).status,401,'different ECDSA signature cannot replay the same message');
const c=await call(owner,'POST','/v1/web/code',{});
const code=c.json.url.split('#c=')[1];
const races=await Promise.all(Array.from({length:6},()=>web('POST','/my/session',{body:{code}})));
assert.equal(races.filter(r=>r.status===200).length,1,'one-time code consumed atomically');
const login=await webLogin(owner);
assert.equal((await web('GET','/my/api/data?module=labs&days=365',{cookie:login.cookie})).json.items.length,2);
assert.equal((await call(owner,'POST','/v1/log',{code:'import_failed',place:'Labs/Import',message:'Jane Doe jane@example.invalid lipase high'})).status,200);
const logs=db.prepare('SELECT message FROM error_log WHERE person_id = ?').all(owner.pid);
assert.ok(logs.every(x=>x.message===null),'free text excluded from logs');
assert.equal((await call(other,'DELETE','/v1/labs/'+history[0].id)).status,200);
assert.equal((await call(owner,'GET','/v1/labs')).json.items.length,2,'another account cannot delete results');
assert.equal((await call(owner,'DELETE','/v1/labs/'+history[0].id)).status,200);
console.log('PASS: lab schema, consent gate, idempotency, account isolation, replay, atomic sessions, privacy-safe log and web history');
