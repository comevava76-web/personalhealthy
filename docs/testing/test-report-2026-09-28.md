# HINT 365 · QA and stress test report

**Date:** 28 September 2026 · **Reviewer:** independent QA (Claude, acting as senior QA engineer) · **Status:** for Human's review

## 1. Summary

| | |
|---|---|
| **Scope** | Cloudflare Worker (`worker/src/*.ts`), Web Dashboard (`worker/public/my/app.js`, `report.js`, `index.html`), D1 schema and migrations (`worker/schema.sql`, `.github/workflows/build.yml`), Android app (Kotlin, `android/app/src/main/java/ch/personalhealthy/app/*.kt`, 4 string files, manifest, Gradle). |
| **Revision tested** | `a3a8f78` (branch `claude/update-button-function-tk6g19`, which is `origin/main` `8d5571e` plus one commit, `a5e0ab2`, that only stops `no_session` from being logged). The local `main` branch is behind `origin/main` (`3147dd1`, 26 Sep), so it was not used. |
| **Environment** | Linux container, Node 22.22.2, Wrangler 4.141.0, `wrangler dev --local` (workerd with local D1/SQLite), headless Chromium 1194 (Playwright). Dummy secrets only. Anthropic, Google and Google Play were **never called**: only the code paths that fail before any outbound call were exercised. No production system was touched. |
| **Method** | Line-by-line code review; 160 automated API/web functional checks; 8 time-zone checks; 60 browser checks at 390 px and 1280 px; load test with 200 concurrent clients (about 11,000 requests, 164,000 stored readings); static review of the Android app. |
| **Verdict** | **Conditional pass.** Core behaviour is solid: signatures, account isolation (no IDOR found), input validation, atomic scan confirmation and invite use, error-log aggregation, the 365-day purge and the cookie consent all work, including under concurrency, with **0 % errors and no lost writes**. Before a wider (Play Store) release, fix the three **High** findings: the committed APK signing key, the full-table scans on every app open, and the unauthenticated write path into the error log (which feeds an automated agent). |

### Results per area

| Area | Checks | Pass | Fail |
|---|---:|---:|---:|
| API: authentication and signatures | 10 | 10 | 0 |
| API: security (IDOR, replay, headers, log abuse) | 15 | 9 | 6 |
| API: robustness (malformed input, unknown paths) | 7 | 6 | 1 |
| API: voice readings validation | 23 | 23 | 0 |
| API: readings list and delete | 5 | 5 | 0 |
| API: photo scan / key (paths before Anthropic) | 10 | 10 | 0 |
| API: terms acceptance | 4 | 4 | 0 |
| API: admin endpoints, invites, credit | 25 | 24 | 1 |
| API: app version gate (min / blocked / off) | 7 | 7 | 0 |
| API: subscription gate | 7 | 6 | 1 |
| API: account sign-out and deletion | 8 | 8 | 0 |
| API: concurrency (confirm, invite race) | 2 | 2 | 0 |
| Web: session, cookie, data, share links | 18 | 18 | 0 |
| Privacy rules (email, fingerprints, log contents) | 9 | 8 | 1 |
| Error log | 1 | 1 | 0 |
| Retention (365-day purge, 90-day log) | 4 | 4 | 0 |
| Public pages | 5 | 5 | 0 |
| **Functional subtotal** | **160** | **150** | **10** |
| Time zone / DST (period arithmetic) | 8 | 5 | 3 |
| Browser UI, 390 px + 1280 px (layout, rules, PDF, send dialog, admin, doctor view, a11y) | 60 | 54 | 6 |
| Stress correctness checks | 10 | 10 | 0 |
| **Total automated** | **238** | **219** | **19** |

All 19 failures are listed as findings in section 5; none is a crash or a data-loss bug.

## 2. How it was tested

Harness: [`docs/testing/harness/`](harness/) (no secrets, test data only).

