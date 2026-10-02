# HINT 365 · The address of the service

## Today: a free, temporary address

Since 02.10.2026 the server, the Web Dashboard and the download link answer at

    https://personalhealthy-api.hint365.workers.dev

- `personalhealthy-api` is the name of the Worker (it stays: its secrets, among them `KEY_ENCRYPTION_KEY`, belong to it).
- `hint365` is the **workers.dev subdomain** of the Cloudflare account: free, chosen once for the whole account.
  It replaced `comevava76` (the owner's account name), which was not fit to show to anyone.
- *Build* sets it by itself (step "workers.dev subdomain"); if `hint365` could not be set, the build stops instead of
  shipping an app that points nowhere.

**This is not the definitive address.** A `workers.dev` address cannot have Cloudflare's WAF and bot protection, and it
carries Cloudflare's name. The definitive address will be the owner's own domain.

**What the change of 02.10.2026 meant for the people using the app.** The app has the address built in. Every app
built before the change (up to 0.1.131) talks to `comevava76` and stops working as soon as the subdomain changes; it
cannot even ask for the update. Each person installs the new app once from the new link
`https://personalhealthy-api.hint365.workers.dev/download`; their data is on the server and comes back on sign-in.

## Later: the definitive domain (owner's own name)

Decided by Human: the domain is bought on GoDaddy, its DNS is moved to Cloudflare, the service stays on the same
Worker and database. Do it **before** the Google Play launch, so that store users never meet an address change.

| # | Step | Who | Where | Time |
|---|---|---|---|---|
| 1 | Buy the domain (for example `hint365.<tld>`) | owner, BY HAND, card | GoDaddy | 10 min |
| 2 | Add the domain to Cloudflare (Free plan); Cloudflare gives two name servers | owner, BY HAND | Cloudflare → Add a domain | 5 min |
| 3 | At GoDaddy, replace the name servers with Cloudflare's two | owner, BY HAND | GoDaddy → Domain → Nameservers → Change | 5 min, then up to 24 h until active |
| 4 | Connect the Worker: custom domain `api.<domain>` (or the bare domain) on `personalhealthy-api`; Cloudflare makes the HTTPS certificate | developer (in `wrangler.toml`, `routes = [{ pattern = "api.<domain>", custom_domain = true }]`) | repository → *Build* | 15 min |
| 5 | Check the new address: `/v1/health`, `/my`, `/terms`, `/privacy`, `/download` | developer | browser | 5 min |
| 6 | Set the GitHub variable `BATTITO_API_URL` = `https://api.<domain>` and run *Build*: a new app is built with the new address | developer | GitHub → Settings → Variables | 15 min |
| 7 | Invalidate the old version: the new build becomes the only one that works (one version only); the old app, still on `hint365.workers.dev` (kept on in parallel), is told to update | automatic with *Build* (`APP_VERSION`); on Google Play when the new version is live | — | — |
| 8 | Update every link: privacy URL in the Google OAuth consent screen and in the Play Console listing, documents, guides, `CLAUDE.md`, `README.md`, `DR/infrastructure-as-code/infrastructure.json`, `prod-probe.mjs` | developer + owner (consoles) | Google Cloud, Play Console, repository | 30 min |
| 9 | Turn on the protections that need a custom domain: WAF managed rules (free set), Bot Fight Mode, "Always use HTTPS", HSTS | owner, BY HAND | Cloudflare → the domain → Security | 10 min |
| 10 | After a few weeks, when the version spread in Admin shows nobody on the old build: `workers_dev = false` in `wrangler.toml` (the old address goes off) | developer | repository | 5 min |

Sign in with Google does not depend on the address (the app sends its Google token to the server, which checks it
with the client ID), so no OAuth client changes, only the consent screen's links (step 8).

Costs: the domain (GoDaddy, yearly); Cloudflare Free plan for DNS, HTTPS and the custom domain: 0.
