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

export async function logError(q: Q, e: ErrorEntry): Promise<void> {
  try {
    const now = Date.now();
    await q(
      `INSERT INTO error_log (day, source, code, place, app_version, count, first_at, last_at, message, person_id)
       VALUES (?1, ?2, ?3, ?4, ?5, 1, ?6, ?6, ?7, ?8)
       ON CONFLICT (day, source, code, place, app_version) DO UPDATE SET
         count = count + 1, last_at = excluded.last_at, message = excluded.message, person_id = excluded.person_id`,
      [new Date(now).toISOString().slice(0, 10), e.source, clean(e.code, 40) || "unknown", String(e.place || "").slice(0, 80),
       String(e.appVersion || "").slice(0, 16), now, clean(e.message, 240) || null, e.personId ? String(e.personId).slice(0, 40) : null],
    );
  } catch (err) {
    console.error("error log failed", err);   // logging must never break a request
  }
}

/** The last 30 days of the log, newest first, for the owner's Admin tab. */
export async function recentErrors(q: Q) {
  const since = Date.now() - 30 * 864e5;
  const rows = await q(
    `SELECT day, source, code, place, app_version, count, last_at, message FROM error_log
     WHERE last_at > ?1 ORDER BY last_at DESC LIMIT 200`, [since]);
  return rows.map((r: any) => ({
    day: String(r.day), source: String(r.source), code: String(r.code), place: String(r.place),
    app: String(r.app_version || ""), count: Number(r.count), lastAt: Number(r.last_at), message: r.message ? String(r.message) : "",
  }));
}
