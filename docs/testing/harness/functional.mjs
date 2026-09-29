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
S.check("terms", "T1", "old terms version -> 400 bad_version", r.status === 400 && r.json?.code === "bad_version", r.text);
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

// ---------------------------------------------------------------- photo scan: only paths that never reach Anthropic
r = await call(alice, "POST", "/v1/bp/scan", { image: "x".repeat(2000), takenAt: now() - 31 * 60e3 });
S.check("scan", "S1", "photo older than 30 min -> 400 photo_time", r.status === 400 && r.json?.code === "photo_time", r.text);
r = await call(alice, "POST", "/v1/bp/scan", { image: "short", takenAt: now() });
S.check("scan", "S2", "missing/short image -> 400 no_photo", r.status === 400 && r.json?.code === "no_photo", r.text);
run("UPDATE persons SET pays = 'self' WHERE id = ?", bob.pid);
r = await call(bob, "POST", "/v1/bp/scan", { image: "x".repeat(2000), takenAt: now() });
S.check("scan", "S3", "self-paying account without a key -> 402 friend_no_key (Anthropic never called)", r.status === 402 && r.json?.code === "friend_no_key", r.text);
run("INSERT INTO person_keys (person_id, sealed_key, created_at) VALUES (?, 'v1:AAAA:BBBB', ?)", bob.pid, now());
r = await call(bob, "POST", "/v1/bp/scan", { image: "x".repeat(2000), takenAt: now() });
S.check("scan", "S4", "sealed key that cannot be opened -> 402 friend_key_invalid", r.status === 402 && r.json?.code === "friend_key_invalid", r.text);
r = await call(bob, "POST", "/v1/key", { apiKey: "not-a-key" });
S.check("scan", "S5", "badly formed Anthropic key -> 400 friend_key_invalid (no call made)", r.status === 400 && r.json?.code === "friend_key_invalid", r.text);
r = await call(bob, "DELETE", "/v1/key");
S.check("scan", "S6", "DELETE /v1/key -> hasKey false", r.status === 200 && r.json.hasKey === false, r.text);
r = await call(bob, "POST", "/v1/key/check", {});
S.check("scan", "S7", "key check without a key -> none", r.status === 200 && r.json.aiStatus === "none", r.text);
r = await call(alice, "POST", "/v1/key", { apiKey: "sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxx" });
S.check("scan", "S8", "every account pays its own AI: a key is checked with Anthropic, not refused by role (F-08)", r.json?.code !== "not_self_pays" && r.status !== 403, r.text);
// confirm: scans inserted directly, as if Anthropic had read them
const mkScan = (pid, readable = true) => {
  const id = "scn_qa" + crypto.randomBytes(6).toString("hex");
  run("INSERT INTO scans (id, person_id, kind, result, taken_at, used, created_at) VALUES (?, ?, 'bp', ?, ?, 0, ?)", id, pid,
    JSON.stringify({ readable, sis: 125, dia: 81, pul: 66, note: "" }), now() - 60e3, now() - 60e3);
  return id;
};
const sAlice = mkScan(alice.pid);
r = await call(bob, "POST", "/v1/bp/confirm", { scanId: sAlice });
S.check("security", "C1", "Bob cannot confirm Alice's scan (IDOR) -> 404", r.status === 404, r.text);
const confirms = await Promise.all(Array.from({ length: 10 }, () => call(alice, "POST", "/v1/bp/confirm", { scanId: sAlice })));
const ok = confirms.filter((c) => c.status === 200).length, dup = confirms.filter((c) => c.status === 409 || (c.status === 401 && c.json?.code === "replay")).length;
S.check("concurrency", "C2", "10 parallel confirms of one scan -> exactly one reading", ok === 1 && dup === 9 && sql("SELECT COUNT(*) n FROM measurements WHERE scan_id = ?", sAlice)[0].n === 1, `ok=${ok} dup=${dup}`);
r = await call(alice, "POST", "/v1/bp/confirm", { scanId: mkScan(alice.pid, false) });
S.check("scan", "C3", "unreadable scan cannot be saved -> 400 scan_invalid", r.status === 400 && r.json?.code === "scan_invalid", r.text);
{
  const old = mkScan(alice.pid); run("UPDATE scans SET created_at = ? WHERE id = ?", now() - 61 * 60e3, old);
  r = await call(alice, "POST", "/v1/bp/confirm", { scanId: old });
  S.check("scan", "C4", "scan older than 60 min -> 400 scan_expired", r.status === 400 && r.json?.code === "scan_expired", r.text);
}

