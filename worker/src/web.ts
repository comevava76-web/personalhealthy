// "My Dash": the personal web dashboard, opened from the app without signing in again.
//
// How the sign-in passes from the phone to the browser:
//   1. the app asks POST /v1/web/code (signed with the phone's key, like every app request) and gets a one-time code;
//   2. it opens /my/#c=<code> in the browser (the code is in the #part, so it never reaches any server log);
//   3. the page sends the code to POST /my/session, which checks it (60 seconds, one use only) and sets a cookie
//      that only this server can read (HttpOnly, Secure, SameSite=Strict), valid for 7 days or until "Sign out".
// Only a SHA-256 fingerprint of codes, cookies and share links is stored: the database never holds a usable one.
//
// Share with the doctor: a read-only link /s/<token> with the readings of a chosen period, valid for a few days,
// that can be withdrawn at any time. It shows no email and no account.
//
// Modules: each part of the dashboard (blood pressure today, lab results later) is one entry of MODULES.
// A new module = one entry here and one in public/my/app.js; routes, sign-in and sharing stay the same.

type Q = (text: string, params?: unknown[]) => Promise<any[]>;

const CODE_TTL = 60e3;                 // the one-time code from the app
const SESSION_TTL = 7 * 864e5;         // the browser stays signed in for 7 days
const SHARE_MAX_DAYS = 30;             // a share link lasts at most 30 days
const MAX_PERIOD_DAYS = 14;            // charts show at most two weeks: every reading readable on one phone screen
const COOKIE = "hint_s";

const enc = new TextEncoder();
const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
const fail = (msg: string, status = 400, code = "generic") => json({ error: msg, code }, status);

function randomToken(): string {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function fingerprint(token: string): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", enc.encode(token));
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, "0")).join("");
}

/** Swiss midnight at the start of the day that is `days` days long ending today: a period of 7 days = today and the 6 before. */
const zurichClock = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Zurich", hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23" });
function periodStart(now: number, days: number): number {
  const t = now - (days - 1) * 864e5;
  const p: Record<string, string> = {};
  for (const x of zurichClock.formatToParts(new Date(t))) p[x.type] = x.value;
  return t - ((+p.hour * 60 + +p.minute) * 60 + +p.second) * 1000 - (t % 1000);
}

/* ---------- modules ---------- */
interface Module {
  /** The person's data between two moments (milliseconds), oldest first. */
  load(q: Q, pid: string, from: number, to: number): Promise<unknown[]>;
}
const MODULES: Record<string, Module> = {
  bp: {
    async load(q, pid, from, to) {
      const rows = await q(
        "SELECT taken_at, period, data, source FROM measurements WHERE person_id = ?1 AND kind = 'bp' AND taken_at >= ?2 AND taken_at <= ?3 ORDER BY taken_at",
        [pid, from, to]
      );
      return rows.map((r: any) => {
        const d = JSON.parse(r.data);
        return { t: Number(r.taken_at), period: r.period, sys: d.sis, dia: d.dia, pul: d.pul ?? null, source: r.source || "photo" };
      });
    },
  },
};

/* ---------- step 1, from the app (already signed by the phone): a one-time code ---------- */
export async function newWebCode(q: Q, pid: string, origin: string): Promise<Response> {
  const code = randomToken();
  const now = Date.now();
  await q("DELETE FROM web_codes WHERE expires_at < ?1", [now]);
  await q("INSERT INTO web_codes (code_hash, person_id, expires_at) VALUES (?1, ?2, ?3)", [await fingerprint(code), pid, now + CODE_TTL]);
  return json({ url: `${origin}/my/#c=${code}` });
}

