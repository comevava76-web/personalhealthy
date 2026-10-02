# HINT 365 — shared handover

Last updated: 2026-10-01, Europe/Zurich. Last editor: Claude Code (photo Scan back without AI, terms v20; dashboard opens on the tab you start from).

Canonical path: `Checkpoint/HANDOVER.md`. This file is shared by Codex/ChatGPT, Claude Code, Kimi and any future developer.

## Start here — shared working protocol

This is the single living handover. Read it at the start of every session, including when returning with the same tool the next day. Git stores earlier versions; do not create one file per tool or per session.

Before work:
1. Read this file first for project context and the latest user decisions.
2. Inspect/fetch current Git without discarding local changes. Check the base commit, branch and work already in progress.
3. Read `AGENTS.md`, `CLAUDE.md` and relevant component instructions; compare the requested task with the pending work below.
4. Follow the latest user instruction. Pending ideas are not evidence that implementation was authorized.

Before ending a work session:
1. Refresh the current-state sections below: shipped version, actual changes, open issues, user decisions and the concrete next step.
2. Append a concise entry to the session log at the bottom. Include date/time/timezone, developer/tool, request, changes, base/head or PR/commit references, validation and limits, deployment/release status and remaining work.
3. Commit the handover with the related change. If nothing shipped or work is blocked, record that explicitly; never label a proposal as completed.
4. Tell the user what was committed and where the next developer should resume.

Keep current state concise and replace superseded statements there. Append to the session log; do not rewrite earlier factual entries to conceal history. Link details in PRs/test documents rather than copying raw logs. Do not store secrets or patient data.

When developers work concurrently, use separate branches/worktrees and avoid overlapping scope unless agreed. Re-read the latest shared handover before merging, reconcile both state and log, and preserve every developer's entry. A worktree note is not a global task lock.

