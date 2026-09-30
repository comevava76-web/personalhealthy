# HINT 365 — shared handover

Last updated: 2026-09-30, Europe/Zurich. Last editor: Codex / OpenAI.

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

**Latest authorized action: establish this shared handover and repository instructions only. No application changes are part of this action.** The user rejected the current lab-import preview flow and described the replacement below. That replacement has NOT been implemented. Wait for a subsequent instruction to implement it; do not restart it merely because the handover is being maintained.

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

## Latest user direction — pending implementation

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
