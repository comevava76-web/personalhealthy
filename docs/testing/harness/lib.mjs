// HINT 365 QA harness: shared helpers.
// Signs requests exactly like the Android app (Api.call in Core.kt):
//   message = METHOD \n PATH+QUERY \n TIMESTAMP_MS \n SHA256HEX(body)
//   ECDSA P-256 / SHA-256, DER signature in base64 (X-Sig), public key as SPKI DER base64.
// Only for a LOCAL worker (wrangler dev --local). Never point it at production.
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

export const BASE = process.env.HINT_BASE || "http://127.0.0.1:8787";
export const FAMILY_CODE = process.env.HINT_FAMILY_CODE || "QA-FAMILY-CODE-DUMMY";
export const APP_VERSION = process.env.HINT_APP_VERSION || "200";

if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(BASE)) {
  console.error("Refusing to run against a non-local address: " + BASE);
  process.exit(2);
}

export function newPhone() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
  const pub = publicKey.export({ type: "spki", format: "der" }).toString("base64");
  return { privateKey, pub, pid: null };
}

export const sha256Hex = (buf) => crypto.createHash("sha256").update(buf).digest("hex");

export function sign(phone, method, pathQ, ts, bodyBuf) {
  const msg = `${method}\n${pathQ}\n${ts}\n${sha256Hex(bodyBuf)}`;
  return crypto.sign("sha256", Buffer.from(msg, "utf8"), { key: phone.privateKey, dsaEncoding: "der" }).toString("base64");
}

/**
 * A signed call like the app's. opts: { raw (string body), ts (override), sigOverride, person (override X-Person),
 * noSig, version (X-App-Version), headers }
 */
export async function call(phone, method, pathQ, body, opts = {}) {
  const bodyStr = opts.raw != null ? opts.raw : body == null ? "" : JSON.stringify(body);
  const bodyBuf = Buffer.from(bodyStr, "utf8");
  const ts = String(opts.ts ?? Date.now());
  const headers = { "X-Ts": ts, "X-App-Version": String(opts.version ?? APP_VERSION), "X-Lang": "en", ...(opts.headers || {}) };
  if (!opts.noSig) headers["X-Sig"] = opts.sigOverride ?? sign(phone, method, pathQ, opts.signTs ?? ts, opts.signBody ?? bodyBuf);
  const person = opts.person !== undefined ? opts.person : phone?.pid;
  if (person) headers["X-Person"] = person;
  if (bodyStr) headers["Content-Type"] = "application/json";
  const t0 = performance.now();
  let res, text;
  try {
    res = await fetch(BASE + pathQ, { method, headers, body: bodyStr ? bodyBuf : undefined });
    text = await res.text();
  } catch (e) {
    return { status: 0, json: null, text: String(e), ms: performance.now() - t0 };
  }
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text, ms: performance.now() - t0, headers: res.headers };
}

/** Registers a phone with the family code (first one becomes the owner). */
export async function register(phone, code = FAMILY_CODE) {
  // each test phone comes from its own address, so the per-address sign-up limit (F-07) is not hit by the harness
  phone.ip ??= "10.9." + Math.floor(Math.random() * 250) + "." + Math.floor(Math.random() * 250);
  const r = await call(phone, "POST", "/v1/register", { code, publicKey: phone.pub }, { person: null, headers: { "CF-Connecting-IP": phone.ip } });
  if (r.status === 200) phone.pid = r.json.personId;
  return r;
}

/** Browser-side helpers (cookie jar of one session). */
export async function web(method, p, { cookie, body, origin, headers = {} } = {}) {
  const h = { ...headers };
  if (cookie) h.cookie = cookie;
  if (origin) h.origin = origin;
  if (body !== undefined) h["content-type"] = "application/json";
  const t0 = performance.now();
  const res = await fetch(BASE + p, { method, headers: h, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body), redirect: "manual" });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text, headers: res.headers, ms: performance.now() - t0 };
}

/** From the app: a one-time code, then the browser turns it into the hint_s cookie. */
export async function webLogin(phone) {
  const c = await call(phone, "POST", "/v1/web/code", {});
  if (c.status !== 200) throw new Error("web/code " + c.status + " " + c.text);
  const code = c.json.url.split("#c=")[1];
  const s = await web("POST", "/my/session", { body: { code }, origin: BASE, headers: phone.ip ? { "CF-Connecting-IP": phone.ip } : {} });
  const sc = s.headers.get("set-cookie") || "";
  const m = sc.match(/hint_s=([^;]+)/);
  return { status: s.status, cookie: m ? `hint_s=${m[1]}` : "", setCookie: sc, code, url: c.json.url };
}

/** Direct access to the LOCAL D1 file (for back-dated fixtures and for checking results). */
export function localDb() {
  const dir = process.env.HINT_D1_DIR || path.resolve(process.env.HINT_WORKER_DIR || ".", ".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
  const f = fs.readdirSync(dir).find((x) => x.endsWith(".sqlite") && x !== "metadata.sqlite");
  if (!f) throw new Error("no local D1 file in " + dir);
  const db = new DatabaseSync(path.join(dir, f));
  db.exec("PRAGMA busy_timeout = 5000");
  return db;
}

/* ---------- tiny test recorder ---------- */
export class Suite {
  constructor(name) { this.name = name; this.results = []; }
  check(area, id, desc, ok, detail = "") {
    this.results.push({ area, id, desc, ok: !!ok, detail });
    console.log(`${ok ? "PASS" : "FAIL"}  [${area}] ${id} ${desc}${ok ? "" : "  -> " + detail}`);
    return ok;
  }
  summary() {
    const by = {};
    for (const r of this.results) { by[r.area] ??= { pass: 0, fail: 0 }; by[r.area][r.ok ? "pass" : "fail"]++; }
    return { suite: this.name, by, failed: this.results.filter((r) => !r.ok) };
  }
  save(file) {
    fs.writeFileSync(file, JSON.stringify({ ...this.summary(), results: this.results }, null, 2));
    if (this.results.some((r) => !r.ok)) process.exitCode = 1;   // a failed check fails the CI job
  }
}

export function pct(arr, p) {
  if (!arr.length) return NaN;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))];
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
