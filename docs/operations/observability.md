# HINT 365 · Observability

Owner only: Web Dashboard → Admin → **Observability**. Codes and counts only: never a reading, a lab value, a report
date, a name or a person id (test OB2).

| Section | What it shows | Where it comes from | Who updates it |
|---|---|---|---|
| Vulnerabilities | open findings by risk; link to the Security console | nightly scan → D1 `security_findings` (see `docs/security/vulnerability-management.md`) | CI every night |
| Compliance EU and Switzerland | one row per control (GDPR, Swiss FADP, ePrivacy, MDR boundary): status Compliant / Partial / Open, evidence, next step, document | `worker/src/ops/compliance.json`, from `docs/compliance/gdpr.md` | the developer, in the same PR as any change to data, providers, retention, security or terms |
| Problems and resolutions | every error met by users in the last 90 days (error log), matched to the problem registry: status Open / Fixing / Fixed / No action, cause, fix, pull request, version | D1 `error_log` + `worker/src/ops/problems.json` | the nightly routine: a new error becomes an entry; the fix PR records cause, fix, PR and version |
| Lab report import | outcomes of the last 30 days: saved, already imported (file / same values), conflict, refused, deletions; reasons for refusals on the phone | D1 `event_log` (server outcomes, 90 days) + `error_log` (`lab_*` codes sent by the app) | automatic |

Statuses are always in English. The registries live in git so every change is reviewed and traceable; the Worker
bundles them at each deployment.

## Nightly routine (06:48 Zurich)

Reads the error log, the event log, the security issues and Dependabot PRs. A bug it can confirm in the code is fixed
without asking the owner: a `claude/` branch with the documents it touches, the problem entry in `problems.json`
(cause, fix, PR, version), the harness, merge after the checks, the new APK. Larger or unclear changes, terms,
accepted risks and blocking app versions are proposed to the owner. The owner gets two or three lines in the chat.
