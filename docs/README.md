# HINT 365 · Documents

Every document about HINT 365 lives in this folder and is kept current with every change: a feature added,
changed or removed updates the documents it touches **in the same commit**. Functional and architecture
documents are in English; user-facing documents are in Italian and English.

| Document | Files | Made from | Update when |
|---|---|---|---|
| **The general document, in plain words**: purpose (not a medical device), who does what, flows, technologies, keys, call sequence, compliance, automatic jobs, logs, defect, vulnerability, patch, change and release management, costs and free limits, how to pick the work up again | `overview/overview.html` → `HINT365-How-it-works.pdf` | hand-written HTML, `node docs/overview/render.cjs` | anything above changes: a process, a job, a key, a price, a provider |
| Functional overview, voice and camera input, architecture, hosting and runtime flow, roles and delivery, application flows and permissions, database, release and deployment, runtime flow (10 pages) | `architecture/architecture.html` → `HINT-Architecture.pdf`, `page-1..10.png` | hand-written HTML, `node docs/architecture/render.cjs` | a flow, technology, rule, table, cost or process changes |
| User guide IT / EN | `guide-it.html`, `guide-en.html` → `HINT-Guida-IT.pdf`, `HINT-Guide-EN.pdf` | hand-written HTML, `node docs/render-guides.cjs` | anything the user sees or does changes (buttons, screens, costs, data) |
| Terms of use, privacy policy, home page | `legal/terms.html`, `legal/privacy.html`, `legal/home.html` → `legal/HINT365-Terms.pdf`, `legal/HINT365-Privacy.pdf` | generated from `worker/src/pages.ts`: `cd worker && node scripts/export-docs.mjs`, then `node docs/legal/render.cjs` | the site pages change (the terms also change the version the app asks to accept) |
| Test reports and security tests | `testing/test-report-<date>.md`; harness in `testing/harness/` (functional and security suite, time zones, load, browser on a local Worker; `prod-probe.mjs` read-only on the live site) | review runs; *Security tests* workflow | after each review; a failed check becomes a fix |
| Vulnerability check and patching | `security/vulnerability-management.md`, decisions in `security/decisions.json`, process drawing (swimlanes) `security/vulnerability-flow.html` → `.pdf`, `.png` (what is scanned, severity and deadlines, how each kind of fix is made, blocking old app versions, who decides, findings on record) | hand-written | a scan, a tool, a deadline or a role changes; every accepted risk |
| GDPR and Swiss FADP | `compliance/gdpr.md` (applicability, roles, gaps, record of processing); controls shown in Admin → Observability from `worker/src/ops/compliance.json` | hand-written | data, providers, retention or consent change |
| Observability | `operations/observability.md`; compliance dossier `compliance/dossier.html` → `compliance/HINT365-Compliance.pdf` (served at `/my/HINT365-Compliance.pdf#C01…`); problem registry `worker/src/ops/problems.json` (cause, fix, PR, version of every real problem) | hand-written; error and event logs in D1 | every fix of a problem met by users; every compliance change |
| The address of the service: today the free `personalhealthy-api.hint365.workers.dev` (not definitive), the steps to the owner's own domain (GoDaddy, DNS on Cloudflare, new app build, old version invalidated) | `operations/domain.md` | hand-written | the subdomain or the domain changes |
| Disaster recovery: the backups and how far back they go, RPO/RTO on the Cloudflare plan in use, every manual step, the monthly drill | `operations/disaster-recovery.md`; general document section 8; Infrastructure as Code in `../DR/` (`infrastructure-as-code/infrastructure.json`, `rebuild.sh`), workflows *Database backup* and *Disaster recovery* | hand-written | a resource, a backup, a secret, a provider or a Cloudflare plan changes; after every drill that fails |
| Owner costs and earnings of the AI features (trial exposure, one subscriber, 200 people) | `business/owner-economics.md` → `business/HINT365-Owner-Economics.pdf` | hand-written Markdown, `node docs/business/render.cjs` | a price, a limit, the trial, the AI model or a provider price changes |
| Demo material | `demo/` (screenshots, sample PDF) | test data only: `testing/harness/demo-shots.mjs` | the look of the dashboard or of the PDF changes |
| Mock-ups | `mockups/` | design drafts | kept as history |

