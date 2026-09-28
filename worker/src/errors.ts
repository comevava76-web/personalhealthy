// The error log: short and grouped, for finding bugs and inconsistencies users run into.
// One row per day, source, error code, place and app version, with a counter: a thousand identical errors
// are one row. Digits are removed from messages, so no reading value can end up here; the only link to a
// person is the anonymous account code. Kept 90 days (nightly purge), read by the owner in the Admin tab.
type Q = (text: string, params?: unknown[]) => Promise<any[]>;

export type ErrorEntry = {
  source: "server" | "app" | "web";
  code: string;          // e.g. "server", "exception", "crash", "photo_unreadable"
  place: string;         // e.g. "POST /v1/bp/scan" or "Report/PDF"
  appVersion?: string | null;
  message?: string | null;
  personId?: string | null;
};

const clean = (v: unknown, n: number) =>
  String(v ?? "").replace(/\d+/g, "#").replace(/\s+/g, " ").trim().slice(0, n);
// place: only a known shape. A crash location keeps its line ("MainActivity.kt:1683"), anything else loses digits
// and unusual characters, so no reading value and no free text can be stored there (test report F-09).
const cleanPlace = (v: unknown) => {
  const s = String(v ?? "").trim().slice(0, 80);
  if (/^[A-Za-z][A-Za-z0-9]*\.(kt|js):\d{1,6}$/.test(s)) return s;
  return s.replace(/\d+/g, "#").replace(/[^A-Za-z#_:/. -]/g, "").slice(0, 80);
};
const cleanVersion = (v: unknown) => (/^\d{1,4}(\.\d{1,4}){0,3}$/.test(String(v ?? "")) ? String(v) : "");
// the day as a date in Zurich, like every other date of the app
const zurichDay = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit" }).format(ms);
const DAILY_ROWS = 300;   // at most this many different rows a day: a flood cannot fill the database

export async function logError(q: Q, e: ErrorEntry): Promise<void> {
  try {
    const now = Date.now();
    const day = zurichDay(now), code = clean(e.code, 40) || "unknown", place = cleanPlace(e.place), ver = cleanVersion(e.appVersion);
    // a known row always counts up; a new row only while the day has room
    await q(
      `INSERT INTO error_log (day, source, code, place, app_version, count, first_at, last_at, message, person_id)
       SELECT ?1, ?2, ?3, ?4, ?5, 1, ?6, ?6, ?7, ?8
       WHERE (SELECT COUNT(*) FROM error_log WHERE day = ?1) < ?9
          OR EXISTS (SELECT 1 FROM error_log WHERE day = ?1 AND source = ?2 AND code = ?3 AND place = ?4 AND app_version = ?5)
       ON CONFLICT (day, source, code, place, app_version) DO UPDATE SET
         count = count + 1, last_at = excluded.last_at, message = excluded.message, person_id = excluded.person_id`,
      [day, e.source, code, place, ver, now, clean(e.message, 240) || null, e.personId ? String(e.personId).slice(0, 40) : null, DAILY_ROWS],
    );
  } catch (err) {
    console.error("error log failed", err);   // logging must never break a request
  }
}
