// HINT 365 QA: functional and negative tests of the API (/v1), the Web Dashboard (/my) and doctor links (/s).
// Needs a LOCAL worker started from a scratch copy (setup-local.sh) and a fresh local D1.
// Run: HINT_WORKER_DIR=<scratch worker dir> node functional.mjs
import crypto from "node:crypto";
import { NOTICE_TEXT, NOTICE_VERSION } from "../../../worker/src/notices.ts";
const notice = {doc: "disclaimer", version: NOTICE_VERSION, lang: "en", healthConsent: true, textSha256: crypto.createHash("sha256").update(NOTICE_TEXT.en).digest("hex")};
import { BASE, call, newPhone, register, web, webLogin, localDb, Suite, sleep } from "./lib.mjs";

const S = new Suite("functional");
const db = localDb();
const sql = (q, ...p) => db.prepare(q).all(...p);
const run = (q, ...p) => db.prepare(q).run(...p);
const DAY = 864e5;
// start from an empty local database (never run against a real one: lib.mjs refuses non-local addresses)
for (const t of ["persons", "measurements", "scans", "ledger", "invites", "person_keys", "acceptances", "web_codes", "web_sessions", "web_shares", "error_log", "seen_sigs", "rate_limits", "security_findings", "security_fixes", "security_fix_requests"]) run(`DELETE FROM ${t}`);
run("DELETE FROM settings WHERE key <> 'billing_mode'");

// ---------------------------------------------------------------- registration and identity
const owner = newPhone();
let r = await register(owner);
S.check("auth", "R1", "family code registers the first phone", r.status === 200 && /^per_/.test(r.json?.personId), r.text);
r = await call(owner, "GET", "/v1/me");
S.check("auth", "R1b", "first public account does not become owner", r.status === 200 && r.json.isAdmin === false, r.text);
run("UPDATE persons SET is_admin = 1 WHERE id = ?", owner.pid); // explicit local fixture provisioning
await call(owner, "POST", "/v1/accept", notice);
S.check("privacy", "P1", "/v1/me never returns an email", r.json && r.json.email === null, r.text);
const ownerPid = owner.pid;
r = await register(owner);
S.check("auth", "R2", "registering the same key again returns the same account", r.json?.personId === ownerPid, r.text);
const bad = newPhone();
r = await call(bad, "POST", "/v1/register", { code: "WRONG-CODE", publicKey: bad.pub }, { person: null });
S.check("auth", "R3", "wrong family code -> 403 family_code", r.status === 403 && r.json?.code === "family_code", r.text);
const other = newPhone();
r = await call(other, "POST", "/v1/register", { code: "QA-FAMILY-CODE-DUMMY", publicKey: bad.pub }, { person: null });
S.check("auth", "R4", "register with a public key the signer does not own -> 401 bad_key", r.status === 401 && r.json?.code === "bad_key", r.text);
{ // F-07: more than 10 sign-up attempts in an hour from one address are refused
  let last;
  for (let i = 0; i < 11; i++) { const p = newPhone(); last = await call(p, "POST", "/v1/register", { code: "WRONG-CODE", publicKey: p.pub }, { person: null, headers: { "CF-Connecting-IP": "10.99.0.1" } }); }
  S.check("security", "RL1", "11th sign-up attempt from one address in an hour -> 429 too_many", last.status === 429 && last.json?.code === "too_many", last.text);
}
const alice = newPhone(); await register(alice);
const bob = newPhone(); await register(bob);
await call(bob, "POST", "/v1/accept", notice);
r = await call(alice, "GET", "/v1/me");
S.check("auth", "R5", "second account is not the owner", r.status === 200 && r.json.isAdmin === false, r.text);

// ---------------------------------------------------------------- signature checks
r = await call(alice, "GET", "/v1/me", null, { noSig: true });
S.check("auth", "A1", "no signature -> 401", r.status === 401, r.text);
r = await call(alice, "GET", "/v1/me", null, { sigOverride: (await import("./lib.mjs")).sign(bob, "GET", "/v1/me", String(Date.now()), Buffer.alloc(0)) });
S.check("auth", "A2", "signature by another phone's key -> 401", r.status === 401 && r.json?.code === "unauthorized", r.text);
r = await call(alice, "GET", "/v1/me", null, { ts: Date.now() - 6 * 60e3 });
S.check("auth", "A3", "timestamp 6 minutes old -> 401 bad_clock", r.status === 401 && r.json?.code === "bad_clock", r.text);
r = await call(alice, "GET", "/v1/me", null, { ts: Date.now() + 6 * 60e3 });
S.check("auth", "A4", "timestamp 6 minutes in the future -> 401 bad_clock", r.status === 401 && r.json?.code === "bad_clock", r.text);
r = await call(alice, "GET", "/v1/me", null, { person: bob.pid });
S.check("security", "A5", "Alice's signature with X-Person = Bob (IDOR) -> 401", r.status === 401, r.text);
r = await call(alice, "POST", "/v1/bp/voice", { sis: 120, dia: 80, pul: 70, spokenAt: Date.now() }, { signBody: Buffer.from('{"sis":121}') });
S.check("security", "A6", "body changed after signing -> 401", r.status === 401, r.text);
{
  const ts = String(Date.now());
  const sig = (await import("./lib.mjs")).sign(alice, "GET", "/v1/bp?days=1", ts, Buffer.alloc(0));
  r = await call(alice, "GET", "/v1/bp?days=400", null, { ts, sigOverride: sig });
  S.check("security", "A7", "query changed after signing -> 401", r.status === 401, r.text);
}
r = await call(alice, "GET", "/v1/me", null, { sigOverride: "!!!not-base64!!!" });
S.check("robustness", "A8", "garbage X-Sig -> 401 (not 500)", r.status === 401, r.text);
r = await call(alice, "GET", "/v1/me", null, { sigOverride: Buffer.alloc(3).toString("base64") });
S.check("robustness", "A8b", "truncated DER signature -> 401 (not 500)", r.status === 401, r.text);
r = await call(alice, "GET", "/v1/me", null, { person: "per_' OR 1=1 --" });
S.check("security", "A9", "SQL metacharacters in X-Person -> 401, no error", r.status === 401, r.text);
r = await call(alice, "POST", "/v1/bp/voice", null, { raw: "{not json" });
S.check("robustness", "A10", "malformed JSON -> 400", r.status === 400, r.text);
r = await call(alice, "GET", "/v1/nothing-here");
S.check("robustness", "A11", "unknown signed path -> 404", r.status === 404, r.text);

