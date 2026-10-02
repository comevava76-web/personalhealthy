# HINT 365 · Disaster recovery runbook

For whoever has to bring HINT 365 back after a loss: data deleted by mistake, a database broken, the Cloudflare
account lost. Follow the steps in order. Everything that happens by itself is a pipeline; everything you must do
by hand is marked **BY HAND**.

## 1. In short

| | Target |
|---|---|
| **RPO** (data that can be lost at most) | **a few minutes** if the problem is noticed within 7 days (Time Travel); otherwise **one day** (last night's backup) |
| **RTO** (time to have the service back) | **1 hour** for a full rebuild from zero; 5 minutes to go back a few minutes in time |
| Backups | Cloudflare Time Travel (automatic) + **one encrypted backup every night**, last **30 nights** kept |
| Where | everything in the European Union, at Cloudflare. **Never in Git** (health data, public repository) |
| Tested | every month, automatically (the *drill*). First drill on the real account, 02.10.2026: rebuilt and restored in 24 s, same counts as production (1 account, 39 readings, 29 acceptances) |

## 2. What we rely on: Cloudflare Workers Free (today)

- **No availability guarantee (no SLA)** on the plan in use: uptime commitments exist only on Cloudflare's paid business plans. HINT 365 is offered "as is", as the terms of use say.
- **D1 Time Travel: 7 days** on Workers Free (30 days on Workers Paid, 5 US$ a month).
- **Daily limits**: 100,000 requests; D1 5 million rows read and 100,000 rows written a day. Above them requests fail until midnight UTC; stored data is not affected. Workers Paid removes the limit.
- **Data bound to the EU** (D1 jurisdiction `eu`).

The RPO and RTO above are internal targets built on these facts, not a contract.

## 3. Which backups exist, and how far back can I go?

Two kinds of backup, both automatic:

| | What it is | How often | How far back | Set up by |
|---|---|---|---|---|
| **Time Travel** | Cloudflare keeps every change of the main database and can put it back as it was at any minute | continuous | **7 days** on the free plan (30 days on Workers Paid, 5 US$ a month) | Cloudflare, always on, nothing to do |
| **Nightly backup** | a full copy of the two databases, encrypted with a phrase only the owner knows, kept in a third database (`personalhealthy-vault`, EU) | **once a night**, 01:40 UTC (03:40 in Zurich in summer) | **the last 30 nights** (older ones are deleted, as the privacy policy says) | GitHub Actions → *Database backup* |

Cloudflare by itself offers only Time Travel; it does not keep daily copies for us. That is why the nightly backup exists.

**If I lose data now, what can I get back?**

| I need the data as it was… | Use | Result |
|---|---|---|
| 10 minutes ago, 2 hours ago, yesterday afternoon | Time Travel, to the minute | exact, to the minute |
| last night | Time Travel, or last night's backup | exact |
| 3 days ago | Time Travel (to the minute) or the backup of that night | exact |
| a week ago | the backup of that night (Time Travel only up to 7 days) | as it was that night |
| 3 weeks ago | the backup of that night | as it was that night |
| 40 days ago | — | not possible: nothing is kept beyond 30 nights |

Limit to know: Time Travel and the vault are in the same Cloudflare account. If the whole account were lost, both
would be lost too. When HINT 365 goes on Google Play, a copy outside the account will be added (R2 in a second
account); until then, losing the account means starting with empty databases.

## 4. What makes up HINT 365

| Piece | Where | Rebuilt by |
|---|---|---|
| Database `personalhealthy` (accounts, readings, lab results, logs, settings) | Cloudflare D1, EU | pipeline (*Disaster recovery*) |
| Database `personalhealthy-backup` (copy of the acceptances of the terms) | Cloudflare D1, EU | pipeline |
| Database `personalhealthy-vault` (the nightly backups) | Cloudflare D1, EU | pipeline |
| Server and Web Dashboard (Worker `personalhealthy-api`, address `personalhealthy-api.hint365.workers.dev`) | Cloudflare Workers | pipeline (*Build*) |
| Code, documents, pipelines | GitHub `comevava76-web/personalhealthy` | — (any clone) |
| Keys and secrets | GitHub secrets; the Worker gets them from *Build* | **BY HAND** (section 6) |
| Sign in with Google | Google Cloud project, OAuth clients | **BY HAND**, only if the address changes |
| The app on the store, the subscription | Google Play Console | **BY HAND**, only the access of the server |
| The AI key and its spending limit | Anthropic Console | **BY HAND**, only if the key is lost |
| The app's signing key | GitHub secret + the owner's offline copy | **BY HAND** |

The full list, in machine form: `DR/infrastructure-as-code/infrastructure.json`. The script that rebuilds it:
`DR/infrastructure-as-code/rebuild.sh`.

## 5. What happened? Pick the case

| Case | Do | RPO | RTO |
|---|---|---|---|
| A. Wrong data written, someone deleted something by mistake (within 7 days) | Actions → *Disaster recovery* → `time-travel`, value = the minute before (e.g. `2026-10-02T21:00:00Z`), confirm `RESTORE` | minutes | 5 min |
| B. Same, but noticed after more than 7 days | the database is not empty, so a restore would mix data: ask the developer to restore the backup of that night into a clone (`drill` with `KEEP=yes`) and copy back only what is missing | 1 day | 1–2 hours |
| C. The main database deleted or broken | Actions → *Disaster recovery* → `rebuild`, value empty (= last night), confirm `RESTORE`. It recreates the databases, the tables, puts the data back and starts *Build* | 1 day | 30 min |
| D. The server broken (database fine) | Actions → *Build* → Run workflow (or *Promote verified APK and server* for the previous version) | nothing | 15 min |
| E. The whole Cloudflare account lost | section 6, from step 1 | everything since the start (see the limit above) until the copy outside the account exists | 1 hour + Google's time if the address changes |
| F. The GitHub repository lost | push any copy of the repository (every developer's computer has one) to a new repository, add the secrets (section 6, step 2) | nothing | 1 hour |

## 6. Full rebuild from zero (case E, and the reference for every case)

**Step 0 · Have these at hand (BY HAND)** — the owner's password manager must hold:
- the login of Cloudflare, GitHub, Google (Cloud and Play Console), Anthropic, each with two-factor;
- `BACKUP_PASSPHRASE` (without it no backup can be read);
- the app's signing key file and its passwords (without it no update can be installed over the app);
- `OWNER_CODE`.

**Step 1 · Cloudflare (BY HAND, 10 min)**
1. Sign in to Cloudflare (a new account if the old one is lost). Copy the **Account ID** (right column of the home page).
2. Workers & Pages → choose the subdomain **`hint365`** (so the address stays `personalhealthy-api.hint365.workers.dev`). Once the owner's own domain is in use, also add it back to Cloudflare (`docs/operations/domain.md`, steps 2 and 4).
   If that name is not available, the address changes: see step 6.
3. My Profile → API Tokens → Create Token → Custom: permissions *Account · D1 · Edit*, *Account · Workers Scripts · Edit*,
   *Account · Account Settings · Read*; limited to this account. Copy the token.
4. If the account is new: replace the old Account ID with the new one in `DR/infrastructure-as-code/infrastructure.json`
   and in `.github/workflows/build.yml`, `owner-phone.yml`, `app-versions.yml` (search `6c6de5312c59db866e1a8e07d3c21c63`).

**Step 2 · GitHub secrets (BY HAND, 10 min)** — Settings → Secrets and variables → Actions:

| Secret | Where it comes from |
|---|---|
| `CLOUDFLARE_API_TOKEN` | step 1.3 |
| `BACKUP_PASSPHRASE` | password manager |
| `ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` | the signing key in the password manager (the file in base64) |
| `AI_API_KEY` | Anthropic Console → API Keys (a new key if the old one is lost) |
| `GOOGLE_WEB_CLIENT_ID` | Google Cloud Console → APIs & Services → Credentials → the Web client |
| `PLAY_SERVICE_ACCOUNT` | Google Cloud → IAM → Service accounts → the Play account → Keys → JSON (only once on Google Play) |
| `OWNER_CODE`, `FAMILY_CODE`, `CONTACT_EMAIL` | password manager |

If the repository is the same and only Cloudflare was lost, only `CLOUDFLARE_API_TOKEN` changes.

**Step 3 · Rebuild and restore (pipeline, 5–20 min)** — Actions → *Disaster recovery* → Run workflow →
action `rebuild`, value empty (last night) or a day `YYYY-MM-DD`, confirm `RESTORE`. It:
1. creates the three databases in the EU (if missing);
2. creates all the tables;
3. takes the backup from the vault, checks its fingerprint, decrypts it and puts the data back;
4. shows how many accounts, readings and acceptances are back;
5. starts *Build*.

If the vault itself was lost (case E): there is no backup to restore; `rebuild` stops at step 3 with "No backup in
the vault" — run `restore` later if an encrypted backup file is found (`rebuild.sh restore-file`).

**Step 4 · Build (pipeline, 12 min)** — started by step 3 (or Actions → *Build* → Run workflow): tests, puts the
secrets into the Worker, deploys the server and the Web Dashboard, builds the signed app and checks that the
download link serves it.

**Step 5 · Outside services (BY HAND, 5 min, only what applies)**
- **Anthropic** (console.anthropic.com): if the key was new, check Settings → Limits → monthly spend limit, and that
  auto-reload is off. The Scan works again once *Build* has run.
- **Google Cloud** (console.cloud.google.com → Credentials): nothing if the address is the same.
- **Google Play Console** (once on the store): Users and permissions → the service account still has access.
- **Owner's phone**: open the app; if it asks for the owner code, type `OWNER_CODE`.

**Step 6 · Only if the address changed** (new subdomain): the app has the address built in, so:
set the GitHub variable `BATTITO_API_URL` to the new address, run *Build* (a new app is made with it), add the new
address to the Google OAuth web client (Authorized JavaScript origins), and send the new download link to the people.
On Google Play, publish the new version (Google review: hours to 3 days).

**Step 7 · Check (BY HAND, 5 min)**
1. `https://personalhealthy-api.hint365.workers.dev/v1/health` shows `{"ok":true}`.
2. The app opens, sign in with Google: your readings and lab results are there.
3. Web Dashboard (from the app): the 7 days and the lab table are there.
4. Admin console: the numbers of users and readings are as expected; Observability opens.
5. Actions → *Database backup* → Run: a new backup appears (`list-backups`).
6. The next morning, the *Error log report* shows no new errors.

**Time, end to end:** step 1–2 by hand 20 min, step 3 about 5–20 min, step 4 12 min, steps 5–7 10 min → **about 1 hour**.

## 7. The monthly drill

On the 1st of every month (02:15 UTC) *Disaster recovery* runs `drill` by itself: it builds a complete copy of the
databases from zero (`…-clone`), restores last night's backup into it, compares the counts with production, measures
the time and deletes the copy. The result is in the run's log (`DRILL PASSED · recovery time … s`). A failed drill is
a defect: it is fixed like any other. Run it by hand any time: action `drill`.

## 8. Security around the backups

| Protection | State |
|---|---|
| Data and backups only in the EU (D1 jurisdiction `eu`) | on |
| Backups encrypted (AES-256, key derived from `BACKUP_PASSPHRASE` with 300,000 rounds); a stolen backup cannot be read | on once `BACKUP_PASSPHRASE` is set |
| Each backup has a fingerprint (SHA-256) checked before every restore | on |
| A restore never overwrites a database that already has accounts | on |
| Two-factor login on Cloudflare, GitHub, Google, Anthropic | **BY HAND**, by the owner |
| Cloudflare token limited to this account and to D1 and Workers | **BY HAND**, check once |
| Copy outside the Cloudflare account (R2 in a second account) | at the Google Play launch |
| WAF and bot protection of Cloudflare | only with a custom domain (not on workers.dev) |

## 9. To do now (owner, once, free)

GitHub → Settings → Secrets → **`BACKUP_PASSPHRASE`**: a long phrase (five or more words), also saved in the password
manager. From the next night a backup is made every night; the first drill runs on the 1st of next month.