| File | What it does |
|---|---|
| `setup-local.sh <scratch>` | Copies `worker/` into a scratch folder, writes a `wrangler.toml` with a dummy database id and a `.dev.vars` with dummy secrets (`FAMILY_CODE=QA-FAMILY-CODE-DUMMY`, random `KEY_ENCRYPTION_KEY`), creates the local D1 from `schema.sql`, adds the `add_col` columns of `build.yml`, starts `wrangler dev --local --test-scheduled` on 127.0.0.1:8787. Repository files are never edited. |
| `lib.mjs` | Generates P-256 keys and signs exactly like `Api.call` in `Core.kt` (`METHOD\nPATH+QUERY\nTS\nSHA256(body)`, DER, base64; headers `X-Ts`, `X-Sig`, `X-Person`, `X-App-Version`). Refuses any non-local base URL. |
| `functional.mjs` | 160 checks: every `/v1` endpoint and the `/my`, `/s` flows, negative cases, IDOR, replay, nightly purge through `/__scheduled`. Empties the local D1 first. |
| `timezone.mjs` | Takes `periodStart()` from `web.ts` and the day counter from `app.js` and checks them around DST. |
| `stress.mjs` | 200 concurrent clients: registration storm, 4,000 voice saves, 2,000 reads, 2,000 error-log writes, 1,000 share links and doctor reads, 400 days × 2 readings × 200 users, admin overview, nightly purge. |
| `seq-latency.mjs` | Single-client latency per endpoint and `EXPLAIN QUERY PLAN` of the hot queries. |
| `ui.mjs` | Playwright, 390 px and 1280 px: cookie banner accept/decline, dashboard, charts, colours (no red hue), horizontal scroll, PDF and CSV download, send dialog, Admin tab, doctor view, console errors, basic accessibility. |

Commands (scratch folder outside the repository):

```bash
bash docs/testing/harness/setup-local.sh /tmp/qa
cd docs/testing/harness
HINT_WORKER_DIR=/tmp/qa/w node functional.mjs
node timezone.mjs
HINT_WORKER_DIR=/tmp/qa/w CLIENTS=200 node stress.mjs
HINT_WORKER_DIR=/tmp/qa/w node seq-latency.mjs
NODE_PATH=/opt/node22/lib/node_modules HINT_WORKER_DIR=/tmp/qa/w HINT_SHOTS=/tmp/qa/shots node ui.mjs
pkill -f "wrangler dev"
```

The Android app could not be built or run here; it was reviewed statically (section 4.4).

## 3. Performance

Local workerd is a single process on one machine, so absolute numbers are **not** production numbers; they are useful for comparing endpoints and spotting regressions. Error rate was 0 % in every phase.

**Under load** (200 concurrent clients unless noted)

| Phase | Requests | Throughput (req/s) | p50 ms | p95 ms | p99 ms | Errors |
|---|---:|---:|---:|---:|---:|---:|
| Register (family code), 200 at once | 200 | 93 | 2,098 | 2,125 | 2,126 | 0 % |
| POST /v1/bp/voice (burst, 20 per client) | 4,000 | 87 | 2,201 | 3,603 | 4,046 | 0 % |
| GET /v1/me | 1,000 | **37** | **5,237** | **10,512** | **12,136** | 0 % |
| GET /v1/bp?days=400 | 1,000 | 83 | 2,456 | 3,205 | 5,002 | 0 % |
| POST /v1/log (same code and place) | 2,000 | 133 | 1,496 | 1,751 | 2,117 | 0 % |
| POST /my/api/share (100 concurrent) | 1,000 | 83 | 1,169 | 1,789 | 2,393 | 0 % |
| GET /s/&lt;token&gt;/data (100 concurrent) | 1,000 | 175 | 586 | 804 | 980 | 0 % |
| GET /my/api/data (100 concurrent) | 1,000 | 102 | 966 | 1,240 | 1,837 | 0 % |
| GET /v1/me with 164,000 readings (50 concurrent) | 200 | 29 | 1,709 | 1,795 | 1,802 | 0 % |
| GET /v1/bp?days=400 with 164,000 readings (50 concurrent) | 200 | 67 | 655 | 1,038 | 1,305 | 0 % |
| GET /my/api/admin/overview, 201 users, 164,000 readings | 10 | 4.6 | 196 | 401 | 401 | 0 % |
| Nightly purge (removed 14,200 of 164,000 readings) | 1 | – | 173 | – | – | 0 % |
| GET /v1/me while back-filling 2,000 legacy rows | 10 | 2.8 | 354 | 382 | 382 | 0 % |

**Single client, 150,000 readings in D1**

