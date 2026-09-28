// HINT 365: remakes the demo material of docs/demo/ (Italian, test data only, never real readings) against a LOCAL worker.
// Run after setup-local.sh:  NODE_PATH=<global node_modules> HINT_WORKER_DIR=<scratch worker dir> node demo-shots.mjs [out-dir]
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import { BASE, call, newPhone, register, web, localDb } from "./lib.mjs";

const OUT = process.argv[2] || new URL("../../demo/", import.meta.url).pathname;
const db = localDb();
const run = (q, ...p) => db.prepare(q).run(...p);
for (const t of ["persons", "measurements", "scans", "ledger", "invites", "person_keys", "acceptances", "web_codes", "web_sessions", "web_shares", "error_log", "seen_sigs", "rate_limits"]) run(`DELETE FROM ${t}`);

const owner = newPhone(); await register(owner);
await call(owner, "GET", "/v1/me");
// seven days of test readings, morning and evening, values that move a little
const ins = db.prepare("INSERT INTO measurements (id, person_id, kind, taken_at, tz, period, data, source, created_at) VALUES (?, ?, 'bp', ?, 'Europe/Zurich', ?, ?, ?, ?)");
const DAY = 864e5, now = Date.now();
const wave = [0, 4, -2, 6, 1, -3, 3];
for (let d = 0; d < 7; d++) for (const [per, h, off] of [["morning", 7.5, 0], ["evening", 20, 5]]) {
  const t = now - d * DAY - ((now - d * DAY) % DAY) + (h - 2) * 3600e3;
  if (t > now) continue;
  ins.run("bp_demo" + crypto.randomBytes(6).toString("hex"), owner.pid, t, per,
    JSON.stringify({ sis: 124 + wave[d] + off, dia: 79 + Math.round(wave[d] / 2), pul: 66 + wave[(d + 2) % 7] }), d % 3 ? "voice" : "photo", t);
}

const browser = await chromium.launch({ executablePath: process.env.HINT_CHROMIUM || undefined });
async function open(width, height) {
  const ctx = await browser.newContext({ viewport: { width, height }, locale: "it-CH", acceptDownloads: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { try { localStorage.setItem("hint.cookies", "yes:1"); } catch {} });
  const page = await ctx.newPage();
  const c = await call(owner, "POST", "/v1/web/code", {});
  await page.goto(c.json.url.replace(/^https?:\/\/[^/]+/, BASE));
  const ck = await page.$(".cookie button[data-v=yes]"); if (ck) await ck.click();
  await page.waitForSelector("svg", { timeout: 10000 });
  await page.waitForTimeout(600);
  return { ctx, page };
}
const shot = (page, name, full = false) => page.screenshot({ path: path.join(OUT, name), fullPage: full });

{ // computer
  const { ctx, page } = await open(1280, 900);
  await shot(page, "web-01-dashboard-computer.png", true);
  const chart = await page.$("svg[role=img]");
  if (chart) { const b = await chart.boundingBox(); await page.mouse.move(b.x + b.width * 0.62, b.y + b.height * 0.35); await page.waitForTimeout(300); await chart.screenshot({ path: path.join(OUT, "web-02-grafico-con-cursore.png") }); }
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#btn-pdf")]);
  await dl.saveAs(path.join(OUT, "report-dal-web.pdf"));
  await ctx.close();
}
{ // phone
  const { ctx, page } = await open(390, 844);
  await shot(page, "web-04-dashboard-telefono.png");
  await shot(page, "web-05-dashboard-telefono-intera.png", true);
  await page.click("#btn-share"); await page.waitForTimeout(500);
  await shot(page, "web-03-invia-al-medico.png");
  // the doctor's view of a fresh link
  const cookie = (await ctx.cookies()).find((c) => c.name === "hint_s");
  const r = await web("POST", "/my/api/share", { cookie: `hint_s=${cookie.value}`, body: {}, origin: BASE });
  const doc = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "it-CH", deviceScaleFactor: 1 });
  const dp = await doc.newPage();
  await dp.goto(r.json.url.replace(/^https?:\/\/[^/]+/, BASE)); await dp.waitForSelector("svg", { timeout: 10000 }); await dp.waitForTimeout(600);
  await shot(dp, "web-06-vista-del-medico.png", true);
  await doc.close(); await ctx.close();
}
await browser.close();
console.log("demo material written to " + OUT);
