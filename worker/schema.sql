-- PersonalHealthy database (Cloudflare D1, data in the European Union).
-- Safe to run as many times as you like: it only creates what is missing.
-- Dates and times are in milliseconds (UTC); measurement values are JSON in the "data" column.
-- Every time column has a readable companion "<name>_local" with the Swiss time (Europe/Zurich)
-- as "MMddyyyy HH:mm", 24-hour clock (e.g. "09262026 14:32"). The server fills it on every insert.
-- SQLite cannot "add a column if missing", so for databases created before these columns existed
-- the build workflow adds them (step "PersonalHealthy database"), and the server fills old rows.

CREATE TABLE IF NOT EXISTS persons (
  id          TEXT PRIMARY KEY,
  public_key  TEXT NOT NULL UNIQUE,          -- the key of the phone in use (a new phone replaces it after Sign in with Google)
  birth_date  TEXT,
  sex         TEXT,
  is_admin    INTEGER NOT NULL DEFAULT 0,
  pays        TEXT NOT NULL DEFAULT 'self',  -- everyone pays their own AI ('owner' only in old rows)
  created_at  INTEGER NOT NULL,
  created_at_local TEXT,
  -- the columns below are also added to older databases by build.yml (add_col)
  google_sub  TEXT,                          -- "h1:" + HMAC of the Google account id: never the id or the email itself
  email       TEXT,                          -- always empty: no email is kept (the nightly job clears old rows)
  consent_at  INTEGER,
  sub_token   TEXT, sub_until INTEGER, sub_state TEXT, sub_checked_at INTEGER,   -- yearly subscription (Google Play)
  last_seen_at INTEGER,                      -- when the app was last opened (owner's Admin tab)
  app_version TEXT                           -- the app version it last opened with
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_persons_google ON persons (google_sub);

CREATE TABLE IF NOT EXISTS scans (
  id          TEXT PRIMARY KEY,
  person_id   TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,                 -- 'bp' = blood pressure; in the future 'lab', 'report', ...
  result      TEXT NOT NULL,                 -- what the AI read (JSON)
  taken_at    INTEGER NOT NULL,
  used        INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  taken_at_local   TEXT,
  created_at_local TEXT
);

CREATE TABLE IF NOT EXISTS measurements (
  id          TEXT PRIMARY KEY,
  person_id   TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,
  taken_at    INTEGER NOT NULL,
  tz          TEXT NOT NULL,
  period      TEXT,                          -- 'morning', 'afternoon' or 'evening'
  data        TEXT NOT NULL,                 -- e.g. {"sis":128,"dia":82,"pul":67}
  source      TEXT NOT NULL,                 -- 'photo' (read from the display) or 'voice' (said aloud)
  scan_id     TEXT,
  lab         TEXT,                          -- for future lab tests
  city        TEXT,
  created_at  INTEGER NOT NULL,
  taken_at_local   TEXT,
  created_at_local TEXT
);
CREATE INDEX IF NOT EXISTS idx_meas_person_kind_time ON measurements (person_id, kind, taken_at);

-- Lab reports already imported: a keyed fingerprint (HMAC with the server secret) of each file, so the same document
-- is never saved twice. Nothing in it identifies the document or the person outside this database.
CREATE TABLE IF NOT EXISTS lab_files (
  person_id      TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  file_hash      TEXT NOT NULL,
  measurement_id TEXT NOT NULL,              -- the report saved from this file
  created_at     INTEGER NOT NULL,
  PRIMARY KEY (person_id, file_hash)
);

CREATE TABLE IF NOT EXISTS settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);
INSERT INTO settings (key, value) VALUES ('billing_mode', 'private') ON CONFLICT (key) DO NOTHING;

-- credit movements: top-ups (topup), balance set by hand (set), cost of each reading (usage)
CREATE TABLE IF NOT EXISTS ledger (
  seq           INTEGER PRIMARY KEY AUTOINCREMENT,
  kind          TEXT NOT NULL,
  amount_micro  INTEGER NOT NULL,            -- millionths of a dollar
  person_id     TEXT,                        -- who took the photo or entered the amount
  payer         TEXT,                        -- whose money: 'owner', or the id of a friend who pays for themselves (empty = 'owner')
  scan_id       TEXT,
  created_at    INTEGER NOT NULL,
  created_at_local TEXT
);

-- Single-use invites made by the administrator, valid 7 days
CREATE TABLE IF NOT EXISTS invites (
  code        TEXT PRIMARY KEY,              -- e.g. "K7QM-3XRA-9TPE"
  type        TEXT NOT NULL,                 -- 'owner_pays' (family member, I pay) or 'self_pays' (friend, pays own photos)
  created_by  TEXT,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  used_by     TEXT,                          -- person id created with this invite
  used_at     INTEGER,
  created_at_local TEXT,
  expires_at_local TEXT,
  used_at_local    TEXT
);

-- Friends' own Anthropic keys, encrypted with AES-GCM (server secret KEY_ENCRYPTION_KEY).
-- Never sent back to the phone.
CREATE TABLE IF NOT EXISTS person_keys (
  person_id   TEXT PRIMARY KEY REFERENCES persons(id) ON DELETE CASCADE,
  sealed_key  TEXT NOT NULL,                 -- "v1:<iv>:<ciphertext>", base64
  created_at  INTEGER NOT NULL,
  created_at_local TEXT,
  status      TEXT,                          -- what Anthropic last answered: 'ok', 'no_credit' or 'invalid'
  checked_at  INTEGER                        -- when (the build adds these two columns to older databases)
);

-- Convert values stored in Italian by earlier versions to English (safe to run again: changes nothing once done).
UPDATE measurements SET period = 'morning'   WHERE period = 'mattina';
UPDATE measurements SET period = 'afternoon' WHERE period = 'pomeriggio';
UPDATE measurements SET period = 'evening'   WHERE period = 'sera';
UPDATE measurements SET source = 'photo'     WHERE source = 'foto';
UPDATE settings SET value = 'private'  WHERE key = 'billing_mode' AND value = 'privato';
UPDATE settings SET value = 'per_user' WHERE key = 'billing_mode' AND value = 'utente';

-- Every acceptance of the notice ("disclaimer"): who, from which phone, which version of the text, when.
-- Only ever added to, never changed. Kept after an account is deleted, as proof of what was accepted.
CREATE TABLE IF NOT EXISTS acceptances (
  id           TEXT PRIMARY KEY,
  person_id    TEXT NOT NULL,
  email        TEXT,
  device       TEXT,                         -- SHA-256 of the phone's public key
  phone        TEXT,                         -- phone make and model, as the app reports it
  doc          TEXT NOT NULL,                -- 'disclaimer'
  version      TEXT NOT NULL,
  lang         TEXT,
  text_sha256  TEXT,                         -- fingerprint of the exact text shown on the phone
  app_version  TEXT,
  accepted_at  INTEGER NOT NULL,
  accepted_at_local TEXT
);
CREATE INDEX IF NOT EXISTS idx_acceptances_person ON acceptances (person_id, doc, version);

-- My Dash (web dashboard). Only SHA-256 fingerprints are stored: a stolen database holds no usable code, cookie or link.
-- One-time codes the app creates to open the dashboard already signed in (60 seconds, one use).
CREATE TABLE IF NOT EXISTS web_codes (
  code_hash   TEXT PRIMARY KEY,
  person_id   TEXT NOT NULL,
  expires_at  INTEGER NOT NULL,
  owner       INTEGER                        -- 1: asked from the owner's own phone (owner_key), opens the Admin console
);
-- Browsers signed in to My Dash (7 days, or until "Sign out").
CREATE TABLE IF NOT EXISTS web_sessions (
  id_hash     TEXT PRIMARY KEY,
  person_id   TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  owner       INTEGER                        -- copied from the code
);
-- Read-only links for the doctor: the readings between date_from and date_to, until expires_at.
CREATE TABLE IF NOT EXISTS web_shares (
  token_hash  TEXT PRIMARY KEY,
  person_id   TEXT NOT NULL,
  date_from   INTEGER NOT NULL,
  date_to     INTEGER NOT NULL,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_web_sessions_person ON web_sessions (person_id);
CREATE INDEX IF NOT EXISTS idx_web_shares_person ON web_shares (person_id);

-- The error log (worker/src/errors.ts): grouped per day, source, code, place and app version, with a counter.
-- No reading values (digits are removed from messages); the anonymous account code only. Kept 90 days.
CREATE TABLE IF NOT EXISTS error_log (
  day          TEXT NOT NULL,                -- UTC date, e.g. 2026-09-27
  source       TEXT NOT NULL,                -- 'server', 'app' or 'web'
  code         TEXT NOT NULL,
  place        TEXT NOT NULL,                -- endpoint ("POST /v1/bp/scan") or screen ("Report/PDF")
  app_version  TEXT NOT NULL DEFAULT '',
  count        INTEGER NOT NULL DEFAULT 1,
  first_at     INTEGER NOT NULL,
  last_at      INTEGER NOT NULL,
  message      TEXT,
  person_id    TEXT,                         -- last anonymous account that met it
  PRIMARY KEY (day, source, code, place, app_version)
);

CREATE INDEX IF NOT EXISTS idx_meas_taken ON measurements (taken_at);
CREATE INDEX IF NOT EXISTS idx_error_last ON error_log (last_at);

-- What happens (not only what fails): lab import outcomes per day, outcome, place and app version. Codes only,
-- never a value, a report date or a person. 90 days. Admin → Observability.
CREATE TABLE IF NOT EXISTS event_log (
  day          TEXT NOT NULL,
  code         TEXT NOT NULL,                -- lab_saved, lab_duplicate_file, lab_conflict_values, …
  place        TEXT NOT NULL,                -- "POST /v1/labs", "web"
  app_version  TEXT NOT NULL DEFAULT '',
  count        INTEGER NOT NULL DEFAULT 1,
  first_at     INTEGER NOT NULL,
  last_at      INTEGER NOT NULL,
  PRIMARY KEY (day, code, place, app_version)
);

-- Signed calls already used (test report F-04): a copy of a call sent again is refused. Kept 10 minutes.
CREATE TABLE IF NOT EXISTS seen_sigs (
  sig_hash    TEXT PRIMARY KEY,              -- SHA-256 of the signature
  expires_at  INTEGER NOT NULL
);

-- The free trial of the AI features (the photo Scan): when it started, per Google account and per phone, so that a
-- second phone or a new account does not start it again. Only HMAC fingerprints ("g:" Google account, "d:" phone,
-- "p:" account without Google), never an id, an email or a phone number. Kept after the account is deleted, at most
-- 2 years (nightly job), only for this purpose.
CREATE TABLE IF NOT EXISTS scan_trials (
  fp         TEXT PRIMARY KEY,
  started_at INTEGER NOT NULL
);

-- The yearly AI allowance of each person (the photo Scan): Scans made and what they cost the owner, in micro-US$
-- from the tokens the AI provider counted, in a 12-month window that starts with the first Scan of the window. When
-- micro_usd reaches the allowance (2.50 US$) the Scan stops until the window renews. Deleted with the account.
CREATE TABLE IF NOT EXISTS scan_usage (
  person_id    TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  scans        INTEGER NOT NULL DEFAULT 0,
  micro_usd    INTEGER NOT NULL DEFAULT 0
);

-- The owner's accounts, day by day, for the Admin console: AI cost of the Scans (all accounts, the owner included) and
-- subscriptions sold (a new paid year seen on Google Play). Totals only: no account, no person.
CREATE TABLE IF NOT EXISTS ai_spend_daily (
  day       TEXT PRIMARY KEY,                -- YYYY-MM-DD, Zurich time
  scans     INTEGER NOT NULL DEFAULT 0,
  micro_usd INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sub_sales_daily (
  day         TEXT PRIMARY KEY,              -- YYYY-MM-DD, Zurich time
  sales       INTEGER NOT NULL DEFAULT 0,    -- paid years
  gross_cents INTEGER NOT NULL DEFAULT 0     -- at the list price (SUB_PRICE_CENTS): an estimate, Google Play has the real figure
);

-- Limits against abuse (test report F-07): a counter per key and window. IP addresses only as a fingerprint.
CREATE TABLE IF NOT EXISTS rate_limits (
  key          TEXT PRIMARY KEY,             -- e.g. "register:<ip fingerprint>", "voice:<person>"
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL
);

-- Results of the nightly security scans (Security tests workflow → publish-security.mjs), for the owner's
-- Security console. Replaced at every run. Libraries with a known vulnerability, findings in our code (Semgrep),
-- secrets written in the repository (gitleaks: rule, file and line only, never the value). No personal data.
CREATE TABLE IF NOT EXISTS security_findings (
  kind        TEXT NOT NULL,                 -- 'library' | 'code' | 'secret'
  ref         TEXT NOT NULL,                 -- advisory id (GHSA, CVE…), Semgrep rule or gitleaks rule
  name        TEXT NOT NULL,                 -- library name, or file path
  version     TEXT,                          -- library version, or line / commit
  location    TEXT,                          -- where it is in the repository
  severity    TEXT,                          -- from the advisory or the tool
  rating      TEXT,                          -- our rating after reachability (docs/security/decisions.json)
  fixed       TEXT,                          -- version that fixes it
  summary     TEXT,
  source_url  TEXT,                          -- the advisory or the line in the repository
  plan_url    TEXT,                          -- the remediation plan (issue, pull request, rule)
  found_at    INTEGER NOT NULL,
  PRIMARY KEY (kind, ref, name, location)
);

-- Since when each open finding is open, and why it is still open (a short reason code written by the nightly
-- publish from docs/security/decisions.json or from where the finding is): to_fix (within 7 days), build_tool,
-- not_patchable, false_positive, accepted, patch_failed. Rows of findings that are gone are deleted by the publish.
CREATE TABLE IF NOT EXISTS security_notes (
  kind     TEXT NOT NULL,
  ref      TEXT NOT NULL,
  name     TEXT NOT NULL,
  location TEXT NOT NULL,
  first_at INTEGER NOT NULL,
  reason   TEXT,
  PRIMARY KEY (kind, ref, name, location)
);

-- Fix requests from the Security console. One row per request (the key lets the fix workflow report progress,
-- stored only as a fingerprint, valid 24 hours) and one row per finding with its state:
-- Open (no fix requested, or it waits for the owner's decision) -> Fixing -> Fixed | Failed. Always in English.
CREATE TABLE IF NOT EXISTS security_fix_requests (
  id          TEXT PRIMARY KEY,
  key_hash    TEXT NOT NULL,
  issue_url   TEXT,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS security_fixes (
  kind          TEXT NOT NULL,
  ref           TEXT NOT NULL,
  name          TEXT NOT NULL,
  location      TEXT NOT NULL,
  fix_id        TEXT,                        -- security_fix_requests.id
  idx           INTEGER,                     -- number of the finding in the request's issue
  status        TEXT NOT NULL DEFAULT 'fixing',   -- open | fixing | fixed | failed
  detail_url    TEXT,                        -- the pull request (or the issue comment) with the fix
  note          TEXT,                        -- short reason: why it failed, or what the owner must decide
  requested_at  INTEGER NOT NULL,
  updated_at    INTEGER,
  issue_url     TEXT,
  PRIMARY KEY (kind, ref, name, location)
);
