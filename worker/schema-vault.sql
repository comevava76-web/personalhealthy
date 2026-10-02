-- D1 "personalhealthy-vault" (EU): the nightly backups of the two other databases, encrypted (AES-256, BACKUP_PASSPHRASE)
-- and cut in parts of at most 90 KB (a D1 statement is limited to 100 KB). Kept 30 days, as the privacy policy says.
-- Written and read only by DR/infrastructure-as-code/rebuild.sh (Actions: Database backup, Disaster recovery).
CREATE TABLE IF NOT EXISTS backups (
  day        TEXT NOT NULL,      -- YYYY-MM-DD (UTC)
  part       INTEGER NOT NULL,   -- 0, 1, 2… in order
  parts      INTEGER NOT NULL,   -- how many parts the backup has
  data       TEXT NOT NULL,      -- base64 of the encrypted bytes
  sha256     TEXT NOT NULL,      -- of the whole encrypted file, to check it before a restore
  created_at INTEGER NOT NULL,
  PRIMARY KEY (day, part)
);
