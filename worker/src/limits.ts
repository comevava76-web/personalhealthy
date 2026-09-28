// Limits against abuse (test report F-07), kept in D1: a counter per key and time window.
// Keys are never raw addresses: an IP address is stored only as a short SHA-256 fingerprint.
type Q = (text: string, params?: unknown[]) => Promise<any[]>;

/** true when this call goes over [max] calls in the last window of [windowMs] for [key]. */
export async function tooMany(q: Q, key: string, max: number, windowMs: number): Promise<boolean> {
  const now = Date.now();
  const [r] = await q(
    `INSERT INTO rate_limits (key, window_start, count) VALUES (?1, ?2, 1)
     ON CONFLICT (key) DO UPDATE SET
       count = CASE WHEN window_start < ?3 THEN 1 ELSE count + 1 END,
       window_start = CASE WHEN window_start < ?3 THEN ?2 ELSE window_start END
     RETURNING count`, [key, now, now - windowMs]);
  return Number(r?.count || 0) > max;
}

/** A short fingerprint of the caller's IP address, for limits on calls made before signing in. */
export async function ipKey(req: Request, what: string): Promise<string> {
  const ip = req.headers.get("CF-Connecting-IP") || "unknown";
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode("hint365-ip:" + ip)));
  return what + ":" + [...d.slice(0, 8)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const HOUR = 3600e3, DAY = 864e5;
