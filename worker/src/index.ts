// PersonalHealthy API (used by the HealthyInstantTracker app).
// Runs on Cloudflare Workers with the D1 database "personalhealthy" (data bound to the European Union).
// All database access goes through the q() function: to move to PostgreSQL/Azure one day,
// change q() and a few SQL expressions; the rest of the code stays the same.

import { NOTICE_TEXT } from "./notices";
import { validateLabImport, loadLabs, saveLab, deleteLabs, labFileKey } from "./labs";
import { homePage, privacyPage, termsPage } from "./pages";
import { handleWeb, newWebCode, endWebAccess } from "./web";
import { logError } from "./errors";
import { tooMany, ipKey, HOUR, DAY } from "./limits";
import { playSubscription, subValid, playAccountId, PLAY_PACKAGE, SUB_PRODUCT } from "./billing";

type Q = (text: string, params?: unknown[]) => Promise<any[]>;

interface Env {
  DB: any; // Cloudflare D1
  ASSETS: any; // the static files in public/ (the app, the guides, the My Dash page)
  ANTHROPIC_API_KEY: string;    // the owner's key: pays for every person with pays = 'owner'
  FAMILY_CODE: string;          // still works as an invite for "family member (I pay)"
  KEY_ENCRYPTION_KEY?: string;  // 32 random bytes in base64: encrypts friends' Anthropic keys in the database
  MODEL?: string;
  GOOGLE_CLIENT_ID?: string;
  OWNER_GOOGLE_ID?: string; // explicit owner HMAC; never grant admin to the first public registrant
  CONTACT_EMAIL?: string;      // shown on the privacy page (repository variable; empty = "the support email on Google's screen")   // "Sign in with Google": the Web client ID the app asks tokens for (empty = off)
  PRICE_IN_PER_MTOK?: string;  // dollars per million input tokens
  PRICE_OUT_PER_MTOK?: string; // dollars per million output tokens
  PLAY_SERVICE_ACCOUNT?: string; // JSON key of the service account that checks subscriptions with Google Play
  APP_VERSION?: string;          // the newest app build (the pipeline's run number, set at deploy)
  GITHUB_FIX_TOKEN?: string;     // Security console "Fix": a GitHub token that may open issues in the repository (owner sets it)
  GITHUB_REPO?: string;          // owner/name of the repository (default comevava76-web/personalhealthy)
}

const MICRO = 1_000_000; // money is kept in millionths of a dollar (integers, no rounding errors)
const DEFAULT_PHOTO_COST = 6000; // $0.006 until there are real readings

/* ---------- credit and settings ---------- */
async function getSetting(q: Q, key: string, def: string): Promise<string> {
  const [r] = await q("SELECT value FROM settings WHERE key = ?1", [key]);
  return r ? String(r.value) : def;
}

/* ---------- switching installed apps off remotely ----------
   Three settings, changed from the app (administrator) or from GitHub (Actions → App versions):
   app_min_version  versions below this number stop working (0 = none)
   app_blocked      single versions switched off, e.g. "71,72"
   app_off          "1" = every version off, an emergency stop
   A switched-off app gets "app_disabled" on every request and shows only the page to update it.
   Apps from before 0.1.75 send no version: they count as version 0. */
async function appGate(q: Q): Promise<{ min: number; blocked: number[]; off: boolean }> {
  const rows = await q("SELECT key, value FROM settings WHERE key IN ('app_min_version', 'app_blocked', 'app_off')");
  const v: Record<string, string> = {};
  for (const r of rows as any[]) v[r.key] = String(r.value);
  return {
    min: Number(v.app_min_version) || 0,
    blocked: (v.app_blocked || "").split(/[\s,]+/).map(Number).filter((n) => n > 0),
    off: v.app_off === "1",
  };
}
/* ---------- the yearly subscription (Google Play) ----------
   Off until the owner switches it on (setting subscription_on = "1", from the app). The owner never pays.
   Without a valid subscription the app and the Web Dashboard show only the invitation to renew; the data stay,
   under the usual 365-day rule, and come back as soon as the subscription is renewed. */
const SUB_RECHECK = 6 * 3600e3;   // an expired subscription is asked to Google Play again at most every 6 hours
async function subState(q: Q, env: Env, pid: string): Promise<{ required: boolean; active: boolean; until: number | null; state: string }> {
  const [p] = await q("SELECT is_admin, sub_token, sub_until, sub_state, sub_checked_at FROM persons WHERE id = ?1", [pid]);
  if (!p) return { required: false, active: false, until: null, state: "" };
  const on = (await getSetting(q, "subscription_on", "0")) === "1";
  let until = Number(p.sub_until) || 0, state = String(p.sub_state || "");
  // renewed on Google Play after it ran out here: ask again, now and then
  if (p.sub_token && env.PLAY_SERVICE_ACCOUNT && Date.now() - (Number(p.sub_checked_at) || 0) > SUB_RECHECK) {
    try {
      const g = await playSubscription(env.PLAY_SERVICE_ACCOUNT, String(p.sub_token));
      if (g) { until = g.until; state = g.state; }
      await q("UPDATE persons SET sub_until = ?1, sub_state = ?2, sub_checked_at = ?3 WHERE id = ?4", [until, state, Date.now(), pid]);
    } catch (e) { console.error("subscription check failed"); }
  }
  return { required: on && !p.is_admin, active: !!p.is_admin || subValid(until, state), until: until || null, state };
}
async function subOk(q: Q, env: Env, pid: string): Promise<boolean> {
  const s = await subState(q, env, pid);
  return !s.required || s.active;
}
// what still works without a subscription: seeing the invitation, renewing, the terms, leaving, deleting the account
const SUB_FREE = new Set(["GET /v1/me", "GET /v1/bp", "GET /v1/labs", "POST /v1/web/code", "POST /v1/sub/verify", "POST /v1/accept", "POST /v1/signout", "DELETE /v1/me", "POST /v1/log"]);

async function appAllowed(q: Q, version: number): Promise<boolean> {
  const g = await appGate(q);
  return !g.off && version >= g.min && !g.blocked.includes(version);
}

// Money pools. Everyone with pays = 'owner' shares the owner's pool ("owner"); each friend with
// pays = 'self' has a pool of their own, named after their person id. Rows written before pools
// existed have no payer and belong to the owner.
type Pool = string;
const OWNER_POOL = "owner";
const poolOf = (person: any): Pool => (person.pays === "self" ? String(person.id) : OWNER_POOL);
const POOL_WHERE = "COALESCE(payer, 'owner') = ?1";

// Credit is counted from the pool's last balance correction ("set"): loaded = that balance + later top-ups,
// spent = cost of the photos read since then, remaining = loaded - spent.
async function creditInfo(q: Q, pool: Pool) {
  const [last] = await q(`SELECT seq, amount_micro, created_at FROM ledger WHERE ${POOL_WHERE} AND kind = 'set' ORDER BY seq DESC LIMIT 1`, [pool]);
  const fromSeq = last ? Number(last.seq) : 0;
  const base = last ? Number(last.amount_micro) : 0;
  const [sums] = await q(
    "SELECT COALESCE(SUM(CASE WHEN kind = 'topup' THEN amount_micro ELSE 0 END), 0) AS top, " +
    "COALESCE(SUM(CASE WHEN kind = 'usage' THEN amount_micro ELSE 0 END), 0) AS used, " +
    "COUNT(CASE WHEN kind = 'usage' THEN 1 END) AS scans, " +
    `COUNT(CASE WHEN kind IN ('topup','set') THEN 1 END) AS money_rows FROM ledger WHERE ${POOL_WHERE} AND seq > ?2`,
    [pool, fromSeq]
  );
  const [avgRow] = await q(
    `SELECT AVG(amount_micro) AS avg FROM (SELECT amount_micro FROM ledger WHERE ${POOL_WHERE} AND kind = 'usage' ORDER BY seq DESC LIMIT 20) t`,
    [pool]
  );
  const configured = !!last || Number(sums?.money_rows || 0) > 0;
  const loaded = base + Number(sums?.top || 0);
  const spent = Number(sums?.used || 0);
  const remaining = loaded - spent;
  const avg = Math.max(1, Math.round(Number(avgRow?.avg) || DEFAULT_PHOTO_COST));
  // everything spent on photo readings since the start (exact: tokens × price of each reading)
  const [all] = await q(`SELECT COALESCE(SUM(amount_micro), 0) AS used FROM ledger WHERE ${POOL_WHERE} AND kind = 'usage'`, [pool]);
  const photosLeft = configured ? Math.max(0, Math.floor(remaining / avg)) : null;
  return {
    configured,
    remaining: configured ? remaining / MICRO : null,
    loaded: configured ? loaded / MICRO : null,
    spent: spent / MICRO,
    spentAll: Number(all?.used || 0) / MICRO,
    scans: Number(sums?.scans || 0),
    since: last ? Number(last.created_at) : null, // time of the last balance correction
    avgCost: avg / MICRO,
    photosLeft,
    low: configured && remaining < 2 * avg,   // estimate: enough for one more photo at most (only for warnings)
    empty: configured && remaining < avg,     // estimate: not enough for another photo (only for warnings)
  };
}