| Endpoint | p50 ms | p95 ms |
|---|---:|---:|
| GET /v1/health | 5.3 | 8.1 |
| GET /v1/me | **50.4** | **56.2** |
| GET /v1/bp?days=400 | 14.8 | 20.7 |
| POST /v1/bp/voice | 15.4 | 20.1 |
| POST /v1/log | 11.2 | 14.1 |
| GET /my/api/data | 13.1 | 17.2 |
| POST /my/api/share | 15.8 | 26.3 |

`GET /v1/me` is 3–4× slower than any other endpoint, and grows with the size of the database: see finding **F-02**.

**Correctness under concurrency (all passed):** 200 simultaneous registrations gave 200 distinct persons and exactly one owner; one key registered 20 times at once gave one person; 4,000 concurrent voice saves were all stored, with stored counts equal to the successful answers for every account; 10 parallel confirmations of one scan created exactly one reading; one invite used by 10 phones at once created exactly one account; 2,000 identical concurrent errors became one `error_log` row with `count = 2000`; 1,000 share links were stored once each; the purge removed every reading older than 365 days and no newer one.

## 4. What works well

- **Signatures:** wrong key, other account's `X-Person`, changed body, changed query, timestamps ±6 min, garbage or truncated DER: all refused with 401, never 500. SQL metacharacters in headers are harmless (all SQL is parameterised; the only interpolated identifiers are constants).
- **Account isolation:** no IDOR found: a user cannot read, delete or confirm another user's readings or scans; web data and share links only ever contain the owner's readings.
- **Validation:** voice values accept exactly 50–260 / 30–160 / 30–220 with DIA < SYS (checked after rounding), reject strings, arrays, `1e999`, missing pulse, stale or future times; a 1 MB body with unicode and NUL junk stores only `sis/dia/pul`.
- **Privacy:** no email returned or stored (the nightly job erases any left over), only SHA-256 fingerprints of one-time codes, sessions and share tokens; the one-time code travels in the `#fragment` and is removed from the address bar; no cookie before consent; `hint_s` is `HttpOnly; Secure; SameSite=Strict; Path=/my`, 7 days; the admin overview holds no reading values or names.
- **Rules:** SYS/DIA/PUL labels; pulse in its own chart; 7 dots, day numbers only; explanation before the charts; no red hue found anywhere (automated colour scan of every element); no judging words; the PDF is A4, 4 pages; the send dialog offers only Email and WhatsApp; share links are valid exactly 7 days.
- **Retention:** readings > 365 days, scans, expired codes/sessions/links and error-log rows > 90 days are purged; acceptances are kept.

### 4.4 Android (static review)

Good: EXIF/GPS is dropped because the photo is re-encoded (`Img.prepare`); `allowBackup="false"`; `FileProvider` not exported; camera and microphone permissions asked at use; biometric/device-credential app lock after 2 minutes; crashes are recorded and sent on next start; network errors are mapped to translated messages; the billing flow verifies on the server before acknowledging. Issues are in F-01, F-10, F-11, F-16 and F-21.

## 5. Findings (prioritised)

Severity: **Critical** = exploitable now with serious impact · **High** = fix before wider release · **Medium** = fix soon · **Low** = polish / hardening.

### F-01 · High · Security / secrets · `android/app/build.gradle.kts:26-31`, `android/app/personalhealthy.keystore`
**The APK signing keystore and its passwords are committed** (`storePassword` and `keyPassword` in plain text — value not repeated here). The app is sideloaded from `/download`, so this key is the only thing that proves an update is genuine. Anyone who ever gets read access to the repository (or a clone, a CI log, a fork) can sign an APK that installs **over** HINT 365 as an update, keeps its data and can use its Android Keystore key to sign API calls as that user. It also breaks the project rule "Mai segreti nel repository".
**Reproduce:** `git ls-files android/app/personalhealthy.keystore`; `grep -n Password android/app/build.gradle.kts`.
**Change:** move the keystore to GitHub secrets (`ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_PASSWORD`), decode it in `build.yml` before Gradle, read the passwords with `System.getenv(...)` in `signingConfigs`; `git rm --cached` the keystore and add `*.keystore` to `.gitignore`. Because the key has been exposed, rotate it with APK Signature Scheme v3 key rotation (`apksigner rotate` + lineage) so installed apps accept the new key; for the Play Store, enrol in Play App Signing and use a separate upload key.

