// HINT 365 QA: the Web Dashboard in headless Chromium (Playwright), at 390 px and 1280 px, against a LOCAL worker.
// Empties the local database, creates an owner and a user with a week of test readings, then checks:
// cookie banner (accept / decline), dashboard, charts, horizontal scroll, colours (no red), PDF download,
// "Send to doctor" dialog (Email / WhatsApp only), doctor link view, Admin tab, console errors, basic accessibility.
// Run: NODE_PATH=<global node_modules> HINT_WORKER_DIR=<scratch worker dir> HINT_SHOTS=<folder> node ui.mjs
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { NOTICE_TEXT, NOTICE_VERSION } from "../../../worker/src/notices.ts";
const notice = {doc: "disclaimer", version: NOTICE_VERSION, lang: "en", healthConsent: true, textSha256: crypto.createHash("sha256").update(NOTICE_TEXT.en).digest("hex")};
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");   // resolved through NODE_PATH (global install)
import { BASE, call, newPhone, register, web, webLogin, localDb, Suite } from "./lib.mjs";

const S = new Suite("ui");
const SHOTS = process.env.HINT_SHOTS || "shots";
fs.mkdirSync(SHOTS, { recursive: true });
const db = localDb();
const run = (q, ...p) => db.prepare(q).run(...p);
for (const t of ["persons", "measurements", "scans", "ledger", "invites", "person_keys", "acceptances", "web_codes", "web_sessions", "web_shares", "error_log"]) run(`DELETE FROM ${t}`);
run("DELETE FROM settings WHERE key <> 'billing_mode'");

const owner = newPhone(); await register(owner);
run("UPDATE persons SET is_admin = 1 WHERE id = ?", owner.pid);
await call(owner, "POST", "/v1/accept", notice);
const user = newPhone(); await register(user);
await call(user, "POST", "/v1/accept", notice);
await call(owner, "GET", "/v1/me");
// a week of test readings: morning, afternoon and evening, one day left empty
const ins = db.prepare("INSERT INTO measurements (id, person_id, kind, taken_at, tz, period, data, source, created_at) VALUES (?, ?, 'bp', ?, 'Europe/Zurich', ?, ?, ?, ?)");
const DAY = 864e5, now = Date.now();
for (const pid of [owner.pid, user.pid]) for (let d = 0; d < 7; d++) {
  if (d === 3) continue;
  for (const [per, h] of [["morning", 7.5], ["afternoon", 13], ["evening", 20]]) {
    const t = now - d * DAY - ((now - d * DAY) % DAY) + (h - 2) * 3600e3;   // ~h o'clock Swiss summer time
    if (t > now) continue;
    ins.run("bp_ui" + crypto.randomBytes(6).toString("hex"), pid, t, per, JSON.stringify({ sis: 118 + d * 3, dia: 76 + d, pul: 62 + d }), d % 2 ? "photo" : "voice", t);
  }
}

const browser = await chromium.launch({ executablePath: process.env.HINT_CHROMIUM || undefined });
const consoleErrors = [];

async function openAs(phone, width, { accept = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 }, locale: "en-GB", acceptDownloads: true, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(`${width}px ${m.text()}`); });
  page.on("pageerror", (e) => consoleErrors.push(`${width}px pageerror ${e.message}`));
  const c = await call(phone, "POST", "/v1/web/code", {});
  await page.goto(c.json.url.replace(/^https?:\/\/[^/]+/, BASE));
  return { ctx, page };
}
const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const redElements = (page) => page.evaluate(() => {
  // any visible colour whose hue is red (<= 15 deg or >= 345 deg) with real saturation
  const hue = (s) => {
    const m = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/); if (!m) return null;
    if (m[4] !== undefined && +m[4] === 0) return null;
    let [r, g, b] = [+m[1] / 255, +m[2] / 255, +m[3] / 255];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (d < 0.25 || mx < 0.35) return null;
    let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; return h;
  };
  const out = [];
  for (const el of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    for (const prop of ["color", "backgroundColor", "fill", "stroke", "borderTopColor"]) {
      const h = hue(cs[prop]);
      if (h != null && (h <= 15 || h >= 345)) out.push(`${el.tagName}.${el.className?.baseVal ?? el.className} ${prop}=${cs[prop]}`);
    }
  }
  return [...new Set(out)].slice(0, 10);
});