// Replay: the same signed request sent twice inside the 5-minute window
{
  const body = { sis: 131, dia: 83, pul: 71, spokenAt: Date.now() };
  const ts = String(Date.now());
  const raw = JSON.stringify(body);
  const sig = (await import("./lib.mjs")).sign(alice, "POST", "/v1/bp/voice", ts, Buffer.from(raw));
  const a = await call(alice, "POST", "/v1/bp/voice", null, { raw, ts, sigOverride: sig });
  const b = await call(alice, "POST", "/v1/bp/voice", null, { raw, ts, sigOverride: sig });
  S.check("security", "A12", "a replayed signed request is rejected", !(a.status === 200 && b.status === 200),
    `first ${a.status}, replay ${b.status}: the replay created a second reading ${b.json?.id}`);
  await call(alice, "DELETE", "/v1/bp");
}

// ---------------------------------------------------------------- terms acceptance
r = await call(alice, "POST", "/v1/accept", { doc: "disclaimer", version: "13" });
S.check("terms", "T1", "older terms version -> 426 app_disabled (the old app shows 'install the latest version')", r.status === 426 && r.json?.code === "app_disabled", r.text);
r = await call(alice, "POST", "/v1/accept", { doc: "disclaimer", version: "999" });
S.check("terms", "T1b", "unknown terms version -> 400 bad_version", r.status === 400 && r.json?.code === "bad_version", r.text);
r = await call(alice, "POST", "/v1/accept", { ...notice, appVersion: "0.1.200", phone: "X".repeat(500) });
S.check("terms", "T2", "current terms accepted", r.status === 200, r.text);
{
  const [row] = sql("SELECT length(phone) AS lp, length(text_sha256) AS lt, lang, email FROM acceptances WHERE person_id = ?", alice.pid);
  S.check("terms", "T3", "acceptance fields are truncated (phone 80, sha 64, canonical language) and email is NULL", row && row.lp === 80 && row.lt === 64 && row.lang === "en" && row.email === null, JSON.stringify(row));
}
r = await call(alice, "GET", "/v1/me");
S.check("terms", "T4", "/v1/me disclaimerOk after acceptance", r.json?.disclaimerOk === true, r.text);

// ---------------------------------------------------------------- voice readings: validation
const now = () => Date.now();
const voice = (p, b) => call(p, "POST", "/v1/bp/voice", b);
const cases = [
  ["V1", "valid 120/80/70", { sis: 120, dia: 80, pul: 70 }, 200],
  ["V2", "SYS < DIA", { sis: 80, dia: 120, pul: 70 }, 400],
  ["V3", "SYS == DIA", { sis: 90, dia: 90, pul: 70 }, 400],
  ["V4", "zeros", { sis: 0, dia: 0, pul: 0 }, 400],
  ["V5", "999/999/999", { sis: 999, dia: 999, pul: 999 }, 400],
  ["V6", "numbers as strings", { sis: "120", dia: "80", pul: "70" }, 400],
  ["V7", "pulse missing", { sis: 120, dia: 80 }, 400],
  ["V8", "lower bounds 50/30/30", { sis: 50, dia: 30, pul: 30 }, 200],
  ["V9", "upper bounds 260/160/220", { sis: 260, dia: 160, pul: 220 }, 200],
  ["V10", "just outside 49/29/29", { sis: 49, dia: 29, pul: 29 }, 400],
  ["V11", "just outside 261/161/221", { sis: 261, dia: 161, pul: 221 }, 400],
  ["V12", "negative values", { sis: -120, dia: -80, pul: -70 }, 400],
  ["V13", "Infinity / NaN via 1e999", null, 400],
  ["V14", "decimals 120.4/79.6/70.5 are rounded", { sis: 120.4, dia: 79.6, pul: 70.5 }, 200],
  ["V15", "decimals that round to SYS == DIA (100.4/100.4)", { sis: 100.4, dia: 100.4, pul: 70 }, 400],
  ["V16", "arrays / objects", { sis: [120], dia: { v: 80 }, pul: true }, 400],
];
for (const [id, d, b, want] of cases) {
  r = b ? await voice(alice, { ...b, spokenAt: now() }) : await call(alice, "POST", "/v1/bp/voice", null, { raw: `{"sis":1e999,"dia":80,"pul":70,"spokenAt":${now()}}` });
  S.check("voice", id, `${d} -> ${want}`, r.status === want, r.text);
  if (id === "V14" && r.status === 200) S.check("voice", "V14b", "rounded to 120/80/71", r.json.sis === 120 && r.json.dia === 80 && r.json.pul === 71, r.text);
}
r = await voice(alice, { sis: 120, dia: 80, pul: 70, spokenAt: now() - 16 * 60e3 });
S.check("voice", "V17", "said 16 minutes ago -> 400 voice_time", r.status === 400 && r.json?.code === "voice_time", r.text);
r = await voice(alice, { sis: 120, dia: 80, pul: 70, spokenAt: now() + 2 * 60e3 });
S.check("voice", "V18", "said 2 minutes in the future -> 400 voice_time", r.status === 400 && r.json?.code === "voice_time", r.text);
r = await voice(alice, { sis: 120, dia: 80, pul: 70 });
S.check("voice", "V19", "spokenAt missing -> 400", r.status === 400, r.text);