async function addMoney(q: Q, pool: Pool, pid: string, kind: "set" | "topup", amount: number) {
  const now = Date.now();
  await q(
    "INSERT INTO ledger (kind, amount_micro, person_id, payer, created_at, created_at_local) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
    [kind, Math.round(amount * MICRO), pid, pool, now, localStamp(now)]
  );
}

const TZ = "Europe/Zurich";
const enc = new TextEncoder();

const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; " +
  "connect-src 'self'; font-src 'self' data:; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";
function secured(res: Response): Response {
  const r = new Response(res.body, res);
  r.headers.set("X-Content-Type-Options", "nosniff");
  r.headers.set("Referrer-Policy", "no-referrer");
  r.headers.set("X-Frame-Options", "DENY");
  r.headers.set("Strict-Transport-Security", "max-age=31536000");
  if ((r.headers.get("content-type") || "").includes("text/html")) r.headers.set("Content-Security-Policy", CSP);
  return r;
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
// "code" is what the app translates into the phone's language; "error" is for the logs
const fail = (msg: string, status = 400, code = "generic") => json({ error: msg, code }, status);

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function sha256Hex(data: Uint8Array): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, "0")).join("");
}

// Android signs in DER format; here we need the r||s format (64 bytes)
function derToRaw(der: Uint8Array): Uint8Array {
  let i = 2;
  if (der[1] & 0x80) i = 2 + (der[1] & 0x7f);
  const read = () => {
    if (der[i] !== 0x02) throw new Error("bad der");
    const len = der[i + 1];
    let v = der.slice(i + 2, i + 2 + len);
    i = i + 2 + len;
    while (v.length > 32 && v[0] === 0) v = v.slice(1);
    const o = new Uint8Array(32);
    o.set(v, 32 - v.length);
    return o;
  };
  const r = read();
  const s = read();
  const out = new Uint8Array(64);
  out.set(r, 0);
  out.set(s, 32);
  return out;
}

async function verify(pubB64: string, sigB64: string, message: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey("spki", b64ToBytes(pubB64), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    return await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, derToRaw(b64ToBytes(sigB64)), enc.encode(message));
  } catch {
    return false;
  }
}

/* ---------- Sign in with Google: the ID token the phone gets from Google, checked here ---------- */
let googleJwks: { keys: any[]; at: number } | null = null;
async function googleKeys(force = false): Promise<any[]> {
  if (!force && googleJwks && Date.now() - googleJwks.at < 3600e3) return googleJwks.keys;
  const r = await fetch("https://www.googleapis.com/oauth2/v3/certs");
  const j: any = await r.json();
  googleJwks = { keys: Array.isArray(j.keys) ? j.keys : [], at: Date.now() };
  return googleJwks.keys;
}
function b64urlToBytes(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return b64ToBytes(s);
}
/**
 * The only trace of the Google account kept in the database: "h1:" + HMAC-SHA256 of Google's stable id,
 * with a key derived from the server secret. It finds the same person again on any phone, but nobody can
 * turn it back into a Google account or an email. No email is ever stored.
 */
async function googleId(env: Env, sub: string): Promise<string> {
  const raw = env.KEY_ENCRYPTION_KEY ? b64ToBytes(env.KEY_ENCRYPTION_KEY) : new Uint8Array(0);
  if (raw.length !== 32) throw new Error("KEY_ENCRYPTION_KEY missing or not 32 bytes");
  const k = await crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode("google-sub:" + sub)));
  return "h1:" + [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Older rows kept Google's raw id and the email: replaced by the fingerprint, email erased (every night, and at sign-in). */
async function anonymizeGoogle(env: Env) {
  const rows = (await env.DB.prepare("SELECT id, google_sub FROM persons WHERE google_sub IS NOT NULL AND google_sub NOT LIKE 'h1:%'").all()).results || [];
  for (const r of rows as any[]) await env.DB.prepare("UPDATE persons SET google_sub = ?1 WHERE id = ?2").bind(await googleId(env, String(r.google_sub)), r.id).run();
  await env.DB.batch([
    env.DB.prepare("UPDATE persons SET email = NULL WHERE email IS NOT NULL"),
    env.DB.prepare("UPDATE acceptances SET email = NULL WHERE email IS NOT NULL"),
  ]);
}

// Returns the Google account (its stable id "sub" and its email) only if the token is genuine,
// was made for this app, has not expired and the email is verified by Google.
/** Apps from this build on send a nonce with Google sign-in (older ones cannot); see /v1/auth/google. */

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function verifyGoogle(token: string, clientId: string): Promise<{ sub: string; email: string; nonce: string } | null> {
  try {
    const [h, p, sg] = token.split(".");
    if (!h || !p || !sg) return null;
    const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(h)));
    const claims = JSON.parse(new TextDecoder().decode(b64urlToBytes(p)));
    if (header.alg !== "RS256") return null;
    let jwk = (await googleKeys()).find((k: any) => k.kid === header.kid);
    if (!jwk) jwk = (await googleKeys(true)).find((k: any) => k.kid === header.kid);   // Google rotated its keys
    if (!jwk) return null;
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    if (!(await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlToBytes(sg), enc.encode(h + "." + p)))) return null;
    if (claims.aud !== clientId) return null;
    if (claims.iss !== "accounts.google.com" && claims.iss !== "https://accounts.google.com") return null;
    if (!(Number(claims.exp) * 1000 > Date.now())) return null;
    if (claims.email_verified !== true && claims.email_verified !== "true") return null;
    if (!claims.sub) return null;
    // issued in the last 5 minutes: an old token cannot be used again
    if (!Number.isFinite(Number(claims.iat)) || Math.abs(Date.now() - Number(claims.iat) * 1000) > 5 * 60e3) return null;
    return { sub: String(claims.sub), email: String(claims.email || ""), nonce: claims.nonce ? String(claims.nonce) : "" };
  } catch {
    return null;
  }
}

/** Version of the notice every user must accept before using the app. A new version asks everyone again. */
const DISCLAIMER_VERSION = "17";
async function acceptedNotice(q: Q, pid: string): Promise<boolean> {
  const [row] = await q("SELECT 1 FROM acceptances WHERE person_id = ?1 AND doc = 'disclaimer' AND version = ?2 LIMIT 1", [pid, DISCLAIMER_VERSION]);
  return !!row;
}

function newId(prefix: string): string {
  const b = crypto.getRandomValues(new Uint8Array(12));
  return prefix + [...b].map(x => x.toString(16).padStart(2, "0")).join("");
}

function bytesToB64(b: Uint8Array): string {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
}