### F-02 · High · Performance / cost · `worker/src/index.ts:324-333` (called from `:618`)
**Every `GET /v1/me` (every time the app opens or resumes) runs four full-table scans.** `fillLocalDates` runs `SELECT … WHERE x_local IS NULL OR y_local IS NULL LIMIT 200` on `persons`, `scans`, `measurements` and `ledger`; when nothing is missing, SQLite reads every row (`EXPLAIN QUERY PLAN` → `SCAN measurements`). With 150,000 readings `/v1/me` takes 50 ms against 15 ms for the others, and under load it is the slowest endpoint (p50 5.2 s, 37 req/s vs 83 for `/v1/bp`). On D1, rows read are billed and capped (the free plan allows 5 million rows read per day): with 150,000 readings about 30 app opens a day would use it up. The same handler also calls `anonymizeGoogle` (a scan of `persons`).
**Reproduce:** `stress.mjs` / `seq-latency.mjs` (plans printed at the end).
**Change:** take `fillLocalDates(q)` out of `/v1/me` and run it only in `purgeOld()` (nightly), or once as a migration in `build.yml`; if it must stay, add partial indexes, e.g. `CREATE INDEX IF NOT EXISTS idx_meas_nolocal ON measurements(id) WHERE taken_at_local IS NULL OR created_at_local IS NULL` (and the same for the other three tables). Keep `anonymizeGoogle` only in the nightly job and at Google sign-in.

### F-03 · High · Security / automation · `worker/src/index.ts:458-470`, `worker/src/errors.ts:282-288`, `.github/workflows/error-log.yml:32-48`
**Anyone on the internet can write rows into `error_log`, with text they choose, and that text is copied into the daily GitHub issue that the scheduled Claude routine reads and acts on.** Any unsigned request to `/v1/<anything>` is answered 401 `bad_clock` and logged with `place = METHOD + pathname` (80 chars, digits kept), `app_version` from the header and `person_id` from the unverified `X-Person` header. Every different path is a new row. Test: 50 unsigned requests to random paths → 50 new rows; an unsigned request with `X-Person: per_spoofed` stored that code as `person_id`.
Impact: unbounded database growth (DoS of the 500 MB D1), a polluted Admin tab, a fake account code attached to errors, and — most important — **an unauthenticated path to put instructions into the input of an agent that opens and merges pull requests** (prompt injection through the issue).
**Reproduce:** `curl http://127.0.0.1:8787/v1/Please-ignore-previous-instructions-and-…` then check `error_log`; checks E4 and E5 in `functional.mjs`.
**Change:** (1) in `fetch()` log only answers to requests that passed authentication, or for unauthenticated ones log a fixed place (`"unauthenticated"`) and `personId: null`; (2) never use the raw path: map it to a known route name (`/v1/bp/:id`, `/v1/me`…) or `"unknown"`; (3) apply `clean()` (digits removed) and a strict `[A-Za-z0-9 _:/.-]` whitelist to `place` and `app_version`; (4) cap new rows per day (e.g. skip the insert when the day already has > 500 rows); (5) in `error-log.yml` and in the routine's prompt, treat the issue content as data, never instructions.

### F-04 · Medium · Security · `worker/src/index.ts:485-493`
**Signed requests can be replayed for 5 minutes.** Nothing records a signature once used. Test A12: the same signed `POST /v1/bp/voice` sent twice stored two readings. Anyone who can capture one request (malicious proxy/VPN app with a user-installed CA, a logging middlebox) can repeat writes (`/v1/bp/voice`, `DELETE /v1/bp`, `/v1/signout`, `DELETE /v1/me`) within the window.
**Change:** keep a table `seen_sigs(sig_hash TEXT PRIMARY KEY, expires_at INTEGER)`; after the signature is verified, `INSERT … ON CONFLICT DO NOTHING` the SHA-256 of `X-Sig` and refuse (401 `replay`) when no row was inserted; purge rows older than 10 minutes nightly. For non-GET only if cost matters. Optionally shorten the window to 2 minutes.

