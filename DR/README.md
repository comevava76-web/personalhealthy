# DR · Disaster recovery of HINT 365

What is needed to rebuild HINT 365 after a loss. The runbook — backups and how far back they go, RPO/RTO, every
manual step — is `docs/operations/disaster-recovery.md` (and section 14 of `docs/HINT365-How-it-works.pdf`).

| Here | What it is |
|---|---|
| `infrastructure-as-code/infrastructure.json` | every piece of the infrastructure, declared: the three D1 databases (EU), the Worker, secrets, outside services, RPO/RTO |
| `infrastructure-as-code/rebuild.sh` | `check`, `apply`, `schema`, `backup`, `list-backups`, `restore DAY`, `restore-file FILE`, `time-travel TS`, `rebuild`, `drill` |
| Actions → *Disaster recovery* | runs it from the browser: `rebuild` = databases + tables + restore + Build; `drill` every month |
| Actions → *Database backup* | the nightly backup |

## Where the backups are (and why not here)

The backups contain health data: they are **never** in Git (public repository). Git holds only the code. The backups
stay at Cloudflare, in the European Union:

| Backup | Where in the Cloudflare dashboard | How often · how far back |
|---|---|---|
| **Time Travel** of the main database | Storage & Databases → **D1** → **personalhealthy** → **Time Travel** | continuous · any minute of the last 7 days (Workers Free) |
| **Nightly backup** of both databases, encrypted (AES-256, `BACKUP_PASSPHRASE`) | Storage & Databases → **D1** → **personalhealthy-vault** → table `backups` (one day = one or more rows) | once a night at 01:40 UTC · the last 30 nights |
| **Copy of the acceptances** of the terms | Storage & Databases → **D1** → **personalhealthy-backup** → table `acceptances_backup` | at once · kept as proof |

A backup alone cannot be read: it needs the passphrase, known only to the owner (password manager) and to the GitHub secret.
