// HINT 365 QA: single-client latency per endpoint (concurrency 1) and query plans of the hot queries.
// Run after stress.mjs, on the same local database: HINT_WORKER_DIR=<scratch worker dir> node seq-latency.mjs
import { call, newPhone, register, web, webLogin, localDb, pct } from "./lib.mjs";
const db = localDb();
const rows = db.prepare("SELECT COUNT(*) n FROM measurements").get().n;
const p = newPhone(); await register(p);
for (let i = 0; i < 20; i++) await call(p, "POST", "/v1/bp/voice", { sis: 120, dia: 80, pul: 70, spokenAt: Date.now() });
const s = await webLogin(p);
const out = { measurements: rows, endpoints: {}, plans: {} };
async function measure(name, f, n = 30) {
  const lat = [];
  for (let i = 0; i < n; i++) lat.push((await f()).ms);
  out.endpoints[name] = { p50: +pct(lat, 50).toFixed(1), p95: +pct(lat, 95).toFixed(1), max: +Math.max(...lat).toFixed(1) };
  console.log(name, out.endpoints[name]);
}
await measure("GET /v1/health", () => web("GET", "/v1/health"));
await measure("GET /v1/me", () => call(p, "GET", "/v1/me"));
await measure("GET /v1/bp?days=400", () => call(p, "GET", "/v1/bp?days=400"));
await measure("POST /v1/bp/voice", () => call(p, "POST", "/v1/bp/voice", { sis: 120, dia: 80, pul: 70, spokenAt: Date.now() }));
await measure("POST /v1/log", () => call(p, "POST", "/v1/log", { code: "qa", place: "QA", message: "x" }));
await measure("GET /my/api/data", () => web("GET", "/my/api/data?days=7", { cookie: s.cookie }));
await measure("POST /my/api/share", () => web("POST", "/my/api/share", { cookie: s.cookie, body: {}, origin: "http://127.0.0.1:8787" }));
for (const [k, q] of Object.entries({
  fillLocalDates: "SELECT id AS k, taken_at, created_at FROM measurements WHERE taken_at_local IS NULL OR created_at_local IS NULL LIMIT 200",
  purge: "DELETE FROM measurements WHERE taken_at < 0",
  errorLogRecent: "SELECT * FROM error_log WHERE last_at > 0 ORDER BY last_at DESC LIMIT 200",
  shareByHash: "SELECT person_id FROM web_shares WHERE token_hash = 'x'",
})) out.plans[k] = db.prepare("EXPLAIN QUERY PLAN " + q).all().map((r) => r.detail).join(" | ");
console.log(out.plans);
(await import("node:fs")).writeFileSync(process.env.HINT_OUT || "seq-latency-results.json", JSON.stringify(out, null, 2));
