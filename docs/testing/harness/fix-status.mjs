// HINT 365: reports the state of a finding to the owner's Security console while the Security fix workflow works.
//   node fix-status.mjs <n> <fixing|fixed|failed|open> [url] [note]     n = number of the finding in the fix issue
//   node fix-status.mjs --finish [note]                                 whatever is still Fixing becomes Failed
// Needs FIX_ID and FIX_KEY (from the fix issue, valid 24 hours); HINT_BASE defaults to the production Worker.
const BASE = (process.env.HINT_BASE || "https://personalhealthy-api.comevava76.workers.dev").replace(/\/$/, "");
const { FIX_ID: id, FIX_KEY: key } = process.env;
if (!id || !key) { console.error("FIX_ID and FIX_KEY are needed"); process.exit(2); }
const [a, b, c, d] = process.argv.slice(2);
const body = a === "--finish" ? { id, key, finish: true, finishNote: b || "not handled" }
  : { id, key, items: [{ n: Number(a), status: b, url: c || "", note: d || "" }] };
const r = await fetch(BASE + "/hooks/fix-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
console.log(r.status, await r.text());
if (!r.ok) process.exitCode = 1;
