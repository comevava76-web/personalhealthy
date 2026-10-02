#!/usr/bin/env bash
# HINT 365 · Infrastructure as Code and disaster recovery.
# Reads DR/infrastructure-as-code/infrastructure.json and makes Cloudflare match it. It only creates what is missing: it never deletes.
#
#   bash DR/infrastructure-as-code/rebuild.sh check                    what exists and what is missing (changes nothing)
#   bash DR/infrastructure-as-code/rebuild.sh apply                    creates the missing databases (EU) and the backup bucket (EU),
#                                                  with its expiry (30 days, as in the privacy policy) and its lock (7 days, nobody can delete)
#   bash DR/infrastructure-as-code/rebuild.sh list-backups             the nightly backups kept in the bucket
#   bash DR/infrastructure-as-code/rebuild.sh restore YYYY-MM-DD       puts a nightly backup back into an EMPTY database (a new account,
#                                                  a lost database): refuses if the database already holds accounts
#   bash DR/infrastructure-as-code/rebuild.sh time-travel TIMESTAMP    puts the live database back to a minute of the last days
#                                                  (Cloudflare D1 Time Travel, e.g. 2026-10-02T21:00:00Z)
# After apply/restore: run Actions → Build (it applies the schema, sets the secrets and deploys the Worker and the app).
#
# Needs: CLOUDFLARE_API_TOKEN (and BACKUP_PASSPHRASE for restore), jq, curl, openssl, node + npm (wrangler).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CFG="$ROOT/DR/infrastructure-as-code/infrastructure.json"
ACC=$(jq -r .cloudflare.account_id "$CFG")
export CLOUDFLARE_ACCOUNT_ID="$ACC" WRANGLER_SEND_METRICS=false
: "${CLOUDFLARE_API_TOKEN:?set CLOUDFLARE_API_TOKEN}"
API="https://api.cloudflare.com/client/v4/accounts/$ACC"
AUTH="Authorization: Bearer $CLOUDFLARE_API_TOKEN"
W() { (cd "$ROOT/worker" && npx --yes wrangler "$@"); }
[ -d "$ROOT/worker/node_modules" ] || (cd "$ROOT/worker" && npm ci --no-audit --no-fund --silent)

d1_id() { curl -s -H "$AUTH" "$API/d1/database?name=$1" | jq -r --arg n "$1" '.result[]? | select(.name==$n) | .uuid' | head -1; }
bucket() { jq -r '.cloudflare.r2[0].name' "$CFG"; }

# a wrangler.toml with the real database ids, for the wrangler commands below (never committed)
config() {
  local t; t=$(mktemp -d)/wrangler.toml
  sed -e "s/D1_DATABASE_ID/$(d1_id personalhealthy)/" -e "s/BACKUP_DATABASE_ID/$(d1_id personalhealthy-backup)/" "$ROOT/worker/wrangler.toml" > "$t"
  sed -i "s#^main = \"src/index.ts\"#main = \"$ROOT/worker/src/index.ts\"#; s#^directory = \"./public\"#directory = \"$ROOT/worker/public\"#" "$t"
  echo "$t"
}

check() {
  echo "Cloudflare account $ACC"
  for n in $(jq -r '.cloudflare.d1[].name' "$CFG"); do
    id=$(d1_id "$n"); [ -n "$id" ] && echo "  D1 $n: present ($id)" || echo "  D1 $n: MISSING"
  done
  b=$(bucket)
  if W r2 bucket list --jurisdiction eu 2>/dev/null | grep -q "$b"; then echo "  R2 $b (eu): present"; else echo "  R2 $b (eu): MISSING (or R2 not enabled on the account)"; fi
  s=$(curl -s -H "$AUTH" "$API/workers/scripts" | jq -r --arg n "$(jq -r .cloudflare.worker.name "$CFG")" '[.result[]? | select(.id==$n)] | length')
  [ "$s" = "1" ] && echo "  Worker $(jq -r .cloudflare.worker.name "$CFG"): present" || echo "  Worker: MISSING (run Actions → Build)"
}

