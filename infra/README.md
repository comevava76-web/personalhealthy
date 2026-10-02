# infra · Infrastructure as Code

- `infrastructure.json` — everything HINT 365 needs outside the code: D1 databases (EU), the R2 backup bucket (EU), the Worker, its secrets and variables, the GitHub secrets and workflows, the outside services.
- `rebuild.sh` — makes Cloudflare match the file: `check`, `apply`, `list-backups`, `restore YYYY-MM-DD`, `time-travel TIMESTAMP`. Creates what is missing, never deletes.

Run it from GitHub (Actions → *Disaster recovery*) or from a computer with `CLOUDFLARE_API_TOKEN` (and `BACKUP_PASSPHRASE` for a restore). The runbook — backups, what to do in each case, recovery times, security layers — is `docs/operations/disaster-recovery.md`.