// ---------------------------------------------------------------- photo Scan (read on the phone): only the numbers arrive
r = await call(alice, "POST", "/v1/bp/photo", { sis: 131, dia: 84, pul: 66, takenAt: now() });
S.check("photo", "P1", "confirmed photo reading -> 200, source photo", r.status === 200 && r.json?.source === "photo" && r.json?.sis === 131, r.text);
r = await call(alice, "GET", "/v1/bp?days=1");
S.check("photo", "P2", "listed with source photo", (r.json?.items || []).some((x) => x.sis === 131 && x.source === "photo"), r.text);
r = await call(alice, "POST", "/v1/bp/photo", { sis: 80, dia: 120, pul: 66, takenAt: now() });
S.check("photo", "P3", "SYS < DIA -> 400 photo_invalid", r.status === 400 && r.json?.code === "photo_invalid", r.text);
r = await call(alice, "POST", "/v1/bp/photo", { sis: 131, dia: 84, pul: 66, takenAt: now() - 16 * 60e3 });
S.check("photo", "P4", "photo 16 minutes old -> 400 photo_time", r.status === 400 && r.json?.code === "photo_time", r.text);
r = await call(alice, "POST", "/v1/bp/photo", { sis: 131, dia: 84, pul: 66, spokenAt: now() });
S.check("photo", "P5", "takenAt missing -> 400", r.status === 400, r.text);
r = await call(alice, "POST", "/v1/bp/photo/outcome", { code: "blurry" });
S.check("photo", "P6", "retake reason counted -> 200", r.status === 200, r.text);
r = await call(alice, "POST", "/v1/bp/photo/outcome", { code: "saved" });
S.check("photo", "P7", "outcome 'saved' only from a real save -> 400", r.status === 400, r.text);
r = await call(alice, "POST", "/v1/bp/photo/outcome", { code: "<script>" });
S.check("photo", "P8", "unknown outcome -> 400", r.status === 400, r.text);
r = await voice(alice, { sis: 120, dia: 80, pul: 70, spokenAt: now(), junk: "x".repeat(900_000), note: "\u202e\u0000😀" });
S.check("voice", "V20", "~1 MB body with unicode/NUL junk fields is accepted without storing the junk", r.status === 200, r.text.slice(0, 200));
if (r.status === 200) {
  const [row] = sql("SELECT data FROM measurements WHERE id = ?", r.json.id);
  S.check("voice", "V20b", "stored JSON holds only sis/dia/pul", row && Object.keys(JSON.parse(row.data)).join(",") === "sis,dia,pul", row?.data);
}
{
  const [row] = sql("SELECT period, tz, source, taken_at_local FROM measurements WHERE person_id = ? LIMIT 1", alice.pid);
  S.check("voice", "V21", "stored with tz Europe/Zurich, source voice, period and local time", row && row.tz === "Europe/Zurich" && row.source === "voice" && ["morning", "afternoon", "evening"].includes(row.period) && /^\d{8} \d\d:\d\d$/.test(row.taken_at_local), JSON.stringify(row));
}

// ---------------------------------------------------------------- list, delete, IDOR
await voice(bob, { sis: 140, dia: 90, pul: 80, spokenAt: now() });
r = await call(alice, "GET", "/v1/bp?days=30");
const aliceItems = r.json?.items || [];
S.check("readings", "L1", "list returns only the caller's readings", r.status === 200 && aliceItems.length >= 4 && aliceItems.every((i) => i.sis !== 140), r.text.slice(0, 200));
r = await call(alice, "GET", "/v1/bp?days=abc");
S.check("readings", "L2", "days=abc falls back to the default", r.status === 200, r.text.slice(0, 100));
r = await call(alice, "GET", "/v1/bp?days=-5");
S.check("readings", "L3", "days=-5 is clamped", r.status === 200, r.text.slice(0, 100));
const bobList = (await call(bob, "GET", "/v1/bp")).json.items;
r = await call(alice, "DELETE", "/v1/bp/" + bobList[0].id);
const bobAfter = (await call(bob, "GET", "/v1/bp")).json.items;
S.check("security", "D1", "Alice cannot delete Bob's reading (IDOR)", bobAfter.length === bobList.length, `status ${r.status}, Bob had ${bobList.length}, now ${bobAfter.length}`);
r = await call(alice, "DELETE", "/v1/bp/" + aliceItems[0].id);
const aliceAfter = (await call(alice, "GET", "/v1/bp")).json.items;
S.check("readings", "D2", "own reading deleted", r.status === 200 && aliceAfter.length === aliceItems.length - 1, r.text);
r = await call(alice, "DELETE", "/v1/bp/bp_doesnotexist");
S.check("readings", "D3", "deleting an unknown id answers 200 ok (idempotent)", r.status === 200, r.text);
r = await call(alice, "DELETE", "/v1/bp/..%2f..%2fetc");
S.check("robustness", "D4", "path traversal-like id -> 404", r.status === 404, r.text);

// ---------------------------------------------------------------- the photo reading with AI is gone (terms v19)
// every former AI call answers 410 ai_removed, writes nothing and never reaches Anthropic
for (const [id, m, p, body] of [["S1", "POST", "/v1/bp/scan", { image: "x".repeat(2000), takenAt: now() }], ["S2", "POST", "/v1/bp/confirm", { scanId: "scn_x" }],
  ["S3", "POST", "/v1/key", { apiKey: "sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxx" }], ["S4", "DELETE", "/v1/key", null], ["S5", "POST", "/v1/key/check", {}],
  ["S6", "POST", "/v1/credit", { action: "topup", amount: 5 }], ["S7", "GET", "/v1/credit/history", null], ["S8", "POST", "/v1/admin/credit", { action: "set", amount: 1 }]]) {
  r = await call(alice, m, p, body);
  S.check("ai-removed", id, `${m} ${p} -> 410 ai_removed`, r.status === 410 && r.json?.code === "ai_removed", r.text);
}
S.check("ai-removed", "S9", "nothing written by the former AI calls", sql("SELECT (SELECT COUNT(*) FROM scans) + (SELECT COUNT(*) FROM ledger) + (SELECT COUNT(*) FROM person_keys) AS n")[0].n === 0);
r = await call(alice, "GET", "/v1/me");
S.check("ai-removed", "S10", "/v1/me carries no AI or credit fields", r.status === 200 && !("hasKey" in r.json) && !("credit" in r.json) && !("aiStatus" in r.json), r.text);

