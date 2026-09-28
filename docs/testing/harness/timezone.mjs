// HINT 365 QA: time-zone checks (Europe/Zurich, DST) of the period arithmetic.
// Takes periodStart() straight from worker/src/web.ts and the "days" formula from worker/public/my/app.js,
// so the test follows the real code. Run: node timezone.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Suite } from "./lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.resolve(here, "../../../worker/src/web.ts"), "utf8");
const clock = src.match(/const zurichClock = [^\n]+/)[0];
const fn = src.match(/function periodStart\(now: number, days: number\): number \{[\s\S]*?\n\}/)[0].replace(/: number/g, "").replace(/: Record<string, string>/g, "");
const periodStart = new Function(`${clock}\n${fn}\nreturn periodStart;`)();

const S = new Suite("timezone");
const zurich = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const local = (ms) => zurich.format(ms);
// the true Swiss midnight of the calendar day of `ms`
function trueMidnight(ms) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Zurich", year: "numeric", month: "numeric", day: "numeric" }).formatToParts(ms).map((x) => [x.type, x.value]));
  for (const off of [1, 2]) { const t = Date.UTC(+p.year, +p.month - 1, +p.day) - off * 3600e3; if (local(t).endsWith("00:00") && local(t).startsWith(`${String(p.day).padStart(2, "0")}/`)) return t; }
  return NaN;
}

// ordinary day, both seasons
for (const iso of ["2026-01-15T10:30:00Z", "2026-07-15T10:30:00Z", "2026-09-28T21:59:00Z", "2026-09-28T22:01:00Z"]) {
  const now = Date.parse(iso), got = periodStart(now, 7), want = trueMidnight(now - 6 * 864e5);
  S.check("timezone", "TZ-" + iso, `7-day window at ${local(now)} starts at Swiss midnight 6 days before`, got === want, `got ${local(got)} want ${local(want)}`);
}
// the first day of the window is a DST change day (spring forward 29 Mar 2026, fall back 25 Oct 2026)
for (const [label, iso] of [["spring (first day 29 Mar 2026)", "2026-04-04T10:00:00Z"], ["autumn (first day 25 Oct 2026)", "2026-10-31T10:00:00Z"]]) {
  const now = Date.parse(iso), got = periodStart(now, 7), want = trueMidnight(now - 6 * 864e5);
  S.check("timezone", "TZ-DST-" + label, `window whose first day is a DST day starts at that day's Swiss midnight: ${label}`, got === want,
    `got ${local(got)} (${new Date(got).toISOString()}), want ${local(want)} (${new Date(want).toISOString()}): off by ${(got - want) / 3600e3} h`);
}

// app.js (after F-14): N = calendar days between the Swiss dates of "from" and "to", both included
const fYmd = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit" });
const midnight = (ms) => { const p = {}; for (const x of fYmd.formatToParts(ms)) p[x.type] = x.value; return Date.UTC(+p.year, +p.month - 1, +p.day); };
const spanDays = (from, to) => Math.round((midnight(to) - midnight(from)) / 864e5) + 1;
for (const iso of ["2026-09-28T06:00:00Z", "2026-09-28T14:00:00Z"]) {
  const to = Date.parse(iso), from = periodStart(to, 7);
  S.check("web", "SPAN-" + iso, `Web Dashboard says "of 7 days" at ${local(to)}`, spanDays(from, to) === 7, `says "of ${spanDays(from, to)} days" (window has 7 calendar days)`);
}
console.log(JSON.stringify(S.summary().by));
S.save(process.env.HINT_OUT || "timezone-results.json");
