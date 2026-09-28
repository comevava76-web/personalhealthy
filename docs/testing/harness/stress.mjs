// HINT 365 QA: load and concurrency test against a LOCAL worker (wrangler dev --local).
// Measures latency (p50/p95/p99), error rate and correctness under concurrency.
// Run after functional.mjs (it empties the local database first):
//   HINT_WORKER_DIR=<scratch worker dir> CLIENTS=200 node stress.mjs
import crypto from "node:crypto";
import { call, newPhone, register, web, webLogin, localDb, pct, sleep } from "./lib.mjs";

const CLIENTS = Number(process.env.CLIENTS || 200);
const VOICE_PER_CLIENT = Number(process.env.VOICE_PER_CLIENT || 20);
const DAY = 864e5;
const db = localDb();
const run = (q, ...p) => db.prepare(q).run(...p);
const one = (q, ...p) => db.prepare(q).get(...p);
for (const t of ["persons", "measurements", "scans", "ledger", "invites", "person_keys", "acceptances", "web_codes", "web_sessions", "web_shares", "error_log"]) run(`DELETE FROM ${t}`);
run("DELETE FROM settings WHERE key <> 'billing_mode'");

const report = { config: { CLIENTS, VOICE_PER_CLIENT }, phases: [], checks: [] };
const check = (id, desc, ok, detail = "") => { report.checks.push({ id, desc, ok: !!ok, detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${id} ${desc} ${ok ? "" : "-> " + detail}`); };

/** Runs `tasks` (functions returning {status, ms}) with at most `conc` in flight; returns stats. */
async function phase(name, tasks, conc, okStatus = (s) => s >= 200 && s < 300) {
  const lat = [], statuses = {};
  let i = 0, errors = 0;
  const t0 = performance.now();
  await Promise.all(Array.from({ length: Math.min(conc, tasks.length) }, async () => {
    while (i < tasks.length) {
      const t = tasks[i++];
      const r = await t();
      lat.push(r.ms); statuses[r.status] = (statuses[r.status] || 0) + 1;
      if (!okStatus(r.status)) errors++;
    }
  }));
  const wall = (performance.now() - t0) / 1000;
  const s = { name, requests: tasks.length, concurrency: conc, wallSec: +wall.toFixed(2), rps: +(tasks.length / wall).toFixed(1),
    p50: +pct(lat, 50).toFixed(1), p95: +pct(lat, 95).toFixed(1), p99: +pct(lat, 99).toFixed(1), max: +Math.max(...lat).toFixed(1),
    errorRate: +(errors / tasks.length * 100).toFixed(2), statuses };
  report.phases.push(s);
  console.log(`${name}: ${JSON.stringify(s)}`);
  return s;
}

// 1) registration storm: CLIENTS phones at once, plus the owner first
const owner = newPhone(); await register(owner);
const phones = Array.from({ length: CLIENTS }, () => newPhone());
await phase(`register x${CLIENTS}`, phones.map((p) => () => register(p)), CLIENTS);
const dupKeys = one("SELECT COUNT(*) - COUNT(DISTINCT public_key) AS d FROM persons").d;
check("ST1", "no duplicate persons after the registration storm", one("SELECT COUNT(*) n FROM persons").n === CLIENTS + 1 && dupKeys === 0, `persons=${one("SELECT COUNT(*) n FROM persons").n}`);
check("ST2", "exactly one owner", one("SELECT COUNT(*) n FROM persons WHERE is_admin = 1").n === 1, "");
// the same key registered 20 times at once must still be one person
const twin = newPhone();
await Promise.all(Array.from({ length: 20 }, () => register(twin)));
check("ST3", "same phone key registered 20x concurrently -> one person", one("SELECT COUNT(*) n FROM persons WHERE public_key = ?", twin.pub).n === 1, "");

// 2) burst of voice saves: every client saves VOICE_PER_CLIENT readings, all at once
const okIds = new Map();
const voiceTasks = [];
for (const p of phones) for (let k = 0; k < VOICE_PER_CLIENT; k++) voiceTasks.push(async () => {
  const r = await call(p, "POST", "/v1/bp/voice", { sis: 110 + (k % 40), dia: 70 + (k % 20), pul: 60 + (k % 30), spokenAt: Date.now() });
  if (r.status === 200) okIds.set(p.pid, (okIds.get(p.pid) || 0) + 1);
  return r;
});
voiceTasks.sort(() => Math.random() - 0.5);
await phase(`voice save x${voiceTasks.length}`, voiceTasks, CLIENTS);
let lost = 0;
for (const p of phones) { const n = one("SELECT COUNT(*) n FROM measurements WHERE person_id = ?", p.pid).n; if (n !== (okIds.get(p.pid) || 0)) lost++; }
check("ST4", "no lost or phantom writes: stored readings == successful answers, per account", lost === 0, `${lost} accounts differ`);

// 3) reads under load
await phase(`GET /v1/me x${CLIENTS * 5}`, Array.from({ length: CLIENTS * 5 }, (_, i) => () => call(phones[i % CLIENTS], "GET", "/v1/me")), CLIENTS);
await phase(`GET /v1/bp?days=400 x${CLIENTS * 5}`, Array.from({ length: CLIENTS * 5 }, (_, i) => () => call(phones[i % CLIENTS], "GET", "/v1/bp?days=400")), CLIENTS);

// 4) error log burst: many identical app errors must aggregate into one row with the right counter
const LOGS = CLIENTS * 10;
await phase(`POST /v1/log x${LOGS} (same code/place)`, Array.from({ length: LOGS }, (_, i) => () => call(phones[i % CLIENTS], "POST", "/v1/log", { code: "qa_burst", place: "QA/burst", message: "burst 123" })), CLIENTS);
await sleep(1500);
const agg = db.prepare("SELECT COUNT(*) rows_, SUM(count) total FROM error_log WHERE code = 'qa_burst'").get();
check("ST5", `error_log aggregates ${LOGS} concurrent identical errors into one row with count ${LOGS}`, agg.rows_ === 1 && agg.total === LOGS, JSON.stringify(agg));

// 5) Web Dashboard: sessions for 50 accounts, many share links, doctor reads
const sess = [];
for (const p of phones.slice(0, 50)) sess.push(await webLogin(p));
check("ST6", "50 web sign-ins", sess.every((s) => s.status === 200 && s.cookie), "");
const SHARES = 1000;
const tokens = [];
await phase(`POST /my/api/share x${SHARES}`, Array.from({ length: SHARES }, (_, i) => async () => {
  const r = await web("POST", "/my/api/share", { cookie: sess[i % 50].cookie, body: { days: 7 }, origin: "http://127.0.0.1:8787" });
  if (r.status === 200) tokens.push(r.json.url.split("/s/")[1]);
  return r;
}), 100);
check("ST7", "every share link stored once", one("SELECT COUNT(*) n FROM web_shares").n === tokens.length && new Set(tokens).size === tokens.length, `${one("SELECT COUNT(*) n FROM web_shares").n} rows, ${tokens.length} links`);
await phase(`GET /s/<token>/data x${SHARES}`, tokens.map((t) => () => web("GET", `/s/${t}/data`)), 100);
await phase(`GET /my/api/data x${SHARES}`, Array.from({ length: SHARES }, (_, i) => () => web("GET", "/my/api/data?module=bp&days=7", { cookie: sess[i % 50].cookie })), 100);

// 6) a year and more of data: 2 readings a day for 400 days for every client (back-dated, straight into the local D1)
const ins = db.prepare("INSERT INTO measurements (id, person_id, kind, taken_at, tz, period, data, source, created_at, taken_at_local, created_at_local) VALUES (?, ?, 'bp', ?, 'Europe/Zurich', ?, ?, 'voice', ?, '01012026 08:00', '01012026 08:00')");
const now = Date.now();
db.exec("BEGIN");
for (const p of phones) for (let d = 1; d <= 400; d++) for (const [per, h] of [["morning", 7], ["evening", 19]]) {
  const t = now - d * DAY + h * 3600e3 - 12 * 3600e3;
  ins.run("bp_y" + crypto.randomBytes(8).toString("hex"), p.pid, t, per, JSON.stringify({ sis: 120, dia: 80, pul: 70 }), t);
}
db.exec("COMMIT");
const total = one("SELECT COUNT(*) n FROM measurements").n;
console.log("measurements in D1:", total);
report.config.measurementsBeforePurge = total;
await phase(`GET /v1/me with ${total} rows x${CLIENTS}`, Array.from({ length: CLIENTS }, (_, i) => () => call(phones[i], "GET", "/v1/me")), 50);
await phase(`GET /v1/bp?days=400 with ${total} rows x${CLIENTS}`, Array.from({ length: CLIENTS }, (_, i) => () => call(phones[i], "GET", "/v1/bp?days=400")), 50);
const ownerSess = await webLogin(owner);
await phase(`GET /my/api/admin/overview with ${total} rows x10`, Array.from({ length: 10 }, () => () => web("GET", "/my/api/admin/overview", { cookie: ownerSess.cookie })), 1);
const ov = await web("GET", "/my/api/admin/overview", { cookie: ownerSess.cookie });
check("ST8", "admin overview counts every reading", ov.json?.totals?.readings === total, `${ov.json?.totals?.readings} vs ${total}`);

// 7) the nightly purge on this volume
const expired = one("SELECT COUNT(*) n FROM measurements WHERE taken_at < ?", Date.now() - 365 * DAY).n;
const t0 = performance.now();
const pr = await web("GET", "/__scheduled?cron=17+3+*+*+*");
const purgeMs = performance.now() - t0;
await sleep(500);
const oldLeft = one("SELECT COUNT(*) n FROM measurements WHERE taken_at < ?", Date.now() - 365 * DAY).n;
report.phases.push({ name: `nightly purge (${expired} readings over 365 days of ${total})`, requests: 1, p50: +purgeMs.toFixed(1), statuses: { [pr.status]: 1 } });
console.log(`purge: ${purgeMs.toFixed(0)} ms, removed ${expired}, left over 365 days: ${oldLeft}`);
check("ST9", "purge removes every reading older than 365 days on a large table", pr.status === 200 && oldLeft === 0, `${oldLeft} left`);
check("ST10", "no reading from the last 365 days lost", one("SELECT COUNT(*) n FROM measurements").n === total - expired, "");

// 8) legacy rows without *_local: the cost of /v1/me when it back-fills them (200 rows per call)
db.exec("UPDATE measurements SET taken_at_local = NULL, created_at_local = NULL WHERE rowid IN (SELECT rowid FROM measurements LIMIT 2000)");
await phase("GET /v1/me while back-filling 2000 legacy rows (x10, sequential)", Array.from({ length: 10 }, (_, i) => () => call(phones[i], "GET", "/v1/me")), 1);

console.log(JSON.stringify(report.checks.filter((c) => !c.ok)));
(await import("node:fs")).writeFileSync(process.env.HINT_OUT || "stress-results.json", JSON.stringify(report, null, 2));
