# HINT 365 · Documents

Every document about HINT 365 lives in this folder and is kept current with every change: a feature added,
changed or removed updates the documents it touches **in the same commit**. Functional and architecture
documents are in English; user-facing documents are in Italian and English.

| Document | Files | Made from | Update when |
|---|---|---|---|
| Functional, architecture, runtime flow and CI/CD (3 pages) | `architecture/architecture.html` → `HINT-Architecture.pdf`, `page-1..3.png` | hand-written HTML, `node docs/architecture/render.cjs` | a flow, technology, rule, table, cost or process changes |
| User guide IT / EN | `guide-it.html`, `guide-en.html` → `HINT-Guida-IT.pdf`, `HINT-Guide-EN.pdf` | hand-written HTML, `node docs/render-guides.cjs` | anything the user sees or does changes (buttons, screens, costs, data) |
| Terms of use, privacy policy, home page | `legal/terms.html`, `legal/privacy.html`, `legal/home.html` | generated from `worker/src/pages.ts`: `cd worker && node scripts/export-docs.mjs` | the site pages change (the terms also change the version the app asks to accept) |
| Demo material | `demo/` (screenshots, sample PDF) | test data only, never real readings | the look of the dashboard or of the PDF changes |
| Mock-ups | `mockups/` | design drafts | kept as history |

Outside this folder, only because the tools need them at the top of the repository: `README.md` (how the
repository is built and set up) and `CLAUDE.md` (the working rules).

## Who does what, and when

| When | Who | What |
|---|---|---|
| A change is decided in the chat | Angelo, architect | decides design, rules, priorities |
| In the same commit as the code | Claude, developer | updates every document above that the change touches, regenerates PDFs and pictures, looks at them |
| On every pull request and push | GitHub Actions, *Docs check* | fails if `legal/` differs from the site code, or if an HTML source changed without its PDF |
| After the merge | GitHub Actions, *Build* | publishes the guide PDFs next to the app, deploys the site whose pages match `legal/` |
| When the APK arrives in the chat | Angelo | reads the documents that changed together with trying the app |