/* ---------- friends' Anthropic keys: encrypted per person, never sent back to the phone ---------- */
// AES-GCM with the server secret KEY_ENCRYPTION_KEY. The person id is bound to the ciphertext,
// so an encrypted key copied onto another person's row cannot be decrypted.
async function kek(env: Env): Promise<CryptoKey> {
  const raw = env.KEY_ENCRYPTION_KEY ? b64ToBytes(env.KEY_ENCRYPTION_KEY) : new Uint8Array(0);
  if (raw.length !== 32) throw new Error("KEY_ENCRYPTION_KEY missing or not 32 bytes");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function sealKey(env: Env, pid: string, apiKey: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc.encode(pid) }, await kek(env), enc.encode(apiKey));
  return `v1:${bytesToB64(iv)}:${bytesToB64(new Uint8Array(ct))}`;
}
async function openKey(env: Env, pid: string, sealed: string): Promise<string> {
  const [v, iv, ct] = sealed.split(":");
  if (v !== "v1") throw new Error("unknown key format");
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64ToBytes(iv), additionalData: enc.encode(pid) }, await kek(env), b64ToBytes(ct));
  return new TextDecoder().decode(pt);
}

/* ---------- invites ---------- */
const INVITE_DAYS = 7;
const INVITE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I/L: easy to read aloud and type
function newInviteCode(): string {
  const b = crypto.getRandomValues(new Uint8Array(12));
  const c = [...b].map(x => INVITE_ALPHABET[x % INVITE_ALPHABET.length]).join("");
  return `${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8, 12)}`;
}
// Accepts what people type or scan: lower case, spaces, missing dashes
function normInvite(s: string): string {
  const c = s.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return c.length === 12 ? `${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8, 12)}` : "";
}

// Swiss time as readable text for the *_local columns, e.g. "09262026 14:32" (MMddyyyy HH:mm, 24-hour clock)
const localFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
function localStamp(ms: number): string {
  const p: Record<string, string> = {};
  for (const part of localFmt.formatToParts(new Date(ms))) p[part.type] = part.value;
  return `${p.month}${p.day}${p.year} ${p.hour}:${p.minute}`;
}

// Fills the *_local columns of rows written before those columns existed.
// Only rows with an empty value are touched, so each row is filled once.
const LOCAL_COLUMNS: [string, string, string[]][] = [
  ["persons", "id", ["created_at"]],
  ["scans", "id", ["taken_at", "created_at"]],
  ["measurements", "id", ["taken_at", "created_at"]],
  ["ledger", "seq", ["created_at"]],
];
async function fillLocalDates(q: Q) {
  for (const [table, key, cols] of LOCAL_COLUMNS) {
    const missing = cols.map(c => `${c}_local IS NULL`).join(" OR ");
    const rows = await q(`SELECT ${key} AS k, ${cols.join(", ")} FROM ${table} WHERE ${missing} LIMIT 200`);
    for (const r of rows) {
      const sets = cols.map((c, i) => `${c}_local = ?${i + 1}`).join(", ");
      await q(`UPDATE ${table} SET ${sets} WHERE ${key} = ?${cols.length + 1}`, [...cols.map(c => localStamp(Number(r[c]))), r.k]);
    }
  }
}

function periodOf(ms: number): string {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hourCycle: "h23" }).format(new Date(ms)));
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

const PROMPT = `This is a photo of the display of a digital blood-pressure monitor.
Read the three values shown:
- systolic (upper): usually the largest number at the top (SYS)
- diastolic (lower): the number below it (DIA)
- pulse: the smallest number at the bottom (PUL, PULSE or a heart symbol)
The digits are often "seven-segment" like on a calculator: carefully tell apart 1 and 7, 5 and 6, 8 and 0.
Do not guess: if a value cannot be read with certainty, use null.
Never report people's names.
Reply ONLY with JSON in this format:
{"systolic": 128, "diastolic": 82, "pulse": 67, "readable": true, "note": ""}`;

const LANGS: Record<string, string> = { it: "Italian", en: "English", de: "German", fr: "French" };

class NoAnthropicCredit extends Error {}
class BadAnthropicKey extends Error {}

// Sorts Anthropic's refusals: no money left, key not valid, or anything else
async function anthropicError(res: Response): Promise<Error> {
  const body = await res.text();
  // Anthropic refuses when the prepaid account has no money left (billing / credit balance error)
  if (res.status === 402 || /billing|credit balance|purchase credits/i.test(body)) return new NoAnthropicCredit(body.slice(0, 300));
  if (res.status === 401 || res.status === 403) return new BadAnthropicKey(body.slice(0, 300));
  return new Error("ai " + res.status + " " + body.slice(0, 300));
}

// The smallest possible request, to check a friend's key before storing it
async function testKey(env: Env, apiKey: string) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    signal: AbortSignal.timeout(45_000),
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: env.MODEL || "claude-sonnet-5", max_tokens: 1, messages: [{ role: "user", content: "Hi" }] }),
  });
  if (!res.ok) throw await anthropicError(res);
}

async function readDisplay(env: Env, apiKey: string, image: string, lang: string) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    signal: AbortSignal.timeout(45_000),
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: env.MODEL || "claude-sonnet-5",
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: image } },
            { type: "text", text: PROMPT + `\nWrite the "note" field in this language: ${LANGS[lang] || "English"}.` },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw await anthropicError(res);
  const out: any = await res.json();
  const text = (out.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n");
  let j: any = {};
  try {
    j = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
  } catch {}
  const num = (v: any, min: number, max: number) =>
    typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? Math.round(v) : null;
  const sis = num(j.systolic, 50, 260);
  const dia = num(j.diastolic, 30, 160);
  const pul = num(j.pulse, 30, 220);
  const readable = j.readable !== false && sis != null && dia != null && dia < sis;
  const u = out.usage || {};
  const inTok = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
  const outTok = u.output_tokens || 0;
  const pin = Number(env.PRICE_IN_PER_MTOK || "2"), pout = Number(env.PRICE_OUT_PER_MTOK || "10");
  const costMicro = Math.ceil(inTok * pin + outTok * pout); // (tokens * $/Mtok) = millionths of a dollar
  return { reading: { readable, sis, dia, pul, note: typeof j.note === "string" ? j.note.slice(0, 200) : "" }, costMicro };
}

/**
 * Every day (cron in wrangler.toml): readings and photo readings older than 365 days are deleted (lab results are
 * kept until the person deletes them), and so are expired
 * web codes, sessions and share links. The record of accepted terms (acceptances) is kept, as proof.
 */
export async function purgeOld(env: Env) {
  await anonymizeGoogle(env);
  const q: Q = async (text, params = []) => (await env.DB.prepare(text).bind(...params).all()).results || [];
  await fillLocalDates(q);
  const now = Date.now(), yearAgo = now - 365 * 864e5;
  await env.DB.batch([
    // lab results are never deleted here: they stay until the person deletes them (a date, a report or the account)
    env.DB.prepare("DELETE FROM measurements WHERE kind != 'lab' AND taken_at < ?1").bind(yearAgo),
    env.DB.prepare("DELETE FROM scans WHERE created_at < ?1").bind(yearAgo),
    env.DB.prepare("DELETE FROM web_codes WHERE expires_at < ?1").bind(now),
    env.DB.prepare("DELETE FROM web_sessions WHERE expires_at < ?1").bind(now),
    env.DB.prepare("DELETE FROM web_shares WHERE expires_at < ?1").bind(now),
    env.DB.prepare("DELETE FROM error_log WHERE last_at < ?1").bind(now - 90 * 864e5),
    env.DB.prepare("DELETE FROM seen_sigs WHERE expires_at < ?1").bind(now),
    env.DB.prepare("DELETE FROM rate_limits WHERE window_start < ?1").bind(now - 2 * 864e5),
  ]);
}

export default {
  async scheduled(_event: unknown, env: Env): Promise<void> {
    await purgeOld(env);
  },

  async fetch(req: Request, env: Env, ctx?: { waitUntil(p: Promise<unknown>): void }): Promise<Response> {
    return secured(await serve(req, env, ctx));
  },
};