for (const width of [390, 1280]) {
  const tag = width + "px";
  // ---------- decline the cookie
  {
    const { ctx, page } = await openAs(user, width);
    await page.waitForSelector(".cookie", { timeout: 5000 });
    await page.screenshot({ path: path.join(SHOTS, `cookie-${tag}.png`) });
    const txt = await page.textContent(".cookie");
    S.check("ui", `CK1-${tag}`, "cookie banner names hint_s and offers Accept / Decline", /hint_s/.test(txt) && /Accept/.test(txt) && /Decline/.test(txt), txt.slice(0, 120));
    await page.click(".cookie button[data-v=no]");
    await page.waitForTimeout(400);
    const cookies = await ctx.cookies();
    S.check("privacy", `CK2-${tag}`, "declining sets no cookie and shows the explanation", !cookies.some((c) => c.name === "hint_s") && /Without the cookie/.test(await page.textContent("main")), JSON.stringify(cookies));
    await ctx.close();
  }
  // ---------- accept, dashboard
  const { ctx, page } = await openAs(user, width);
  await page.waitForSelector(".cookie");
  const cookiesBefore = await ctx.cookies();
  S.check("privacy", `CK3-${tag}`, "no cookie is set before the choice", !cookiesBefore.some((c) => c.name === "hint_s"), JSON.stringify(cookiesBefore));
  await page.click(".cookie button[data-v=yes]");
  await page.waitForSelector("#ch-all svg", { timeout: 8000 }).catch(() => {});
  const cookies = await ctx.cookies();
  S.check("web", `D1-${tag}`, "accepting signs in (hint_s set, HttpOnly)", cookies.some((c) => c.name === "hint_s" && c.httpOnly && c.sameSite === "Strict"), JSON.stringify(cookies.map((c) => c.name)));
  S.check("privacy", `D1b-${tag}`, "the one-time code is removed from the address bar", !/#c=/.test(page.url()), page.url());
  const charts = await page.$$eval(".chart svg", (a) => a.length);
  S.check("web", `D2-${tag}`, "four charts drawn (period, morning, evening, pulse)", charts === 4, `${charts} charts`);
  const days = await page.$$eval("#ch-all svg text.day", (a) => a.map((t) => t.textContent));
  S.check("web", `D3-${tag}`, "7 day labels under the chart, only day numbers", days.length === 7 && days.every((d) => /^\d{1,2}$/.test(d)), days.join(","));
  const legend = await page.textContent("#lg-all");
  S.check("rules", `D4-${tag}`, "labels SYS / DIA in the chart legend", /SYS/.test(legend) && /DIA/.test(legend), legend);
  const pulseHasBp = await page.$$eval("#lg-p span", (a) => a.map((s) => s.textContent).join(" "));
  S.check("rules", `D5-${tag}`, "pulse chart is separate from pressure (PUL only)", /PUL/.test(pulseHasBp) && !/SYS|DIA/.test(pulseHasBp), pulseHasBp);
  S.check("rules", `D6-${tag}`, "chart explanation shown before the charts", (await page.$$eval("main .note", (a) => a.length)) > 0, "");
  S.check("layout", `D7-${tag}`, "no horizontal page scroll", await noHScroll(page), `scrollWidth ${await page.evaluate(() => document.documentElement.scrollWidth)}`);
  const red = await redElements(page);
  S.check("rules", `D8-${tag}`, "no red anywhere on the dashboard", red.length === 0, red.join(" | "));
  const judge = await page.evaluate(() => document.body.innerText.match(/\b(normal|abnormal|hypertension|healthy|good|bad|danger|warning|optimal|elevated)\b/gi) || []);
  S.check("rules", `D9-${tag}`, "no judging words about values on the page", judge.length === 0, judge.join(","));
  const counts = await page.textContent(".kpi:nth-child(4) .u");
  S.check("web", `D10-${tag}`, "readings counter says 'of 7 days' for a 7-day period", /of 7 days/.test(counts), counts);
  await page.screenshot({ path: path.join(SHOTS, `dashboard-${tag}.png`), fullPage: true });
  // readings table
  await page.click("details summary");
  const tableScroll = await page.evaluate(() => { const d = document.querySelector("details div"); return d ? d.scrollWidth > d.clientWidth + 1 : false; });
  S.check("layout", `D11-${tag}`, "readings table fits without its own horizontal scroll", !tableScroll, "the table scrolls sideways inside its card");
  // tap targets on the phone
  if (width < 500) {
    const small = await page.$$eval("button, a", (a) => a.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.height < 32); }).map((e) => (e.id || e.textContent.trim()).slice(0, 20) + ":" + Math.round(e.getBoundingClientRect().height)));
    S.check("a11y", `A1-${tag}`, "buttons and links at least 32 px high on the phone", small.length === 0, small.join(", "));
  }
  // accessibility basics
  const a11y = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    unnamed: [...document.querySelectorAll("button")].filter((b) => b.offsetParent && !b.textContent.trim() && !b.getAttribute("aria-label")).length,
    svgNoLabel: [...document.querySelectorAll(".chart svg")].filter((s) => !s.getAttribute("aria-label") && !s.querySelector("title") && s.getAttribute("role") !== "img").length,
    h1: document.querySelectorAll("h1").length,
  }));
  S.check("a11y", `A2-${tag}`, "page language set and every visible button has a name", a11y.lang === "en" && a11y.unnamed === 0, JSON.stringify(a11y));
  S.check("a11y", `A3-${tag}`, "charts have a text alternative (role=img / aria-label / title)", a11y.svgNoLabel === 0, `${a11y.svgNoLabel} chart SVGs without a text alternative`);
  // PDF
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 20000 }).catch(() => null), page.click("#btn-pdf")]);
  if (dl) {
    const f = path.join(SHOTS, `report-${tag}.pdf`); await dl.saveAs(f);
    const buf = fs.readFileSync(f);
    const pages = (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
    S.check("pdf", `PDF1-${tag}`, "PDF downloads, A4, 4 pages (summary, morning/evening, pulse, list)", buf.slice(0, 4).toString() === "%PDF" && pages === 4 && /595\.2\d* 841\.8\d*/.test(buf.toString("latin1")), `${buf.length} bytes, ${pages} pages, name ${dl.suggestedFilename()}`);
  } else S.check("pdf", `PDF1-${tag}`, "PDF downloads", false, "no download event");
  // CSV
  S.check("export", `CSV-${tag}`, "web has no CSV button", await page.locator("#btn-csv").count() === 0, "");
  // send to the doctor
  await page.click("#btn-share");
  await page.waitForSelector("dialog#share[open]");
  const btns = await page.$$eval("dialog#share .send button", (a) => a.map((b) => b.textContent.trim()));
  S.check("share", `SD1-${tag}`, "send dialog offers only Email and WhatsApp", btns.length === 2 && /Email/.test(btns[0]) && /WhatsApp/.test(btns[1]), btns.join(" / "));
  S.check("layout", `SD2-${tag}`, "dialog without horizontal scroll", await noHScroll(page), "");
  await page.screenshot({ path: path.join(SHOTS, `send-${tag}.png`) });
  const popupP = ctx.waitForEvent("page", { timeout: 15000 }).catch(() => null);
  const dlP = page.waitForEvent("download", { timeout: 20000 }).catch(() => null);
  await page.click("#sh-wa");
  const [popup, sdl] = await Promise.all([popupP, dlP]);
  const status = await page.textContent("#sh-status");
  const popupUrl = popup ? popup.url() : "";
  S.check("share", `SD3-${tag}`, "WhatsApp: PDF downloaded and a wa.me message with the 7-day link opened", !!sdl && /wa\.me|whatsapp/i.test(popupUrl + status) || (!!sdl && /attach/i.test(status)), `download=${!!sdl} popup=${popupUrl.slice(0, 80)} status=${status}`);
  if (popup) await popup.close();
  await page.click("#sh-close").catch(() => {});
  await ctx.close();

  // ---------- owner: Admin tab
  {
    const { ctx, page } = await openAs(owner, width);
    await page.click(".cookie button[data-v=yes]");
    await page.waitForSelector("#modules button[data-m=admin]", { timeout: 8000 }).catch(() => {});
    const hasAdmin = await page.$("#modules button[data-m=admin]");
    S.check("admin", `AT1-${tag}`, "owner sees the Admin tab", !!hasAdmin, "");
    if (hasAdmin) {
      await hasAdmin.click();
      await page.waitForSelector("table.list", { timeout: 8000 }).catch(() => {});
      const text = await page.textContent("main");
      S.check("admin", `AT2-${tag}`, "Admin shows totals and storage only, no account codes", !/per_/.test(text) && /Database space/.test(text) && /500 MB/.test(text), text.slice(0, 120));
      S.check("layout", `AT3-${tag}`, "Admin without horizontal page scroll", await noHScroll(page), `scrollWidth ${await page.evaluate(() => document.documentElement.scrollWidth)}`);
      S.check("rules", `AT4-${tag}`, "no red on the Admin tab", (await redElements(page)).length === 0, (await redElements(page)).join(" | "));
      await page.screenshot({ path: path.join(SHOTS, `admin-${tag}.png`), fullPage: true });
    }
    await ctx.close();
  }
  {
    const { ctx, page } = await openAs(user, width);
    await page.click(".cookie button[data-v=yes]");
    await page.waitForSelector(".chart svg", { timeout: 8000 }).catch(() => {});
    S.check("admin", `AT5-${tag}`, "a normal user has no Admin tab", !(await page.$("#modules button[data-m=admin]")), "");
    await ctx.close();
  }
  // ---------- the doctor's read-only view
  {
    const s = await webLogin(user);
    const url = (await web("POST", "/my/api/share", { cookie: s.cookie, body: { days: 7 }, origin: BASE })).json.url.replace(/^https?:\/\/[^/]+/, BASE);
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, locale: "en-GB" });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => consoleErrors.push(`${width}px doctor pageerror ${e.message}`));
    await page.goto(url);
    await page.waitForSelector(".chart svg", { timeout: 8000 }).catch(() => {});
    const vis = await page.$$eval(".actions button", (a) => a.filter((b) => !b.hidden).map((b) => b.id));
    S.check("share", `DR1-${tag}`, "doctor view: only the PDF button, a banner, no cookie banner", vis.join() === "btn-pdf" && !!(await page.$(".banner")) && !(await page.$(".cookie")), vis.join());
    S.check("layout", `DR2-${tag}`, "doctor view without horizontal scroll", await noHScroll(page), "");
    await page.screenshot({ path: path.join(SHOTS, `doctor-${tag}.png`), fullPage: true });
    await ctx.close();
  }
}
S.check("web", "CON1", "no console errors or page errors", consoleErrors.length === 0, consoleErrors.slice(0, 5).join(" | "));
await browser.close();
console.log(JSON.stringify(S.summary().by));
S.save(process.env.HINT_OUT || "ui-results.json");
