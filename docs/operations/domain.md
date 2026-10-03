# HINT 365 · The address of the service

## The app follows the server's address by itself

The address is **not fixed in the app**. One file in the repository says where the server is:
`config/server.json`

    { "api":  "https://personalhealthy-api.comevava76.workers.dev",   ← where the server answers now
      "next": "https://personalhealthy-api.hint365.workers.dev" }     ← where it will move

- *Build* reads it: it builds both addresses into the app and gives them to the Worker (`SERVER_URL`, `SERVER_NEXT`).
- The Worker answers `GET /v1/where` → `{ service: "hint365", api, next }` (no sign-in, no personal data).
- The app (`Server` in `Core.kt`) asks `/v1/where` **every time it opens and every time it comes back** to the screen:
  - if `api` is a new address, it moves there;
  - it keeps `next`;
  - if the address it uses no longer answers, it tries `next` (then the addresses built in);
  - **an app that stays open** also moves: when a call cannot reach the server, the app asks where the server is and,
    if it moved, sends the same call once more to the new address.
- A new address is used only if it answers over HTTPS as HINT 365 **and** names itself as the current address.
  Offline, nothing changes.
- The Web Dashboard, the doctor's links and `/download` take their address from the request, so they follow by
  themselves.

Only apps from build 0.1.134 on can move by themselves. Older apps have the address built in. Under "one version
only" they are asked to update while the old address still works, so do the move only once the Admin console shows
nobody on an older build.

## Today: a free, temporary address

`personalhealthy-api.comevava76.workers.dev`: `personalhealthy-api` is the Worker (it stays: its secrets, among them
`KEY_ENCRYPTION_KEY`, belong to it), `comevava76` the account's free **workers.dev subdomain**. It is going to be
`hint365` (already in `next`). **It is not the definitive address**: a `workers.dev` address cannot have Cloudflare's
WAF and bot protection, and it carries Cloudflare's name. The definitive address will be the owner's own domain.

### Move to `hint365.workers.dev` (free)

1. Wait until the Admin console shows everyone on a build that follows the address (0.1.134 or later).
2. **Owner, by hand** (Cloudflare's API cannot rename a subdomain, error 10036): Cloudflare dashboard → Workers & Pages →
   Account details → Subdomain → Change → `hint365`. From this moment `comevava76` no longer answers.
3. Apps reach `comevava76` no more, try `next` (`hint365`), find HINT 365 there and stay there. Nothing to reinstall.
4. Developer: in `config/server.json` move the address from `next` to `api` (and empty `next`), merge, *Build*.
   (Until then *Build* notices the rename, warns, and deploys with `hint365` as the address.)

## Later: the definitive domain (owner's own name)

Decided by Human: the domain is bought on GoDaddy, its DNS is moved to Cloudflare, the service stays on the same
Worker and database. With an own domain the old and the new address work **at the same time**, so the move has no gap.

| # | Step | Who | Where | Time |
|---|---|---|---|---|
| 1 | Buy the domain (for example `hint365.<tld>`) | owner, BY HAND, card | GoDaddy | 10 min |
| 2 | Add the domain to Cloudflare (Free plan); Cloudflare gives two name servers | owner, BY HAND | Cloudflare → Add a domain | 5 min |
| 3 | At GoDaddy, replace the name servers with Cloudflare's two | owner, BY HAND | GoDaddy → Domain → Nameservers → Change | 5 min, then up to 24 h until active |
| 4 | Connect the Worker: custom domain `api.<domain>` on `personalhealthy-api` (`routes = [{ pattern = "api.<domain>", custom_domain = true }]` in `wrangler.toml`); Cloudflare makes the HTTPS certificate. Leave `workers_dev = true` | developer | repository → *Build* | 15 min |
| 5 | Check the new address: `/v1/where`, `/v1/health`, `/my`, `/terms`, `/privacy`, `/download` | developer | browser | 5 min |
| 6 | `config/server.json`: `api` = `https://api.<domain>`, merge, *Build*. At their next opening (or next call) all apps move by themselves | developer | repository | 15 min |
| 7 | Update the links outside the app: privacy URL in the Google OAuth consent screen and in the Play Console listing, documents, `CLAUDE.md`, `README.md`, `DR/infrastructure-as-code/infrastructure.json`, `prod-probe.mjs` | developer + owner (consoles) | Google Cloud, Play Console, repository | 30 min |
| 8 | Turn on the protections that need a custom domain: WAF managed rules (free set), Bot Fight Mode, "Always use HTTPS", HSTS | owner, BY HAND | Cloudflare → the domain → Security | 10 min |
| 9 | After a few weeks, when Admin shows nobody on a build older than the move: `workers_dev = false` in `wrangler.toml` (the old address goes off) | developer | repository | 5 min |

Sign in with Google does not depend on the address (the app sends its Google token to the server, which checks it
with the client ID), so no OAuth client changes, only the consent screen's links (step 7).

Costs: the domain (GoDaddy, yearly); Cloudflare Free plan for DNS, HTTPS and the custom domain: 0.
