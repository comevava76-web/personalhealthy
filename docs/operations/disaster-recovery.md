# HINT 365 · Infrastructure as Code, backups and disaster recovery

**Goal:** if something is lost (a database, the Cloudflare account, the Worker), the whole service can be rebuilt
from the repository with one workflow and the data put back from an encrypted backup kept in the EU.

## What the infrastructure is

Everything is declared in the repository:

| Piece | Declared in | Created / updated by |
|---|---|---|
| D1 `personalhealthy` (EU): accounts, readings, lab results, logs, settings | `DR/infrastructure-as-code/infrastructure.json`, tables in `worker/schema.sql` | `DR/infrastructure-as-code/rebuild.sh apply`; tables and columns by *Build* |
| D1 `personalhealthy-backup` (EU): copy of the acceptances of the terms | `DR/infrastructure-as-code/infrastructure.json`, `worker/schema-backup.sql` | same |
| R2 bucket `hint365-backups` (EU): nightly encrypted backups, kept 30 days, locked 7 days | `DR/infrastructure-as-code/infrastructure.json` | `DR/infrastructure-as-code/rebuild.sh apply` |
| Worker `personalhealthy-api`: code, Web Dashboard, bindings, crons (03:17 UTC nightly, hourly :07) | `worker/wrangler.toml` | *Build* (`wrangler deploy`) |
| Worker secrets and variables | names in `DR/infrastructure-as-code/infrastructure.json`; values only in GitHub secrets / Cloudflare | *Build* |
| Workers subdomain `comevava76.workers.dev` | `DR/infrastructure-as-code/infrastructure.json` | *Build* |
| Outside Cloudflare: Google sign-in client, Google Play app and subscription, Anthropic key, Android signing key | `DR/infrastructure-as-code/infrastructure.json` (`outside`, `github.secrets`) | by hand, once |

Why a script and not Terraform: D1's EU jurisdiction can be set only at creation through the API or wrangler,
the Worker is already declared in `wrangler.toml`, and Terraform would need a state file holding secrets stored
somewhere. For one service run by one person an idempotent script (it creates what is missing and never deletes)
is simpler and safer. `infrastructure.json` plays the role of the Terraform files.

## The three layers of backup

The backups are never in Git (health data, public repository): see `DR/README.md` for where each one is in the Cloudflare dashboard.


| Layer | What it covers | How far back | Where |
|---|---|---|---|
| D1 Time Travel (Cloudflare, automatic) | the live database to any minute | 7 days on the free plan, 30 on Workers Paid | Cloudflare, EU |
| Nightly backup (*Database backup* workflow, 01:40 UTC) | both databases, exported, compressed, AES-256 encrypted with `BACKUP_PASSPHRASE` | 30 days (then deleted, as the privacy policy says) | R2 `hint365-backups`, EU jurisdiction; locked 7 days |
| Acceptances copy (Worker, at once and nightly) | the legal proof of every acceptance | as long as kept | D1 `personalhealthy-backup`, EU |

The backup passphrase is known only to the owner (password manager) and to the GitHub secret: a backup copied by
someone else cannot be read. The bucket lock means that, even with a stolen token, a backup cannot be deleted in its
first 7 days.

## What to do in each case (Actions → *Disaster recovery*)

| What happened | Action | Data lost at most (RPO) | Time to be back (RTO) |
|---|---|---|---|
| Wrong data written (a bug, a mistaken deletion) | `time-travel` with the moment before, type `RESTORE` | minutes | about 5 minutes |
| A database deleted or unusable | `apply` (new empty database), `restore` with the last day, then *Build* | up to 1 day | about 30 minutes |
| The Cloudflare account lost | new account: new `CLOUDFLARE_API_TOKEN` and the account id in `infrastructure.json` and the workflows; `apply`, `restore`, *Build* | up to 1 day | about 1 hour |
| The Worker deleted or broken | *Build* (or *Promote verified APK and server*) | nothing | about 12 minutes |
| GitHub repository lost | any clone (every developer's computer) pushed to a new repository, secrets added again | nothing | about 1 hour |
| Android signing key lost | without the offline copy no update can install over the app (Google Play App Signing protects the app on the store) | — | — |

`check` changes nothing: it lists what exists and what is missing. `list-backups` lists the backups in the bucket.
`restore` refuses to run on a database that already holds accounts (it would mix data): use `time-travel` there.

**Tested** on 02.10.2026 on a local copy: export of both databases, encryption, decryption and restore into an empty
database and into one that already had the tables: same counts as the original (7 accounts, 11 readings, 5 acceptances).
Test it on the real account once a year: `apply` in a test account, `restore`, compare the counts.

## Security layers on Cloudflare (and around it)

| Layer | State |
|---|---|
| Data bound to the EU (D1 and R2 jurisdiction `eu`) | on |
| D1 Time Travel | on (automatic) |
| Encrypted nightly backup, 30 days, locked 7 days | on once `BACKUP_PASSPHRASE` is set and R2 is enabled |
| API token limited to this account and to D1, Workers, R2 | to check in the Cloudflare dashboard (My Profile → API Tokens) |
| Two-factor login (a security key or an authenticator app) on Cloudflare, GitHub, Google, Anthropic | to switch on by the owner |
| Rate limits and signed requests in the Worker | on (in the code) |
| WAF, Bot Fight Mode, rate-limiting rules of Cloudflare | only on a custom domain (not on workers.dev): to add with the domain |
| Cloudflare audit log and usage notifications | in the dashboard (Manage account → Audit log; Notifications) |
| Android signing key: offline copy | by the owner (an encrypted copy on a USB key or in the password manager) |

## Owner's one-time steps

1. Cloudflare dashboard → R2 → enable (free up to 10 GB; it asks for a payment method but costs nothing at this size).
2. Cloudflare → API token used by GitHub: add the permission *Workers R2 Storage: Edit*.
3. GitHub → Settings → Secrets → `BACKUP_PASSPHRASE`: a long phrase, also saved in the password manager.
4. Actions → *Disaster recovery* → `apply`, then Actions → *Database backup* → Run: the first backup appears in the bucket.
