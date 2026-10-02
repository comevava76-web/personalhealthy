// The yearly subscription, bought and renewed through Google Play (the person pays Google, with Google Pay or any
// method Google Play offers; cancelling is done in Google Play at any time). The server never sees a card or a name:
// it asks Google Play about the purchase token the app sends, and keeps only that token and the end date.
//
// Needs the server secret PLAY_SERVICE_ACCOUNT: the JSON key of a Google Cloud service account that has access to
// the app in Play Console (see README, "Abbonamento"). Without it the subscription cannot be checked.

export const PLAY_PACKAGE = "ch.personalhealthy.app";
export const SUB_PRODUCT = "hint365_annual";

const enc = new TextEncoder();
const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

let cached: { token: string; exp: number } | null = null;

/** An access token for the Google Play Developer API, signed with the service account's key (cached ~1 h). */
async function googleToken(serviceAccountJson: string): Promise<string> {
  if (cached && cached.exp > Date.now() + 60e3) return cached.token;
  const sa = JSON.parse(serviceAccountJson);
  const now = Math.floor(Date.now() / 1000);
  const part = (o: unknown) => b64url(enc.encode(JSON.stringify(o)));
  const unsigned = part({ alg: "RS256", typ: "JWT" }) + "." + part({
    iss: sa.client_email, scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
  });
  const der = Uint8Array.from(atob(String(sa.private_key).replace(/-----[^-]+-----/g, "").replace(/\s+/g, "")), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(unsigned)));
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: unsigned + "." + b64url(sig) }),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error("Google token refused: " + r.status);
  cached = { token: j.access_token, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000 };
  return cached.token;
}

/**
 * The newest version of the app that Google Play has really published to everyone: the production track's releases
 * that are "completed" (reviewed and rolled out to 100%). 0 = none yet (the app is not on Google Play).
 * A version still in review, or rolled out only to part of the people, does not count: nobody may be asked to update
 * before Google can give them the update.
 */
export async function playLiveVersion(serviceAccountJson: string): Promise<number> {
  const at = await googleToken(serviceAccountJson);
  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PLAY_PACKAGE}/edits`;
  const h = { authorization: `Bearer ${at}` };
  const e = await fetch(base, { method: "POST", headers: h });
  if (e.status === 404) return 0;
  if (!e.ok) throw new Error("Google Play edits " + e.status);
  const id = ((await e.json()) as any).id;
  try {
    const t = await fetch(`${base}/${id}/tracks/production`, { headers: h });
    if (t.status === 404) return 0;
    if (!t.ok) throw new Error("Google Play track " + t.status);
    const j: any = await t.json();
    let live = 0;
    for (const r of j.releases || []) if (r.status === "completed") for (const v of r.versionCodes || []) live = Math.max(live, Number(v) || 0);
    return live;
  } finally {
    await fetch(`${base}/${id}`, { method: "DELETE", headers: h }).catch(() => {});
  }
}

export type PlaySub = { until: number; state: string; account: string };

/** What Google Play says about a purchase token; null = unknown token. */
export async function playSubscription(serviceAccountJson: string, purchaseToken: string): Promise<PlaySub | null> {
  const at = await googleToken(serviceAccountJson);
  const r = await fetch(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PLAY_PACKAGE}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`,
    { headers: { authorization: `Bearer ${at}` } },
  );
  if (r.status === 400 || r.status === 404 || r.status === 410) return null;
  if (!r.ok) throw new Error("Google Play answered " + r.status);
  const j: any = await r.json();
  let until = 0;
  for (const li of j.lineItems || []) {
    if (li.productId && li.productId !== SUB_PRODUCT) continue;
    const t = Date.parse(li.expiryTime || "");
    if (t > until) until = t;
  }
  return {
    until,
    state: String(j.subscriptionState || ""),
    account: String(j.externalAccountIdentifiers?.obfuscatedExternalAccountId || ""),
  };
}

/** Paid and not over: cancelled subscriptions stay valid until the end of the year already paid. */
export function subValid(until: number, state: string): boolean {
  return until > Date.now() &&
    ["SUBSCRIPTION_STATE_ACTIVE", "SUBSCRIPTION_STATE_CANCELED", "SUBSCRIPTION_STATE_IN_GRACE_PERIOD"].includes(state);
}

/** The anonymous account code as Google Play keeps it with the purchase, so a token works only for its own account. */
export async function playAccountId(pid: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode("hint365-sub:" + pid)));
  return [...d].map((b) => b.toString(16).padStart(2, "0")).join("");
}