### F-05 · Medium · Admin safety · `worker/src/index.ts:621-622`, `worker/src/web.ts:150-157, 204-207`
**One user can defeat the owner's "never above the newest version" safeguard.** `persons.app_version` is written from the client's `X-App-Version` header on `/v1/me`, and `newestVersion()` takes the maximum. Test W20: a user sending `X-App-Version: 99999` made "Newest version installed: 0.1.99999"; the Admin button "Block versions older than 0.1.99999" would then switch off **every** installed app, the owner's included (only recoverable from GitHub Actions).
**Change:** in `/v1/me` store the version only if it is ≤ the newest real build (e.g. a `LATEST_VERSION_CODE` var written by `build.yml`), and compute `newestVersion()` from that var, not from user data. In `/my/api/admin/app-min-version`, also refuse a minimum above the owner's own `persons.app_version`.

### F-06 · Medium · Security headers · `worker/src/web.ts:27-31`, `worker/src/pages.ts:43`, static `/my/` (no `public/_headers`)
**No Content-Security-Policy, no `X-Frame-Options`/`frame-ancestors`, no `X-Content-Type-Options`, no `Referrer-Policy` header** on `/my/`, `/s/…` or the public pages (checks HD1–HD3). The dashboard renders with `innerHTML`; today every dynamic value is either a number, a server-controlled enum or escaped with `esc()`, so no XSS was found, but there is no second line of defence, and the pages can be framed (clickjacking of "Withdraw all links" or the admin "Block versions" button).
**Change:** add `worker/public/_headers`:
```
/my/*
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
```
and the same headers on the responses built in code (`json()` in both files, `page()` in `pages.ts`, and the `/s/` page, which is served through `env.ASSETS.fetch`). Add `Strict-Transport-Security: max-age=31536000` on the Worker responses.

### F-07 · Medium · Abuse / rate limiting · `worker/src/index.ts:505-509`, `worker/src/web.ts:173-185`, `/v1/bp/voice`, `/v1/log`
**No rate limit anywhere.** The static `FAMILY_CODE` can be guessed without limit (each guess costs one request), and a correct guess creates an account on the owner's side (see F-08). A signed-in user can create unlimited share links (1,000 in 12 s in the test), readings or log rows, all counting against the 500 MB D1.
**Change:** use a Workers Rate Limiting binding (`[[unsafe.bindings]] type = "ratelimit"`) or a small D1 counter keyed by IP (register) and by person (writes): e.g. 10 register attempts per IP per hour, 60 voice saves and 20 share links per person per day, 100 log rows per person per day. Remove `FAMILY_CODE` if invites and Google sign-in replace it (F-08).

### F-08 · Medium · Cost policy / dead path · `worker/src/index.ts:505-524, 744-747, 819`, `.github/workflows/build.yml:80`
**Accounts that the owner pays for can still be created, although the project rule says AI is always paid by the user.** `/v1/register` with `FAMILY_CODE`, and invites of type `owner_pays`, create persons with `pays = 'owner'`; their photo scans use the owner's `ANTHROPIC_API_KEY` (`index.ts:819`). Every deploy then runs `UPDATE persons SET pays = 'self'` (`build.yml:80`), so behaviour silently changes at the next build. The register path also creates admins on an empty database.
**Change:** decide one model. If "everyone pays their own" is final: make `/v1/register` create `pays = 'self'` (or remove the family-code path), accept only `self_pays` invites, drop the `env.ANTHROPIC_API_KEY` fallback in `/v1/bp/scan` (return `friend_no_key`), and remove the migration line once no `'owner'` rows remain. Update the architecture document accordingly.

### F-09 · Medium · Privacy · `worker/src/errors.ts:286`
**`place` is not cleaned of digits**, while the rule is "no reading values in the error log". `message` is cleaned, `place` is only cut to 80 characters. Test E2: `place = "app.js:123 SYS 142/95"` was stored as is. The app and the web choose `place` freely.
**Change:** `clean(e.place, 80)` for `place` (and a whitelist as in F-03). If line numbers are wanted, send them in a separate numeric field that is not free text, e.g. `line`.

### F-10 · Medium · Android robustness · `MainActivity.kt:330-353`, `Core.kt:359`
**When the phone's key is no longer valid (the account was moved to another phone with Google sign-in, or signed out elsewhere), the app is stuck.** Every call returns `unauthorized`; `reload()` only shows the error message; there is no way back to sign-in other than clearing the app's data.
**Change:** in `reload()` (or in `Api.call`), on `ApiException("unauthorized")` from `/v1/me`, clear `personId` (as the sign-out branch at `MainActivity.kt:669` does) and show the sign-in screen with a short explanation ("This account is now used on another phone").

