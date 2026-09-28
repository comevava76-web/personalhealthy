// HINT 365: passive security checks against the LIVE site. Only unauthenticated GET/OPTIONS requests: it never signs in,
// never writes, never uses test data. What an outsider would try first: headers, forged or missing credentials,
// admin pages, guessed doctor links, error pages that leak details, CORS.
// Run: node prod-probe.mjs [base]   (default: the production Worker)
import fs from "node:fs";
import crypto from "node:crypto";

const BASE = (process.argv[2] || process.env.HINT_PROD || "https://personalhealthy-api.comevava76.workers.dev").replace(/\/$/, "");
const results = [];
const check = (id, desc, ok, detail = "") => {
  results.push({ id, desc, ok: !!ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${id} ${desc}${ok ? "" : "  -> " + detail}`);
};
const get = async (p, init = {}) => {
  const r = await fetch(BASE + p, { redirect: "manual", ...init });
  return { status: r.status, h: r.headers, text: await r.text() };
};
const leaks = (t) => /at [\w$.]+ \(|stack|SQLITE|D1_ERROR|TypeError|ReferenceError|\/src\/\w+\.ts/i.test(t);

// 1. headers on the pages people open
const my = await get("/my/");
const csp = my.h.get("content-security-policy") || "";
check("H1", "/my/ has a Content-Security-Policy without unsafe-eval and with frame-ancestors 'none'", /default-src 'self'/.test(csp) && !/unsafe-eval/.test(csp) && /frame-ancestors 'none'/.test(csp), csp || "missing");
check("H2", "/my/ forbids framing (X-Frame-Options DENY)", /deny/i.test(my.h.get("x-frame-options") || ""), my.h.get("x-frame-options") || "missing");
check("H3", "/my/ sends nosniff and no referrer", /nosniff/i.test(my.h.get("x-content-type-options") || "") && /no-referrer/i.test(my.h.get("referrer-policy") || ""), `${my.h.get("x-content-type-options")} ${my.h.get("referrer-policy")}`);
check("H4", "HSTS is on", /max-age=\d{7,}/.test(my.h.get("strict-transport-security") || ""), my.h.get("strict-transport-security") || "missing");
const api = await get("/v1/health");
check("H5", "the API sends nosniff too", /nosniff/i.test(api.h.get("x-content-type-options") || ""), api.h.get("x-content-type-options") || "missing");
const robots = await get("/robots.txt");
check("H6", "robots.txt keeps /my/, /s/ and /v1/ out of search engines", ["/my/", "/s/", "/v1/"].every((p) => robots.text.includes("Disallow: " + p)), robots.text.slice(0, 120));

// 2. no way in without credentials
const me = await get("/v1/me");
check("A1", "GET /v1/me without a signature -> 401", me.status === 401, String(me.status));
const ts = String(Date.now());
const forged = await get("/v1/me", { headers: { "X-Ts": ts, "X-Sig": crypto.randomBytes(70).toString("base64"), "X-Person": "per_" + crypto.randomBytes(12).toString("hex"), "X-App-Version": "999" } });
check("A2", "a forged signature for an invented account -> 401", forged.status === 401, String(forged.status));
const old = await get("/v1/me", { headers: { "X-Ts": String(Date.now() - 3600e3), "X-Sig": "AAAA", "X-Person": "per_x" } });
check("A3", "a timestamp one hour old -> 401", old.status === 401, String(old.status));
const adm = await get("/my/api/admin/overview");
check("A4", "the owner's Admin data without a session -> 401/403", adm.status === 401 || adm.status === 403, String(adm.status));
const fakeCookie = await get("/my/api/me", { headers: { Cookie: "hint_s=" + crypto.randomBytes(32).toString("base64url") } });
check("A5", "an invented session cookie -> 401", fakeCookie.status === 401, String(fakeCookie.status));
const share = await get("/s/" + crypto.randomBytes(24).toString("base64url") + "/data");
check("A6", "a guessed doctor link -> 404, no data", share.status === 404 && !/"items"/.test(share.text), String(share.status));

// 3. errors say nothing about the inside
for (const [id, p] of [["E1", "/v1/bp/%00%27%22"], ["E2", "/my/api/data?module=../../etc"], ["E3", "/nothing-here"], ["E4", "/s/%E0%A4%A"]]) {
  const r = await get(p);
  check(id, `${p} answers without a stack trace or database detail (${r.status})`, r.status < 500 && !leaks(r.text), r.text.slice(0, 160));
}

// 4. other sites cannot read the API from a browser
const cors = await get("/v1/me", { method: "OPTIONS", headers: { Origin: "https://evil.example", "Access-Control-Request-Method": "GET" } });
const acao = cors.h.get("access-control-allow-origin");
check("C1", "no CORS for other sites (no Access-Control-Allow-Origin: * or the foreign origin)", !acao || (acao !== "*" && !acao.includes("evil.example")), acao || "none");

const failed = results.filter((r) => !r.ok);
fs.writeFileSync(process.env.HINT_OUT || "prod-probe-results.json", JSON.stringify({ suite: "prod-probe", base: BASE, failed, results }, null, 2));
console.log(`${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
