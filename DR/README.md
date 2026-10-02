# DR · Disaster recovery of HINT 365

This folder holds what is needed to rebuild HINT 365 after a loss. The full runbook (what to do in each case,
recovery times, security layers) is `docs/operations/disaster-recovery.md`.

| Folder / file | What it is |
|---|---|
| `infrastructure-as-code/infrastructure.json` | every piece of the infrastructure, declared: D1 databases (EU), R2 backup bucket (EU), Worker, secrets, outside services |
| `infrastructure-as-code/rebuild.sh` | recreates what is missing and puts the data back: `check`, `apply`, `list-backups`, `restore YYYY-MM-DD`, `time-travel TIMESTAMP` |
| GitHub Actions → *Disaster recovery* | runs the script from the browser, no computer needed |
| GitHub Actions → *Database backup* | makes the nightly backup |

## Where the backups are (and why not here)

The backups contain health data. They are **never** put in Git (the repository is public): Git holds only the
code that makes and restores them. The backups themselves stay at Cloudflare, in the European Union:

| Backup | Where to see it in the Cloudflare dashboard | Kept |
|---|---|---|
| **Nightly backup** of both databases, one file per night, encrypted (AES-256) with `BACKUP_PASSPHRASE` | Storage & Databases → **R2** → bucket **`hint365-backups`** (jurisdiction EU) → folder `d1/` → one folder per day, e.g. `d1/2026-10-03/hint365-db.tar.gz.enc` | 30 days; nobody can delete one in its first 7 days |
| **Time Travel** of the live database | Storage & Databases → **D1** → **`personalhealthy`** → **Time Travel** (restore to a minute) | 7 days on the free plan, 30 on Workers Paid |
| **Copy of the acceptances** of the terms | Storage & Databases → **D1** → **`personalhealthy-backup`** → table `acceptances_backup` | kept as proof |

A backup file alone cannot be read: it needs the passphrase, which only the owner has (password manager) besides the
GitHub secret. Restore never needs the dashboard: Actions → *Disaster recovery* → `restore` with the day.