### F-11 · Medium · Security · `worker/src/index.ts:551-569`
**The Google ID token is not bound to the phone or to a nonce.** Any valid, unexpired ID token for this client moves the whole account to the key that presents it (`recovered: true`) and disconnects the real phone. A token leaked from a log, a debugging tool or another app using the same client ID is enough for an account takeover within the token's lifetime (~1 hour).
**Change:** have the app request the token with `nonce = base64url(SHA-256(publicKey))` (`GetSignInWithGoogleOption.Builder(...).setNonce(...)` in `Google.kt:25`) and verify `claims.nonce` against the presented `publicKey` on the server; also reject tokens whose `iat` is older than 5 minutes.

### F-12 · Medium · i18n / rules · `android/app/src/main/res/values-de/strings.xml`, `values-fr/strings.xml`, `worker/public/my/app.js:9`, `worker/public/my/report.js:7`
**German and French are incomplete.** 23 strings are missing in DE and FR, so German and French users see English for: the binding terms screen (`disc_title`, `disc_body`, `disc_accept`, `disc_decline`, …), "Web Dashboard", the AI status lines and the credit states. The Web Dashboard and its PDF exist only in Italian and English, so a DE/FR phone gets a German/French PDF from the app but an English one from the web — against "stesso PDF A4 dall'app e dal web". (Italian misses only the two non-translatable names, which is correct.)
**Change:** translate the 23 keys (list: `ai_check_now, ai_key_invalid, ai_no_credit, ai_state_invalid, ai_state_no_credit, ai_state_ok, colophon_rights, credit_spent, credit_state_empty, credit_state_key, credit_state_ok, disc_accept, disc_accepted_on, disc_body, disc_check, disc_decline, disc_declined, disc_lang, disc_legal, disc_title, disc_web, my_dash, my_dash_sub`); for the terms, if they must stay in English for legal reasons, say so on the screen. Add `de` and `fr` dictionaries to `T` in `app.js` and `W` in `report.js`, chosen from `navigator.language`. Add a CI check that fails when a key in `values/strings.xml` is missing from another locale.

### F-13 · Low · Time zone · `worker/src/web.ts:45-50`
**On DST days the 7-day window starts one hour off.** `periodStart` subtracts the wall-clock time since midnight from an instant, which is wrong when the first day of the window has 23 or 25 hours. When that day is 29 Mar 2026 the window starts at 28 Mar 23:00 (a reading from the evening before is counted in the totals and the list, but falls outside the chart); when it is 25 Oct 2026 it starts at 01:00 (readings between 00:00 and 01:00 are missing). Test: `timezone.mjs`.
**Change:** compute the Swiss calendar date first, then find its midnight: e.g. take `Y-M-D` of `now - (days-1)*864e5` in Europe/Zurich, and return the UTC instant for `Y-M-D 00:00` by trying offsets +1 h and +2 h and keeping the one whose Zurich time reads `00:00` (the helper `trueMidnight` in `timezone.mjs` does exactly this).

### F-14 · Low · Web correctness · `worker/public/my/app.js:224`
**"Readings … on 5 of 6 days" before noon.** `spanDays = round((to - from) / day)` where `from` is midnight six days ago and `to` is now, so before 12:00 it says 6 days for a 7-day period (seen in the browser at 04:14 CEST). **Change:** `const spanDays = Math.round((midnight(data.to) - midnight(data.from)) / 864e5) + 1;` (the `midnight()` helper already exists in the file).

### F-15 · Low · Subscription rule · `worker/src/web.ts:86-97`
**Doctor links keep serving readings after the subscription has run out**, while `/my/api/data` and `/my/api/share` return 402 (test SH11). Decide the rule; if links must stop too, check `subOk(row.person_id)` before loading the data and answer 402 `sub_expired` (the page then shows "Link expired").

### F-16 · Low · API hygiene · `worker/src/index.ts:455, 483-489`
**Any unknown address that is not a static file (`/robots.txt`, `/s/short`, `/favicon.ico`) answers 401 "Phone clock is wrong"**, because `handle()` runs for every path and checks `X-Ts` first. Confusing for crawlers and users, and it feeds F-03.
**Change:** at the top of `handle()`, return `fail("Not found", 404, "not_found")` unless `url.pathname.startsWith("/v1/")`; add a `robots.txt` (`Disallow: /my/`, `Disallow: /s/`).

