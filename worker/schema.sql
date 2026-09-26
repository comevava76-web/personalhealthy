-- Database PersonalHealthy (Cloudflare D1, dati nell'Unione Europea).
-- Si può rilanciare quante volte si vuole: crea solo ciò che manca.
-- Date e ore sono in millisecondi (UTC); i valori delle misure sono JSON nella colonna "data".

CREATE TABLE IF NOT EXISTS persons (
  id          TEXT PRIMARY KEY,
  public_key  TEXT NOT NULL UNIQUE,          -- chiave anonima del telefono
  birth_date  TEXT,
  sex         TEXT,
  is_admin    INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS scans (
  id          TEXT PRIMARY KEY,
  person_id   TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,                 -- 'bp' = pressione; in futuro 'lab', 'referto', ...
  result      TEXT NOT NULL,                 -- cosa ha letto l'AI (JSON)
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
  period      TEXT,
  data        TEXT NOT NULL,                 -- es. {"sis":128,"dia":82,"pul":67}
  source      TEXT NOT NULL,
  scan_id     TEXT,
  lab         TEXT,                          -- per le analisi future
  city        TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_meas_person_kind_time ON measurements (person_id, kind, taken_at);

CREATE TABLE IF NOT EXISTS settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);
INSERT INTO settings (key, value) VALUES ('billing_mode', 'privato') ON CONFLICT (key) DO NOTHING;

-- movimenti del credito: ricariche (topup), saldo impostato (set), costo di ogni lettura (usage)
CREATE TABLE IF NOT EXISTS ledger (
  seq           INTEGER PRIMARY KEY AUTOINCREMENT,
  kind          TEXT NOT NULL,
  amount_micro  INTEGER NOT NULL,            -- milionesimi di dollaro
  person_id     TEXT,
  scan_id       TEXT,
  created_at    INTEGER NOT NULL
);