/** Calls that passed authentication (a verified phone signature or a valid web session). */
const AUTHENTICATED = new WeakSet<Request>();
/** Route names for the error log: a known route, or "unknown" (never a path typed by a stranger). */
const ROUTES = new Set([
  "/v1/me", "/v1/accept", "/v1/web/code", "/v1/signout", "/v1/credit", "/v1/admin/credit", "/v1/credit/history",
  "/v1/admin/settings", "/v1/admin/app-min-version", "/v1/admin/invites", "/v1/admin/subscription", "/v1/key", "/v1/key/check",
  "/v1/bp/scan", "/v1/bp/confirm", "/v1/bp/voice", "/v1/bp", "/v1/sub/verify", "/v1/log", "/v1/register", "/v1/auth/google",
  "/my/session", "/my/api/me", "/my/api/data", "/my/api/share", "/my/api/shares", "/my/api/log", "/my/api/admin/overview",
  "/my/api/admin/app-min-version", "/my/api/admin/security", "/my/api/admin/security/fix", "/my/api/admin/security/status", "/hooks/fix-status",
]);
const routeName = (method: string, path: string) => (ROUTES.has(path) ? method + " " + path : "unknown");

async function serve(req: Request, env: Env, ctx?: { waitUntil(p: Promise<unknown>): void }): Promise<Response> {
  {
    const url = new URL(req.url);
    if (url.pathname === "/v1/health") return json({ ok: true });
    // public pages, linked from Google's sign-in screen
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/home")) return homePage();
    if (req.method === "GET" && url.pathname === "/privacy") return privacyPage(env.CONTACT_EMAIL || "");
    if (req.method === "GET" && url.pathname === "/terms") return termsPage(url.searchParams.get("lang") || (req.headers.get("accept-language") || "en").slice(0, 2).toLowerCase());
    // the easy address to share: always the latest app
    if (req.method === "GET" && url.pathname === "/download") return Response.redirect(url.origin + "/HINT.apk", 302);
    if (req.method === "GET" && url.pathname === "/HINT.apk") {
      const version = Number(env.APP_VERSION) || 98;
      return new Response(null, { status: 302, headers: { Location: `https://github.com/comevava76-web/personalhealthy/releases/download/v0.1.${version}/HealthyInstantTracker-0.1.${version}.apk`, "Cache-Control": "no-store" } });
    }
    const q: Q = async (text, params = []) => (await env.DB.prepare(text).bind(...params).all()).results || [];
    try {
      // asked by the app when it opens, before anything else: is this version still allowed?
      if (req.method === "GET" && url.pathname === "/v1/app-status")
        return json({ ok: await appAllowed(q, Number(url.searchParams.get("v")) || 0), download: url.origin + "/download" });
      // My Dash in the browser (/my/...) and the links shared with the doctor (/s/...)
      const res = (await handleWeb(req, env, q, url, (pid: string) => subOk(q, env, pid), () => AUTHENTICATED.add(req)))
        ?? (await handle(req, env, q, url));
      // errors met by users go to the error log, grouped (see errors.ts). Logged only for calls that passed
      // authentication, or for server failures (5xx): a stranger cannot write into the log (test report F-03).
      // Not logged: pages not found, a subscription that ran out and an app version switched off (expected answers).
      const api = url.pathname.startsWith("/v1/") || url.pathname.startsWith("/my/api/");
      const authed = AUTHENTICATED.has(req);
      if (api && res.status >= 400 && ![402, 404, 426].includes(res.status) && !url.pathname.endsWith("/log") && (authed || res.status >= 500)) {
        const task = (async () => {
          let code = "http_" + res.status, message = "";
          try { const j: any = await res.clone().json(); code = j.code || code; message = j.error || ""; } catch {}
          // a browser opening the Web Dashboard without a session is the normal way in, not an error
          if (code === "no_session") return;
          await logError(q, {
            source: "server", code, place: routeName(req.method, url.pathname), message,
            appVersion: authed ? req.headers.get("X-App-Version") : null,
            personId: authed && url.pathname.startsWith("/v1/") ? req.headers.get("X-Person") : null,
          });
        })();
        if (ctx) ctx.waitUntil(task); else await task;
      }
      return res;
    } catch (e: any) {
      console.error("worker request failed");
      const task = logError(q, { source: "server", code: "exception", place: routeName(req.method, url.pathname), message: String(e?.message || e) });
      if (ctx) ctx.waitUntil(task); else await task;
      return fail("Internal server error", 500, "server");
    }
  }
}