// ---------------------------------------------------------------- admin endpoints /v1/admin/*
for (const [p, b] of [["/v1/admin/subscription", { on: false }], ["/v1/admin/settings", { billingMode: "private" }], ["/v1/admin/app-min-version", { minVersion: 1 }], ["/v1/admin/invites", { type: "self_pays" }]]) {
  r = await call(alice, "POST", p, b);
  S.check("admin", "AD-" + p.split("/").pop(), `non-owner POST ${p} -> 403 admin_only`, r.status === 403, r.text);
}
r = await call(owner, "POST", "/v1/admin/subscription", { on: true });
S.check("admin", "AD1", "subscription on without Play service account -> 503", r.status === 503, r.text);
r = await call(owner, "POST", "/v1/admin/settings", { billingMode: "per_user" });
S.check("admin", "AD2", "billing per_user refused", r.status === 400, r.text);
r = await call(owner, "POST", "/v1/admin/invites", { type: "self_pays" });
S.check("admin", "AD3", "owner creates an invite", r.status === 200 && /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(r.json.code), r.text);
{
  const code = r.json.code;
  const inv = newPhone();
  let x = await register(inv, code.toLowerCase().replace(/-/g, " "));
  S.check("admin", "AD4", "invite works typed in lower case with spaces, account pays itself", x.status === 200 && x.json.pays === "self", x.text);
  const inv2 = newPhone();
  x = await register(inv2, code);
  S.check("admin", "AD5", "invite cannot be used twice -> 403 invite_used", x.status === 403 && x.json?.code === "invite_used", x.text);
  const c2 = (await call(owner, "POST", "/v1/admin/invites", { type: "owner_pays" })).json.code;
  run("UPDATE invites SET expires_at = ? WHERE code = ?", now() - 1000, c2);
  x = await register(newPhone(), c2);
  S.check("admin", "AD6", "expired invite -> 403 invite_expired", x.status === 403 && x.json?.code === "invite_expired", x.text);
  // race: the same invite from 10 phones at once
  const c3 = (await call(owner, "POST", "/v1/admin/invites", { type: "self_pays" })).json.code;
  const rs = await Promise.all(Array.from({ length: 10 }, () => register(newPhone(), c3)));
  S.check("concurrency", "AD7", "one invite used by 10 phones at once -> exactly one account", rs.filter((z) => z.status === 200).length === 1, rs.map((z) => z.status).join(","));
}
// an app built before the current terms keeps working with its own terms until the person updates (P-010)
{
  const old = newPhone(); await register(old);
  r = await web("GET", "/v1/app-status?v=121");
  S.check("terms", "T7", "app 121 (older terms) is still allowed", r.status === 200 && r.json.ok === true, r.text);
  r = await call(old, "GET", "/v1/me", null, { version: 121 });
  S.check("terms", "T8", "app 121 before accepting -> disclaimerOk false", r.status === 200 && r.json.disclaimerOk === false, r.text);
  r = await call(old, "POST", "/v1/accept", { ...notice, version: "21", textSha256: "a".repeat(64) }, { version: 121 });
  S.check("terms", "T9", "app 121 accepts its own terms v21 -> recorded as v21", r.status === 200 && sql("SELECT version FROM acceptances WHERE person_id = ?", old.pid)[0]?.version === "21", r.text);
  r = await call(old, "GET", "/v1/me", null, { version: 121 });
  S.check("terms", "T10", "app 121 after accepting -> disclaimerOk true, no loop", r.json?.disclaimerOk === true, r.text);
  r = await call(old, "GET", "/v1/me", null, { version: 122 });
  S.check("terms", "T11", "after the update (122) the current terms are asked", r.json?.disclaimerOk === false, r.text);
  r = await call(old, "POST", "/v1/accept", { ...notice, version: "21", textSha256: "a".repeat(64) }, { version: 122 });
  S.check("terms", "T12", "a build with the current terms cannot accept older ones -> 426", r.status === 426, r.text);
}
r = await call(owner, "POST", "/v1/admin/app-min-version", { minVersion: 999 });
S.check("admin", "AD8", "min version above the owner's own app -> 400", r.status === 400, r.text);
r = await call(owner, "POST", "/v1/admin/app-min-version", { minVersion: 150 });
S.check("gate", "G1", "owner switches off versions below 150", r.status === 200 && r.json.appMinVersion === 150, r.text);
r = await call(alice, "GET", "/v1/me", null, { version: 100 });
S.check("gate", "G2", "app version 100 -> 426 app_disabled", r.status === 426 && r.json?.code === "app_disabled", r.text);
r = await call(alice, "GET", "/v1/me", null, { version: "" });
S.check("gate", "G3", "no X-App-Version counts as 0 -> 426", r.status === 426, r.text);
r = await web("GET", "/v1/app-status?v=100");
S.check("gate", "G4", "app-status v=100 -> ok false", r.status === 200 && r.json.ok === false, r.text);
r = await web("GET", "/v1/app-status?v=200");
S.check("gate", "G5", "app-status v=200 -> ok true", r.json?.ok === true, r.text);
run("INSERT INTO settings (key, value) VALUES ('app_blocked', '200') ON CONFLICT (key) DO UPDATE SET value = excluded.value");
r = await call(alice, "GET", "/v1/me");
S.check("gate", "G6", "app_blocked = 200 blocks version 200", r.status === 426, r.text);
run("UPDATE settings SET value = '' WHERE key = 'app_blocked'");
run("INSERT INTO settings (key, value) VALUES ('app_off', '1') ON CONFLICT (key) DO UPDATE SET value = excluded.value");
r = await call(alice, "GET", "/v1/me");
S.check("gate", "G7", "app_off = 1 blocks every version", r.status === 426, r.text);
run("UPDATE settings SET value = '0' WHERE key = 'app_off'");
await call(owner, "POST", "/v1/admin/app-min-version", { minVersion: 0 });

// ---------------------------------------------------------------- subscription gate
run("INSERT INTO settings (key, value) VALUES ('subscription_on', '1') ON CONFLICT (key) DO UPDATE SET value = excluded.value");
r = await call(alice, "GET", "/v1/bp");
S.check("subscription", "B1", "subscription expired: own readings remain available", r.status === 200, r.text);
r = await call(alice, "GET", "/v1/me");
S.check("subscription", "B2", "the app is never blocked: sub.required false, not paid, Scan on trial", r.status === 200 && r.json.sub.required === false && r.json.sub.active === false && r.json.sub.scan === "trial", r.text);
run("INSERT OR REPLACE INTO scan_trials (fp, started_at) VALUES (?, ?)", "p:" + alice.pid, now() - 16 * DAY);
r = await call(alice, "GET", "/v1/me");
S.check("subscription", "B2b", "after the 15-day Scan trial: the Scan is locked, the rest still answers", r.status === 200 && r.json.sub.scan === "locked", r.text);
r = await call(owner, "GET", "/v1/me");
S.check("subscription", "B2c", "the owner's Scan is never locked", r.status === 200 && r.json.sub.scan === "on", r.text);
r = await call(owner, "GET", "/v1/bp");
S.check("subscription", "B3", "the owner never pays", r.status === 200, r.text);
r = await call(alice, "POST", "/v1/sub/verify", { purchaseToken: "x" });
S.check("subscription", "B4", "sub/verify without Play account -> 503", r.status === 503, r.text);
run("UPDATE persons SET sub_until = ?, sub_state = 'SUBSCRIPTION_STATE_ACTIVE' WHERE id = ?", now() + 30 * DAY, alice.pid);
r = await call(alice, "GET", "/v1/bp");
S.check("subscription", "B5", "valid subscription -> readings again", r.status === 200, r.text);
r = await call(alice, "GET", "/v1/me");
S.check("subscription", "B5b", "valid subscription -> the Scan is on again", r.status === 200 && r.json.sub.scan === "on", r.text);
run("INSERT OR REPLACE INTO scan_usage (person_id, window_start, scans, micro_usd) VALUES (?, ?, 10, 20000)", alice.pid, now() - DAY);
r = await call(alice, "GET", "/v1/me");
S.check("subscription", "B5c", "subscriber sees the Scans left in the yearly allowance (2.50 $, from the recorded use)", r.status === 200 && r.json.sub.scansLeft === 1240, r.text);
run("UPDATE scan_usage SET micro_usd = 2500000 WHERE person_id = ?", alice.pid);
r = await call(alice, "GET", "/v1/me");
S.check("subscription", "B5d", "allowance used up -> no Scans left", r.status === 200 && r.json.sub.scansLeft === 0, r.text);
run("DELETE FROM scan_usage WHERE person_id = ?", alice.pid);

