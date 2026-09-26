// PersonalHealthy API (usata dall'app Battito).
// Gira su Cloudflare Workers con il database D1 "personalhealthy" (dati vincolati all'Unione Europea).
// Tutto l'accesso al database passa dalla funzione q(): per passare un giorno a PostgreSQL/Azure
// si cambia q() e poche espressioni SQL, il resto del codice resta uguale.

type Q = (text: string, params?: unknown[]) => Promise<any[]>;

interface Env {
  DB: any; // Cloudflare D1
  ANTHROPIC_API_KEY: string;
  FAMILY_CODE: string;
  MODEL?: string;
  PRICE_IN_PER_MTOK?: string;  // dollari per milione di token in ingresso
  PRICE_OUT_PER_MTOK?: string; // dollari per milione di token in uscita
}

const MICRO = 1_000_000; // i soldi sono tenuti in milionesimi di dollaro (numeri interi, nessun errore di arrotondamento)
const DEFAULT_PHOTO_COST = 6000; // 0,006 $ finché non ci sono letture reali

/* ---------- credito e impostazioni ---------- */
async function getSetting(q: Q, key: string, def: string): Promise<string> {
  const [r] = await q("SELECT value FROM settings WHERE key = ?1", [key]);
  return r ? String(r.value) : def;
}

async function creditInfo(q: Q) {
  const [last] = await q("SELECT seq, amount_micro FROM ledger WHERE kind = 'set' ORDER BY seq DESC LIMIT 1");
  const fromSeq = last ? Number(last.seq) : 0;
  const base = last ? Number(last.amount_micro) : 0;
  const [sums] = await q(
    "SELECT COALESCE(SUM(CASE WHEN kind = 'topup' THEN amount_micro ELSE 0 END), 0) AS top, " +
    "COALESCE(SUM(CASE WHEN kind = 'usage' THEN amount_micro ELSE 0 END), 0) AS used, " +
    "COUNT(CASE WHEN kind IN ('topup','set') THEN 1 END) AS money_rows FROM ledger WHERE seq > ?1",
    [fromSeq]
  );
  const [avgRow] = await q(
    "SELECT AVG(amount_micro) AS avg FROM (SELECT amount_micro FROM ledger WHERE kind = 'usage' ORDER BY seq DESC LIMIT 20) t"
  );
  const configured = !!last || Number(sums?.money_rows || 0) > 0;
  const remaining = base + Number(sums?.top || 0) - Number(sums?.used || 0);
  const avg = Math.max(1, Math.round(Number(avgRow?.avg) || DEFAULT_PHOTO_COST));
  const photosLeft = configured ? Math.max(0, Math.floor(remaining / avg)) : null;
  return {
    configured,
    remaining: configured ? remaining / MICRO : null,
    avgCost: avg / MICRO,
    photosLeft,
    low: configured && remaining < 2 * avg,   // basta al massimo per una foto
    empty: configured && remaining < avg,     // non basta più per una foto
  };
}

const TZ = "Europe/Zurich";
const enc = new TextEncoder();

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8" } });
// "code" è quello che l'app traduce nella lingua del telefono; "error" resta per i log
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

// Android firma in formato DER; qui serve il formato r||s (64 byte)
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

function periodOf(ms: number): string {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hourCycle: "h23" }).format(new Date(ms)));
  return h < 12 ? "mattina" : h < 17 ? "pomeriggio" : "sera";
}

const PROMPT = `Questa è la foto del display di un misuratore di pressione digitale.
Leggi i tre valori mostrati:
- sistolica (massima): di solito il numero più grande in alto (SYS)
- diastolica (minima): il numero sotto (DIA)
- pulsazioni: il numero più piccolo in basso (PUL, PULSE o simbolo del cuore)
Le cifre sono spesso "a segmenti" come su una calcolatrice: distingui con cura 1 e 7, 5 e 6, 8 e 0.
Non inventare: se un valore non si legge con sicurezza metti null.
Non riportare mai nomi di persone.
Rispondi SOLO con JSON in questo formato:
{"sistolica": 128, "diastolica": 82, "pulsazioni": 67, "leggibile": true, "nota": ""}`;