async function handle(req: Request, env: Env, q: Q, url: URL): Promise<Response> {
  if (!url.pathname.startsWith("/v1/")) return fail("Not found", 404, "not_found");
  // Bound streaming input before allocation, including requests without Content-Length.
  const chunks: Uint8Array[] = []; let size = 0;
  const reader = req.body?.getReader();
  if (reader) {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.length;
      if (size > 8 * 1024 * 1024) { await reader.cancel(); return fail("Request too large", 413, "too_large"); }
      chunks.push(value);
    }
  }
  const body = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
  const ts = req.headers.get("X-Ts") || "";
  const sig = req.headers.get("X-Sig") || "";
  const tsn = Number(ts);
  if (!tsn || Math.abs(Date.now() - tsn) > 5 * 60e3)
    return fail("Phone clock is wrong: turn on automatic date and time.", 401, "bad_clock");
  // a version switched off remotely can do nothing at all
  if (!(await appAllowed(q, Number(req.headers.get("X-App-Version")) || 0)))
    return fail("This version of HINT 365 has been switched off: install the latest one.", 426, "app_disabled");
  const message = `${req.method}\n${url.pathname + url.search}\n${ts}\n${await sha256Hex(body)}`;
  let data: any = {};
  if (body.length) {
    try {
      data = JSON.parse(new TextDecoder().decode(body));
    } catch {
      return fail("Invalid request", 400, "generic");
    }
  }

  // Phone activation: the family code (family member, the owner pays) or a single-use invite code,
  // plus the anonymous key generated on the phone
  if (req.method === "POST" && url.pathname === "/v1/register") {
    if (await tooMany(q, await ipKey(req, "register"), 10, HOUR)) return fail("Too many attempts: try again later", 429, "too_many");
    const typed = String(data.code ?? data.familyCode ?? "").trim();
    const isFamily = !!env.FAMILY_CODE && typed === env.FAMILY_CODE;
    const invite = isFamily ? "" : normInvite(typed);
    if (!isFamily && !invite) return fail("Invalid code", 403, "family_code");
    if (typeof data.publicKey !== "string" || !(await verify(data.publicKey, sig, message)))
      return fail("Invalid phone key", 401, "bad_key");
    const [existing] = await q("SELECT id, pays FROM persons WHERE public_key = ?1", [data.publicKey]);
    if (existing) return json({ personId: existing.id, pays: existing.pays || "owner" });
    const id = newId("per_");
    const now = Date.now();
    if (isFamily) {
      // the first activated phone manages credit, settings and invites
      await q(
        "INSERT INTO persons (id, public_key, is_admin, pays, created_at, created_at_local) " +
        "VALUES (?1, ?2, 0, 'self', ?3, ?4)",
        [id, data.publicKey, now, localStamp(now)]
      );
      return json({ personId: id, pays: "self" });
    }
    // Invite: one atomic step that marks the invite as used and creates the person, or does nothing
    const results = await env.DB.batch([
      env.DB.prepare(
        "UPDATE invites SET used_by = ?1, used_at = ?2, used_at_local = ?3 WHERE code = ?4 AND used_by IS NULL AND expires_at > ?2"
      ).bind(id, now, localStamp(now), invite),
      env.DB.prepare(
        `INSERT INTO persons (id, public_key, is_admin, pays, created_at, created_at_local)
         SELECT ?1, ?2, 0, 'self', ?3, ?4 FROM invites WHERE code = ?5 AND used_by = ?1`
      ).bind(id, data.publicKey, now, localStamp(now), invite),
    ]);
    if (!results[1]?.meta?.changes) {
      const [inv] = await q("SELECT used_by, expires_at FROM invites WHERE code = ?1", [invite]);
      if (!inv) return fail("Invalid code", 403, "family_code");
      if (inv.used_by) return fail("Invite already used", 403, "invite_used");
      return fail("Invite expired", 403, "invite_expired");
    }
    const [p] = await q("SELECT pays FROM persons WHERE id = ?1", [id]);
    return json({ personId: id, pays: p?.pays || "owner" });
  }

  // Sign in with Google. One call for everything:
  //  - this Google account already has an account: this phone takes its place (new phone, reinstall);
  //    the old phone is disconnected;
  //  - this phone already has an account without Google (earlier versions): Google is linked to it;
  //  - otherwise a new account, which pays its own photo readings with its own Anthropic key.
  // After this, day to day the phone only uses its own key, unlocked with fingerprint or face.
  if (req.method === "POST" && url.pathname === "/v1/auth/google") {
    if (!env.GOOGLE_CLIENT_ID) return fail("Google sign-in is not set up", 503, "google_off");
    if (await tooMany(q, await ipKey(req, "google"), 20, HOUR)) return fail("Too many attempts: try again later", 429, "too_many");
    if (typeof data.publicKey !== "string" || !(await verify(data.publicKey, sig, message)))
      return fail("Invalid phone key", 401, "bad_key");
    const g = await verifyGoogle(String(data.idToken || ""), env.GOOGLE_CLIENT_ID);
    if (!g) return fail("Google sign-in not valid", 401, "google_invalid");
    // the token must have been asked for this very phone key: a token taken elsewhere cannot be replayed
    const expectedNonce = b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(data.publicKey))));
    if (!g.nonce || g.nonce !== expectedNonce) return fail("Google sign-in not valid", 401, "google_invalid");
    const now = Date.now();
    const [unusedToken] = await q("INSERT INTO seen_sigs (sig_hash, expires_at) VALUES (?1, ?2) ON CONFLICT (sig_hash) DO NOTHING RETURNING sig_hash",
      [await sha256Hex(enc.encode("google-token:" + data.idToken)), now + 10 * 60e3]);
    if (!unusedToken) return fail("Google sign-in already used", 401, "google_invalid");
    const gid = await googleId(env, g.sub);
    const [owner] = await q("SELECT id, COALESCE(pays, 'owner') AS pays FROM persons WHERE google_sub = ?1 OR google_sub = ?2", [gid, g.sub]);
    const [onPhone] = await q("SELECT id, google_sub FROM persons WHERE public_key = ?1", [data.publicKey]);
    if (owner) {
      if (onPhone && onPhone.id !== owner.id) {
        // this phone holds another account: only an empty one without Google may be replaced
        const [used] = await q("SELECT 1 FROM measurements WHERE person_id = ?1 LIMIT 1", [onPhone.id]);
        if (onPhone.google_sub || used) return fail("This phone is used by another account", 409, "phone_in_use");
        // the empty account goes with everything it had (only the acceptances stay, as proof)
        await endWebAccess(q, onPhone.id, true);
        await env.DB.batch([
          env.DB.prepare("DELETE FROM scans WHERE person_id = ?1").bind(onPhone.id),
          env.DB.prepare("DELETE FROM person_keys WHERE person_id = ?1").bind(onPhone.id),
          env.DB.prepare("DELETE FROM ledger WHERE payer = ?1 OR person_id = ?1").bind(onPhone.id),
          env.DB.prepare("DELETE FROM persons WHERE id = ?1").bind(onPhone.id),
        ]);
      }
      await endWebAccess(q, String(owner.id), false);
      await q("UPDATE persons SET public_key = ?1, google_sub = ?2, email = NULL WHERE id = ?3", [data.publicKey, gid, owner.id]);
      return json({ personId: owner.id, pays: owner.pays, recovered: true });
    }
    if (data.consent !== true) return fail("Consent needed", 400, "consent_required");
    if (onPhone) {
      if (onPhone.google_sub) return fail("This phone is linked to another Google account", 409, "google_other");
      await q("UPDATE persons SET google_sub = ?1, email = NULL, consent_at = ?2 WHERE id = ?3", [gid, now, onPhone.id]);
      const [p] = await q("SELECT COALESCE(pays, 'owner') AS pays FROM persons WHERE id = ?1", [onPhone.id]);
      return json({ personId: onPhone.id, pays: p?.pays || "owner", linked: true });
    }
    // everyone pays their own photo readings with their own Anthropic key, set up in the app right after
    const id = newId("per_");
    await q(
      "INSERT INTO persons (id, public_key, is_admin, pays, google_sub, email, consent_at, created_at, created_at_local) " +
      "VALUES (?1, ?2, ?7, 'self', ?3, ?4, ?5, ?5, ?6)",
      [id, data.publicKey, gid, null, now, localStamp(now), env.OWNER_GOOGLE_ID && env.OWNER_GOOGLE_ID === gid ? 1 : 0]
    );
    return json({ personId: id, pays: "self" });
  }

  // Everything else requires the registered phone's signature
  const pid = req.headers.get("X-Person") || "";
  const [person] = await q("SELECT id, public_key, is_admin, COALESCE(pays, 'owner') AS pays, google_sub, email FROM persons WHERE id = ?1", [pid]);
  if (!person || !(await verify(person.public_key, sig, message))) return fail("Unauthorized", 401, "unauthorized");
  AUTHENTICATED.add(req);
  // a signed call that changes something works once: the same call sent again (a copy taken on the way) is refused
  // (test report F-04). Reads change nothing, so they are not recorded: half the writes on the database.
  if (req.method !== "GET") {
    const sigHash = await sha256Hex(enc.encode(pid + "\n" + message));
    const [fresh] = await q("INSERT INTO seen_sigs (sig_hash, expires_at) VALUES (?1, ?2) ON CONFLICT (sig_hash) DO NOTHING RETURNING sig_hash",
      [sigHash, Date.now() + 10 * 60e3]);
    if (!fresh) return fail("This request was already used", 401, "replay");
  }
  // An error met in the app (a crash, a screen that failed): into the grouped error log, never a reading value
  if (req.method === "POST" && url.pathname === "/v1/log") {
    if (await tooMany(q, "log:" + pid, 100, DAY)) return json({ ok: true, dropped: true });
    await logError(q, {
      source: "app", code: String(data.code || "app_error"), place: String(data.place || ""),
      message: String(data.message || ""), appVersion: req.headers.get("X-App-Version"), personId: pid,
    });
    return json({ ok: true });
  }

  const requiresNotice = req.method === "POST" && ["/v1/bp/voice", "/v1/bp/scan", "/v1/bp/confirm", "/v1/labs", "/v1/web/code"].includes(url.pathname);
  if (requiresNotice && !(await acceptedNotice(q, pid))) return fail("Accept the current terms first", 403, "notice_required");

  // no valid subscription: only the invitation to renew
  if (!SUB_FREE.has(req.method + " " + url.pathname) && !(req.method === "DELETE" && /^\/v1\/(bp|labs)(?:\/[^/]+)?$/.test(url.pathname)) && !(await subOk(q, env, pid)))
    return fail("The HINT 365 subscription has run out: renew it to use the app again.", 402, "sub_expired");
  const pool = poolOf(person);
  // everyone pays their own AI with their own Anthropic key; the owner-paid model is gone (test report F-08)
  const selfPays = true;
  const hasKey = async () => !!(await q("SELECT 1 FROM person_keys WHERE person_id = ?1", [pid]))[0];
  // Scan is on only when Anthropic itself said yes: key accepted and credit available, at the last real check
  const aiState = async () => {
    if (!selfPays) return { aiStatus: "ok", aiCheckedAt: null };
    const [k] = await q("SELECT COALESCE(status, 'ok') AS status, checked_at FROM person_keys WHERE person_id = ?1", [pid]);
    return k ? { aiStatus: String(k.status), aiCheckedAt: k.checked_at == null ? null : Number(k.checked_at) } : { aiStatus: "none", aiCheckedAt: null };
  };

  // 0) Who am I, and the credit of my own pool (a friend never sees the owner's pool, nor the other way round)
  if (req.method === "GET" && url.pathname === "/v1/me") {
    // (Google fingerprints and readable local dates are completed by the nightly job, not here: test report F-02)
    // when the app was last opened: shown to the owner as a usage figure, nothing more
    // and with which app version: the owner sees, for every account, the version it really runs
    // kept only if it is a version that really exists (a header can say anything)
    const sent = Number(req.headers.get("X-App-Version")) || 0;
    const code = sent > 0 && sent <= (Number(env.APP_VERSION) || Infinity) ? sent : 0;
    await q("UPDATE persons SET last_seen_at = ?1, app_version = COALESCE(?2, app_version) WHERE id = ?3", [Date.now(), code ? "0.1." + code : null, pid]);
    return json({
      personId: pid,
      isAdmin: !!person.is_admin,
      pays: person.pays,
      hasKey: selfPays ? await hasKey() : false,
      hasGoogle: !!person.google_sub,
      email: null,   // never stored: the phone keeps it for itself
      googleOn: !!env.GOOGLE_CLIENT_ID,
      billingMode: await getSetting(q, "billing_mode", "private"),
      credit: await creditInfo(q, pool),
      disclaimerOk: await acceptedNotice(q, pid),
      ...(await aiState()),
      ...(person.is_admin ? { appMinVersion: (await appGate(q)).min, subscriptionOn: (await getSetting(q, "subscription_on", "0")) === "1" } : {}),
      sub: await subState(q, env, pid),
    });
  }

  // A purchase or renewal made in Google Play: checked with Google Play, then kept (token and end date only)
  if (req.method === "POST" && url.pathname === "/v1/sub/verify") {
    if (!env.PLAY_SERVICE_ACCOUNT) return fail("Subscriptions cannot be checked yet", 503, "sub_unavailable");
    const token = String(data.purchaseToken || "");
    if (!token || token.length > 4096) return fail("Invalid purchase", 400, "sub_invalid");
    const [other] = await q("SELECT id FROM persons WHERE sub_token = ?1 AND id <> ?2", [token, pid]);
    if (other) return fail("This subscription belongs to another account", 409, "sub_other_account");
    const g = await playSubscription(env.PLAY_SERVICE_ACCOUNT, token);
    if (!g) return fail("Google Play does not know this purchase", 400, "sub_invalid");
    if (g.account && g.account !== (await playAccountId(pid))) return fail("This subscription belongs to another account", 409, "sub_other_account");
    const [assigned] = await q("UPDATE persons SET sub_token = ?1, sub_until = ?2, sub_state = ?3, sub_checked_at = ?4 WHERE id = ?5 AND NOT EXISTS (SELECT 1 FROM persons WHERE sub_token = ?1 AND id <> ?5) RETURNING id",
      [token, g.until, g.state, Date.now(), pid]);
    if (!assigned) return fail("This subscription belongs to another account", 409, "sub_other_account");
    return json({ sub: await subState(q, env, pid), package: PLAY_PACKAGE, product: SUB_PRODUCT });
  }
  // The owner switches the subscription on (everyone else must then pay) or off (the app is free for everyone)
  if (req.method === "POST" && url.pathname === "/v1/admin/subscription") {
    if (!person.is_admin) return fail("Only the app owner can change this", 403, "admin_only");
    const on = data.on === true;
    if (on && !env.PLAY_SERVICE_ACCOUNT) return fail("Subscriptions cannot be checked yet", 503, "sub_unavailable");
    await q("INSERT INTO settings (key, value) VALUES ('subscription_on', ?1) ON CONFLICT (key) DO UPDATE SET value = excluded.value", [on ? "1" : "0"]);
    return json({ subscriptionOn: on });
  }
  // The notice accepted on the phone: recorded with who, which phone, which text and when. Never changed afterwards.
  if (req.method === "POST" && url.pathname === "/v1/accept") {
    if (data.doc !== "disclaimer" || data.version !== DISCLAIMER_VERSION || data.healthConsent !== true) return fail("Unknown notice version", 400, "bad_version");
    const lang = String(data.lang || "").toLowerCase();
    if (!NOTICE_TEXT[lang]) return fail("Unsupported notice language", 400, "bad_version");
    const textHash = await sha256Hex(enc.encode(NOTICE_TEXT[lang]));
    if (data.textSha256 !== textHash) return fail("Notice text differs from the current version", 400, "bad_version");
    const now = Date.now();
    const device = [...new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(person.public_key)))]
      .map((b) => b.toString(16).padStart(2, "0")).join("");
    const str = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : null);
    await q(
      "INSERT INTO acceptances (id, person_id, email, device, phone, doc, version, lang, text_sha256, app_version, accepted_at, accepted_at_local) " +
      "VALUES (?1, ?2, ?3, ?4, ?5, 'disclaimer', ?6, ?7, ?8, ?9, ?10, ?11)",
      [newId("acc_"), pid, null, device, str(data.phone, 80), DISCLAIMER_VERSION, str(data.lang, 8),
       textHash, req.headers.get("X-App-Version"), now, localStamp(now)]
    );
    return json({ ok: true });
  }

  if (url.pathname === "/v1/labs" && req.method === "GET") {
    return json({ items: await loadLabs(q, pid) });
  }
  if (url.pathname === "/v1/labs" && req.method === "POST") {
    if (await tooMany(q, "labs:" + pid, 30, DAY)) return fail("Too many imports", 429, "too_many");
    const lab = validateLabImport(data);
    if (!lab) return fail("Check the lab results and date", 400, "lab_invalid");
    const id = "lab_" + lab.id;
    const [existing] = await q("SELECT person_id, data, taken_at FROM measurements WHERE id = ?1", [id]);
    if (existing) {   // the same import sent again (a retry): the same answer, nothing saved twice
      if (existing.person_id !== pid || Number(existing.taken_at) !== lab.takenAt) return fail("Import identifier already used", 409, "lab_conflict");
      return json({ ok: true, id });
    }
    const fileKey = lab.fileHash ? await labFileKey(env.KEY_ENCRYPTION_KEY, pid, lab.fileHash) : null;
    const r = await saveLab(env.DB, q, pid, lab, fileKey, TZ, localStamp);
    if (r.status === "conflict") return fail("This report has different results from those already saved for the same day", 409, "lab_conflict_values");
    if (r.status === "duplicate") return json({ ok: true, id: r.id, duplicate: r.reason });
    return json({ ok: true, id: r.id, saved: r.saved, known: r.known });
  }
  if (url.pathname.startsWith("/v1/labs/") && req.method === "DELETE") {
    await deleteLabs(env.DB, pid, { id: url.pathname.split('/').pop() || "" });
    return json({ ok: true });
  }

  // My Dash: a one-time code to open the web dashboard already signed in (see web.ts)
  if (req.method === "POST" && url.pathname === "/v1/web/code") return newWebCode(q, pid, url.origin);

  // Sign out of this phone: the phone is forgotten, the data stays and comes back with Google on any phone
  if (req.method === "POST" && url.pathname === "/v1/signout") {
    if (!person.google_sub) return fail("Link Google first, or you could not sign in again", 409, "google_needed");
    await endWebAccess(q, pid, false);   // browsers signed in to My Dash from this phone are signed out too
    await q("UPDATE persons SET public_key = ?1 WHERE id = ?2", ["signed-out:" + pid, pid]);
    return json({ ok: true });
  }

  // Delete my account and all my data (right to erasure). The app asks twice. The app manager cannot:
  // the family's credit and invites depend on them. The record of the accepted notice is kept, as proof.
  if (req.method === "DELETE" && url.pathname === "/v1/me") {
    if (person.is_admin) return fail("The app manager cannot delete their account", 403, "admin_delete");
    await endWebAccess(q, pid, true);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM lab_files WHERE person_id = ?1").bind(pid),
      env.DB.prepare("DELETE FROM measurements WHERE person_id = ?1").bind(pid),
      env.DB.prepare("DELETE FROM scans WHERE person_id = ?1").bind(pid),
      env.DB.prepare("DELETE FROM person_keys WHERE person_id = ?1").bind(pid),
      env.DB.prepare("DELETE FROM ledger WHERE payer = ?1").bind(pid),                     // their own money records
      env.DB.prepare("UPDATE ledger SET person_id = NULL WHERE person_id = ?1").bind(pid),  // photos on the shared credit: kept, without who
      env.DB.prepare("UPDATE error_log SET person_id = NULL WHERE person_id = ?1").bind(pid),
      env.DB.prepare("DELETE FROM invites WHERE used_by = ?1 OR created_by = ?1").bind(pid),
      env.DB.prepare("DELETE FROM persons WHERE id = ?1").bind(pid),
    ]);
    return json({ ok: true });
  }

  // Money added or balance corrected, always on the caller's own pool.
  // The owner's pool is managed only by the administrator; each friend manages their own.
  if (req.method === "POST" && (url.pathname === "/v1/credit" || url.pathname === "/v1/admin/credit")) {
    if (!selfPays && !person.is_admin) return fail("Only the app manager can change the credit", 403, "admin_only");
    const amount = Number(data.amount);
    if (!(amount >= 0 && amount <= 1000)) return fail("Invalid amount", 400, "bad_amount");
    const kind = data.action === "set" ? "set" : "topup";
    if (kind === "topup" && amount <= 0) return fail("Invalid amount", 400, "bad_amount");
    await addMoney(q, pool, pid, kind, amount);
    return json({ credit: await creditInfo(q, pool) });
  }
  // Last 20 movements of the caller's own pool: top-ups, balance corrections and the cost of each photo
  if (req.method === "GET" && url.pathname === "/v1/credit/history") {
    const rows = await q(`SELECT kind, amount_micro, created_at FROM ledger WHERE ${POOL_WHERE} ORDER BY seq DESC LIMIT 20`, [pool]);
    return json({
      items: rows.map((r: any) => ({ kind: r.kind, amount: Number(r.amount_micro) / MICRO, at: Number(r.created_at) })),
    });
  }
  if (req.method === "POST" && url.pathname === "/v1/admin/settings") {
    if (!person.is_admin) return fail("Only the app manager can change the settings", 403, "admin_only");
    const mode = String(data.billingMode || "");
    if (mode === "per_user") return fail("Per-user payment is not available yet", 400, "mode_unavailable");
    if (mode !== "private") return fail("Invalid mode", 400, "generic");
    await q("INSERT INTO settings (key, value) VALUES ('billing_mode', ?1) ON CONFLICT (key) DO UPDATE SET value = excluded.value", [mode]);
    return json({ billingMode: mode });
  }

  // Switch off older apps (administrator only): every version below minVersion stops working; 0 lets them all work again
  if (req.method === "POST" && url.pathname === "/v1/admin/app-min-version") {
    if (!person.is_admin) return fail("Only the app manager can switch versions off", 403, "admin_only");
    const min = Math.max(0, Math.floor(Number(data.minVersion) || 0));
    // never below the administrator's own app, or nobody could switch it back on from the phone
    const own = Number(req.headers.get("X-App-Version")) || 0;
    if (min > own) return fail("Invalid version", 400, "generic");
    await q("INSERT INTO settings (key, value) VALUES ('app_min_version', ?1) ON CONFLICT (key) DO UPDATE SET value = excluded.value", [String(min)]);
    return json({ appMinVersion: min });
  }

  // Invite someone (administrator only): single-use code, valid 7 days
  if (req.method === "POST" && url.pathname === "/v1/admin/invites") {
    if (!person.is_admin) return fail("Only the app manager can invite", 403, "admin_only");
    const type = data.type === "self_pays" ? "self_pays" : data.type === "owner_pays" ? "owner_pays" : "";
    if (!type) return fail("Invalid invite type", 400, "generic");
    const now = Date.now();
    const expires = now + INVITE_DAYS * 864e5;
    const code = newInviteCode();
    await q(
      "INSERT INTO invites (code, type, created_by, created_at, expires_at, created_at_local, expires_at_local) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
      [code, type, pid, now, expires, localStamp(now), localStamp(expires)]
    );
    return json({ code, type, expiresAt: expires });
  }

  // A friend's own Anthropic key: tested, then stored encrypted. It is never sent back to the phone.
  if (url.pathname === "/v1/key") {
    if (!selfPays) return fail("Only people who pay for their own photos have a key", 403, "not_self_pays");
    if (req.method === "DELETE") {
      await q("DELETE FROM person_keys WHERE person_id = ?1", [pid]);
      return json({ hasKey: false, credit: await creditInfo(q, pool) });
    }
    if (req.method === "POST") {
      const apiKey = String(data.apiKey || "").trim();
      if (!/^sk-ant-[A-Za-z0-9_-]{20,300}$/.test(apiKey)) return fail("This does not look like an Anthropic key", 400, "friend_key_invalid");
      const amount = data.amount == null || data.amount === "" ? null : Number(data.amount);
      if (amount != null && !(amount >= 0 && amount <= 1000)) return fail("Invalid amount", 400, "bad_amount");
      if (!env.KEY_ENCRYPTION_KEY) return fail("The server cannot store keys yet", 500, "server");
      try {
        await testKey(env, apiKey);
      } catch (e: any) {
        console.error("key test failed"); // Anthropic's reply; never the key itself
        if (e instanceof NoAnthropicCredit) return fail("Key works, but the Anthropic credit is empty", 402, "friend_no_credit");
        if (e instanceof BadAnthropicKey) return fail("Anthropic does not accept this key", 400, "friend_key_invalid");
        return fail("Could not check the key. Try again shortly.", 502, "key_test_failed");
      }
      const sealed = await sealKey(env, pid, apiKey);
      const now = Date.now();
      await q(
        "INSERT INTO person_keys (person_id, sealed_key, created_at, created_at_local, status, checked_at) VALUES (?1, ?2, ?3, ?4, 'ok', ?3) " +
        "ON CONFLICT (person_id) DO UPDATE SET sealed_key = excluded.sealed_key, created_at = excluded.created_at, created_at_local = excluded.created_at_local, status = 'ok', checked_at = excluded.checked_at",
        [pid, sealed, now, localStamp(now)]
      );
      if (amount != null) await addMoney(q, pool, pid, "set", amount);
      return json({ hasKey: true, credit: await creditInfo(q, pool) });
    }
  }

  // Is the AI usable right now? Asks Anthropic with the smallest possible request (a few thousandths of a cent)
  // and stores the answer: "ok", "no_credit" (the Anthropic account is empty) or "invalid" (key refused).
  // Anthropic has no way to read the balance itself; this is the only certain check: it either answers or refuses.
  if (req.method === "POST" && url.pathname === "/v1/key/check") {
    if (!selfPays) return json({ aiStatus: "ok", aiCheckedAt: null });
    const [k] = await q("SELECT sealed_key FROM person_keys WHERE person_id = ?1", [pid]);
    if (!k) return json({ aiStatus: "none", aiCheckedAt: null });
    let status = "ok";
    try {
      await testKey(env, await openKey(env, pid, String(k.sealed_key)));
    } catch (e: any) {
      if (e instanceof NoAnthropicCredit) status = "no_credit";
      else if (e instanceof BadAnthropicKey) status = "invalid";
      else return fail("Could not reach Anthropic. Try again shortly.", 502, "key_test_failed");   // unknown: state unchanged
    }
    const now = Date.now();
    await q("UPDATE person_keys SET status = ?1, checked_at = ?2 WHERE person_id = ?3", [status, now, pid]);
    return json({ aiStatus: status, aiCheckedAt: now });
  }

  // 1) Photo reading: the numbers are decided only by the reading
  if (req.method === "POST" && url.pathname === "/v1/bp/scan") {
    if (await tooMany(q, "scan:" + pid, 60, DAY)) return fail("Too many photos today: try again tomorrow", 429, "too_many");
    const takenAt = Number(data.takenAt);
    const now = Date.now();
    if (!takenAt || takenAt > now + 2 * 60e3 || takenAt < now - 30 * 60e3)
      return fail("Invalid photo time. Retake the photo.", 400, "photo_time");
    if (typeof data.image !== "string" || data.image.length < 1000) return fail("Missing photo", 400, "no_photo");
    // Whose key pays: a friend's own key, never the owner's as a fallback
    let apiKey = env.ANTHROPIC_API_KEY;
    if (selfPays) {
      const [k] = await q("SELECT sealed_key FROM person_keys WHERE person_id = ?1", [pid]);
      if (!k) return fail("No Anthropic key yet", 402, "friend_no_key");
      try {
        apiKey = await openKey(env, pid, String(k.sealed_key));
      } catch (e: any) {
        console.error("key open failed");
        return fail("Your key can no longer be used. Add it again.", 402, "friend_key_invalid");
      }
    }
    // No limit here: the photo is always sent. The app's credit is only an estimate;
    // only Anthropic knows the real balance and refuses when it is finished.
    let r, costMicro;
    try {
      ({ reading: r, costMicro } = await readDisplay(env, apiKey, data.image, (req.headers.get("X-Lang") || "en").slice(0, 2).toLowerCase()));
    } catch (e: any) {
      console.error("provider request failed");
      if (e instanceof NoAnthropicCredit) {
        if (selfPays) await q("UPDATE person_keys SET status = 'no_credit', checked_at = ?1 WHERE person_id = ?2", [Date.now(), pid]);
        return selfPays ? fail("Your Anthropic credit is finished", 402, "friend_no_credit") : fail("Anthropic credit is finished", 402, "anthropic_no_credit");
      }
      if (e instanceof BadAnthropicKey && selfPays) {
        await q("UPDATE person_keys SET status = 'invalid', checked_at = ?1 WHERE person_id = ?2", [Date.now(), pid]);
        return fail("Anthropic does not accept your key", 402, "friend_key_invalid");
      }
      return fail("Reading failed. Try again shortly.", 502, "read_failed");
    }
    // Anthropic just answered: the key works and there is credit
    if (selfPays) await q("UPDATE person_keys SET status = 'ok', checked_at = ?1 WHERE person_id = ?2", [Date.now(), pid]);
    const scanId = newId("scn_");
    await q(
      "INSERT INTO scans (id, person_id, kind, result, taken_at, used, created_at, taken_at_local, created_at_local) " +
      "VALUES (?1, ?2, 'bp', ?3, ?4, 0, ?5, ?6, ?7)",
      [scanId, pid, JSON.stringify(r), takenAt, now, localStamp(takenAt), localStamp(now)]
    );
    await q(
      "INSERT INTO ledger (kind, amount_micro, person_id, payer, scan_id, created_at, created_at_local) VALUES ('usage', ?1, ?2, ?3, ?4, ?5, ?6)",
      [costMicro, pid, pool, scanId, now, localStamp(now)]
    );
    return json({ scanId, ...r, takenAt, period: periodOf(takenAt), credit: await creditInfo(q, pool) });
  }

  // 2) Confirm: save exactly what was read (the phone cannot change the numbers)
  if (req.method === "POST" && url.pathname === "/v1/bp/confirm") {
    const [s] = await q(
      "SELECT id, result, used, taken_at, created_at FROM scans WHERE id = ?1 AND person_id = ?2 AND kind = 'bp'",
      [String(data.scanId || ""), pid]
    );
    if (!s) return fail("Scan not found", 404, "not_found");
    if (s.used) return fail("Measurement already saved", 409, "already_saved");
    if (Date.now() - Number(s.created_at) > 60 * 60e3) return fail("Scan expired, retake the photo", 400, "scan_expired");
    const r = JSON.parse(s.result);
    if (!r.readable) return fail("Scan was not valid, retake the photo", 400, "scan_invalid");
    const id = newId("bp_");
    const takenMs = Number(s.taken_at);
    const period = periodOf(takenMs);
    const now = Date.now();
    // A single atomic operation: the measurement is inserted only if the scan was not already used
    const results = await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO measurements (id, person_id, kind, taken_at, tz, period, data, source, scan_id, created_at, taken_at_local, created_at_local)
         SELECT ?1, ?2, 'bp', ?3, ?4, ?5, ?6, 'photo', ?7, ?8, ?9, ?10
         WHERE EXISTS (SELECT 1 FROM scans WHERE id = ?7 AND used = 0)`
      ).bind(id, pid, takenMs, TZ, period, JSON.stringify({ sis: r.sis, dia: r.dia, pul: r.pul }), s.id, now, localStamp(takenMs), localStamp(now)),
      env.DB.prepare("UPDATE scans SET used = 1 WHERE id = ?1").bind(s.id),
    ]);
    if (!results[0]?.meta?.changes) return fail("Measurement already saved", 409, "already_saved");
    return json({ id, takenAt: takenMs, period, sis: r.sis, dia: r.dia, pul: r.pul });
  }

  // 2b) Values said aloud, after the person confirmed them on screen: marked 'voice' so reports can tell them
  // from photo readings. All three values are needed. Date and time: when they were said, accepted only
  // if that was in the last 15 minutes (not in the future). Same limits as a photo reading.
  if (req.method === "POST" && url.pathname === "/v1/bp/voice") {
    if (await tooMany(q, "voice:" + pid, 60, DAY)) return fail("Too many readings today: try again tomorrow", 429, "too_many");
    const num = (v: any, min: number, max: number) =>
      typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? Math.round(v) : null;
    const sis = num(data.sis, 50, 260), dia = num(data.dia, 30, 160);
    const pul = num(data.pul, 30, 220);
    if (sis == null || dia == null || pul == null || dia >= sis)
      return fail("Values out of range", 400, "voice_invalid");
    const now = Date.now();
    const spokenAt = Number(data.spokenAt);
    if (!Number.isFinite(spokenAt) || spokenAt > now + 60e3 || now - spokenAt > 15 * 60e3)
      return fail("Too long since the values were said", 400, "voice_time");
    const id = newId("bp_");
    const takenMs = Math.min(Math.round(spokenAt), now);
    const period = periodOf(takenMs);
    await q(
      "INSERT INTO measurements (id, person_id, kind, taken_at, tz, period, data, source, created_at, taken_at_local, created_at_local) " +
      "VALUES (?1, ?2, 'bp', ?3, ?4, ?5, ?6, 'voice', ?7, ?8, ?9)",
      [id, pid, takenMs, TZ, period, JSON.stringify({ sis, dia, pul }), now, localStamp(takenMs), localStamp(now)]
    );
    return json({ id, takenAt: takenMs, period, sis, dia, pul, source: "voice" });
  }

  // 3) List of measurements
  if (req.method === "GET" && url.pathname === "/v1/bp") {
    const days = Math.min(Math.max(Number(url.searchParams.get("days")) || 30, 1), 400);
    const rows = await q(
      "SELECT id, taken_at, period, data, source FROM measurements WHERE person_id = ?1 AND kind = 'bp' AND taken_at >= ?2 ORDER BY taken_at",
      [pid, Date.now() - days * 864e5]
    );
    const items = rows.map((r: any) => {
      const d = JSON.parse(r.data);
      return { id: r.id, takenAt: Number(r.taken_at), period: r.period, sis: d.sis, dia: d.dia, pul: d.pul ?? null, source: r.source || "photo" };
    });
    return json({ items });
  }

  // 4b) Delete ALL of the caller's own measurements and photo readings (asked twice in the app).
  // The credit movements stay: they are money, not measurements.
  if (req.method === "DELETE" && url.pathname === "/v1/bp") {
    const results = await env.DB.batch([
      env.DB.prepare("DELETE FROM measurements WHERE person_id = ?1 AND kind = 'bp'").bind(pid),
      env.DB.prepare("DELETE FROM scans WHERE person_id = ?1 AND kind = 'bp'").bind(pid),
    ]);
    return json({ ok: true, deleted: results[0]?.meta?.changes ?? 0 });
  }

  // 4) Delete a measurement (any id of the caller's own measurements)
  const del = url.pathname.match(/^\/v1\/bp\/([A-Za-z0-9_]+)$/);
  if (req.method === "DELETE" && del) {
    await q("DELETE FROM measurements WHERE id = ?1 AND person_id = ?2 AND kind = 'bp'", [del[1], pid]);
    return json({ ok: true });
  }

  return fail("Not found", 404, "not_found");
}