### F-17 · Low · Accessibility · `worker/public/my/app.js:156, 211`, `worker/public/my/style.css`, `index.html`
- The four chart SVGs have no text alternative (no `role="img"`, `aria-label` or `<title>`): screen readers get nothing. Add `role="img"` and an `aria-label` such as "SYS and DIA, daily averages, 22–28 Sep" (the table stays the accessible source of the values).
- The morning/evening balance on screen reuses the PDF sizes: its texts are 7.5–8 px at 390 px — too small to read. Pass a scale factor (e.g. font sizes × 1.6) when drawing it on screen.
- Footer links are 14 px high on the phone (tap target guideline ≥ 44 px): add `padding: 12px 4px; display: inline-block`.
- At 390 px the "All readings" table scrolls sideways inside its card; stack the columns (as the Admin tables already do with `data-l`) or shorten the Date column.

### F-18 · Low · Data model · `worker/schema.sql`
**`schema.sql` does not describe the real database:** the 9 columns added by `build.yml` (`google_sub`, `email`, `sub_*`, `last_seen_at`, `app_version`, `consent_at`, …) and the `idx_persons_google` index are missing, so a database created from the schema alone fails on `/v1/me`. There is no index for `measurements.taken_at` alone (nightly purge scans) or `error_log.last_at` (Admin tab scans and sorts).
**Change:** add the columns to the `CREATE TABLE` statements (keeping `add_col` for old databases), and add `CREATE INDEX IF NOT EXISTS idx_meas_taken ON measurements(taken_at)` and `idx_error_last ON error_log(last_at)`. Consider dropping the `persons.email` and `acceptances.email` columns now that the nightly job keeps them empty (rule: no email in the database).

### F-19 · Low · Data hygiene · `worker/src/index.ts:562-567`
When Google sign-in replaces an empty account on the phone, only the `persons` row is deleted: its `person_keys`, `ledger`, `web_sessions`, `web_codes`, `web_shares` and `acceptances` rows stay orphaned. **Change:** reuse the deletion batch of `DELETE /v1/me` (without the acceptances) for that id.

### F-20 · Low · Web UX · `worker/public/my/app.js:355-378`
"Withdraw all links sent" acts at once, without confirmation, and every tap on Email/WhatsApp creates a new 7-day link (retries leave several live links). **Change:** `if (!confirm(...)) return;` before the DELETE; reuse the link created in the last few minutes for the same period instead of creating a new one.

### F-21 · Low · Android code quality · various
- `Core.kt:313, 322-323` — `ErrorReport.sent` is a plain `Int` updated from several threads; use `AtomicInteger`.
- `MainActivity.kt:570` — `voice!!` inside the save callback can throw if the screen was cancelled in between; capture the triple when the screen is built (`val v = voice ?: return`).
- `Core.kt:114` — `pul != null` is always true there (3 numbers are required), dead branch; `Core.kt:107` default `dia = 0` is never used either.
- `Core.kt:590-603` — the decoded and the rotated bitmap are never recycled (up to ~30 MB for a 12 MP photo); call `bmp.recycle()` / `out.recycle()` after compressing.
- `Billing.kt:124-134` — `handle()` catches only `ApiException`; `acknowledgePurchase` failures are ignored and there is no retry, so a purchase verified by the server but not acknowledged is refunded by Google after 3 days. Check its `BillingResult` and retry on the next `restore()`.

### F-22 · Info
- `errors.ts:286` stores the UTC date as `day`, while everything else is Swiss time; a late-evening error in Zurich is filed under the next day. Consider the Zurich date.
- `web.ts:227` counts expired share links in the per-user "shares" figure; add `AND s.expires_at > ?`.
- `build.yml` contains the Cloudflare account id in clear text; not a secret, but it could be a repository variable.

## 6. Recommended changes, in order