**Latest authorized action (Claude Code, 01.10.2026): app reorganisation decided by the user in chat — icon bottom bar (Blood pressure, Lab results, Dashboard ↗, Owner ↗ for the owner only, Admin), the Report tab replaced by the Dashboard icon, Lab results = import + progress bar + upload history by day, web dashboard Blood pressure first like the old app Report, owner area no longer a web tab, terms v18 (data of the account holder only).** Earlier: automatic lab import, duplicate protection and the web table. The security Fix activation is parked in the backlog (issue #107).

## Published baseline

- Repository: https://github.com/comevava76-web/personalhealthy
- API/dashboard: https://personalhealthy-api.comevava76.workers.dev / `/my/`.
- Stack: native Android/Kotlin/Compose; Cloudflare Worker + EU-bound D1; browser dashboard. This project does not use Vercel or Sites.
- Latest published APK: **0.1.100**, version code **100**. User reports that the app loads/imports, but dislikes the import preview.
- Current application `main` commit before this documentation-only checkpoint: `43a5fd307367f4d3b2bb35ff74dc4c3dc5c6b6ad`.
- PR #104: https://github.com/comevava76-web/personalhealthy/pull/104 — local lab import, dashboard, localization, security and signing work. Squash: `8a0a89d580ab81f7a9832412e29e7d2f8fc68aaf`.
- Hosting correction: `b4643a672bdf4fa63b6b164210abe0fd2048fa9e` — host large APKs in GitHub Releases, retain `/HINT.apk` redirect and deployment recovery workflow.
- PR #105: https://github.com/comevava76-web/personalhealthy/pull/105 — laboratory label parsing, qualitative values, report dates, image orientation/formats. Squash: current application commit above.
- Build/release 100: https://github.com/comevava76-web/personalhealthy/actions/runs/36762143684 — quality, signed APK, server deployment and release recording all succeeded. Deployment health returned `{"ok":true}`.
- APK: https://github.com/comevava76-web/personalhealthy/releases/download/v0.1.100/HealthyInstantTracker-0.1.100.apk
- APK SHA-256: `c907a367e64a87abb9e4b28bd94f1c38dcf5a7483344c45f63156780f74edb70` (60,255,419 bytes). A direct attachment was delivered in chat because the user's GitHub download link did not work.
- The user installs APKs directly; no Play Store or iOS release yet. Existing installation was originally **0.1.94**. Updates must install over the existing app, preserving account/data; never instruct uninstall/reinstall.

## What Codex changed

### Android lab reports

Added a separate localized **Lab results / Referti** tab, independent of the existing optional Anthropic blood-pressure camera Scan.

Documents are processed on the phone: PDFBox Android 2.0.27.0 reads embedded PDF text; bundled ML Kit Text Recognition 16.0.1 handles scanned pages/images. No source document, patient heading, source filename or complete extracted text is sent to the backend. Temporary private copies are deleted. Accepted confirmed structured fields are report date, test code, result, unit and reference.

Current file limits: 20 MB; unencrypted PDFs with 1–15 pages. Picker supports PDF, JPEG, PNG, WebP and HEIC/HEIF; the latter depend on device decoding support. Photo EXIF rotation/mirroring is handled. TIFF and Office documents are not supported. Scanned-page processing and OCR are bounded in image size; this is not a universal document reader.

Version 99 initially supported 35 numeric tests. Version 100 expands to 50 recognized test codes, including RDW, RDW-SD, MPV, PSA, urine culture and separate absolute/percentage differential counts. Fixes cover specimen prefixes (`S-`, `Sg-`, etc.), parenthesized acronyms, long laboratory labels, `x10^9/L` units and numeric “Range previsto” references. Original numeric precision, spelling and units are retained.

Bounded qualitative statuses are supported in IT/EN/DE/FR, including positive/negative, present/absent, reactive/non-reactive, detected/not detected and indeterminate. These remain text in dated history/PDF; numeric graphs ignore them. Arbitrary narrative is not supported. Unknown tests and ambiguous duplicates are currently omitted: **this behavior does not satisfy the user's new completeness requirement**.

Explicit report-date labels are parsed and prefilled. Birth dates and request/acceptance dates are not used as substitutes. Conflicting/missing report dates return no inferred date. The present UI still lets the user select/change a date and edit/confirm every extracted row. **The user now rejects this workflow.**

### Server and browser

Added account-isolated lab endpoints: `GET/POST /v1/labs`, `DELETE /v1/labs/:id`. Imports use stable UUIDs for idempotency, validate the entire submitted schema and require consent. Data is stored as lab measurements in D1; documents and raw OCR are not stored there.

The user previously authorized synchronizing structured results for account recovery, web reports and trends. Thus “processed locally” does NOT mean “all results stay only on the phone”: confirmed result fields are uploaded and stored in D1. Keep disclosures accurate.

Added a separate lab dashboard with dated results, references and trends grouped by test AND unit. Qualitative values appear as text. Toolbar uses Share and PDF; CSV was removed. Lab sharing exports the result PDF, without the original file or a blood-pressure bearer share link. App/browser use system language: IT/EN/DE/FR, English fallback. Existing blood-pressure functionality remains.

### Security, accounts and consent

Implemented mandatory Google nonce, token freshness and single-use ID-token checks; canonical-message replay protection; atomic one-time browser codes; session/code revocation on account recovery; explicit owner/admin provisioning rather than making the first public registrant admin; account ownership checks; strict structured lab schemas; bounded request bodies; privacy-safe error logging; account deletion cleanup; subscription validation/access fixes; canonical disclaimer v16 and separate health-data consent.

Personal history/export and account deletion remain accessible when a subscription expires. Existing admin accounts are preserved. Security scan snapshots preserve the last completed findings and mark incomplete/stale scans instead of reporting a false clean state. Deployment is gated on quality checks and signed APK production. These are fixes, not a certification that every risk is eliminated.

### Signing, release and hosting

The previous Android signing key/password were exposed in public Git history. A new private signing key was generated, backed up privately and provisioned through GitHub secrets. Do NOT generate another replacement or expose secrets in the repository/checkpoint.

Public signing lineage plus v2/v3/v3.1 rotation preserves upgrade compatibility. APK 100 verification reported old signer for Android <=32 and new signer for Android >=33. Old SHA-256 certificate: `13ad198ffc9b7c9c7fbd15d3dc6aba921d129b2567d9cf25a6bb58be609ab9d1`. New certificate: `0c95593fabda0b34a091e2827c21060bce9043f530b7d7d5ef43cb63bf63cbeb`. Signing configuration and rotation script are in `android/app/build.gradle.kts`, `android/scripts/sign-rotated.py` and `docs/signing/lineage.bin`.

Existing `ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_PASSWORD`, `ANDROID_KEY_ALIAS` secrets must be retained. Keep full Git history in the release signing job. Do not replace Cloudflare's existing encryption key or recreate the database. The exposed old key is still in history; rotation does not retroactively revoke it on every device. Check Google Android OAuth certificate registration when validating new-account sign-in/recovery; this end-to-end test remains outstanding.

APKs are about 60 MB, exceeding Cloudflare's 25 MB static asset limit. GitHub Releases hosts APK/AAB; `/download` and `/HINT.apk` route to the promoted APK. Server/site/database remain Cloudflare. Build workflow publishes the binary before deployment and has idempotent release handling; `promote-built-apk.yml` can promote an existing verified build.

Documentation was updated: architecture HTML/PDF/previews, IT/EN guides/PDFs, legal exports, synthetic dashboard demos and test notes. A favicon fixed the browser suite's only console 404. `rebuild-lab-docs.yml` was added to render/verify document artifacts through CI when the local Chromium runtime failed.

## What Claude Code changed (2026-09-28–30)

- **Crash fix after release 100**: `t()` in `Core.kt` formatted every text, so the new lab names with a literal "(%)" (`lab_name_*_pct`) threw `UnknownFormatConversionException` (error log: app 100, `Core.kt:72`, 2 events). It now formats only when arguments are passed. The server error log now keeps any `crash:<ExceptionClass>` code instead of hiding a new crash type as `unknown`.
- **Security and vulnerabilities** (already on main before Codex's releases): nightly OSV.dev scan of the full Gradle tree (app and build tools kept apart), Semgrep and gitleaks, results in D1; Admin → Security console with overall status, Fix column and live Open/Fixing/Fixed/Failed states (`docs/security/`). Fix needs the owner's secrets `SECURITY_FIX_TOKEN` and `CLAUDE_CODE_OAUTH_TOKEN` (not set yet). Latest scan: 0 advisories in the app; 58 in Android build tools (AGP 8.5.2, #94, owner decides); Kotlin build-cache advisory Low (#97).

## Evidence and remaining limitations

- Version 99: 168 local functional checks; lab schema/consent/ownership/replay/idempotency/atomic-session checks; 8 timezone checks; Android builds and initial 4 parser tests; full browser suite 60 checks after favicon fix; 8 lab views across four languages at mobile/desktop widths. Synthetic demos only.
- Version 100: 9 Kotlin parser/date regressions passed locally and Android CI passed. Server qualitative validation accepts bounded results/references and rejects arbitrary identity narrative and qualitative results with numeric units.
- The user-supplied two-page PDF was inspected locally. Desktop PDFBox 2.0.27 positional text extraction plus the app parser produced **26 numeric rows + urine culture = 27 results**, all **21 supplied reference intervals**, and the explicitly labeled report date. No patient data/source PDF was committed. This proves this digital-PDF case, not general phone-photo accuracy.
- PR #105 Android, security and documentation checks passed. Main release 100 quality, signing and deployment passed. APK signatures v2/v3/v3.1 and certificate continuity were checked; downloaded attachment matched GitHub's SHA-256 digest.
- Actual phone-photo OCR across varied layouts, full Google recovery with the new certificate, and physical update installation were not independently tested by Codex. User confirms the current app loads/imports.
- Current rule restricts lab report dates/imports to the last 365 days, and history/retention also use report timestamps. The supplied old report can be extracted but cannot be saved with its original date. Do not silently use today's date. **Before a later implementation, distinguish retention since storage from age of the clinical report; do not assume the user wants to discard old reports.**
- The present parser can omit unfamiliar tests, duplicate codes or ambiguous rows; qualitative output is a closed status vocabulary. It cannot guarantee complete extraction from arbitrary reports.
- No generative AI for lab reports has been implemented. The optional existing Anthropic Scan is for blood-pressure display photos.
- Play Store SDK/Billing/native 16 KB readiness and iOS are separate tasks. No legal/security certification is claimed.
- Older test notes include historical “release blocked/not deployed” statements and a 35-test count. This checkpoint and the actual release/commits supersede those historical status statements.

## Automatic lab import — implemented 2026-10-01 (Claude Code), awaiting the user's phone test

User decisions in chat: (1) local reading only, PDF and photos, no other file types; (2) every test saved, also outside the catalog, with its printed name; (3) no duplicates: file fingerprint, and the same test on the same report date is unique; (4) older reports saved with their printed date; lab results are never deleted automatically, only by the user (a date, all, a report, or the account); terms and privacy state at rest / in transit (HTTPS/TLS, signed requests) / on the server, pseudonymized not anonymous, phone under the user's responsibility; (7) one row per test across laboratories (catalog synonyms; normalized printed names), the unit with each value, no conversion; (5) web table: rows = tests (union of all reports), columns = report dates, a dash when missing, no charts, orange ↑/↓ when outside the reference printed on the same report, delete a whole date; (6) import in the background with visible stages (Processing → Scanning → Uploading → saved).

Technical choice (the user accepted the recommendation): local PDF text + ML Kit OCR with a strict whole-document gate, no cloud AI. Details, tests and limits: `docs/testing/lab-import-automatic-2026-10-01.md`. Terms version 17. Remaining: measure the gate on the user's real reports and photos; if too many real reports are refused, consider AI extraction as a separate, explicitly authorized decision (document leaves the phone, consent, cost).

## Previous user direction (Codex handover, now superseded by the section above)

The user explicitly requested:

1. Remove the long per-result import preview/edit/confirmation flow. A report may contain 100 results; importing must not require scrolling through and accepting 100 fields.
2. A batch experience: select/import document → processing/progress → completed and saved → open the usable report dashboard. History/dashboard is where results are browsed, not an import-time form.
3. Read the date from the report. No user date selection or manual data entry.
4. Preserve test names/results, qualitative strings such as negative/positive, units and supplied reference intervals. Do not silently discard rows.
5. If extraction is not sufficiently reliable, save nothing. No guesses, invented dates/ranges or partial writes presented as a complete import. An uncertain batch must fail clearly.
6. Codex/Claude Code must provide a technical recommendation about OCR versus AI; the user supplies the product intent and expects the developer to choose/evaluate the technology.
7. Maintain a shared Markdown tracking file under **`Checkpoint/` on Git** so either developer can pick up the work.
8. **Latest action: maintain the shared handover and its repository instructions only; make no app/backend/UI changes.** Implementation of items 1–6 remains pending a subsequent instruction to proceed.

A later implementation must align consent wording/flags with an automatic validated batch: the current endpoint requires `confirmed:true`, originally meaning explicit user review. Do not simply spoof that flag or remove validation. Ensure atomic storage, stable batch IDs, retry safety and no partial writes. Track processing locally and report errors without documents, names or values in logs. The user must not supply an Anthropic/OpenAI API key to enable this feature.

## Priority for the next session — user feedback, 2026-09-30 21:43 Europe/Zurich

Handoff for the developer engaged next, including tomorrow (2026-10-01). **Record of requested work only: this flow is not implemented yet.**

### Observed state and unresolved reliability

The user reports that lab import now loads the document and reads some results. This is evidence of functioning import, not evidence that OCR is reliable across reports/photos. Assess completeness and extraction accuracy before enabling automatic persistence. The verified digital-PDF example above must not be presented as a general OCR accuracy validation.

### Required interaction after document selection

- Do not display extracted values, a long scrolling preview, per-row edit fields, confirmation checkboxes or a date picker on the import screen.
- Scanning, extraction and uploading the structured batch must run automatically after the user selects the document.
- The date must be the date actually printed on the report and read reliably. No manual date entry/change and no substitution with today's date, date of birth, file date or request date.
- If the date or extraction is uncertain, ambiguous or incomplete, fail the batch clearly and save nothing. Do not compensate for uncertainty by handing an editing form to the user.
- Preserve numeric and qualitative results, units and supplied reference intervals. Do not silently drop unsupported rows and then present a complete-success message.

### Progress and completion presentation

Show a compact, pleasant status area with localized text advancing with the real work, for example:

1. “Elaborazione in corso…” — opening/preparing the local document.
2. “Scansione in corso…” — reading the document and extracting results.
3. “Caricamento dati…” — saving the validated structured batch.
4. “Dati caricati” — only after the backend acknowledges successful persistence.
5. “Dati disponibili nello storico” — provide access to the report dashboard, where the results can actually be browsed.

The user requested paced transitions rather than a static screen or a wall of values, mentioning short pauses. Short minimum display times/animations may smooth transitions, but must not block processing, fabricate progress percentages, or show scanning/saving/completion just because a fixed sleep elapsed. A failure must replace the progress state with a clear failure state, never a success state. Completion means an atomically saved, retry-safe batch, not merely successful text recognition.

Keep report dates, references and textual results available in history/dashboard. Source-document processing remains on the phone; the authorized structured results are persisted in the account database. Preserve IT/EN/DE/FR localization and update-over-existing-APK compatibility.

### Technical decision required before implementation

The developer must assess whether the local PDF/OCR pipeline can satisfy this unattended flow. The user expects a recommendation, not to choose the technology unaided. If the current pipeline cannot meet the reliability/completeness gate, evaluate a semantic/multimodal AI approach against representative labeled documents. Do not equate an OCR recognition score or an AI's claimed confidence with trustworthy field association. No AI implementation or document transfer to a cloud provider is authorized by this documentation update; the existing local-processing constraint still applies.

Next concrete task, when the user authorizes implementation: validate extraction/date/row coverage on varied digital PDFs, scans and photos; select the extraction strategy; then replace the import preview with the automatic batch state machine, atomic save and report-dashboard navigation. Reconcile the old-report/365-day issue without changing the printed report date.

## Technical assessment for the next developer

Recommendation: **do not convert the current regex/catalog parser directly into automatic saving.** Its success on one PDF is insufficient for the proposed unattended flow.

Use embedded PDF text directly when available. OCR is useful for reading visual text from photos/scanned PDFs; it also provides geometry and recognition scores. Those scores measure text recognition, not correctness of a date/test/value/reference association or completeness of a medical table. The current implementation does not calculate or calibrate a batch confidence gate.

For heterogeneous laboratory layouts, evaluate layout-aware extraction and a multimodal AI extractor against the same labeled corpus. AI is a reasonable candidate for understanding varying labels and table structures, but can also misread or invent values. Do not treat an AI's self-reported confidence as proof. Require source-grounded field checks, date disambiguation, table coverage, unit/reference association and whole-batch rejection when uncertain. This is a technical recommendation/inference; no OCR-versus-AI accuracy benchmark has been run here.

The current local-only document-processing requirement remains. A cloud Claude/OpenAI vision call would send document content outside the phone, even if structured values are already synchronized. No such change is authorized. A fully on-device semantic model would need measured accuracy, memory, latency and supported-device tests; do not promise that capability without a prototype. If remote AI is later chosen, explicitly settle document transfer, redaction, consent and provider costs with the user before implementing it. No additional provider has been configured.

Sources checked on 2026-09-30:

- Google ML Kit text recognition: https://developers.google.com/ml-kit/vision/text-recognition/v2
- Android text recognition and geometry/confidence attributes: https://developers.google.com/ml-kit/vision/text-recognition/v2/android
- Claude PDF text/image processing: https://platform.claude.com/docs/en/build-with-claude/pdf-support
- Claude vision accuracy limitations: https://platform.claude.com/docs/en/build-with-claude/vision

## Navigation and working agreement

Primary files: `android/app/src/main/java/ch/personalhealthy/app/Labs.kt`; `android/app/src/test/java/ch/personalhealthy/app/LabsParserTest.kt`; `worker/src/labs.ts`; `worker/src/index.ts`; `worker/src/web.ts`; `worker/public/my/app.js`; `worker/public/my/lab-labels.js`; localized Android `strings.xml`; `.github/workflows/build.yml`.

Read `docs/testing/labs-security-review-2026-09-30.md` and `docs/testing/lab-document-parsing-2026-09-30.md` with the historical-status caveat above. Read `CLAUDE.md` for project conventions, then honor the latest user instruction if it differs. Do not rely on another tool's transient workspace, cached APK or previous authentication state: fetch current Git and verify grants.

For every future checkpoint update record: developer/tool, date, base/head SHA, request, implemented changes, tests and their limits, PR/release/deployment links, and the next action. Append completion evidence to the session log and refresh the current-state sections. Never store credentials, signing-key files, tokens, real patient reports or patient identifiers in `Checkpoint/`.


## Session log — append only

### 2026-09-29–30 — Codex / OpenAI — feature and release work

- Request: take over the existing project, add local lab import/history and localization, harden security, preserve APK update compatibility and publish.
- Completed: PR #104; APK/server 0.1.99; large-APK hosting/deployment correction. Relevant application commits and validation are recorded above.
- Limits: no universal report extraction, phone-photo accuracy benchmark, complete new-certificate Google recovery test or Play/iOS launch.
- Next action at that time: investigate the user's readable PDF that produced no supported rows.

### 2026-09-30 — Codex / OpenAI — readable report correction and release 100

- Base: `b4643a672bdf4fa63b6b164210abe0fd2048fa9e`. Completed application head: `43a5fd307367f4d3b2bb35ff74dc4c3dc5c6b6ad`, PR #105.
- Completed: expanded labels/catalog, qualitative statuses, explicit report-date extraction, camera orientation and image-format handling; docs regenerated. APK 0.1.100 and backend published.
- Validation: 9 Kotlin regressions; local real digital-PDF extraction of 27 results, date and 21 references; PR checks and main release gates passed; signing lineage/digest verified. Evidence/limits above.
- User feedback: app imports, but per-row preview and manual date selection are rejected. User wants an automatic reliable batch and dashboard, with no save when uncertain. This redesign has not shipped.

### 2026-09-30 21:26–21:33 Europe/Zurich — Codex / OpenAI — initial tracking

- Request: stop app changes; create a shared checkpoint for switching developers.
- Completed: `Checkpoint/2026-09-30-HINT365.md`, documentation-only commit `441cb83398bee9c5d994828c2c88d7bb10207593`.
- Validation: remote file content matched the authored brief. No app changes, build or deployment.
- Next step: adopt one canonical living file and repository-wide reading/updating instructions.

### 2026-09-30 21:35 Europe/Zurich — Codex / OpenAI — canonical handover protocol

- Request: make the shared handover the first project-context document to read for Codex/ChatGPT, Claude Code, Kimi and future developers; require updating and committing before handoff.
- Completed in this documentation commit: moved the dated brief to `Checkpoint/HANDOVER.md`; added the startup/closing protocol and append-only session log; added root `AGENTS.md`; linked the protocol first in `CLAUDE.md` and `README.md`. The former path is removed; its history remains in Git.
- Validation: reviewed the document migration and repository pointers; only documentation/instruction files changed. No application build, APK or deployment triggered.
- Next action: read this handover and the next user instruction. Automatic lab batch redesign remains pending; do not claim it is implemented.

### 2026-09-30 21:43 Europe/Zurich — Codex / OpenAI — refined import UX handoff

- Request: record that import reads some results but OCR reliability remains unverified; require a trustworthy report date and a fully automatic batch, with staged progress instead of values/date editing on the upload screen.
- Completed: updated the shared current-state instructions with the detailed user feedback, real progress/completion semantics, failure/no-save requirement and the next developer's technical evaluation task.
- Validation: documentation-only update; no extraction behavior, UI, database, APK or deployment changed. Existing tests are not evidence that the proposed automatic flow is implemented.
- Next action: the developer engaged by the user should start from the priority section above. The implementation remains pending.

### 2026-09-30 evening Europe/Zurich — Claude Code — daily error-log routine, crash fix

- Request: read this handover after Codex's releases 99–100; daily routine (error log, security-test issues, Dependabot).
- Found: new crash in app 100 at `Core.kt:72`, logged as code `unknown` because the server dropped the unlisted exception class.
- Changed: `Core.kt` `t()` formats only with arguments; `worker/src/errors.ts` accepts `crash:<JavaClassName>`; security drawing foot note now records the key rotation of 30.09.
- Validation: local functional and security suite all green; drawing re-rendered, `docs/check-layout.cjs` ok. Android compile and APK by CI (*Android build check*, *Build*).
- Not touched: lab import redesign (still pending, not authorized), signing keys, database.
- Next: owner tries the new APK and opens a lab report with percentage rows (neutrophils, lymphocytes…); owner decisions on #94 (AGP), #98 (Kotlin 2.4.20) and the Fix secrets.

### 2026-10-01 Europe/Zurich — Claude Code — automatic lab import, duplicates, web table

- Request (user, chat): focus on lab report upload, saving to the database and the web report; park the security Fix activation (issue #107). Decisions listed in "Automatic lab import — implemented".
- Changed: `LabsParser.kt` (new, plain Kotlin), `Labs.kt` (background `LabImport`, stages, no preview), strings IT/EN/DE/FR, `worker/src/labs.ts` (auto imports, custom names, `saveLab`, `deleteLabs`, HMAC file key), `lab_files` table, no automatic purge of lab results, delete a date or all on the web, `/my/api/labs` DELETE, web matrix + PDF, terms v17 + privacy, `worker/scripts/sync-notice.mjs` (+ Docs check), architecture, guides, demo, CLAUDE.md rules.
- Validation: 15 parser tests on a plain JVM; functional suite, `labs-security.mjs`, `labs-ui.mjs` (8 views) green locally; Android compile and APK by CI.
- Not done / limits: no measurement on real reports or phone photos yet; no AI extraction.
- Next: the user installs the new APK over the existing one, accepts terms v17, imports a real PDF and a photo, and checks the web table.

### 2026-10-01 Europe/Zurich — Claude Code — Observability page and tracing

- Request (user, chat): trace everything that happens in the lab import so failures can be analysed; the nightly routine fixes sure bugs without asking; an Admin (web) Observability page with vulnerabilities, EU/Swiss compliance and problems with their resolutions.
- Changed: `event_log` table and `countEvent` (lab import outcomes and deletions, codes only, 90 days); `/my/api/admin/observability`; registries `worker/src/ops/compliance.json` (19 controls) and `worker/src/ops/problems.json` (P-001 crash fixed in 0.1.101, P-002 no action); Admin → Observability page; `docs/operations/observability.md`; CLAUDE.md rule; nightly routine prompt updated.
- Validation: functional suite 172 checks (OB1–OB3 new), `labs-security.mjs` (every outcome counted, codes only), browser view at 1280 and 390 px without errors.
- Next: the user tests 0.1.102 (lab import) and then the app reorganisation discussion.

### 2026-10-01 06:48 Europe/Zurich — Claude Code — nightly routine

- Error log (last 24 h): only known problems from app 0.1.100 before the fixes (P-001 crash, P-003 terms after v17); no lab import yet (event_log empty).
- Found: the scheduled *Security tests* run of 30.09 failed at "Resolve the Android dependency tree": the release-signing guard matched `--configuration releaseRuntimeClasspath`. Fixed (P-004): the guard applies only to tasks that build a release package; checked with a unit test of the rule; `assembleRelease bundleRelease` in *Build* still require the key.
- Next: the user installs 0.1.104 from /download (served by the Worker since PR #110) and tries a lab import.


### 2026-10-01 Europe/Zurich — Claude Code — app reorganisation, terms v18

- Request (user, chat): Report tab becomes a button to the Web Dashboard (landing on Blood pressure, then Lab results); the web Blood pressure tab must show what the app Report showed (chart, eight tiles, morning/evening balance); no Admin tab on the web, the owner reaches it with a separate button in the app; Lab results in the app: import, a nicer progress bar, then an upload history grouped by day with the outcome only (no drill-down); icons in the bottom bar with a small name under each, clear for older people; terms: data must belong to the account holder, no pop-up.
- Changed: `Tab` enum with icons (`ic_tab_*` vector drawables, duotone) and web entries (Dashboard, Owner = `#c=…&admin`); `HomeScreen` gets Send PDF / Send Excel / Web Dashboard at the bottom (nothing removed); `ReportScreen` removed; `Labs.kt`: `LabLog` (uploads that saved nothing, on the phone only: outcome code + report date, 60 entries), `ImportProgress` with a progress bar and three steps, auto-hide after the outcome, `UploadRow`, delete with confirmation; `/v1/labs` now returns `c` (upload time); web: modules ordered bp → labs, owner area only via `#admin`, eight tiles like the app, separate morning/evening charts and the nine-tile grid replaced; terms v18 (`NOTICE_VERSION`, `DISCLAIMER_VERSION` app and server) — one account = one person; guides IT/EN, architecture, privacy wording, demo screenshots.
- Validation: functional suite (all groups pass), `labs-security.mjs`, `labs-ui.mjs`, local probe 17/17, layout check; web checked at 1280 and 390 px. The Android code is compiled only by CI (no SDK in the session).
- User decisions after the PR went up: (1) remove the AI Scan entirely (button, Attiva AI, credit/key UI, stored keys, costs and AI readings; terms v19 without Anthropic) — to do in a separate PR after #116; (2) phone without screen lock: a non-blocking orange notice on Blood pressure that opens the security settings, responsibility stays with the user (done in #116).
- Next: the user installs the new APK from /download, accepts terms v18 and tries the bottom bar and a lab import.

### 2026-10-01 Europe/Zurich — Claude Code — AI Scan removed, terms v19

- Request (user, chat): yes to removing the photo Scan with Anthropic ("1 sì") and to the screen-lock notice (shipped in #116, APK 0.1.109).
- Changed: app — Scan button, camera flow, ScanScreen, KeyScreen (Friends.kt deleted), credit/key sections and dialogs, AI badge and warnings removed; one full-width "Record a reading" button; costs table shows only the app. Server — `/v1/bp/scan`, `/v1/bp/confirm`, `/v1/key`, `/v1/key/check`, `/v1/credit*`, `/v1/admin/credit` answer 410 `ai_removed`; `/v1/me` without AI or credit fields; Anthropic code, key sealing and credit pools removed; the nightly purge empties `scans`, `ledger`, `person_keys`; the deploy no longer sends `ANTHROPIC_API_KEY` and deletes it from the Worker. Owner area — totals: users, readings, lab reports, errors. Terms v19 (no Anthropic), privacy and home, CLAUDE.md cost rule, compliance C06/C08, gdpr.md, guides IT/EN, architecture pages 1–5.
- Validation: functional suite (S1–S10 removal checks, PU4 purge), labs-security, probe 17/17, layout check. Android compiles on CI only.
- Owner to do: delete the GitHub secret `ANTHROPIC_API_KEY` (no longer used); readings saved earlier with Scan stay (source `photo`).

### 2026-10-01 Europe/Zurich — Claude Code — PDF download, "full reports", browser fix

- Request (user, chat, after 0.1.110): keep a camera Scan of the monitor but without AI, accurate, tested on at least 400 photos, saying "photo not clear, retake" (design pending: questions asked in chat); remove Excel from the app, only "Download PDF"; rename the dashboard button "Go to your full reports"; the bottom Dashboard icon downloaded something instead of opening the dashboard.
- Changed: Blood pressure tab — one "Download PDF" button (MediaStore Downloads, then opens the viewer; Android 9 and older: share sheet), Excel removed from the app; "Go to your full reports" button; bottom icon renamed Reports; every dashboard link opens in the browser (`openInBrowser`), problem P-005 (the 0.1.111 selector dropped the address: fixed in 0.1.112, P-006); guides, architecture, web sign-in text.
- Next: the on-device, AI-free monitor reader, after the user's answers on the photo test set.

### 2026-10-01 — Claude Code — 0.1.112: dashboard links fixed (P-006); Scan without AI in progress

- Request: in 0.1.111 the Reports and Owner icons and «Vai ai tuoi report completi» opened nothing useful.
- Cause: the P-005 fix started the browser with a selector intent (`makeMainSelectorActivity`), which opens the browser's start page and drops the address.
- Change: `openInBrowser` (Report.kt) sends the address to the browser itself (default browser, else Chrome, else the first one; manifest `<queries>` for browsers); failures go to the error log as `Web/browser`. `problems.json` P-006.
- Scan without AI, work in progress, NOT in main: `MonitorReader.kt` and `MonitorReaderTest.kt` are in commit `5f8713e` (PR #121 history; taken out before merge because the Android unit-test classpath has no java.awt, which the photo generator needs: it must move to a plain JVM test module). Status: 0 wrong values; 171 of 262 easy generated photos read (aim 90%); 0 of 6 real photos read. Next: real photos of the owner's monitor (Paramed Expert-X) with their values, then camera flow, confirm screen, POST /v1/bp/photo, terms v20.
- Validation: no local Android SDK; compile and unit tests run in CI.

### 2026-10-01 — Claude Code — photo Scan without AI (terms v20); dashboard opens on the right tab

- Requests (Human): put the photo Scan back, without AI, tested, saying "retake" when the photo is not clear; the Web Dashboard must open on the tab the person starts from.
- Scan: `android/reader` (plain Kotlin module: `MonitorReader.kt` + `MonitorReaderTest.kt`, 400 generated photos, run in CI through `testDebugUnitTest`; 0 wrong values required); `MonitorScan.kt` (photo load/EXIF, MonitorReader, then bundled ML Kit with the same layout rule); `PhotoScreen` in MainActivity: photo + numbers, «Sì, sono giusti: salva» / «I numeri sono sbagliati: rifai la foto», retake with the reason (dark, glare, blurry, not found, unclear, implausible) and "say it aloud". Server: `POST /v1/bp/photo` (same validation as voice, source `photo`), `POST /v1/bp/photo/outcome` (codes `bp_photo_*` in `event_log`). Functional tests P1–P8 pass locally.
- Measured reader quality: generated photos 0 wrong, about 65% of the easy ones read by MonitorReader alone; real photos (6 available) 0 read by MonitorReader alone; ML Kit fallback is untested off-device. The confirmation screen is the safety net. Next: real photos of the owner's monitor (Paramed Expert-X) with values; watch `bp_photo_*` counts in Observability.
- Dashboard: the app adds `&bp` / `&labs` (`&admin` for the owner) and `app.js` opens that tab.
- Terms v20 (IT/EN/DE/FR, synced to the app), privacy/home, compliance.json + dossier + gdpr.md (record of processing), guides IT/EN, architecture pages 1, 2, 6, CLAUDE.md rule.

### 2026-10-01 — Claude Code — names in the bottom bar; Admin console without module tabs

- Request (Human): the owner's web button is now **Admin** (last in the bar); the in-app account tab (Google, readings, sign out, delete account, costs, terms) is now **Gestore** (EN Manage, DE Verwalten, FR Gérer); the web Admin console hides the Blood pressure / Lab results tabs: numbers only.
- Files: MainActivity.kt (Tab order), strings ×4, worker/public/my/app.js, guides IT/EN, architecture page 6, CLAUDE.md.
- Also (Human): opened from the app with `&bp` or `&labs`, the dashboard shows only that page (module tabs hidden).

### 2026-10-01 — Claude Code — app simplified (no Report menu), Admin console with four numbers, colophon; test lab reports

- Requests (Human): app button «Voce» (was «Registra una misura»), no browser explanation text, no Report menu (the full reports open from the button at the end of Pressione and Referti); Referti history shows saved reports only (refused/duplicate uploads stay in `error_log`/`event_log`); Gestore without costs, with counts of readings and lab reports and the Google identity; web colophon redone (also /, /terms, /privacy); Admin console: four numbers only (open vulnerabilities in app code vs Android/iOS libraries, open defects, compliance not fully covered), the Observability button with a halo, the version block; the Security card removed; Observability problems tab shows open defects only.
- Server: `/my/api/admin/observability` adds `openByPlace` (code vs mobile).
- Test data in production, asked by Human on his own test account (owner): six fake lab reports with ids `lab_demo-1`…`lab_demo-6` (lab_demo-6 dated 20.11.2023 inserted last, to show the date order). Delete them with `DELETE FROM measurements WHERE id LIKE 'lab_demo-%'` when no longer needed.
- Docs: guides IT/EN, architecture, CLAUDE.md, docs/legal, demo screenshots (test data).

### 2026-10-01 — Claude Code — light theme (app + web, one palette); listening doctor; button labels on one line

- Requests (Human): a light theme with matching colours, the same tones in app and web; the voice button must not wrap; a friendly doctor with a stethoscope while the app listens.
- App: `object C` returns dark or light values (`C.light`), `ThemeChoice` in Gestore («Aspetto»: as the phone / light / dark, kept on the phone), status and navigation bars follow; screen charts read the theme; `BigButton` labels on one line; `DoctorListening` (Listen.kt, drawn in Compose).
- Web: style.css variables for both themes (dark values now identical to the app: bg #0F1D38, panel #172B50…), light via `&light`/`&dark` from the app or the device setting; charts read the CSS variables; public pages follow the device setting.
- The 0.1.115 build (PR #124) is online.


### 2026-10-01 — Claude Code — colourful PDFs (blood pressure in app + web, lab results on the web), never red

- Request (Human): the PDF headers looked dull; make the blood-pressure PDF colourful and give the lab PDF lively colours and a well-designed table. Only the colours of an old version were the reference, not its layout of numbers. Never red.
- Blood pressure (`Report.kt` `buildPdf` and `report.js`, identical): violet→teal header band with a SYS/DIA/PUL three-colour line, white chart cards with a light shade under each line and coloured legend dots, value boxes tinted with their measure's colour (numbers in that colour), readings table with a gradient header row and lavender alternate rows.
- Lab results (`labsPdf` in `app.js`, web only): teal→indigo band, table with a gradient header row, alternate row tints, column lines, a frame per block, at most five dates per block split evenly; out-of-range values orange with a small triangle on a pale orange cell; footer with disclaimer and page numbers on every page.
- Tests: both PDFs generated from a local Worker with test data only (`docs/demo/report-dal-web.pdf`, `docs/demo/lab-results.pdf`), checked page by page. The app's PDF is checked by the APK build in CI; Human checks it on the phone.
- Next: Human checks the PDFs on the phone; MonitorReader still waits for real photos of the monitor.

### 2026-10-02 — Claude Code — Gestore redone, dark theme by default, lab history collapsed

- Requests (Human, on 0.1.116): the Gestore page looked rough («Come il tele…» cut, «Identity» in English, giant buttons); the default theme must be dark (light only if chosen); the list of uploaded lab reports must not push the Web Dashboard button down.
- App: Gestore in tidy cards — two coloured counters (readings, lab reports) with «Gestisci misure» as a row; «Aspetto» as a two-way switch Scuro/Chiaro with icons (dark is the default, an old «as the phone» choice becomes dark); «Account» card with Google, sign out and delete account as rows; «Condividi l'app» as a row. New icons ic_list/ic_moon/ic_sun/ic_person/ic_logout/ic_delete/ic_share. Referti: the saved reports sit closed under one line with their number; a tap opens the list by day.
- Web: the dashboard opens dark unless the app passes `&light` (no device fallback any more).
- Guides IT/EN (+PDF) and CLAUDE.md updated. Kotlin compiled by the APK job in CI (no Android SDK in this session).
- Next: after the release, a UI/graphics review of the app code (asked by Human); then stop for now.

### 2026-10-02 — Claude Code — 0.1.117 online; UI review; Observability without the lab-import table

- 0.1.117 (PR #127) is online. A UI/graphics review of the app code was done (read only) and its findings were given to Human in chat; none applied yet, Human decides which. Main ones: SYS/DIA/PUL labels missing in the readings list, low contrast of small teal/amber numbers in the light theme and of white on violet buttons in the dark theme, DE/FR button labels cut, «Durchschnitt» cut.
- Human asked to remove «Caricamento referti · ultimi 30 giorni» from the web Observability page: removed (the server still counts the outcomes in `event_log`; they stay in the log). CLAUDE.md and architecture row 11 updated.
- Build 118 (PR #128): the Worker deployed, but the `/download` check 5 s after the deploy still got 0.1.117 and failed the job (release 0.1.118 not recorded). Fixed in build.yml: retry every 10 s for up to 2 minutes (P-007). The next build is 0.1.119 (same app as 0.1.117).

### 2026-10-02 — Claude Code — daily check (error log, security, patching)

- Error log last 24 h: nothing; event log only normal outcomes. Issue #119 (30.09–01.10): Core.kt:72 crash = P-001, fixed in 0.1.101; `bad_version` = app 0.1.100 below the minimum version (expected) → closed.
- Security: Bouncy Castle 1.72 inside the app via pdfbox-android (12 advisories, 2 Critical; owner's Fix request #126; the automatic Security fix run stopped at the AI step). Fixed with a Gradle constraint to 1.86 (P-008, vulnerability-management.md §8). Build-tool findings (#112) unchanged: they follow the Android Gradle plugin update (#94, Human decides).
- Dependabot: zxing 3.5.4 (patch) taken in this PR (#93). Not merged: coroutines 1.11 (#96, needs Kotlin 2) and exifinterface 1.4.2 (#95, needs compileSdk 35): they wait for the Kotlin 2 / AGP 9 / SDK 35 step (#94, #98, Human). Majors #89–#92, #94, #98, #120 proposed, not merged.
