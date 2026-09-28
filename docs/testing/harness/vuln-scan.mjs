// HINT 365: vulnerability scan of every third-party library the project ships or builds with, against OSV.dev
// (https://osv.dev, the open vulnerability database of Google and the open-source community: GitHub Advisory
// Database, CVE, Android, Maven, npm…).
// Inventory:
//  - Android: the FULL resolved tree when HINT_GRADLE_DEPS points to the output of
//    `gradle :app:dependencies --configuration releaseRuntimeClasspath` and `gradle buildEnvironment` (CI does this),
//    including libraries pulled in by other libraries and those versioned by the Compose BOM; otherwise the libraries
//    declared in android/*.gradle.kts and the two build plugins;
//  - the web libraries copied into worker/public/my/vendor (jsPDF, svg2pdf.js);
//  - the server's build and deploy tool (worker/package-lock.json, created in CI).
// A library is vulnerable when its exact version falls inside the affected range of a published advisory.
// Our own rating and the link to the remediation plan come from docs/security/decisions.json.
// Writes a Markdown report (argument or HINT_OUT) and a JSON file (HINT_JSON) for the owner's Security console;
// exits 1 when a known vulnerability affects a version in use.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
const OUT = process.argv[2] || process.env.HINT_OUT || "vulnerability-scan.md";
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const pkgs = new Map();   // "ecosystem|name|version" -> {ecosystem, name, version, where}
const add = (ecosystem, name, version, where) => {
  const k = `${ecosystem}|${name}|${version}`;
  if (!pkgs.has(k)) pkgs.set(k, { ecosystem, name, version, where });
};

// 1. Android
const declared = new Map();   // "group:artifact" -> file that declares it
const PLUGINS = { "com.android.application": "com.android.tools.build:gradle", "org.jetbrains.kotlin.android": "org.jetbrains.kotlin:kotlin-gradle-plugin" };
for (const f of ["android/app/build.gradle.kts", "android/build.gradle.kts"]) {
  const s = read(f);
  for (const m of s.matchAll(/"([\w.-]+):([\w.-]+)(?::([\w.+-]+))?"/g)) declared.set(`${m[1]}:${m[2]}`, { file: f, version: m[3] });
  for (const m of s.matchAll(/id\("([\w.]+)"\) version "([\w.-]+)"/g))
    if (PLUGINS[m[1]]) declared.set(PLUGINS[m[1]], { file: f + " (build plugin)", version: m[2] });
}
let fullTree = false;
// HINT_GRADLE_DEPS: the app's runtime tree (shipped to phones); HINT_GRADLE_BUILD: the build tools' tree (never shipped)
for (const [file, build] of [[process.env.HINT_GRADLE_DEPS, false], [process.env.HINT_GRADLE_BUILD, true]]) {
  if (!file || !fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (!/--- /.test(line) || /--- project /.test(line)) continue;
    const m = line.match(/--- ([A-Za-z0-9_.-]+):([A-Za-z0-9_.-]+)(?::([A-Za-z0-9_.+-]+))?(?: -> ([A-Za-z0-9_.+-]+))?/);
    const version = m && (m[4] || m[3]);
    if (!m || !version) continue;
    const name = `${m[1]}:${m[2]}`;
    const d = declared.get(name);
    add("Maven", name, version, d ? d.file : build ? "Android build tools (not in the app)" : "app (pulled in by another library)");
    fullTree = true;
  }
}
for (const [name, d] of declared) if (d.version && ![...pkgs.values()].some((p) => p.name === name)) add("Maven", name, d.version, d.file);

// 2. web libraries copied into the site (the file name carries the version)
for (const f of fs.readdirSync(path.join(ROOT, "worker/public/my/vendor"))) {
  const m = f.match(/^(jspdf|svg2pdf)-(\d+\.\d+\.\d+)/);
  if (m) add("npm", m[1] === "svg2pdf" ? "svg2pdf.js" : "jspdf", m[2], "worker/public/my/vendor/" + f);
}
// 3. the server's build and deploy tool
try {
  const lock = JSON.parse(read("worker/package-lock.json"));
  for (const [k, v] of Object.entries(lock.packages || {})) if (k.startsWith("node_modules/") && v.version)
    add("npm", k.slice(k.lastIndexOf("node_modules/") + 13), v.version, k === "node_modules/wrangler" ? "worker/package.json (build tool)" : "worker (build tool, dependency)");
} catch {
  try { const w = JSON.parse(read("worker/node_modules/wrangler/package.json")); add("npm", "wrangler", w.version, "worker/package.json (build tool)"); } catch {}
}

