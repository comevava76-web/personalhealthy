// HINT 365: captures the real Web Dashboard screens of the scripted demo (docs/demo/hint365-demo/), in English, with
// TEST DATA ONLY (never real readings), against a LOCAL worker. It writes JPEG frames and the positions the demo's
// cursor moves to (frames.json). Run after setup-local.sh:
//   NODE_PATH=<global node_modules> HINT_WORKER_DIR=<scratch worker dir> NODE_OPTIONS=--experimental-strip-types node demo-tour.mjs
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { NOTICE_TEXT, NOTICE_VERSION } from "../../../worker/src/notices.ts";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import { BASE, call, newPhone, register, localDb } from "./lib.mjs";

const OUT = process.argv[2] || new URL("../../demo/hint365-demo/frames/", import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const db = localDb();
const run = (q, ...p) => db.prepare(q).run(...p);
for (const t of ["persons", "measurements", "lab_files", "scans", "ledger", "invites", "person_keys", "acceptances", "web_codes", "web_sessions", "web_shares", "error_log", "event_log", "seen_sigs", "rate_limits", "security_findings", "security_notes"]) { try { run(`DELETE FROM ${t}`); } catch {} }
const notice = { doc: "disclaimer", version: NOTICE_VERSION, lang: "en", healthConsent: true, textSha256: crypto.createHash("sha256").update(NOTICE_TEXT.en).digest("hex") };

// the owner (the person of the demo) on the phone on record, and a few other test accounts on different app versions
const owner = newPhone(); await register(owner);
run("UPDATE persons SET is_admin = 1 WHERE id = ?", owner.pid);
run("INSERT INTO settings (key, value) VALUES ('owner_key', (SELECT public_key FROM persons WHERE id = ?)) ON CONFLICT (key) DO UPDATE SET value = excluded.value", owner.pid);
await call(owner, "POST", "/v1/accept", notice);
await call(owner, "GET", "/v1/me");
for (const v of ["0.1.130", "0.1.130", "0.1.130", "0.1.129", "0.1.127"]) {
  const p = newPhone(); await register(p);
  run("UPDATE persons SET app_version = ? WHERE id = ?", v, p.pid);
}
run("UPDATE persons SET app_version = '0.1.130' WHERE id = ?", owner.pid);

// seven days of test readings, morning and evening
const ins = db.prepare("INSERT INTO measurements (id, person_id, kind, taken_at, tz, period, data, source, created_at) VALUES (?, ?, 'bp', ?, 'Europe/Zurich', ?, ?, ?, ?)");
const DAY = 864e5, now = Date.now();
const wave = [0, 4, -2, 6, 1, -3, 3];
for (let d = 0; d < 7; d++) for (const [per, h, off] of [["morning", 7.5, 0], ["evening", 20, 5]]) {
  const t = now - d * DAY - ((now - d * DAY) % DAY) + (h - 2) * 3600e3;
  if (t > now) continue;
  ins.run("bp_demo" + crypto.randomBytes(6).toString("hex"), owner.pid, t, per,
    JSON.stringify({ sis: 124 + wave[d] + off, dia: 79 + Math.round(wave[d] / 2), pul: 66 + wave[(d + 2) % 7] }), d % 3 ? "voice" : "photo", t);
}
// three test lab reports, imported through the real API
const labs = [
  [200, [["glucose", "95", "mg/dL", "70-100"], ["cholesterol", "198", "mg/dL", "<200"], ["hdl", "55", "mg/dL", ">40"], ["creatinine", "0.9", "mg/dL", "0.7-1.2"]]],
  [110, [["glucose", "99", "mg/dL", "70-100"], ["cholesterol", "205", "mg/dL", "<200"], ["hdl", "57", "mg/dL", ">40"], ["triglycerides", "120", "mg/dL", "<150"]]],
  [18, [["glucose", "92", "mg/dL", "70-100"], ["cholesterol", "214", "mg/dL", "<200"], ["hdl", "58", "mg/dL", ">40"], ["creatinine", "0.9", "mg/dL", "0.7-1.2"], ["triglycerides", "110", "mg/dL", "<150"]]],
];
for (const [ago, items] of labs) {
  const r = await call(owner, "POST", "/v1/labs", { id: crypto.randomUUID(), takenAt: now - ago * DAY, confirmed: true,
    items: items.map(([code, value, unit, reference]) => ({ code, value, unit, reference })) });
  if (r.status !== 200) console.log("lab import", r.status, r.text);
}
// test findings for Observability (counts only), as the weekly scan writes them, and the newest app version
run("INSERT INTO settings (key, value) VALUES ('app_live_version', '130') ON CONFLICT (key) DO UPDATE SET value = excluded.value");
try {
  const f = db.prepare("INSERT INTO security_findings (kind, ref, name, version, location, severity, rating, fixed, summary, source_url, plan_url, found_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)");
  const n = db.prepare("INSERT INTO security_notes (kind, ref, name, location, first_at, reason) VALUES (?,?,?,?,?,?)");
  for (const [ref, name, ver, loc, sev, fixed, reason, ago] of [
    ["GHSA-test-0001", "com.squareup.okhttp3:okhttp", "4.12.0", "android", "moderate", "4.12.1", "to_fix", 2],
    ["GHSA-test-0002", "com.android.tools.build:gradle", "8.5.2", "Android build tools (not in the app)", "low", "9.0.0", "build_tool", 9],
  ]) { f.run("library", ref, name, ver, loc, sev, sev, fixed, "Test finding for the demo", "", "", now - ago * DAY); n.run("library", ref, name, loc, now - ago * DAY, reason); }
  run("INSERT INTO settings (key, value) VALUES ('security_scan', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
    JSON.stringify({ at: now - 3 * 3600e3, complete: true, libraries: 140, android: 96, fullTree: true, vulnerable: 2, code: 0, secrets: 0 }));
} catch (e) { console.log("findings:", String(e).slice(0, 160)); }

const browser = await chromium.launch({ executablePath: process.env.HINT_CHROMIUM || undefined });
const W = 1000, H = 560;
const frames = {};
async function open(hash) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, locale: "en-GB", deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { try { localStorage.setItem("hint.cookies", "yes:1"); } catch {} });
  const page = await ctx.newPage();
  const c = await call(owner, "POST", "/v1/web/code", {});
  await page.goto(c.json.url.replace(/^https?:\/\/[^/]+/, BASE) + (hash ? "&" + hash : ""));
  const ck = await page.$(".cookie button[data-v=yes]"); if (ck) await ck.click();
  await page.waitForTimeout(1200);
  return { ctx, page };
}
async function box(page, sel) {
  const el = await page.$(sel); if (!el) return null;
  const b = await el.boundingBox(); if (!b) return null;
  return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) };
}
async function shot(page, name, targets = {}) {
  await page.screenshot({ path: path.join(OUT, name + ".jpg"), type: "jpeg", quality: 78 });
  const t = {};
  for (const [k, sel] of Object.entries(targets)) t[k] = await box(page, sel);
  frames[name] = t;
}

