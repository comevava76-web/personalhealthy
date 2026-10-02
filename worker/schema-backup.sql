-- HINT 365 · backup database "personalhealthy-backup" (Cloudflare D1, data bound to the European Union).
-- Holds only a copy of every acceptance of the terms of use, as legal proof, separate from the main database:
-- the pseudonymous account code, the HMAC fingerprint of the Google account (never the email), the fingerprint of
-- the phone's key, the phone model, the document version, its language, the fingerprint of the exact text shown,
-- the app version and the time. Written at each acceptance and checked again every night. Never deleted by the app.
CREATE TABLE IF NOT EXISTS acceptances_backup (
  id           TEXT PRIMARY KEY,
  person_id    TEXT NOT NULL,
  google_fp    TEXT,
  device       TEXT,
  phone        TEXT,
  doc          TEXT NOT NULL,
  version      TEXT NOT NULL,
  lang         TEXT,
  text_sha256  TEXT,
  app_version  TEXT,
  accepted_at  INTEGER NOT NULL,
  accepted_at_local TEXT,
  copied_at    INTEGER NOT NULL
);