apply() {
  for row in $(jq -c '.cloudflare.d1[]' "$CFG"); do
    n=$(jq -r .name <<<"$row"); j=$(jq -r .jurisdiction <<<"$row")
    if [ -z "$(d1_id "$n")" ]; then
      echo "Creating D1 $n (jurisdiction $j)"
      curl -s -X POST -H "$AUTH" -H "Content-Type: application/json" "$API/d1/database" \
        --data "$(jq -n --arg n "$n" --arg j "$j" '{name: $n, jurisdiction: $j}')" | jq -e '.success' >/dev/null
    else echo "D1 $n: already there"; fi
  done
  r=$(jq -c '.cloudflare.r2[0]' "$CFG"); b=$(jq -r .name <<<"$r")
  if W r2 bucket list --jurisdiction eu 2>/dev/null | grep -q "$b"; then echo "R2 $b: already there"
  else
    echo "Creating R2 $b (jurisdiction eu)"
    W r2 bucket create "$b" --jurisdiction eu || { echo "::warning::R2 is not enabled on the account: enable it once in the dashboard (R2 → Get started, free up to 10 GB) and run again"; return 0; }
  fi
  W r2 bucket lifecycle add "$b" expire-backups "" --expire-days "$(jq -r .expire_days <<<"$r")" --jurisdiction eu --force >/dev/null 2>&1 || true
  W r2 bucket lock add "$b" keep-backups "" --retention-days "$(jq -r .lock_days <<<"$r")" --jurisdiction eu --force >/dev/null 2>&1 || true
  echo "Done. Next: Actions → Build (schema, secrets, Worker, app)."
}

list_backups() {
  curl -s -H "$AUTH" -H "cf-r2-jurisdiction: eu" "$API/r2/buckets/$(bucket)/objects?prefix=d1/&per_page=100" \
    | jq -r '.result[]? | "\(.key)  \(.size) bytes  \(.last_modified)"'
}

restore() {
  local day="${1:?date YYYY-MM-DD}"
  : "${BACKUP_PASSPHRASE:?set BACKUP_PASSPHRASE}"
  local c; c=$(config)
  local people; people=$(npx --yes wrangler d1 execute personalhealthy --remote --config "$c" --json \
    --command "SELECT COUNT(*) AS n FROM persons" 2>/dev/null | jq -r '.[0].results[0].n // 0' || echo 0)
  if [ "${people:-0}" != "0" ] && [ "${FORCE:-}" != "yes" ]; then
    echo "The database already holds $people accounts: a restore would mix data. Use time-travel, or FORCE=yes."; exit 1; fi
  local t; t=$(mktemp -d)
  W r2 object get "$(bucket)/d1/$day/hint365-db.tar.gz.enc" --file "$t/b.enc" --jurisdiction eu --remote
  openssl enc -d -aes-256-cbc -pbkdf2 -iter 300000 -pass env:BACKUP_PASSPHRASE -in "$t/b.enc" | tar -xz -C "$t"
  for f in personalhealthy personalhealthy-backup; do
    # the export recreates the tables; on a database that already has the schema it must not fail
    sed -e 's/^CREATE TABLE /CREATE TABLE IF NOT EXISTS /' -e 's/^CREATE INDEX /CREATE INDEX IF NOT EXISTS /' \
        -e 's/^CREATE UNIQUE INDEX /CREATE UNIQUE INDEX IF NOT EXISTS /' -e 's/^INSERT INTO /INSERT OR REPLACE INTO /' "$t/$f.sql" > "$t/$f.r.sql"
    echo "Restoring $f from $day"
    npx --yes wrangler d1 execute "$f" --remote --config "$c" --file "$t/$f.r.sql" --yes
  done
  rm -rf "$t"
  echo "Restored. Next: Actions → Build, then open the app."
}

case "${1:-check}" in
  check) check ;;
  apply) apply; check ;;
  list-backups) list_backups ;;
  restore) restore "${2:-}" ;;
  time-travel) c=$(config); npx --yes wrangler d1 time-travel restore personalhealthy --timestamp="${2:?timestamp}" --config "$c" ;;
  *) sed -n '2,16p' "$0"; exit 1 ;;
esac
