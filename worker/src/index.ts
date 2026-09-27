// PersonalHealthy API (used by the HealthyInstantTracker app).
// Runs on Cloudflare Workers with the D1 database "personalhealthy" (data bound to the European Union).
// All database access goes through the q() function: to move to PostgreSQL/Azure one day,
// change q() and a few SQL expressions; the rest of the code stays the same.

import { homePage, privacyPage, termsPage } from "./pages";
import { handleWeb, newWebCode, endWebAccess } from "./web";

type Q = (text: string, params?: unknown[]) => Promise<any[]>;

interface Env {
  DB: any; // Cloudflare D1
  ASSETS: any; // the static files in public/ (the app, the guides, the My Dash page)
  ANTHROPIC_API_KEY: string;    // the owner's key: pays for every person with pays = 'owner'
  FAMILY_CODE: string;          // still works as an invite for "family member (I pay)"
  KEY_ENCRYPTION_KEY?: string;  // 32 random bytes in base64: encrypts friends' Anthropic keys in the database
  MODEL?: string;
  GOOGLE_CLIENT_ID?: string;
  CONTACT_EMAIL?: string;      // shown on the privacy page (repository variable; empty = "the support email on Google's screen")   // "Sign in with Google": the Web client ID the app asks tokens for (empty = off)
  PRICE_IN_PER_MTOK?: string;  // dollars per million input tokens
  PRICE_OUT_PER_MTOK?: string; // dollars per million output tokens
}

const MICRO = 1_000_000; // money is kept in millionths of a dollar (integers, no rounding errors)
const DEFAULT_PHOTO_COST = 6000; // $0.006 until there are real readings

/* ---------- credit and settings ---------- */
async function getSetting(q: Q, key: string, def: string): Promise<string> {
  const [r] = await q("SELECT value FROM settings WHERE key = ?1", [key]);
  return r ? String(r.value) : def;
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

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8" } });
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
async function verifyGoogle(token: string, clientId: string): Promise<{ sub: string; email: string } | null> {
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
    return { sub: String(claims.sub), email: String(claims.email || "") };
  } catch {
    return null;
  }
}

/** Version of the notice every user must accept before using the app. A new version asks everyone again. */
const DISCLAIMER_VERSION = "7";
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
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: env.MODEL || "claude-sonnet-5", max_tokens: 1, messages: [{ role: "user", content: "Hi" }] }),
  });
  if (!res.ok) throw await anthropicError(res);
}

async function readDisplay(env: Env, apiKey: string, image: string, lang: string) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
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
 * Every day (cron in wrangler.toml): readings and photo readings older than 365 days are deleted, and so are expired
 * web codes, sessions and share links. The record of accepted terms (acceptances) is kept, as proof.
 */
export async function purgeOld(env: Env) {
  await anonymizeGoogle(env);
  const now = Date.now(), yearAgo = now - 365 * 864e5;
  await env.DB.batch([
    env.DB.prepare("DELETE FROM measurements WHERE taken_at < ?1").bind(yearAgo),
    env.DB.prepare("DELETE FROM scans WHERE created_at < ?1").bind(yearAgo),
    env.DB.prepare("DELETE FROM web_codes WHERE expires_at < ?1").bind(now),
    env.DB.prepare("DELETE FROM web_sessions WHERE expires_at < ?1").bind(now),
    env.DB.prepare("DELETE FROM web_shares WHERE expires_at < ?1").bind(now),
  ]);
}

export default {
  async scheduled(_event: unknown, env: Env): Promise<void> {
    await purgeOld(env);
  },

  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/v1/health") return json({ ok: true });
    // public pages, linked from Google's sign-in screen
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/home")) return homePage();
    if (req.method === "GET" && url.pathname === "/privacy") return privacyPage(env.CONTACT_EMAIL || "");
    if (req.method === "GET" && url.pathname === "/terms") return termsPage();
    // the easy address to share: always the latest app
    if (req.method === "GET" && url.pathname === "/download") return Response.redirect(url.origin + "/HINT.apk", 302);
    const q: Q = async (text, params = []) => (await env.DB.prepare(text).bind(...params).all()).results || [];
    try {
      // My Dash in the browser (/my/...) and the links shared with the doctor (/s/...)
      const web = await handleWeb(req, env, q, url);
      if (web) return web;
      return await handle(req, env, q, url);
    } catch (e: any) {
      console.error(e?.stack || e);
      return fail("Internal server error", 500, "server");
    }
  },
};