{ // functions: blood pressure, charts, the doctor
  const { ctx, page } = await open("bp");
  await shot(page, "f1-bp", { share: "#btn-share", pdf: "#btn-pdf" });
  const chart = await page.$("svg[role=img]");
  if (chart) {
    await chart.scrollIntoViewIfNeeded(); await page.evaluate(() => window.scrollBy(0, -60)); await page.waitForTimeout(400);
    await shot(page, "f2-charts", { chart: "svg[role=img]" });
    const b = await chart.boundingBox();
    await page.mouse.move(b.x + b.width * 0.62, b.y + b.height * 0.4); await page.waitForTimeout(400);
    frames["f3-hover"] = { point: { x: Math.round(b.x + b.width * 0.62), y: Math.round(b.y + b.height * 0.4) } };
    await page.screenshot({ path: path.join(OUT, "f3-hover.jpg"), type: "jpeg", quality: 78 });
  }
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(300);
  await page.click("#btn-share"); await page.waitForTimeout(600);
  await shot(page, "f4-share", {});
  await ctx.close();
}
{ // functions: lab results
  const { ctx, page } = await open("labs");
  await shot(page, "f5-labs", {});
  await ctx.close();
}
{ // utilities: the owner's console (the money part is never shown) and Observability
  const { ctx, page } = await open("admin");
  await page.waitForSelector(".tiles.adm", { timeout: 10000 });
  // the money part of the console is never shown in the demo (asked by Human)
  await page.evaluate(() => {
    document.querySelectorAll("#main .card").forEach((c) => { if (c.querySelector(".mg-row:not(.mg-ver)") && !c.querySelector("#adm-obs") && !/App versions/.test(c.textContent)) c.remove(); });
    document.querySelectorAll("#main .card").forEach((c) => { const t = (c.querySelector("h2") || {}).textContent || ""; if (/Accounts|Usage|Income|expenses/i.test(t)) c.remove(); });
  });
  await shot(page, "u1-admin", { tiles: ".tiles.adm", obs: "#adm-obs" });
  const v = await page.$(".mg-row:last-of-type");
  const vcard = await page.$$(".card");
  const versions = vcard[vcard.length - 1];
  if (versions) { await versions.scrollIntoViewIfNeeded(); await page.evaluate(() => window.scrollBy(0, 120)); await page.waitForTimeout(300); }
  await shot(page, "u2-versions", {});
  await page.evaluate(() => window.scrollTo(0, 0));
  const ob = await page.$("#adm-obs"); if (ob) { await ob.scrollIntoViewIfNeeded(); await ob.click(); }
  await page.waitForSelector(".ob-tabs", { timeout: 10000 }); await page.waitForTimeout(700);
  await shot(page, "u3-observability", { vulns: "[data-tab=vulns]", compliance: "[data-tab=compliance]" });
  const vt = await page.$("[data-tab=vulns]"); if (vt) { await vt.click(); await page.waitForTimeout(700); }
  await page.evaluate(() => window.scrollBy(0, 330)); await page.waitForTimeout(400);
  await shot(page, "u4-vulns", {});
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(300);
  const ct = await page.$("[data-tab=compliance]"); if (ct) { await ct.click(); await page.waitForTimeout(700); }
  await shot(page, "u5-compliance", {});
  await ctx.close();
}
fs.writeFileSync(path.join(OUT, "frames.json"), JSON.stringify(frames, null, 1));
await browser.close();
console.log("frames:", Object.keys(frames).join(", "));