1. **F-01** Move the signing keystore and passwords out of the repository into GitHub secrets, and rotate the key (APK Signature Scheme v3 lineage; Play App Signing for the store).
2. **F-03 + F-09 + F-16** Close the unauthenticated write path into `error_log`: log only authenticated failures (or a fixed place), route names instead of raw paths, digits and a whitelist on `place`, a daily row cap, and 404 for non-`/v1/` paths; treat the issue text as data in the routine.
3. **F-02** Take `fillLocalDates` and `anonymizeGoogle` out of `/v1/me` (nightly job only) or add partial indexes.
4. **F-05** Stop trusting `X-App-Version` for the "newest version" safeguard.
5. **F-04** Add replay protection (store used signatures for 10 minutes).
6. **F-06** Add CSP, `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy`, HSTS.
7. **F-08 + F-07** Settle the "everyone pays their own AI" model in code (remove the owner-paid paths and the family code) and add rate limits on register, share links, readings and log writes.
8. **F-10 + F-11** Android: recover from `unauthorized` to the sign-in screen; bind the Google ID token to the phone key with a nonce.
9. **F-12** Complete DE/FR strings (terms first) and add DE/FR to the Web Dashboard and its PDF; add a CI check for missing keys.
10. **F-13, F-14, F-15** DST-correct `periodStart`, the "of 7 days" counter, and the doctor-link rule after a subscription ends.
11. **F-17 to F-22** Accessibility, schema file, orphan rows, confirmation on withdraw, Android polish.

After each change, rerun the harness (section 2). The failing checks listed above are the acceptance tests for these fixes; per the project rules, changes to flows or rules also need the architecture document, guides and legal pages updated in the same commit.

## 7. Follow-up · what was fixed (28.09.2026, same day)

Backup of the version as tested: branch `backup/as-is-2026-09-28` (= release v0.1.88).

| Finding | Status | How |
|---|---|---|
| F-01 keystore in the repository | **prepared, needs the owner** | `build.gradle.kts` signs with the key from GitHub secrets (`ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_PASSWORD`, `ANDROID_KEY_ALIAS`) when they exist; until then the old key. A new key means one reinstall of the app. |
| F-02 `/v1/me` full scans | fixed | anonymisation and local-date back-fill moved to the nightly job |
| F-03, F-09, F-16 error-log write path | fixed | only authenticated calls or 5xx logged, route names, `place` whitelist, digits removed, 300 new rows a day, 404 outside `/v1/`, Zurich date; routine prompt treats log text as data |
| F-04 replay | fixed | `seen_sigs`: a signed call that changes something works once (reads are not recorded) |
| F-05 newest version from one header | fixed | `APP_VERSION` set by the build |
| F-06 security headers | fixed | CSP, frame DENY, nosniff, no-referrer, HSTS; `robots.txt` |
| F-07 rate limits | fixed | `rate_limits`: sign-up 10/h per IP, Google sign-in 20/h, web session 30/h, share 20/day, log 100/day, Scan and voice 60/day |
| F-08 owner-paid accounts | fixed | every new account pays its own AI |
| F-10 account moved to another phone | fixed | the app goes back to the sign-in screen with a message |
| F-11 Google token bound to the phone key | fixed | nonce = SHA-256 of the phone's public key; required from app version 100 |
| F-12 DE/FR | fixed | app texts complete (the long terms stay in English, as shown on screen), Web Dashboard and PDF in DE/FR; *Docs check* fails on a missing text |
| F-13 DST, F-14 day counter | fixed | calendar arithmetic |
| F-15 doctor link after the subscription ends | fixed | link answers 404 |
| F-17 accessibility | fixed | chart labels, table on phones, bigger footer links, balance text |
| F-18 schema | fixed | `schema.sql` complete, indexes |
| F-19 orphan rows | fixed | replaced accounts lose scans, keys, ledger, web access |
| F-20 withdraw links | fixed | confirmation; the link is reused for 10 minutes |
| F-21 Android polish | fixed | AtomicInteger, bitmaps recycled, purchase acknowledgement checked and logged, `voice` without `!!` |
| F-22 | fixed | Zurich date in the error log, only valid links counted |

Rerun of the harness after the fixes (local Worker): **functional 160/160**, time zones 8/8, **stress 10/10 with
0 errors** in 4,000 concurrent voice saves, browser 60/60, probe 17/17. Two tests were updated to the new rules
(every account self-pays; sign-ups limited per address) and a rate-limit check (RL1) was added. The harness now
runs by itself: *Security tests* workflow (every PR, every night, Sundays in full).