Outside this folder, only because the tools need them at the top of the repository: `README.md` (how the
repository is built and set up), `CLAUDE.md` (the working rules) and `DR/` (disaster recovery: the Infrastructure as Code and where the backups are; the backups themselves are never in Git).

## Who does what, and when

| When | Who | What |
|---|---|---|
| A change is decided in the chat | Human, architect | decides design, rules, priorities |
| In the same commit as the code | Claude, developer | updates every document above that the change touches, regenerates PDFs and pictures, looks at them |
| On every pull request and push | GitHub Actions, *Docs check* | fails if `legal/` differs from the site code, if an HTML source changed without its PDF, if an app text is missing in IT/DE/FR, or if a text overflows its box or a page (`node docs/check-layout.cjs`) |
| On every pull request to the server, and every night | GitHub Actions, *Security tests* | functional and security suite, time zones; nightly also the live-site probe and the vulnerability scan of every library (OSV.dev, `testing/harness/vuln-scan.mjs`); Sundays load and browser |
| When the owner presses Fix in Admin → Security | GitHub Actions, *Security fix* (Claude Code on the owner's plan) | fixes the chosen findings by the process; each row goes Open → Fixing → Fixed or Failed, live in the console |
| Every Monday | GitHub *Dependabot* (`.github/dependabot.yml`) | a pull request for each outdated or vulnerable library (Android, server tools, actions) |
| On every pull request to the app | GitHub Actions, *Android build check* | the APK must compile (also every Dependabot update) before the merge |
| After the merge | GitHub Actions, *Build* | publishes the guide PDFs next to the app, deploys the site whose pages match `legal/` |
| When the APK arrives in the chat | Human | reads the documents that changed together with trying the app |

## Continuous improvement loop

Every Monday night: *Security tests* (02:10 Zurich, when the app is used least) open or update an issue labelled `security-test` when a check fails;
*Error log report* (GitHub Actions, 06:30 Zurich) opens an issue labelled `error-log` when the D1
error log has rows in the last 24 hours; the developer's scheduled routine (06:48 Zurich) reads both, fixes small bugs
through pull requests (documents included), merges after *Docs check*, and reports in the issue. Larger changes wait
for the human. Drawn on page 8 of the architecture document.

## 2026-09-30: local lab import and security hardening

- `testing/labs-security-review-2026-09-30.md`: implementation, synthetic verification and release blockers.
- `testing/harness/labs-security.mjs`: consent, schema minimization, isolation, replay, atomic sessions and history regressions.
- `testing/harness/labs-ui.mjs`: lab history, localized names and PDF at mobile/desktop widths.
- Canonical terms version 16: `worker/src/notices.ts`; public pages generated in `legal/`.
- `demo/labs-it-mobile.png`, `demo/labs-en-desktop.png`, `demo/lab-results.pdf`: localized synthetic lab history and export, regenerated before release.
- Dashboard demo images and PDF refreshed for the Share/PDF toolbar; public favicon added to eliminate a browser resource error.

APK binaries are kept in GitHub Releases. Because the repository is private, `/download` serves the APK from the Worker: the build splits it into parts under Cloudflare's 25 MiB file limit (`public/dl/`, never committed) and the Worker joins them; without the parts it falls back to the release. `promote-built-apk.yml` supports retrying deployment with an already verified APK after database migration has completed.

## 2026-09-30: laboratory document parsing correction

- `testing/lab-document-parsing-2026-09-30.md`: digital PDF reproduction, test labels, numeric catalog and image-format limitations.
- Source PDFs and patient data are never committed as test fixtures.

## 2026-10-01: automatic lab report import

- `testing/lab-import-automatic-2026-10-01.md`: decisions, reading rules, duplicates, retention from upload, web table, tests and limits.
- Terms version 17; `worker/scripts/sync-notice.mjs` keeps the app's terms text identical to the server's (checked by *Docs check*).
- `demo/labs-it-mobile.png`, `demo/labs-en-desktop.png`, `demo/lab-results.pdf`: synthetic lab table and PDF.