/** Everything the browser (not the app) calls: /my/... and /s/... . Returns null for other addresses. */
export async function handleWeb(req: Request, env: any, q: Q, url: URL): Promise<Response | null> {
  const p = url.pathname;

  // shared read-only view for the doctor: the same page, which reads its data from /s/<token>/data
  const shared = p.match(/^\/s\/([A-Za-z0-9_-]{20,})(\/data)?\/?$/);
  if (shared && req.method === "GET") {
    const [row] = await q("SELECT person_id, date_from, date_to, expires_at FROM web_shares WHERE token_hash = ?1", [await fingerprint(shared[1])]);
    if (!row || Number(row.expires_at) < Date.now()) {
      return shared[2] ? fail("This link has expired or was withdrawn", 404, "share_gone") : env.ASSETS.fetch(new Request(url.origin + "/my/"));
    }
    if (!shared[2]) return env.ASSETS.fetch(new Request(url.origin + "/my/"));
    const mod = MODULES[url.searchParams.get("module") || "bp"];
    if (!mod) return fail("Unknown module", 404);
    const items = await mod.load(q, row.person_id, Number(row.date_from), Number(row.date_to));
    return json({ shared: true, from: Number(row.date_from), to: Number(row.date_to), expiresAt: Number(row.expires_at), items });
  }

  if (!p.startsWith("/my/")) return null;
  // the page itself and its files are static (public/my); only /my/session and /my/api/... come here
  const sameOrigin = (req.headers.get("origin") || url.origin) === url.origin;
  if (req.method !== "GET" && !sameOrigin) return fail("Forbidden", 403);

  // step 3: the one-time code becomes a cookie
  if (p === "/my/session" && req.method === "POST") {
    let code = "";
    try { code = String((await req.json() as any).code || ""); } catch {}
    const h = await fingerprint(code);
    const [row] = await q("SELECT person_id, expires_at FROM web_codes WHERE code_hash = ?1", [h]);
    await q("DELETE FROM web_codes WHERE code_hash = ?1", [h]);   // one use only, valid or not
    if (!row || Number(row.expires_at) < Date.now()) return fail("This link has expired: open My Dash again from the app", 401, "code_gone");
    const token = randomToken();
    const now = Date.now();
    await q("DELETE FROM web_sessions WHERE expires_at < ?1", [now]);
    await q("INSERT INTO web_sessions (id_hash, person_id, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)",
      [await fingerprint(token), row.person_id, now, now + SESSION_TTL]);
    return json({ ok: true }, 200, {
      "set-cookie": `${COOKIE}=${token}; Path=/my; Max-Age=${SESSION_TTL / 1000}; HttpOnly; Secure; SameSite=Strict`,
    });
  }

  // every other /my/ call needs the cookie
  const token = (req.headers.get("cookie") || "").split(/;\s*/).find(c => c.startsWith(COOKIE + "="))?.slice(COOKIE.length + 1) || "";
  const sh = token ? await fingerprint(token) : "";
  const [sess] = sh ? await q("SELECT person_id, expires_at FROM web_sessions WHERE id_hash = ?1", [sh]) : [];
  if (!sess || Number(sess.expires_at) < Date.now()) return fail("Not signed in", 401, "no_session");
  const pid = String(sess.person_id);

  if (p === "/my/session" && req.method === "DELETE") {
    await q("DELETE FROM web_sessions WHERE id_hash = ?1", [sh]);
    return json({ ok: true }, 200, { "set-cookie": `${COOKIE}=; Path=/my; Max-Age=0; HttpOnly; Secure; SameSite=Strict` });
  }
  if (p === "/my/api/me" && req.method === "GET") {
    const [person] = await q("SELECT email FROM persons WHERE id = ?1", [pid]);
    const shares = await q("SELECT COUNT(*) AS n FROM web_shares WHERE person_id = ?1 AND expires_at > ?2", [pid, Date.now()]);
    return json({ email: person?.email || null, modules: Object.keys(MODULES), activeShares: Number(shares[0]?.n || 0) });
  }
  if (p === "/my/api/data" && req.method === "GET") {
    const mod = MODULES[url.searchParams.get("module") || "bp"];
    if (!mod) return fail("Unknown module", 404);
    const days = Math.min(Math.max(Number(url.searchParams.get("days")) || 14, 1), MAX_PERIOD_DAYS);
    const to = Date.now();
    const from = periodStart(to, days);
    return json({ shared: false, from, to, items: await mod.load(q, pid, from, to) });
  }
  // a read-only link for the doctor: the chosen period, as it is now, valid for a few days
  if (p === "/my/api/share" && req.method === "POST") {
    let b: any = {};
    try { b = await req.json(); } catch {}
    const days = Math.min(Math.max(Math.round(Number(b.days) || 14), 1), MAX_PERIOD_DAYS);
    const valid = Math.min(Math.max(Math.round(Number(b.validDays) || 7), 1), SHARE_MAX_DAYS);
    const now = Date.now();
    const t = randomToken();
    await q("DELETE FROM web_shares WHERE expires_at < ?1", [now]);
    const from = periodStart(now, days);
    await q("INSERT INTO web_shares (token_hash, person_id, date_from, date_to, created_at, expires_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
      [await fingerprint(t), pid, from, now, now, now + valid * 864e5]);
    return json({ url: `${url.origin}/s/${t}`, from, to: now, expiresAt: now + valid * 864e5 });
  }
  if (p === "/my/api/shares" && req.method === "DELETE") {
    await q("DELETE FROM web_shares WHERE person_id = ?1", [pid]);
    return json({ ok: true });
  }
  return fail("Not found", 404);
}

/** When the person signs out of the phone or deletes the account: the browsers and the share links stop working. */
export async function endWebAccess(q: Q, pid: string, alsoShares: boolean) {
  await q("DELETE FROM web_sessions WHERE person_id = ?1", [pid]);
  await q("DELETE FROM web_codes WHERE person_id = ?1", [pid]);
  if (alsoShares) await q("DELETE FROM web_shares WHERE person_id = ?1", [pid]);
}