// ---------------------------------------------------------------- credit
r = await call(alice, "POST", "/v1/credit", { action: "topup", amount: 5 });
S.check("admin", "K1", "a user changes only their own credit estimate (F-08)", r.status === 200 && sql("SELECT COUNT(*) n FROM ledger WHERE person_id = ? AND kind = 'topup'", alice.pid)[0].n >= 1, r.text);
for (const [id, amt] of [["K2", -1], ["K3", 1001], ["K4", "abc"], ["K5", 0]]) {
  r = await call(owner, "POST", "/v1/credit", { action: "topup", amount: amt });
  S.check("admin", id, `credit top-up ${JSON.stringify(amt)} -> 400`, r.status === 400, r.text);
}
r = await call(owner, "POST", "/v1/credit", { action: "set", amount: 10 });
S.check("admin", "K6", "owner sets the balance", r.status === 200 && r.json.credit.remaining === 10, r.text);
r = await call(owner, "GET", "/v1/credit/history");
S.check("admin", "K7", "credit history", r.status === 200 && r.json.items.length >= 1, r.text);

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
S.check("subscription", "B2", "/v1/me still answers, sub.required and not active", r.status === 200 && r.json.sub.required === true && r.json.sub.active === false, r.text);
r = await call(owner, "GET", "/v1/bp");
S.check("subscription", "B3", "the owner never pays", r.status === 200, r.text);
r = await call(alice, "POST", "/v1/sub/verify", { purchaseToken: "x" });
S.check("subscription", "B4", "sub/verify without Play account -> 503", r.status === 503, r.text);
run("UPDATE persons SET sub_until = ?, sub_state = 'SUBSCRIPTION_STATE_ACTIVE' WHERE id = ?", now() + 30 * DAY, alice.pid);
r = await call(alice, "GET", "/v1/bp");
S.check("subscription", "B5", "valid subscription -> readings again", r.status === 200, r.text);
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
  S.check("subscription", "SH11", "doctor link stops while the subscription has run out (as /my/api/data does)", r.status !== 200, `status ${r.status}: link keeps serving readings`);
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
  run("INSERT INTO web_codes (code_hash, person_id, expires_at) VALUES ('qa-old-code', ?, ?)", dave.pid, t - 1000);
  run("INSERT INTO web_sessions (id_hash, person_id, created_at, expires_at) VALUES ('qa-old-sess', ?, ?, ?)", dave.pid, t - 9 * DAY, t - 1000);
  run("INSERT INTO error_log (day, source, code, place, app_version, count, first_at, last_at) VALUES ('2000-01-01', 'server', 'qa_old', 'x', '', 1, ?, ?)", t - 91 * DAY, t - 91 * DAY);
  run("UPDATE persons SET email = 'someone@example.invalid' WHERE id = ?", dave.pid);
  run("UPDATE acceptances SET email = 'someone@example.invalid' WHERE person_id = ?", owner.pid);
  const accBefore = sql("SELECT COUNT(*) n FROM acceptances")[0].n;
  r = await web("GET", "/__scheduled?cron=17+3+*+*+*");
  await sleep(500);
  const left = sql("SELECT id FROM measurements WHERE person_id = ? ORDER BY id", dave.pid).map((x) => x.id);
  S.check("retention", "PU1", "purge deletes readings older than 365 days, keeps 364.9 / 300 / 1 days", r.status === 200 && left.join(",") === "bp_qaage2,bp_qaage3,bp_qaage4", left.join(","));
  S.check("retention", "PU2", "purge deletes old scans, expired codes and sessions, error log > 90 days",
    sql("SELECT (SELECT COUNT(*) FROM scans WHERE id='scn_qaold') + (SELECT COUNT(*) FROM web_codes WHERE code_hash='qa-old-code') + (SELECT COUNT(*) FROM web_sessions WHERE id_hash='qa-old-sess') + (SELECT COUNT(*) FROM error_log WHERE code='qa_old') n")[0].n === 0, "");
  S.check("retention", "PU3", "acceptances are kept by the purge", sql("SELECT COUNT(*) n FROM acceptances")[0].n === accBefore, "");
  S.check("privacy", "PU4", "any email left in persons/acceptances is erased by the nightly job", sql("SELECT (SELECT COUNT(*) FROM persons WHERE email IS NOT NULL) + (SELECT COUNT(*) FROM acceptances WHERE email IS NOT NULL) n")[0].n === 0, "");
  r = await call(dave, "GET", "/v1/bp?days=400");
  S.check("retention", "PU5", "API never returns a reading older than 365 days", r.json.items.every((i) => now() - i.takenAt <= 365 * DAY), "");
}

const out = S.summary();
console.log(JSON.stringify(out.by, null, 1));
S.save(process.env.HINT_OUT || "functional-results.json");