// ---------------------------------------------------------------- owner's powers only from the owner's phone
r = await call(owner, "GET", "/v1/me");
S.check("owner", "OW1", "owner on the phone on record: owner powers", r.status === 200 && r.json.isAdmin === true, r.text);
run("UPDATE settings SET value = 'another-phone-key' WHERE key = 'owner_key'");
r = await call(owner, "GET", "/v1/me");
S.check("owner", "OW2", "owner account moved to a phone not on record (e.g. stolen Google account): no owner powers", r.status === 200 && r.json.isAdmin === false, r.text);
r = await call(owner, "POST", "/v1/admin/app-min-version", { minVersion: 0 });
S.check("owner", "OW3", "owner calls from that phone are refused", r.status === 403, r.text);
run("DELETE FROM settings WHERE key = 'owner_key'");
r = await call(owner, "GET", "/v1/me");
S.check("owner", "OW4", "no phone on record yet: the owner's phone in use is recorded", r.status === 200 && r.json.isAdmin === true, r.text);
run("DELETE FROM scan_trials WHERE fp = ?", "p:" + alice.pid);
run("UPDATE persons SET sub_until = NULL, sub_state = NULL WHERE id = ?", alice.pid);

// ---------------------------------------------------------------- web dashboard
run("UPDATE settings SET value = '0' WHERE key = 'subscription_on'");
const sessA = await webLogin(alice);
S.check("web", "W1", "one-time code becomes a cookie", sessA.status === 200 && sessA.cookie.length > 20, sessA.setCookie);
S.check("web", "W2", "cookie flags HttpOnly; Secure; SameSite=Strict; Path=/my; Max-Age=604800",
  /HttpOnly/.test(sessA.setCookie) && /Secure/.test(sessA.setCookie) && /SameSite=Strict/.test(sessA.setCookie) && /Path=\/my/.test(sessA.setCookie) && /Max-Age=604800/.test(sessA.setCookie), sessA.setCookie);
