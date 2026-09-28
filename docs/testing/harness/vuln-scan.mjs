// HINT 365: vulnerability scan of every third-party library the project ships or builds with, against OSV.dev
// (the open vulnerability database of Google and the open-source community: GitHub advisories, NVD, Android, npm, Maven…).
// Lists: Android libraries and Gradle plugins (android/*.gradle.kts), the web libraries copied into
// worker/public/my/vendor (jsPDF, svg2pdf.js), the server's tools (worker/package-lock or wrangler).
// Writes a Markdown report; exits 1 when a known vulnerability affects a version in use.
// Run: node vuln-scan.mjs [report.md]
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
const OUT = process.argv[2] || process.env.HINT_OUT || "vulnerability-scan.md";
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const pkgs = [];

// 1. Android: "group:artifact:version" coordinates and the two Gradle plugins
for (const f of ["android/app/build.gradle.kts", "android/build.gradle.kts"]) {
  const s = read(f);
  for (const m of s.matchAll(/"([\w.-]+):([\w.-]+):([\w.+-]+)"/g))
    pkgs.push({ ecosystem: "Maven", name: `${m[1]}:${m[2]}`, version: m[3], where: f });
  for (const m of s.matchAll(/id\("([\w.]+)"\) version "([\w.-]+)"/g)) {
    const name = { "com.android.application": "com.android.tools.build:gradle", "org.jetbrains.kotlin.android": "org.jetbrains.kotlin:kotlin-gradle-plugin" }[m[1]];
    if (name) pkgs.push({ ecosystem: "Maven", name, version: m[2], where: f + " (build plugin)" });
  }
}
// 2. web libraries copied into the site (file name carries the version)
for (const f of fs.readdirSync(path.join(ROOT, "worker/public/my/vendor"))) {
  const m = f.match(/^(jspdf|svg2pdf)-(\d+\.\d+\.\d+)/);
  if (m) pkgs.push({ ecosystem: "npm", name: m[1] === "svg2pdf" ? "svg2pdf.js" : "jspdf", version: m[2], where: "worker/public/my/vendor/" + f });
}
// 3. the server's build and deploy tool
try {
  const lock = JSON.parse(read("worker/package-lock.json"));
  for (const [k, v] of Object.entries(lock.packages || {})) if (k.startsWith("node_modules/") && v.version)
    pkgs.push({ ecosystem: "npm", name: k.slice(13), version: v.version, where: "worker (build tool, dependency)" });
} catch {
  try { const w = JSON.parse(read("worker/node_modules/wrangler/package.json")); pkgs.push({ ecosystem: "npm", name: "wrangler", version: w.version, where: "worker (build tool)" }); } catch {}
}

const direct = pkgs.filter((p) => !p.where.includes("dependency"));
const res = await fetch("https://api.osv.dev/v1/querybatch", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ queries: pkgs.map((p) => ({ package: { ecosystem: p.ecosystem, name: p.name }, version: p.version })) }),
});
if (!res.ok) { console.error("OSV.dev did not answer: " + res.status); process.exit(2); }
const batch = (await res.json()).results || [];
const found = [];
for (let i = 0; i < pkgs.length; i++) for (const v of batch[i]?.vulns || []) found.push({ ...pkgs[i], id: v.id });
// details (summary, severity, fixed version) for each finding
for (const f of found) {
  try {
    const d = await (await fetch("https://api.osv.dev/v1/vulns/" + f.id)).json();
    f.summary = (d.summary || d.details || "").split("\n")[0].slice(0, 140);
    f.severity = d.database_specific?.severity || (d.severity?.[0]?.score ? "CVSS " + d.severity[0].score.split("/")[0] : "—");
    const fixed = (d.affected || []).flatMap((a) => (a.ranges || []).flatMap((r) => r.events.filter((e) => e.fixed).map((e) => e.fixed)));
    f.fixed = fixed.length ? [...new Set(fixed)].join(", ") : "no fix yet";
  } catch { f.summary = ""; f.severity = "?"; f.fixed = "?"; }
}

const date = new Date().toISOString().slice(0, 10);
const md = [
  `# HINT 365 · Vulnerability scan ${date}`, "",
  `Source: OSV.dev (GitHub Security Advisories, NVD, Android, npm, Maven). Libraries checked: **${pkgs.length}** (${direct.length} used directly).`, "",
  found.length ? `**${found.length} known vulnerabilit${found.length === 1 ? "y" : "ies"}** in versions in use:` : "**No known vulnerability** in the versions in use.", "",
  ...(found.length ? ["| Library | Version | Advisory | Severity | Fixed in | Where |", "|---|---|---|---|---|---|",
    ...found.map((f) => `| ${f.name} | ${f.version} | [${f.id}](https://osv.dev/vulnerability/${f.id}) ${f.summary.replace(/\|/g, "/")} | ${f.severity} | ${f.fixed} | ${f.where} |`), ""] : []),
  "## Libraries checked", "", "| Library | Version | Where |", "|---|---|---|",
  ...direct.map((p) => `| ${p.name} | ${p.version} | ${p.where} |`), "",
  "Not covered by this list: libraries whose version comes from the Compose BOM (checked through the BOM version by Dependabot), and the Android system itself.",
].join("\n");
fs.writeFileSync(OUT, md + "\n");
console.log(md.split("\n").slice(0, 12).join("\n"));
if (found.length) process.exitCode = 1;
