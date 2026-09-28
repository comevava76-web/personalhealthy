// HINT 365: puts the results of the nightly security scans into D1, for the owner's Security console (Admin → Security).
// Reads from the folder given as argument: vulns.json (vuln-scan.mjs), semgrep.json (Semgrep), gitleaks.json (gitleaks).
// Writes table security_findings (replaced at every run) and settings.security_scan (summary).
// Never stores a secret: gitleaks runs with --redact and only the rule, file, line and commit are kept.
// Needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID (GitHub secrets); runs only in GitHub Actions.
import fs from "node:fs";
import path from "node:path";

const DIR = process.argv[2] || ".";
const { CLOUDFLARE_API_TOKEN: TOKEN, CLOUDFLARE_ACCOUNT_ID: ACCOUNT, GITHUB_REPOSITORY: REPO = "comevava76-web/personalhealthy",
  GITHUB_SHA: SHA = "main", RUN_URL = "" } = process.env;
if (!TOKEN || !ACCOUNT) { console.error("Cloudflare credentials missing"); process.exit(2); }
const load = (f) => { try { return JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")); } catch { return null; } };
const blob = (file, line, ref = SHA) => `https://github.com/${REPO}/blob/${ref}/${file}${line ? "#L" + line : ""}`;
const cut = (s, n) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

let decisions = {};
try { decisions = JSON.parse(fs.readFileSync(new URL("../../security/decisions.json", import.meta.url), "utf8")); } catch {}
const rows = [];
const v = load("vulns.json");
for (const f of v?.findings || [])
  rows.push({ kind: "library", ref: f.id, name: f.name, version: f.version, location: f.where, severity: f.severity, rating: f.rating,
    fixed: f.fixed, summary: f.summary, source_url: f.source, plan_url: f.plan });
const sg = load("semgrep.json");
for (const r of sg?.results || []) {
  const sev = String(r.extra?.severity || "INFO").toUpperCase();
  const ref = cut(String(r.check_id).split(".").pop(), 80), dec = decisions[`${ref}@${r.path}`] || {};
  rows.push({ kind: "code", ref, name: r.path, version: String(r.start?.line || ""),
    location: `${r.path}:${r.start?.line || ""}`, severity: sev === "ERROR" ? "HIGH" : sev === "WARNING" ? "MODERATE" : "LOW", rating: dec.rating || "",
    fixed: "", summary: cut(dec.note || r.extra?.message, 200), source_url: blob(r.path, r.start?.line),
    plan_url: dec.plan || `https://semgrep.dev/r?q=${encodeURIComponent(r.check_id)}` });
}
const gl = load("gitleaks.json");
for (const s of Array.isArray(gl) ? gl : [])
  rows.push({ kind: "secret", ref: cut(s.RuleID, 80), name: s.File, version: cut(s.Commit, 7), location: `${s.File}:${s.StartLine}`,
    severity: "HIGH", rating: "", fixed: "", summary: "a secret is written in the repository (value not stored)",
    source_url: blob(s.File, s.StartLine, s.Commit || SHA), plan_url: `https://github.com/${REPO}/blob/main/docs/security/vulnerability-management.md` });

const summary = { at: Date.now(), libraries: v?.libraries ?? null, android: v?.android ?? null, fullTree: !!v?.fullTree,
  vulnerable: rows.filter((r) => r.kind === "library").length, code: rows.filter((r) => r.kind === "code").length,
  secrets: rows.filter((r) => r.kind === "secret").length, runUrl: RUN_URL };

const API = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/d1/database`;
const H = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };
const dbs = await (await fetch(`${API}?name=personalhealthy`, { headers: H })).json();
const id = dbs.result?.find((d) => d.name === "personalhealthy")?.uuid;
if (!id) { console.error("database not found"); process.exit(2); }
const q = async (sql, params = []) => {
  const r = await (await fetch(`${API}/${id}/query`, { method: "POST", headers: H, body: JSON.stringify({ sql, params }) })).json();
  if (!r.success) throw new Error(JSON.stringify(r.errors));
};
await q("DELETE FROM security_findings");
const now = Date.now();
for (const r of rows.slice(0, 500))
  await q(`INSERT OR REPLACE INTO security_findings (kind, ref, name, version, location, severity, rating, fixed, summary, source_url, plan_url, found_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`,
    [r.kind, cut(r.ref, 120), cut(r.name, 200), cut(r.version, 60), cut(r.location, 200), cut(r.severity, 20), cut(r.rating, 20),
     cut(r.fixed, 80), cut(r.summary, 240), cut(r.source_url, 300), cut(r.plan_url, 300), now]);
await q("INSERT INTO settings (key, value) VALUES ('security_scan', ?1) ON CONFLICT (key) DO UPDATE SET value = excluded.value", [JSON.stringify(summary)]);
console.log(`published: ${rows.length} findings`, summary);
