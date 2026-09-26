// PersonalHealthy API (used by the HealthyInstantTracker app).
// Runs on Cloudflare Workers with the D1 database "personalhealthy" (data bound to the European Union).
// All database access goes through the q() function: to move to PostgreSQL/Azure one day,
// change q() and a few SQL expressions; the rest of the code stays the same.

type Q = (text: string, params?: unknown[]) => Promise<any[]>;

interface Env {
  DB: any; // Cloudflare D1
  ANTHROPIC_API_KEY: string;
  FAMILY_CODE: string;
  MODEL?: string;
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

// Credit is counted from the last balance correction ("set"): loaded = that balance + later top-ups,
// spent = cost of the photos read since then, remaining = loaded - spent.
async function creditInfo(q: Q) {
  const [last] = await q("SELECT seq, amount_micro, created_at FROM ledger WHERE kind = 'set' ORDER BY seq DESC LIMIT 1");
  const fromSeq = last ? Number(last.seq) : 0;
  const base = last ? Number(last.amount_micro) : 0;
  const [sums] = await q(
    "SELECT COALESCE(SUM(CASE WHEN kind = 'topup' THEN amount_micro ELSE 0 END), 0) AS top, " +
    "COALESCE(SUM(CASE WHEN kind = 'usage' THEN amount_micro ELSE 0 END), 0) AS used, " +
    "COUNT(CASE WHEN kind = 'usage' THEN 1 END) AS scans, " +
    "COUNT(CASE WHEN kind IN ('topup','set') THEN 1 END) AS money_rows FROM ledger WHERE seq > ?1",
    [fromSeq]
  );
  const [avgRow] = await q(
    "SELECT AVG(amount_micro) AS avg FROM (SELECT amount_micro FROM ledger WHERE kind = 'usage' ORDER BY seq DESC LIMIT 20) t"
  );
  const configured = !!last || Number(sums?.money_rows || 0) > 0;
  const loaded = base + Number(sums?.top || 0);
  const spent = Number(sums?.used || 0);
  const remaining = loaded - spent;
  const avg = Math.max(1, Math.round(Number(avgRow?.avg) || DEFAULT_PHOTO_COST));
  const photosLeft = configured ? Math.max(0, Math.floor(remaining / avg)) : null;
  return {
    configured,
    remaining: configured ? remaining / MICRO : null,
    loaded: configured ? loaded / MICRO : null,
    spent: spent / MICRO,
    scans: Number(sums?.scans || 0),
    since: last ? Number(last.created_at) : null, // time of the last balance correction
    avgCost: avg / MICRO,
    photosLeft,
    low: configured && remaining < 2 * avg,   // enough for one more photo at most
    empty: configured && remaining < avg,     // not enough for another photo
  };
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

function newId(prefix: string): string {
  const b = crypto.getRandomValues(new Uint8Array(12));
  return prefix + [...b].map(x => x.toString(16).padStart(2, "0")).join("");
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

async function readDisplay(env: Env, image: string, lang: string) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": env.ANTHROPIC_API_KEY,
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
  if (!res.ok) throw new Error("ai " + res.status + " " + (await res.text()).slice(0, 300));
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

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/v1/health") return json({ ok: true });
    const q: Q = async (text, params = []) => (await env.DB.prepare(text).bind(...params).all()).results || [];
    try {
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

  // Phone activation: family code + anonymous key generated on the phone
  if (req.method === "POST" && url.pathname === "/v1/register") {
    if (!env.FAMILY_CODE || data.familyCode !== env.FAMILY_CODE) return fail("Invalid family code", 403, "family_code");
    if (typeof data.publicKey !== "string" || !(await verify(data.publicKey, sig, message)))
      return fail("Invalid phone key", 401, "bad_key");
    const [existing] = await q("SELECT id FROM persons WHERE public_key = ?1", [data.publicKey]);
    if (existing) return json({ personId: existing.id });
    const id = newId("per_");
    const now = Date.now();
    // the first activated phone manages credit and settings
    await q(
      "INSERT INTO persons (id, public_key, is_admin, created_at, created_at_local) VALUES (?1, ?2, NOT EXISTS (SELECT 1 FROM persons), ?3, ?4)",
      [id, data.publicKey, now, localStamp(now)]
    );
    return json({ personId: id });
  }

  // Everything else requires the registered phone's signature
  const pid = req.headers.get("X-Person") || "";
  const [person] = await q("SELECT id, public_key, is_admin FROM persons WHERE id = ?1", [pid]);
  if (!person || !(await verify(person.public_key, sig, message))) return fail("Unauthorized", 401, "unauthorized");

  // 0) Who am I, credit and settings
  if (req.method === "GET" && url.pathname === "/v1/me") {
    await fillLocalDates(q);
    return json({
      personId: pid,
      isAdmin: !!person.is_admin,
      billingMode: await getSetting(q, "billing_mode", "private"),
      credit: await creditInfo(q),
    });
  }
  if (req.method === "POST" && url.pathname === "/v1/admin/credit") {
    if (!person.is_admin) return fail("Only the app manager can change the credit", 403, "admin_only");
    const amount = Number(data.amount);
    if (!(amount >= 0 && amount <= 1000)) return fail("Invalid amount", 400, "bad_amount");
    const kind = data.action === "set" ? "set" : "topup";
    if (kind === "topup" && amount <= 0) return fail("Invalid amount", 400, "bad_amount");
    const now = Date.now();
    await q(
      "INSERT INTO ledger (kind, amount_micro, person_id, created_at, created_at_local) VALUES (?1, ?2, ?3, ?4, ?5)",
      [kind, Math.round(amount * MICRO), pid, now, localStamp(now)]
    );
    return json({ credit: await creditInfo(q) });
  }
  // Last 20 credit movements: top-ups, balance corrections and the cost of each photo (readable by every registered phone)
  if (req.method === "GET" && url.pathname === "/v1/credit/history") {
    const rows = await q("SELECT kind, amount_micro, created_at FROM ledger ORDER BY seq DESC LIMIT 20");
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

  // 1) Photo reading: the numbers are decided only by the reading
  if (req.method === "POST" && url.pathname === "/v1/bp/scan") {
    const takenAt = Number(data.takenAt);
    const now = Date.now();
    if (!takenAt || takenAt > now + 2 * 60e3 || takenAt < now - 30 * 60e3)
      return fail("Invalid photo time. Retake the photo.", 400, "photo_time");
    if (typeof data.image !== "string" || data.image.length < 1000) return fail("Missing photo", 400, "no_photo");
    const before = await creditInfo(q);
    if (before.empty) return fail("Reading credit is used up. The app manager must top it up.", 402, "credit_empty");
    let r, costMicro;
    try {
      ({ reading: r, costMicro } = await readDisplay(env, data.image, (req.headers.get("X-Lang") || "en").slice(0, 2).toLowerCase()));
    } catch (e: any) {
      console.error(e?.message);
      return fail("Reading failed. Try again shortly.", 502, "read_failed");
    }
    const scanId = newId("scn_");
    await q(
      "INSERT INTO scans (id, person_id, kind, result, taken_at, used, created_at, taken_at_local, created_at_local) " +
      "VALUES (?1, ?2, 'bp', ?3, ?4, 0, ?5, ?6, ?7)",
      [scanId, pid, JSON.stringify(r), takenAt, now, localStamp(takenAt), localStamp(now)]
    );
    await q(
      "INSERT INTO ledger (kind, amount_micro, person_id, scan_id, created_at, created_at_local) VALUES ('usage', ?1, ?2, ?3, ?4, ?5)",
      [costMicro, pid, scanId, now, localStamp(now)]
    );
    return json({ scanId, ...r, takenAt, period: periodOf(takenAt), credit: await creditInfo(q) });
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

  // 3) List of measurements
  if (req.method === "GET" && url.pathname === "/v1/bp") {
    const days = Math.min(Math.max(Number(url.searchParams.get("days")) || 30, 1), 400);
    const rows = await q(
      "SELECT id, taken_at, period, data FROM measurements WHERE person_id = ?1 AND kind = 'bp' AND taken_at >= ?2 ORDER BY taken_at",
      [pid, Date.now() - days * 864e5]
    );
    const items = rows.map((r: any) => {
      const d = JSON.parse(r.data);
      return { id: r.id, takenAt: Number(r.taken_at), period: r.period, sis: d.sis, dia: d.dia, pul: d.pul ?? null };
    });
    return json({ items });
  }

  // 4) Delete a measurement
  const del = url.pathname.match(/^\/v1\/bp\/(bp_[a-f0-9]+)$/);
  if (req.method === "DELETE" && del) {
    await q("DELETE FROM measurements WHERE id = ?1 AND person_id = ?2 AND kind = 'bp'", [del[1], pid]);
    return json({ ok: true });
  }

  return fail("Not found", 404, "not_found");
}
