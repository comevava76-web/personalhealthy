# HINT 365 · Documents

Every document about HINT 365 lives in this folder and is kept current with every change: a feature added,
changed or removed updates the documents it touches **in the same commit**. Functional and architecture
documents are in English; user-facing documents are in Italian and English.

| Document | Files | Made from | Update when |
|---|---|---|---|
| Functional overview, voice and camera input, architecture, hosting and runtime flow, roles and delivery, application flows and permissions (6 pages) | `architecture/architecture.html` → `HINT-Architecture.pdf`, `page-1..6.png` | hand-written HTML, `node docs/architecture/render.cjs` | a flow, technology, rule, table, cost or process changes |
| User guide IT / EN | `guide-it.html`, `guide-en.html` → `HINT-Guida-IT.pdf`, `HINT-Guide-EN.pdf` | hand-written HTML, `node docs/render-guides.cjs` | anything the user sees or does changes (buttons, screens, costs, data) |
| Terms of use, privacy policy, home page | `legal/terms.html`, `legal/privacy.html`, `legal/home.html` | generated from `worker/src/pages.ts`: `cd worker && node scripts/export-docs.mjs` | the site pages change (the terms also change the version the app asks to accept) |
| Test reports and security tests | `testing/test-report-<date>.md`; harness in `testing/harness/` (functional and security suite, time zones, load, browser on a local Worker; `prod-probe.mjs` read-only on the live site) | review runs; *Security tests* workflow | after each review; a failed check becomes a fix |
| Vulnerability check and patching | `security/vulnerability-management.md` (what is scanned, severity and deadlines, how each kind of fix is made, blocking old app versions, who decides, findings on record) | hand-written | a scan, a tool, a deadline or a role changes; every accepted risk |
| GDPR and Swiss FADP | `compliance/gdpr.md` (applicability, roles, gaps, record of processing) | hand-written | data, providers, retention or consent change |
| Demo material | `demo/` (screenshots, sample PDF) | test data only: `testing/harness/demo-shots.mjs` | the look of the dashboard or of the PDF changes |
| Mock-ups | `mockups/` | design drafts | kept as history |

Outside this folder, only because the tools need them at the top of the repository: `README.md` (how the
repository is built and set up) and `CLAUDE.md` (the working rules).

## Who does what, and when

| When | Who | What |
|---|---|---|
| A change is decided in the chat | Human, architect | decides design, rules, priorities |
| In the same commit as the code | Claude, developer | updates every document above that the change touches, regenerates PDFs and pictures, looks at them |
| On every pull request and push | GitHub Actions, *Docs check* | fails if `legal/` differs from the site code, if an HTML source changed without its PDF, if an app text is missing in IT/DE/FR, or if a text overflows its box or a page (`node docs/check-layout.cjs`) |
| On every pull request to the server, and every night | GitHub Actions, *Security tests* | functional and security suite, time zones; nightly also the live-site probe and the vulnerability scan of every library (OSV.dev, `testing/harness/vuln-scan.mjs`); Sundays load and browser |
| Every Monday | GitHub *Dependabot* (`.github/dependabot.yml`) | a pull request for each outdated or vulnerable library (Android, server tools, actions) |
| On every pull request to the app | GitHub Actions, *Android build check* | the APK must compile (also every Dependabot update) before the merge |
| After the merge | GitHub Actions, *Build* | publishes the guide PDFs next to the app, deploys the site whose pages match `legal/` |
| When the APK arrives in the chat | Human | reads the documents that changed together with trying the app |

## Continuous improvement loop

Every morning: *Security tests* (06:10 Zurich) open or update an issue labelled `security-test` when a check fails;
*Error log report* (GitHub Actions, 06:30 Zurich) opens an issue labelled `error-log` when the D1
error log has rows in the last 24 hours; the developer's scheduled routine (06:48 Zurich) reads both, fixes small bugs
through pull requests (documents included), merges after *Docs check*, and reports in the issue. Larger changes wait
for the human. Drawn on page 5 of the architecture document.