const list = [...pkgs.values()];
if (process.env.HINT_DRY) { for (const p of list) console.log(`${p.ecosystem}\t${p.name}\t${p.version}\t${p.where}`); process.exit(0); }
const res = await fetch("https://api.osv.dev/v1/querybatch", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ queries: list.map((p) => ({ package: { ecosystem: p.ecosystem, name: p.name }, version: p.version })) }),
});
if (!res.ok) { console.error("OSV.dev did not answer: " + res.status); process.exit(2); }
const batch = (await res.json()).results || [];
const found = [];
for (let i = 0; i < list.length; i++) for (const v of batch[i]?.vulns || []) found.push({ ...list[i], id: v.id });

let decisions = {};
try { decisions = JSON.parse(read("docs/security/decisions.json")); } catch {}
for (const f of found) {
  try {
    const d = await (await fetch("https://api.osv.dev/v1/vulns/" + f.id)).json();
    f.summary = (d.summary || d.details || "").split("\n")[0].slice(0, 160);
    f.severity = String(d.database_specific?.severity || (d.severity?.[0]?.score ? "CVSS " + d.severity[0].score.split("/")[0] : "unknown")).toUpperCase();
    const fixed = (d.affected || []).flatMap((a) => (a.ranges || []).flatMap((r) => r.events.filter((e) => e.fixed).map((e) => e.fixed)));
    f.fixed = fixed.length ? [...new Set(fixed)].join(", ") : "";
    f.aliases = (d.aliases || []).slice(0, 3);
  } catch { f.summary = ""; f.severity = "UNKNOWN"; f.fixed = ""; f.aliases = []; }
  f.source = "https://osv.dev/vulnerability/" + f.id;
  const dec = decisions[f.id] || {};
  // our rating after reachability: a decision if there is one; otherwise code used only to build goes one level down
  f.buildOnly = /build (tool|plugin)|not in the app/.test(f.where);
  const DOWN = { CRITICAL: "HIGH", HIGH: "MODERATE", MODERATE: "LOW", LOW: "LOW" };
  f.rating = dec.rating || (f.buildOnly && DOWN[f.severity] ? DOWN[f.severity] : "");
  f.plan = dec.plan || "";              // link to the remediation plan (issue or pull request)
}

const date = new Date().toISOString().slice(0, 10);
const counted = { libraries: list.length, android: list.filter((p) => p.ecosystem === "Maven").length, fullTree };
const md = [
  `# HINT 365 · Vulnerability scan ${date}`, "",
  `Source: OSV.dev (GitHub Advisory Database, CVE, Android, Maven, npm). Libraries checked: **${list.length}**` +
    ` (Android ${counted.android}${fullTree ? ", full resolved tree" : ", declared only"}).`, "",
  found.length ? `**${found.length} known vulnerabilit${found.length === 1 ? "y" : "ies"}** in versions in use:` : "**No known vulnerability** in the versions in use.", "",
  ...(found.length ? ["| Library | Version | Advisory | Severity | Our rating | Fixed in | Where | Plan |", "|---|---|---|---|---|---|---|---|",
    ...found.map((f) => `| ${f.name} | ${f.version} | [${f.id}](${f.source}) ${f.summary.replace(/\|/g, "/")} | ${f.severity} | ${f.rating || "to triage"} | ${f.fixed || "no fix yet"} | ${f.where} | ${f.plan || "—"} |`), ""] : []),
].join("\n");
fs.writeFileSync(OUT, md + "\n");
if (process.env.HINT_JSON) fs.writeFileSync(process.env.HINT_JSON, JSON.stringify({ at: Date.now(), ...counted, findings: found }, null, 2));
console.log(md);
if (found.length) process.exitCode = 1;