S.check("privacy", "W3", "code travels in the #fragment, not the query", /\/my\/#c=/.test(sessA.url), sessA.url);
r = await web("POST", "/my/session", { body: { code: sessA.code }, origin: BASE });
S.check("web", "W4", "the one-time code cannot be used twice -> 401 code_gone", r.status === 401 && r.json?.code === "code_gone", r.text);
{
  const c = await call(alice, "POST", "/v1/web/code", {});
  const code = c.json.url.split("#c=")[1];
  const h = crypto.createHash("sha256").update(code).digest("hex");
  run("UPDATE web_codes SET expires_at = ? WHERE code_hash = ?", now() - 1, h);
  r = await web("POST", "/my/session", { body: { code }, origin: BASE });
  S.check("web", "W5", "expired one-time code -> 401", r.status === 401, r.text);
  S.check("privacy", "W5b", "only a SHA-256 fingerprint of the code is stored", sql("SELECT COUNT(*) n FROM web_codes WHERE code_hash = ?", code)[0].n === 0, "");
}
r = await web("POST", "/my/session", { body: "not json", origin: BASE });
S.check("robustness", "W6", "malformed session body -> 401", r.status === 401, r.text);
r = await web("POST", "/my/session", { body: { code: "x" }, origin: "https://evil.example" });
S.check("security", "W7", "cross-origin POST -> 403", r.status === 403, r.text);
r = await web("GET", "/my/api/data");
S.check("web", "W8", "data without cookie -> 401 no_session", r.status === 401 && r.json?.code === "no_session", r.text);
r = await web("GET", "/my/api/data", { cookie: "hint_s=forged-token-value-000000000000000" });
S.check("security", "W9", "forged cookie -> 401", r.status === 401, r.text);
r = await web("GET", "/my/api/data?days=30", { cookie: sessA.cookie });
S.check("web", "W10", "data: at most 7 days even when 30 are asked", r.status === 200 && r.json.to - r.json.from <= 7 * DAY, r.text.slice(0, 200));
S.check("security", "W11", "data only holds the caller's readings", r.json.items.every((i) => i.sys !== 140), JSON.stringify(r.json.items).slice(0, 200));
r = await web("GET", "/my/api/data?module=unknown", { cookie: sessA.cookie });
S.check("web", "W12", "unknown module -> 404", r.status === 404, r.text);
r = await web("GET", "/my/api/me", { cookie: sessA.cookie });
S.check("web", "W13", "/my/api/me for a non-owner: isOwner false", r.status === 200 && r.json.isOwner === false, r.text);
r = await web("GET", "/my/api/admin/overview", { cookie: sessA.cookie });
S.check("admin", "W14", "non-owner cannot open the admin overview -> 403", r.status === 403, r.text);
r = await web("POST", "/my/api/admin/app-min-version", { cookie: sessA.cookie, body: { minVersion: 1 }, origin: BASE });
S.check("admin", "W15", "non-owner cannot block versions from the web -> 403", r.status === 403, r.text);

// share links
r = await web("POST", "/my/api/share", { cookie: sessA.cookie, body: { days: 30 }, origin: BASE });
S.check("share", "SH1", "share link valid exactly 7 days", r.status === 200 && Math.abs(r.json.expiresAt - r.json.to - 7 * DAY) < 5, r.text);
S.check("share", "SH2", "shared period clamped to 7 days", r.json.to - r.json.from <= 7 * DAY, r.text);
const shareUrl = r.json.url;
const token = shareUrl.split("/s/")[1];
S.check("privacy", "SH3", "only a fingerprint of the share token is stored", sql("SELECT COUNT(*) n FROM web_shares WHERE token_hash = ?", token)[0].n === 0, "");
r = await web("GET", "/s/" + token);
S.check("share", "SH4", "/s/<token> serves the page", r.status === 200 && /<html/.test(r.text), String(r.status));
r = await web("GET", "/s/" + token + "/data");
S.check("share", "SH5", "/s/<token>/data is read-only data with no account or email", r.status === 200 && r.json.shared === true && !/per_|@/.test(r.text), r.text.slice(0, 200));
r = await web("POST", "/s/" + token + "/data", { body: {} });
S.check("share", "SH6", "POST to a share link is not accepted", r.status >= 400, String(r.status));
r = await web("GET", "/s/" + "A".repeat(43) + "/data");
S.check("share", "SH7", "unknown token -> 404 share_gone", r.status === 404 && r.json?.code === "share_gone", r.text);
r = await web("GET", "/s/short");
S.check("robustness", "SH8", "/s/short (malformed) answers 404, not a phone-clock 401", r.status === 404, `${r.status} ${r.text.slice(0, 90)}`);
r = await web("DELETE", "/my/api/shares", { cookie: sessA.cookie, origin: BASE });
r = await web("GET", "/s/" + token + "/data");
S.check("share", "SH9", "withdrawn link -> 404", r.status === 404, r.text);
{
  const s2 = (await web("POST", "/my/api/share", { cookie: sessA.cookie, body: {}, origin: BASE })).json.url.split("/s/")[1];
  run("UPDATE web_shares SET expires_at = ? WHERE token_hash = ?", now() - 1, crypto.createHash("sha256").update(s2).digest("hex"));
  r = await web("GET", "/s/" + s2 + "/data");
  S.check("share", "SH10", "expired link -> 404", r.status === 404, r.text);
  const s3 = (await web("POST", "/my/api/share", { cookie: sessA.cookie, body: {}, origin: BASE })).json.url.split("/s/")[1];
  run("INSERT INTO settings (key, value) VALUES ('subscription_on', '1') ON CONFLICT (key) DO UPDATE SET value = excluded.value");
  r = await web("GET", "/s/" + s3 + "/data");
  S.check("subscription", "SH11", "doctor link keeps working: the subscription unlocks only the Scan", r.status === 200, `status ${r.status}`);
  r = await web("GET", "/my/api/data", { cookie: sessA.cookie });
  S.check("subscription", "SH12", "web data remains accessible after subscription expiry", r.status === 200, r.text);
  run("UPDATE settings SET value = '0' WHERE key = 'subscription_on'");
}

// web error log
r = await web("POST", "/my/api/log", { cookie: sessA.cookie, body: { code: "script", place: "app.js:123 SYS 142/95", message: "value 142/95 failed" }, origin: BASE });
{
  const [row] = sql("SELECT place, message FROM error_log WHERE source = 'web' ORDER BY last_at DESC LIMIT 1");
  S.check("privacy", "E1", "error log never stores free text", row && row.message === null, JSON.stringify(row));
  S.check("privacy", "E2", "error log place has digits removed too (reading values could be sent there)", row && !/\d/.test(row.place), JSON.stringify(row));
}
r = await call(alice, "POST", "/v1/log", { code: "crash:IllegalStateException", place: "Report.kt:123", message: "SYS 150 DIA 99" });
{
  const [row] = sql("SELECT code, message, person_id FROM error_log WHERE source = 'app' ORDER BY last_at DESC LIMIT 1");
  S.check("errorlog", "E3", "app log stores code without free text", r.status === 200 && row && row.message === null && row.person_id === alice.pid, JSON.stringify(row));
}
{
  const before = sql("SELECT COUNT(*) n FROM error_log")[0].n;
  await Promise.all(Array.from({ length: 50 }, (_, i) => web("GET", `/v1/flood-${i}-${crypto.randomBytes(4).toString("hex")}`)));
  await sleep(1500);   // the log is written after the answer (waitUntil)
  const after = sql("SELECT COUNT(*) n FROM error_log")[0].n;
  S.check("security", "E4", "unauthenticated requests cannot add new error_log rows at will", after - before < 5, `${after - before} new rows from 50 unsigned requests to random paths`);
  const [spoof] = sql("SELECT COUNT(*) n FROM error_log WHERE person_id = 'per_spoofed'");
  await web("GET", "/v1/me", { headers: { "X-Person": "per_spoofed", "X-App-Version": "999" } });
  await sleep(1000);
  const [spoof2] = sql("SELECT COUNT(*) n FROM error_log WHERE person_id = 'per_spoofed'");
  S.check("security", "E5", "an unsigned request cannot put an arbitrary account code into the error log", spoof2.n === spoof.n, "X-Person of an unauthenticated request stored as person_id");
}

// owner's area on the web
const sessO = await webLogin(owner);
r = await web("GET", "/my/api/me", { cookie: sessO.cookie });
S.check("admin", "W16", "owner: isOwner true", r.json?.isOwner === true, r.text);
r = await web("GET", "/my/api/admin/overview", { cookie: sessO.cookie });
S.check("admin", "W17", "owner opens the admin overview: totals only, no list of accounts or errors", r.status === 200 && r.json.totals && r.json.users === undefined && r.json.errors === undefined, r.text.slice(0, 200));
S.check("privacy", "W18", "admin overview holds no reading values (sis/dia/pul/data)", r.status === 200 && !/"(sis|dia|pul|sys|data)"/.test(r.text), "");
r = await web("GET", "/my/api/admin/security", { cookie: sessO.cookie });
S.check("admin", "W17b", "owner opens the Security console", r.status === 200 && Array.isArray(r.json.items), r.text.slice(0, 200));
r = await web("GET", "/my/api/admin/security", { cookie: sessA.cookie });
S.check("security", "W17c", "a non-owner cannot open the Security console -> 403", r.status === 403, r.text.slice(0, 200));
// Observability: compliance controls, problems with their resolutions, import outcomes; owner only, codes and counts only
r = await web("GET", "/my/api/admin/observability", { cookie: sessO.cookie });
S.check("admin", "OB1", "owner opens Observability: compliance controls, problem registry, errors and events",
  r.status === 200 && r.json.compliance?.controls?.length >= 15 && Array.isArray(r.json.problems) && Array.isArray(r.json.errors) && Array.isArray(r.json.events), r.text.slice(0, 200));
S.check("privacy", "OB2", "Observability carries no reading, report value or person id",
  r.status === 200 && !/"(sis|dia|pul|value|reference|person_id|personId|name)"\s*:/.test(JSON.stringify({ errors: r.json.errors, events: r.json.events })), "");
r = await web("GET", "/my/api/admin/observability", { cookie: sessA.cookie });
S.check("security", "OB3", "a non-owner cannot open Observability -> 403", r.status === 403, r.text.slice(0, 200));
// Security console "Fix": off without the GitHub token; progress only with the request's own key (Open → Fixing → Fixed | Failed)
r = await web("POST", "/my/api/admin/security/fix", { cookie: sessO.cookie, body: { items: [] }, origin: BASE });
S.check("security", "FX1", "Fix without the server's GitHub token -> 503 fix_not_configured", r.status === 503 && r.json?.code === "fix_not_configured", r.text);
r = await web("POST", "/my/api/admin/security/fix", { cookie: sessA.cookie, body: { items: [] }, origin: BASE });
S.check("security", "FX2", "a non-owner cannot request a fix -> 403", r.status === 403, r.text);
{
  const now = Date.now(), key = "k-" + crypto.randomBytes(16).toString("hex");
  run("INSERT INTO security_fix_requests (id, key_hash, issue_url, created_at, expires_at) VALUES ('fxqa', ?, 'https://github.com/x/y/issues/1', ?, ?)", crypto.createHash("sha256").update(key).digest("hex"), now, now + 864e5);
  for (const [n, name] of [[1, "lib-a"], [2, "lib-b"]])
    run("INSERT INTO security_fixes (kind, ref, name, location, fix_id, idx, status, requested_at, updated_at) VALUES ('library', 'GHSA-qa', ?, 'android', 'fxqa', ?, 'fixing', ?, ?)", name, n, now, now);
  r = await web("POST", "/hooks/fix-status", { body: { id: "fxqa", key: "wrong", items: [{ n: 1, status: "fixed" }] } });
  S.check("security", "FX3", "fix progress with a wrong key -> 401, nothing changes", r.status === 401 && sql("SELECT status FROM security_fixes WHERE name = 'lib-a'")[0].status === "fixing", r.text);
  r = await web("POST", "/hooks/fix-status", { body: { id: "fxqa", key, items: [{ n: 1, status: "fixed", url: "https://github.com/x/y/pull/2" }, { n: 1, status: "deleted" }] } });
  S.check("security", "FX4", "fix progress with the request key: Fixed with its pull request; unknown states ignored", r.status === 200 && sql("SELECT status, detail_url FROM security_fixes WHERE name = 'lib-a'")[0].status === "fixed", r.text);
  r = await web("POST", "/hooks/fix-status", { body: { id: "fxqa", key, finish: true } });
  S.check("security", "FX5", "end of the run: what is still Fixing becomes Failed", sql("SELECT status FROM security_fixes WHERE name = 'lib-b'")[0].status === "failed", r.text);
  r = await web("GET", "/my/api/admin/security/status", { cookie: sessO.cookie });
  S.check("security", "FX6", "the console reads the states (owner only)", r.status === 200 && r.json.items.length === 2, r.text.slice(0, 200));
}
S.check("privacy", "W18b", "admin overview holds no email", !/@/.test(r.text), "");
r = await web("POST", "/my/api/admin/app-min-version", { cookie: sessO.cookie, body: { minVersion: 99999 }, origin: BASE });
S.check("admin", "W19", "web: min version above newest installed -> 400", r.status === 400, r.text);
// a user inflates the newest version with a forged header, then the owner can lock everyone out
await call(bob, "GET", "/v1/me", null, { version: 99999 });
r = await web("GET", "/my/api/admin/overview", { cookie: sessO.cookie });
S.check("admin", "W20", "newest version cannot be inflated by one user's X-App-Version header", r.json.versions.newest < 99999, `newest = ${r.json.versions.newest}`);
S.check("admin", "W20b", "version spread: people per app version, adding up to all users", Array.isArray(r.json.versions.spread) && r.json.versions.spread.reduce((a, x) => a + x.n, 0) === r.json.totals.users, JSON.stringify(r.json.versions.spread));
await call(bob, "GET", "/v1/me");
run("UPDATE persons SET app_version = '0.1.200' WHERE id = ?", bob.pid);

// sign out of the web
r = await web("DELETE", "/my/session", { cookie: sessA.cookie, origin: BASE });
S.check("web", "W21", "sign out clears the cookie", r.status === 200 && /Max-Age=0/.test(r.headers.get("set-cookie") || ""), r.headers.get("set-cookie"));
r = await web("GET", "/my/api/me", { cookie: sessA.cookie });
S.check("web", "W22", "old cookie no longer works", r.status === 401, r.text);

// ---------------------------------------------------------------- sign out of the phone and delete the account
r = await call(alice, "POST", "/v1/signout", {});
S.check("account", "X1", "sign out without Google -> 409 google_needed", r.status === 409, r.text);
run("UPDATE persons SET google_sub = 'h1:qa' WHERE id = ?", alice.pid);
const sessA2 = await webLogin(alice);
r = await call(alice, "POST", "/v1/signout", {});
S.check("account", "X2", "sign out with Google", r.status === 200, r.text);
r = await call(alice, "GET", "/v1/me");
S.check("account", "X3", "phone key no longer works after sign-out", r.status === 401, r.text);
r = await web("GET", "/my/api/me", { cookie: sessA2.cookie });
S.check("account", "X4", "browser sessions end with the phone sign-out", r.status === 401, r.text);
r = await call(owner, "DELETE", "/v1/me");
S.check("account", "X5", "the owner cannot delete their account -> 403", r.status === 403, r.text);
const carol = newPhone(); await register(carol);
await call(carol, "POST", "/v1/accept", notice);
await voice(carol, { sis: 118, dia: 76, pul: 60, spokenAt: now() });
const sessC = await webLogin(carol);
const shareC = (await web("POST", "/my/api/share", { cookie: sessC.cookie, body: {}, origin: BASE })).json.url.split("/s/")[1];
r = await call(carol, "DELETE", "/v1/me");
S.check("account", "X6", "account deleted", r.status === 200, r.text);
const left = sql("SELECT (SELECT COUNT(*) FROM persons WHERE id = ?1) p, (SELECT COUNT(*) FROM measurements WHERE person_id = ?1) m, (SELECT COUNT(*) FROM web_sessions WHERE person_id = ?1) s, (SELECT COUNT(*) FROM web_shares WHERE person_id = ?1) sh, (SELECT COUNT(*) FROM acceptances WHERE person_id = ?1) a", carol.pid)[0];
S.check("account", "X7", "deletion removes person, readings, sessions and links; keeps the acceptance as proof", left.p === 0 && left.m === 0 && left.s === 0 && left.sh === 0 && left.a === 1, JSON.stringify(left));
r = await web("GET", "/s/" + shareC + "/data");
S.check("account", "X8", "doctor link of a deleted account -> 404", r.status === 404, r.text);

// ---------------------------------------------------------------- public pages and headers
for (const p of ["/", "/privacy", "/terms"]) {
  r = await web("GET", p);
  S.check("pages", "PG" + p, `${p} served, says HINT 365`, r.status === 200 && /HINT 365/.test(r.text), String(r.status));
}
r = await web("GET", "/terms");
S.check("pages", "PG-oauth", "terms mention Sign in with Google (OAuth 2.0 / OpenID Connect) and the hint_s cookie", /OAuth 2\.0/.test(r.text) && /OpenID Connect/.test(r.text) && /hint_s/.test(r.text), "");
r = await web("GET", "/download");
S.check("pages", "PG-dl", "/download redirects to the APK", r.status === 302 && /HINT\.apk$/.test(r.headers.get("location") || ""), String(r.status));
r = await web("GET", "/my/");
const h = r.headers;
S.check("security", "HD1", "/my/ sends Content-Security-Policy", !!h.get("content-security-policy"), "no CSP header");
S.check("security", "HD2", "/my/ forbids framing (X-Frame-Options or frame-ancestors)", !!h.get("x-frame-options") || /frame-ancestors/.test(h.get("content-security-policy") || ""), "clickjacking possible");
S.check("security", "HD3", "/my/ sends Strict-Transport-Security / nosniff", !!h.get("x-content-type-options"), "no nosniff");

// ---------------------------------------------------------------- nightly purge (365 days) via the scheduled handler
{
  const dave = newPhone(); await register(dave);
  const ins = db.prepare("INSERT INTO measurements (id, person_id, kind, taken_at, tz, period, data, source, created_at) VALUES (?, ?, 'bp', ?, 'Europe/Zurich', 'morning', '{\"sis\":120,\"dia\":80,\"pul\":70}', 'voice', ?)");
  const t = now();
  const ages = [366, 365.01, 364.9, 300, 1];
  ages.forEach((a, i) => ins.run("bp_qaage" + i, dave.pid, Math.round(t - a * DAY), Math.round(t - a * DAY)));
  run("INSERT INTO scans (id, person_id, kind, result, taken_at, used, created_at) VALUES ('scn_qaold', ?, 'bp', '{}', ?, 1, ?)", dave.pid, t - 400 * DAY, t - 400 * DAY);
  // left over from the former photo reading with AI: a recent reading, a key and a cost row, all deleted by the purge
  run("INSERT INTO scans (id, person_id, kind, result, taken_at, used, created_at) VALUES ('scn_qanew', ?, 'bp', '{}', ?, 1, ?)", dave.pid, t - DAY, t - DAY);
  run("INSERT INTO person_keys (person_id, sealed_key, created_at) VALUES (?, 'v1:AAAA:BBBB', ?)", dave.pid, t);
  run("INSERT INTO ledger (kind, amount_micro, person_id, payer, created_at) VALUES ('usage', 6000, ?, ?, ?)", dave.pid, dave.pid, t);
  run("INSERT INTO web_codes (code_hash, person_id, expires_at) VALUES ('qa-old-code', ?, ?)", dave.pid, t - 1000);
  run("INSERT INTO web_sessions (id_hash, person_id, created_at, expires_at) VALUES ('qa-old-sess', ?, ?, ?)", dave.pid, t - 9 * DAY, t - 1000);
  run("INSERT INTO error_log (day, source, code, place, app_version, count, first_at, last_at) VALUES ('2000-01-01', 'server', 'qa_old', 'x', '', 1, ?, ?)", t - 91 * DAY, t - 91 * DAY);
  run("UPDATE persons SET email = 'someone@example.invalid' WHERE id = ?", dave.pid);
  run("UPDATE acceptances SET email = 'someone@example.invalid' WHERE person_id = ?", owner.pid);
  // lab results: kept until the person deletes them, whatever the report or upload date
  const lab = db.prepare("INSERT INTO measurements (id, person_id, kind, taken_at, tz, period, data, source, created_at) VALUES (?, ?, 'lab', ?, 'Europe/Zurich', 'lab', '[]', 'local-import', ?)");
  lab.run("lab_qaoldreport", dave.pid, Math.round(t - 900 * DAY), Math.round(t - 10 * DAY));
  lab.run("lab_qaoldupload", dave.pid, Math.round(t - 400 * DAY), Math.round(t - 366 * DAY));
  const accBefore = sql("SELECT COUNT(*) n FROM acceptances")[0].n;
  r = await web("GET", "/__scheduled?cron=17+3+*+*+*");
  await sleep(500);
  const left = sql("SELECT id FROM measurements WHERE person_id = ? AND kind = 'bp' ORDER BY id", dave.pid).map((x) => x.id);
  const labsLeft = sql("SELECT id FROM measurements WHERE person_id = ? AND kind = 'lab' ORDER BY id", dave.pid).map((x) => x.id);
  S.check("retention", "PU6", "lab results are never deleted by the nightly job, whatever their dates", labsLeft.join(",") === "lab_qaoldreport,lab_qaoldupload", labsLeft.join(","));
  S.check("retention", "PU1", "purge deletes readings older than 365 days, keeps 364.9 / 300 / 1 days", r.status === 200 && left.join(",") === "bp_qaage2,bp_qaage3,bp_qaage4", left.join(","));
  S.check("retention", "PU2", "purge deletes old scans, expired codes and sessions, error log > 90 days",
    sql("SELECT (SELECT COUNT(*) FROM scans WHERE id='scn_qaold') + (SELECT COUNT(*) FROM web_codes WHERE code_hash='qa-old-code') + (SELECT COUNT(*) FROM web_sessions WHERE id_hash='qa-old-sess') + (SELECT COUNT(*) FROM error_log WHERE code='qa_old') n")[0].n === 0, "");
  S.check("retention", "PU4", "purge deletes every key, cost and reading of the former AI Scan",
    sql("SELECT (SELECT COUNT(*) FROM scans) + (SELECT COUNT(*) FROM ledger) + (SELECT COUNT(*) FROM person_keys) AS n")[0].n === 0, "");
  S.check("retention", "PU3", "acceptances are kept by the purge", sql("SELECT COUNT(*) n FROM acceptances")[0].n === accBefore, "");
  S.check("privacy", "PU4", "any email left in persons/acceptances is erased by the nightly job", sql("SELECT (SELECT COUNT(*) FROM persons WHERE email IS NOT NULL) + (SELECT COUNT(*) FROM acceptances WHERE email IS NOT NULL) n")[0].n === 0, "");
  r = await call(dave, "GET", "/v1/bp?days=400");
  S.check("retention", "PU5", "API never returns a reading older than 365 days", r.json.items.every((i) => now() - i.takenAt <= 365 * DAY), "");
}

const out = S.summary();
console.log(JSON.stringify(out.by, null, 1));
S.save(process.env.HINT_OUT || "functional-results.json");
