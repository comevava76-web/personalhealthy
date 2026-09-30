// The error log: short and grouped, for finding bugs and inconsistencies users run into.
// One row per day, source, error code, place and app version, with a counter: a thousand identical errors
// are one row. Messages are never stored; only allowlisted codes and locations remain. The only link to a
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

// Only fixed vocabulary reaches storage: no free-text code, path, name or email.
const CODES = new Set(["acc_", "admin_delete", "admin_only", "afternoon", "already_saved", "anthropic_no_credit", "app", "app_disabled", "app_error", "bad_amount", "bad_clock", "bad_key", "bad_version", "base64", "billing_connect", "billing_mode", "bp", "bp_", "code", "code_gone", "consent_required", "cookie", "crash:IOException", "crash:IllegalStateException", "crash:NullPointerException", "crash:OutOfMemoryError", "crash:RuntimeException", "created_at", "days", "decrypt", "diastolic", "disclaimer", "en", "encrypt", "error", "evening", "exception", "failed", "family_code", "fix_github", "fix_not_configured", "fixed", "fixhook", "fixing", "friend_key_invalid", "friend_no_credit", "friend_no_key", "generic", "google", "google_invalid", "google_needed", "google_off", "google_other", "h23", "hint365_annual", "hint_s", "http_", "id", "image", "import_failed", "invalid", "invite_expired", "invite_used", "jwk", "key_test_failed", "lab_", "lab_conflict", "lab_invalid", "lang", "ledger", "measurements", "mode_unavailable", "module", "morning", "no_credit", "no_photo", "no_session", "none", "nosniff", "not_found", "not_self_pays", "note", "notice_required", "number", "numeric", "ok", "open", "origin", "owner", "owner_pays", "pdf", "per_", "per_user", "personalhealthy", "persons", "phone_in_use", "photo", "photo_time", "pkcs8", "private", "promise", "pulse", "raw", "read_failed", "readable", "register", "replay", "scan_expired", "scan_invalid", "scans", "scn_", "script", "security_findings", "security_snapshot_findings", "self", "self_pays", "seq", "server", "session", "set", "share", "share_gone", "share_scope", "sign", "spki", "string", "sub", "sub_expired", "sub_invalid", "sub_other_account", "sub_unavailable", "subscription_on", "systolic", "taken_at", "text", "too_large", "too_many", "topup", "true", "unauthorized", "unknown", "user", "v1", "verify", "voice", "voice_invalid", "voice_time", "web", "web_error"]);
// a crash keeps its exception class (a Java name, never user data), so a new kind of crash is not hidden as "unknown"
const clean = (v: unknown, n: number) => CODES.has(String(v)) || /^crash:[A-Za-z][A-Za-z0-9_$]{0,58}$/.test(String(v)) ? String(v).slice(0, n) : "unknown";
const PLACES = new Set(["unknown", "app.js", "Report/PDF", "Report/Excel", "Labs/Import", "Web/PDF", "Web/send-to-doctor", "admin/security/fix", "Billing/connect"]);
const cleanPlace = (v: unknown) => {
  const s = String(v ?? "");
  if (PLACES.has(s)) return s;
  if (/^(MainActivity|Core|Report|Labs|Billing|Google|Friends|Listen|Reminders)\.kt:\d{1,6}$/.test(s) || /^(app|report)\.js:\d{1,6}$/.test(s)) return s;
  if (/^(GET|POST|DELETE) \/(v1|my\/api)\/(me|accept|web\/code|signout|credit|admin\/(credit|settings|subscription|invites|app-min-version|overview|security(?:\/(fix|status))?)|key(?:\/check)?|bp(?:\/(voice|scan|confirm))?|labs|sub\/verify|log|data|share|shares)$/.test(s)) return s;
  return "unknown";
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
      [day, e.source, code, place, ver, now, null, e.personId ? String(e.personId).slice(0, 40) : null, DAILY_ROWS],
    );
  } catch (err) {
    console.error("error log failed");   // logging must never break a request
  }
}
