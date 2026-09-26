-- PersonalHealthy database (Cloudflare D1, data in the European Union).
-- Safe to run as many times as you like: it only creates what is missing.
-- Dates and times are in milliseconds (UTC); measurement values are JSON in the "data" column.
-- Every time column has a readable companion "<name>_local" with the Swiss time (Europe/Zurich)
-- as "MMddyyyy HH:mm", 24-hour clock (e.g. "09262026 14:32"). The server fills it on every insert.
-- SQLite cannot "add a column if missing", so for databases created before these columns existed
-- the build workflow adds them (step "PersonalHealthy database"), and the server fills old rows.

CREATE TABLE IF NOT EXISTS persons (
  id          TEXT PRIMARY KEY,
  public_key  TEXT NOT NULL UNIQUE,          -- the phone's anonymous key
  birth_date  TEXT,
  sex         TEXT,
  is_admin    INTEGER NOT NULL DEFAULT 0,
  pays        TEXT NOT NULL DEFAULT 'owner', -- 'owner' = the owner's key and credit; 'self' = a friend with their own key
  created_at  INTEGER NOT NULL,
  created_at_local TEXT
);

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
  source      TEXT NOT NULL,                 -- 'photo'
  scan_id     TEXT,
  lab         TEXT,                          -- for future lab tests
  city        TEXT,
  created_at  INTEGER NOT NULL,
  taken_at_local   TEXT,
  created_at_local TEXT
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
  created_at_local TEXT
);

-- Convert values stored in Italian by earlier versions to English (safe to run again: changes nothing once done).
UPDATE measurements SET period = 'morning'   WHERE period = 'mattina';
UPDATE measurements SET period = 'afternoon' WHERE period = 'pomeriggio';
UPDATE measurements SET period = 'evening'   WHERE period = 'sera';
UPDATE measurements SET source = 'photo'     WHERE source = 'foto';
UPDATE settings SET value = 'private'  WHERE key = 'billing_mode' AND value = 'privato';
UPDATE settings SET value = 'per_user' WHERE key = 'billing_mode' AND value = 'utente';