const LANGS: Record<string, string> = { it: "italiano", en: "English", de: "Deutsch", fr: "français" };

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
            { type: "text", text: PROMPT + `\nScrivi il campo "nota" in questa lingua: ${LANGS[lang] || "English"}.` },
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
  const sis = num(j.sistolica, 50, 260);
  const dia = num(j.diastolica, 30, 160);
  const pul = num(j.pulsazioni, 30, 220);
  const readable = j.leggibile !== false && sis != null && dia != null && dia < sis;
  const u = out.usage || {};
  const inTok = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
  const outTok = u.output_tokens || 0;
  const pin = Number(env.PRICE_IN_PER_MTOK || "2"), pout = Number(env.PRICE_OUT_PER_MTOK || "10");
  const costMicro = Math.ceil(inTok * pin + outTok * pout); // (token * $/Mtok) = milionesimi di dollaro
  return { reading: { readable, sis, dia, pul, note: typeof j.nota === "string" ? j.nota.slice(0, 200) : "" }, costMicro };
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
      return fail("Errore interno del server", 500, "server");
    }
  },
};

async function handle(req: Request, env: Env, q: Q, url: URL): Promise<Response> {
  const body = new Uint8Array(await req.arrayBuffer());
  const ts = req.headers.get("X-Ts") || "";
  const sig = req.headers.get("X-Sig") || "";
  const tsn = Number(ts);
  if (!tsn || Math.abs(Date.now() - tsn) > 5 * 60e3)
    return fail("L'ora del telefono non è corretta: attiva data e ora automatiche.", 401, "bad_clock");
  const message = `${req.method}\n${url.pathname + url.search}\n${ts}\n${await sha256Hex(body)}`;
  let data: any = {};
  if (body.length) {
    try {
      data = JSON.parse(new TextDecoder().decode(body));
    } catch {
      return fail("Richiesta non valida", 400, "generic");
    }
  }

  // Attivazione del telefono: codice di famiglia + chiave anonima generata nel telefono
  if (req.method === "POST" && url.pathname === "/v1/register") {
    if (!env.FAMILY_CODE || data.familyCode !== env.FAMILY_CODE) return fail("Codice di famiglia non valido", 403, "family_code");
    if (typeof data.publicKey !== "string" || !(await verify(data.publicKey, sig, message)))
      return fail("Chiave del telefono non valida", 401, "bad_key");
    const [existing] = await q("SELECT id FROM persons WHERE public_key = ?1", [data.publicKey]);
    if (existing) return json({ personId: existing.id });
    const id = newId("per_");
    // il primo telefono attivato gestisce credito e impostazioni
    await q(
      "INSERT INTO persons (id, public_key, is_admin, created_at) VALUES (?1, ?2, NOT EXISTS (SELECT 1 FROM persons), ?3)",
      [id, data.publicKey, Date.now()]
    );
    return json({ personId: id });
  }

  // Tutto il resto richiede la firma del telefono registrato
  const pid = req.headers.get("X-Person") || "";
  const [person] = await q("SELECT id, public_key, is_admin FROM persons WHERE id = ?1", [pid]);
  if (!person || !(await verify(person.public_key, sig, message))) return fail("Accesso non autorizzato", 401, "unauthorized");

  // 0) Chi sono, credito e impostazioni
  if (req.method === "GET" && url.pathname === "/v1/me") {
    return json({
      personId: pid,
      isAdmin: !!person.is_admin,
      billingMode: await getSetting(q, "billing_mode", "privato"),
      credit: await creditInfo(q),
    });
  }
  if (req.method === "POST" && url.pathname === "/v1/admin/credit") {
    if (!person.is_admin) return fail("Solo chi gestisce l'app può cambiare il credito", 403, "admin_only");
    const amount = Number(data.amount);
    if (!(amount >= 0 && amount <= 1000)) return fail("Importo non valido", 400, "bad_amount");
    const kind = data.action === "set" ? "set" : "topup";
    if (kind === "topup" && amount <= 0) return fail("Importo non valido", 400, "bad_amount");
    await q("INSERT INTO ledger (kind, amount_micro, person_id, created_at) VALUES (?1, ?2, ?3, ?4)", [kind, Math.round(amount * MICRO), pid, Date.now()]);
    return json({ credit: await creditInfo(q) });
  }
  if (req.method === "POST" && url.pathname === "/v1/admin/settings") {
    if (!person.is_admin) return fail("Solo chi gestisce l'app può cambiare le impostazioni", 403, "admin_only");
    const mode = String(data.billingMode || "");
    if (mode === "utente") return fail("Il pagamento da parte di ogni utente non è ancora disponibile", 400, "mode_unavailable");
    if (mode !== "privato") return fail("Modalità non valida", 400, "generic");
    await q("INSERT INTO settings (key, value) VALUES ('billing_mode', ?1) ON CONFLICT (key) DO UPDATE SET value = excluded.value", [mode]);
    return json({ billingMode: mode });
  }

  // 1) Lettura della foto: i numeri li decide solo la lettura
  if (req.method === "POST" && url.pathname === "/v1/bp/scan") {
    const takenAt = Number(data.takenAt);
    const now = Date.now();
    if (!takenAt || takenAt > now + 2 * 60e3 || takenAt < now - 30 * 60e3)
      return fail("L'ora della foto non è valida. Rifai la foto.", 400, "photo_time");
    if (typeof data.image !== "string" || data.image.length < 1000) return fail("Foto mancante", 400, "no_photo");
    const before = await creditInfo(q);
    if (before.empty) return fail("Il credito per le letture è finito. Chi gestisce l'app deve ricaricarlo.", 402, "credit_empty");
    let r, costMicro;
    try {
      ({ reading: r, costMicro } = await readDisplay(env, data.image, (req.headers.get("X-Lang") || "en").slice(0, 2).toLowerCase()));
    } catch (e: any) {
      console.error(e?.message);
      return fail("Lettura non riuscita. Riprova tra poco.", 502, "read_failed");
    }
    const scanId = newId("scn_");
    await q(
      "INSERT INTO scans (id, person_id, kind, result, taken_at, used, created_at) VALUES (?1, ?2, 'bp', ?3, ?4, 0, ?5)",
      [scanId, pid, JSON.stringify(r), takenAt, now]
    );
    await q("INSERT INTO ledger (kind, amount_micro, person_id, scan_id, created_at) VALUES ('usage', ?1, ?2, ?3, ?4)", [costMicro, pid, scanId, now]);
    return json({ scanId, ...r, takenAt, period: periodOf(takenAt), credit: await creditInfo(q) });
  }

  // 2) Conferma: salva esattamente quanto letto (il telefono non può cambiare i numeri)
  if (req.method === "POST" && url.pathname === "/v1/bp/confirm") {
    const [s] = await q(
      "SELECT id, result, used, taken_at, created_at FROM scans WHERE id = ?1 AND person_id = ?2 AND kind = 'bp'",
      [String(data.scanId || ""), pid]
    );
    if (!s) return fail("Lettura non trovata", 404, "not_found");
    if (s.used) return fail("Misura già salvata", 409, "already_saved");
    if (Date.now() - Number(s.created_at) > 60 * 60e3) return fail("Lettura scaduta, rifai la foto", 400, "scan_expired");
    const r = JSON.parse(s.result);
    if (!r.readable) return fail("La lettura non era valida, rifai la foto", 400, "scan_invalid");
    const id = newId("bp_");
    const takenMs = Number(s.taken_at);
    const period = periodOf(takenMs);
    // Un'unica operazione indivisibile: la misura entra solo se la lettura non era già stata usata
    const results = await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO measurements (id, person_id, kind, taken_at, tz, period, data, source, scan_id, created_at)
         SELECT ?1, ?2, 'bp', ?3, ?4, ?5, ?6, 'foto', ?7, ?8
         WHERE EXISTS (SELECT 1 FROM scans WHERE id = ?7 AND used = 0)`
      ).bind(id, pid, takenMs, TZ, period, JSON.stringify({ sis: r.sis, dia: r.dia, pul: r.pul }), s.id, Date.now()),
      env.DB.prepare("UPDATE scans SET used = 1 WHERE id = ?1").bind(s.id),
    ]);
    if (!results[0]?.meta?.changes) return fail("Misura già salvata", 409, "already_saved");
    return json({ id, takenAt: takenMs, period, sis: r.sis, dia: r.dia, pul: r.pul });
  }

  // 3) Elenco misure
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

  // 4) Eliminazione di una misura
  const del = url.pathname.match(/^\/v1\/bp\/(bp_[a-f0-9]+)$/);
  if (req.method === "DELETE" && del) {
    await q("DELETE FROM measurements WHERE id = ?1 AND person_id = ?2 AND kind = 'bp'", [del[1], pid]);
    return json({ ok: true });
  }

  return fail("Non trovato", 404, "not_found");
}
