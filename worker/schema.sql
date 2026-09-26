-- PersonalHealthy database (Cloudflare D1, data in the European Union).
-- Safe to run as many times as you like: it only creates what is missing.
-- Dates and times are in milliseconds (UTC); measurement values are JSON in the "data" column.

CREATE TABLE IF NOT EXISTS persons (
  id          TEXT PRIMARY KEY,
  public_key  TEXT NOT NULL UNIQUE,          -- the phone's anonymous key
  birth_date  TEXT,
  sex         TEXT,
  is_admin    INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS scans (
  id          TEXT PRIMARY KEY,
  person_id   TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,                 -- 'bp' = blood pressure; in the future 'lab', 'report', ...
  result      TEXT NOT NULL,                 -- what the AI read (JSON)
  taken_at    INTEGER NOT NULL,
  used        INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS measurements (
  id          TEXT PRIMARY KEY,
  person_id   TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,
  taken_at    INTEGER NOT NULL,
  tz          TEXT NOT NULL,
  period      TEXT,                          -- 'morning', 'afternoon' or 'evening'
  data        TEXT NOT NULL,                 -- e.g. {"sis":128,"dia":82,"pul":67}
  source      TEXT NOT NULL,                 -- 'photo'
  scan_id     TEXT,
  lab         TEXT,                          -- for future lab tests
  city        TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_meas_person_kind_time ON measurements (person_id, kind, taken_at);

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
  person_id     TEXT,
  scan_id       TEXT,
  created_at    INTEGER NOT NULL
);

-- Convert values stored in Italian by earlier versions to English (safe to run again: changes nothing once done).
UPDATE measurements SET period = 'morning'   WHERE period = 'mattina';
UPDATE measurements SET period = 'afternoon' WHERE period = 'pomeriggio';
UPDATE measurements SET period = 'evening'   WHERE period = 'sera';
UPDATE measurements SET source = 'photo'     WHERE source = 'foto';
UPDATE settings SET value = 'private'  WHERE key = 'billing_mode' AND value = 'privato';
UPDATE settings SET value = 'per_user' WHERE key = 'billing_mode' AND value = 'utente';