async function handle(req: Request, env: Env, q: Q, url: URL): Promise<Response> {
  const body = new Uint8Array(await req.arrayBuffer());
  const ts = req.headers.get("X-Ts") || "";
  const sig = req.headers.get("X-Sig") || "";
  const tsn = Number(ts);
  if (!tsn || Math.abs(Date.now() - tsn) > 5 * 60e3)
    return fail("Phone clock is wrong: turn on automatic date and time.", 401, "bad_clock");
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
        "VALUES (?1, ?2, NOT EXISTS (SELECT 1 FROM persons), 'owner', ?3, ?4)",
        [id, data.publicKey, now, localStamp(now)]
      );
      return json({ personId: id, pays: "owner" });
    }
    // Invite: one atomic step that marks the invite as used and creates the person, or does nothing
    const results = await env.DB.batch([
      env.DB.prepare(
        "UPDATE invites SET used_by = ?1, used_at = ?2, used_at_local = ?3 WHERE code = ?4 AND used_by IS NULL AND expires_at > ?2"
      ).bind(id, now, localStamp(now), invite),
      env.DB.prepare(
        `INSERT INTO persons (id, public_key, is_admin, pays, created_at, created_at_local)
         SELECT ?1, ?2, 0, CASE type WHEN 'self_pays' THEN 'self' ELSE 'owner' END, ?3, ?4 FROM invites WHERE code = ?5 AND used_by = ?1`
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
    if (typeof data.publicKey !== "string" || !(await verify(data.publicKey, sig, message)))
      return fail("Invalid phone key", 401, "bad_key");
    const g = await verifyGoogle(String(data.idToken || ""), env.GOOGLE_CLIENT_ID);
    if (!g) return fail("Google sign-in not valid", 401, "google_invalid");
    const now = Date.now();
    const gid = await googleId(env, g.sub);
    const [owner] = await q("SELECT id, COALESCE(pays, 'owner') AS pays FROM persons WHERE google_sub = ?1 OR google_sub = ?2", [gid, g.sub]);
    const [onPhone] = await q("SELECT id, google_sub FROM persons WHERE public_key = ?1", [data.publicKey]);
    if (owner) {
      if (onPhone && onPhone.id !== owner.id) {
        // this phone holds another account: only an empty one without Google may be replaced
        const [used] = await q("SELECT 1 FROM measurements WHERE person_id = ?1 LIMIT 1", [onPhone.id]);
        if (onPhone.google_sub || used) return fail("This phone is used by another account", 409, "phone_in_use");
        await q("DELETE FROM persons WHERE id = ?1", [onPhone.id]);
      }
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
      "VALUES (?1, ?2, NOT EXISTS (SELECT 1 FROM persons), 'self', ?3, ?4, ?5, ?5, ?6)",
      [id, data.publicKey, gid, null, now, localStamp(now)]
    );
    return json({ personId: id, pays: "self" });
  }

  // Everything else requires the registered phone's signature
  const pid = req.headers.get("X-Person") || "";
  const [person] = await q("SELECT id, public_key, is_admin, COALESCE(pays, 'owner') AS pays, google_sub, email FROM persons WHERE id = ?1", [pid]);
  if (!person || !(await verify(person.public_key, sig, message))) return fail("Unauthorized", 401, "unauthorized");
  const pool = poolOf(person);
  const selfPays = person.pays === "self";
  const hasKey = async () => !!(await q("SELECT 1 FROM person_keys WHERE person_id = ?1", [pid]))[0];
  // Scan is on only when Anthropic itself said yes: key accepted and credit available, at the last real check
  const aiState = async () => {
    if (!selfPays) return { aiStatus: "ok", aiCheckedAt: null };
    const [k] = await q("SELECT COALESCE(status, 'ok') AS status, checked_at FROM person_keys WHERE person_id = ?1", [pid]);
    return k ? { aiStatus: String(k.status), aiCheckedAt: k.checked_at == null ? null : Number(k.checked_at) } : { aiStatus: "none", aiCheckedAt: null };
  };

  // 0) Who am I, and the credit of my own pool (a friend never sees the owner's pool, nor the other way round)
  if (req.method === "GET" && url.pathname === "/v1/me") {
    // an account from before: its Google id becomes a fingerprint and its email is erased, right now
    if (person.email || (person.google_sub && !String(person.google_sub).startsWith("h1:"))) await anonymizeGoogle(env);
    await fillLocalDates(q);
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
    });
  }
  // The notice accepted on the phone: recorded with who, which phone, which text and when. Never changed afterwards.
  if (req.method === "POST" && url.pathname === "/v1/accept") {
    if (data.doc !== "disclaimer" || data.version !== DISCLAIMER_VERSION) return fail("Unknown notice version", 400, "bad_version");
    const now = Date.now();
    const device = [...new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(person.public_key)))]
      .map((b) => b.toString(16).padStart(2, "0")).join("");
    const str = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : null);
    await q(
      "INSERT INTO acceptances (id, person_id, email, device, phone, doc, version, lang, text_sha256, app_version, accepted_at, accepted_at_local) " +
      "VALUES (?1, ?2, ?3, ?4, ?5, 'disclaimer', ?6, ?7, ?8, ?9, ?10, ?11)",
      [newId("acc_"), pid, null, device, str(data.phone, 80), DISCLAIMER_VERSION, str(data.lang, 8),
       str(data.textSha256, 64), str(data.appVersion, 20), now, localStamp(now)]
    );
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
      env.DB.prepare("DELETE FROM measurements WHERE person_id = ?1").bind(pid),
      env.DB.prepare("DELETE FROM scans WHERE person_id = ?1").bind(pid),
      env.DB.prepare("DELETE FROM person_keys WHERE person_id = ?1").bind(pid),
      env.DB.prepare("DELETE FROM ledger WHERE payer = ?1").bind(pid),                     // their own money records
      env.DB.prepare("UPDATE ledger SET person_id = NULL WHERE person_id = ?1").bind(pid),  // photos on the shared credit: kept, without who
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
        console.error("key test: " + String(e?.message).slice(0, 200)); // Anthropic's reply; never the key itself
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
        console.error("key open: " + e?.message);
        return fail("Your key can no longer be used. Add it again.", 402, "friend_key_invalid");
      }
    }
    // No limit here: the photo is always sent. The app's credit is only an estimate;
    // only Anthropic knows the real balance and refuses when it is finished.
    let r, costMicro;
    try {
      ({ reading: r, costMicro } = await readDisplay(env, apiKey, data.image, (req.headers.get("X-Lang") || "en").slice(0, 2).toLowerCase()));
    } catch (e: any) {
      console.error(e?.message);
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
