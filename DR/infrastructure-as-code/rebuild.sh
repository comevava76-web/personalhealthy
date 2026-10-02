#!/usr/bin/env bash
# HINT 365 · Infrastructure as Code and disaster recovery.
# Reads DR/infrastructure-as-code/infrastructure.json and makes Cloudflare match it. It creates, never deletes
# (the only exception: the temporary clone made by "drill", which it removes at the end).
#
#   rebuild.sh check                 what exists and what is missing (changes nothing)
#   rebuild.sh apply                 creates the missing D1 databases, all bound to the EU
#   rebuild.sh schema                creates the tables (idempotent: CREATE TABLE IF NOT EXISTS)
#   rebuild.sh backup                exports the two databases, encrypts them (AES-256, BACKUP_PASSPHRASE) and keeps
#                                    them in the vault database; removes backups older than 30 days
#   rebuild.sh list-backups          the backups in the vault (day, parts, size)
#   rebuild.sh restore DAY|latest    puts a backup back into an EMPTY database (refuses if it holds accounts)
#   rebuild.sh restore-file FILE     the same from a downloaded encrypted file (if the vault itself is lost)
#   rebuild.sh time-travel TS        the live database back to a minute of the last 7 days (D1 Time Travel)
#   rebuild.sh rebuild [DAY|latest]  disaster recovery from zero: apply + schema + restore; then Actions → Build deploys
#   rebuild.sh drill                 the whole recovery on a temporary clone (…-clone databases): rebuild, restore the
#                                    latest backup, compare the counts with production, measure the time, remove the clone
#
# Needs CLOUDFLARE_API_TOKEN (and BACKUP_PASSPHRASE for backup/restore), jq, curl, openssl, node + npm.
# LOCAL=1 WORKER_DIR=<scratch dir with node_modules> runs everything on local databases (wrangler --local), for tests.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CFG="$ROOT/DR/infrastructure-as-code/infrastructure.json"
ACC=$(jq -r .cloudflare.account_id "$CFG")
export CLOUDFLARE_ACCOUNT_ID="$ACC" WRANGLER_SEND_METRICS=false
SUFFIX="${SUFFIX:-}"                       # "-clone" during a drill
MAIN="personalhealthy$SUFFIX"; COPY="personalhealthy-backup$SUFFIX"; VAULT="personalhealthy-vault"   # one vault only
KEEP_DAYS=$(jq -r .recovery.backup_keep_days "$CFG")
PART=90000                                 # bytes of base64 per row: a D1 statement is limited to 100 KB
WDIR="${WORKER_DIR:-$ROOT/worker}"         # where wrangler runs (the local test uses its own copy)
if [ -n "${LOCAL:-}" ]; then WHERE=(--local); else WHERE=(--remote); : "${CLOUDFLARE_API_TOKEN:?set CLOUDFLARE_API_TOKEN}"; fi
API="https://api.cloudflare.com/client/v4/accounts/$ACC"
AUTH="Authorization: Bearer ${CLOUDFLARE_API_TOKEN:-}"
[ -d "$WDIR/node_modules" ] || (cd "$WDIR" && npm ci --no-audit --no-fund --silent)
log() { echo "[$(date -u +%H:%M:%S)] $*"; }

d1_id() { [ -n "${LOCAL:-}" ] && { echo "00000000-0000-0000-0000-$(printf '%012d' $(( $(echo -n "$1" | cksum | cut -d' ' -f1) % 1000000000000 )))"; return; }
  curl -s -H "$AUTH" "$API/d1/database?name=$1" | jq -r --arg n "$1" '.result[]? | select(.name==$n) | .uuid' | head -1; }

# a wrangler config naming every database used here, with its real id (never committed)
CONF=""
conf() {
  [ -n "$CONF" ] && return
  # locally the config sits in WORKER_DIR, so the local databases live in WORKER_DIR/.wrangler/state
  if [ -n "${LOCAL:-}" ]; then CONF="$WDIR/.dr-wrangler.toml"; else CONF=$(mktemp -d)/wrangler.toml; fi
  { echo "name = \"hint365-dr\""; echo "compatibility_date = \"2025-09-01\""
    for n in "$MAIN" "$COPY" "$VAULT"; do id=$(d1_id "$n"); [ -n "$id" ] || continue
      printf '[[d1_databases]]\nbinding = "%s"\ndatabase_name = "%s"\ndatabase_id = "%s"\n' "$(echo "$n" | tr 'a-z-' 'A-Z_')" "$n" "$id"; done
  } > "$CONF"
}
w() { (cd "$WDIR" && npx --yes wrangler "$@"); }
d1() { local db="$1"; shift; conf; w d1 execute "$db" "${WHERE[@]}" --config "$CONF" --yes "$@"; }
q() { d1 "$1" --json --command "$2" 2>/dev/null | jq -c '.[0].results'; }      # a query, rows as JSON

check() {
  for n in "$MAIN" "$COPY" "$VAULT"; do id=$(d1_id "$n"); [ -n "$id" ] && log "D1 $n: present" || log "D1 $n: MISSING"; done
  [ -n "${LOCAL:-}" ] && return
  s=$(curl -s -H "$AUTH" "$API/workers/scripts" | jq -r '[.result[]? | select(.id=="personalhealthy-api")] | length')
  [ "$s" = "1" ] && log "Worker personalhealthy-api: present" || log "Worker: MISSING (Actions → Build)"
}

apply() {
  [ -n "${LOCAL:-}" ] && { log "local: databases are created on first use"; return; }
  for n in "$MAIN" "$COPY" "$VAULT"; do
    if [ -z "$(d1_id "$n")" ]; then
      log "Creating D1 $n (jurisdiction eu)"
      curl -s -X POST -H "$AUTH" -H "Content-Type: application/json" "$API/d1/database" \
        --data "$(jq -n --arg n "$n" '{name: $n, jurisdiction: "eu"}')" | jq -e '.success' >/dev/null
    else log "D1 $n: already there"; fi
  done
  CONF=""
}

schema() {
  log "Tables: $MAIN, $COPY, $VAULT"
  d1 "$MAIN" --file "$ROOT/worker/schema.sql" >/dev/null
  d1 "$COPY" --file "$ROOT/worker/schema-backup.sql" >/dev/null
  d1 "$VAULT" --file "$ROOT/worker/schema-vault.sql" >/dev/null
}

backup() {
  : "${BACKUP_PASSPHRASE:?set BACKUP_PASSPHRASE}"
  local t day; t=$(mktemp -d); day="${DAY:-$(date -u +%F)}"
  d1 "$VAULT" --file "$ROOT/worker/schema-vault.sql" >/dev/null
  conf
  w d1 export "$MAIN" "${WHERE[@]}" --config "$CONF" --output "$t/personalhealthy.sql" >/dev/null
  w d1 export "$COPY" "${WHERE[@]}" --config "$CONF" --output "$t/personalhealthy-backup.sql" >/dev/null
  tar -czf - -C "$t" personalhealthy.sql personalhealthy-backup.sql \
    | openssl enc -aes-256-cbc -pbkdf2 -iter 300000 -salt -pass env:BACKUP_PASSPHRASE -out "$t/b.enc"
  rm -f "$t"/*.sql
  local sha; sha=$(sha256sum "$t/b.enc" | cut -c1-64)
  { base64 -w0 "$t/b.enc" | fold -w "$PART"; echo; } | sed '/^$/d' > "$t/parts"     # one part per line, last one included
  local n; n=$(wc -l < "$t/parts")
  q "$VAULT" "DELETE FROM backups WHERE day = '$day'" >/dev/null
  local i=0; now=$(date +%s000)
  while IFS= read -r chunk; do
    printf "INSERT INTO backups (day, part, parts, data, sha256, created_at) VALUES ('%s', %d, %d, '%s', '%s', %s);\n" \
      "$day" "$i" "$n" "$chunk" "$sha" "$now" > "$t/p.sql"
    d1 "$VAULT" --file "$t/p.sql" >/dev/null; i=$((i + 1))
  done < "$t/parts"
  q "$VAULT" "DELETE FROM backups WHERE day < date('now', '-$KEEP_DAYS days')" >/dev/null
  log "Backup $day: $(stat -c %s "$t/b.enc") bytes encrypted, $n part(s), sha256 ${sha:0:12}…"
  rm -rf "$t"
}

list_backups() { q "$VAULT" "SELECT day, MAX(parts) AS parts, SUM(length(data)) AS chars, MAX(created_at) AS at FROM backups GROUP BY day ORDER BY day DESC" | jq -r '.[] | "\(.day)  \(.parts) part(s)  \(.chars) chars"'; }

# the encrypted file of a day, rebuilt from its parts and checked against its fingerprint
fetch() {
  local day="$1" out="$2"
  [ "$day" = "latest" ] && day=$(q "$VAULT" "SELECT MAX(day) AS d FROM backups" | jq -r '.[0].d // empty')
  [ -n "$day" ] || { echo "No backup in the vault"; exit 1; }
  log "Backup of $day"
  q "$VAULT" "SELECT data FROM backups WHERE day = '$day' ORDER BY part" | jq -r '.[].data' | tr -d '\n' | base64 -d > "$out"
  local want; want=$(q "$VAULT" "SELECT sha256 FROM backups WHERE day = '$day' LIMIT 1" | jq -r '.[0].sha256')
  [ "$(sha256sum "$out" | cut -c1-64)" = "$want" ] || { echo "The backup of $day is damaged (fingerprint differs)"; exit 1; }
}

restore_file() {
  local f="$1"
  : "${BACKUP_PASSPHRASE:?set BACKUP_PASSPHRASE}"
  local people; people=$(q "$MAIN" "SELECT COUNT(*) AS n FROM persons" | jq -r '.[0].n // 0' 2>/dev/null || echo 0)
  if [ "${people:-0}" != "0" ] && [ "${FORCE:-}" != "yes" ]; then
    echo "$MAIN already holds $people accounts: a restore would mix data. Use time-travel, or FORCE=yes."; exit 1; fi
  local t; t=$(mktemp -d)
  openssl enc -d -aes-256-cbc -pbkdf2 -iter 300000 -pass env:BACKUP_PASSPHRASE -in "$f" | tar -xz -C "$t" \
    || { echo "Cannot decrypt: wrong BACKUP_PASSPHRASE?"; exit 1; }
  for pair in "personalhealthy:$MAIN" "personalhealthy-backup:$COPY"; do
    src=${pair%%:*}; dst=${pair#*:}
    # the export recreates the tables: on a database that already has them it must not fail
    sed -e 's/^CREATE TABLE /CREATE TABLE IF NOT EXISTS /' -e 's/^CREATE INDEX /CREATE INDEX IF NOT EXISTS /' \
        -e 's/^CREATE UNIQUE INDEX /CREATE UNIQUE INDEX IF NOT EXISTS /' -e 's/^INSERT INTO /INSERT OR REPLACE INTO /' \
        "$t/$src.sql" > "$t/$src.r.sql"
    log "Restoring $dst"
    d1 "$dst" --file "$t/$src.r.sql" >/dev/null
  done
  rm -rf "$t"
}
restore() { local t; t=$(mktemp -d); fetch "${1:-latest}" "$t/b.enc"; restore_file "$t/b.enc"; rm -rf "$t"; }

counts() { q "$1" "SELECT (SELECT COUNT(*) FROM persons) AS persons, (SELECT COUNT(*) FROM measurements) AS measurements, (SELECT COUNT(*) FROM acceptances) AS acceptances" | jq -c '.[0]'; }

rebuild() {
  local t0; t0=$(date +%s)
  apply; schema; restore "${1:-latest}"
  log "Counts in $MAIN: $(counts "$MAIN")"
  log "Rebuilt in $(( $(date +%s) - t0 )) s. Next: Actions → Build (secrets, Worker, app)."
}

drill() {
  local prod t0; prod=$(counts personalhealthy); t0=$(date +%s)
  SUFFIX=-clone; MAIN="personalhealthy-clone"; COPY="personalhealthy-backup-clone"; CONF=""
  rebuild latest
  local clone; clone=$(counts "$MAIN")
  log "Production: $prod"; log "Clone:      $clone"
  local secs=$(( $(date +%s) - t0 ))
  if [ -z "${KEEP:-}" ] && [ -z "${LOCAL:-}" ]; then
    for n in "$MAIN" "$COPY"; do curl -s -X DELETE -H "$AUTH" "$API/d1/database/$(d1_id "$n")" >/dev/null; log "Clone $n removed"; done
  fi
  echo "DRILL $( [ "$prod" = "$clone" ] && echo PASSED || echo 'DIFFERS (data changed since the backup, or the restore is incomplete)' ) · recovery time ${secs} s"
}

case "${1:-check}" in
  check) check ;;
  apply) apply; check ;;
  schema) schema ;;
  backup) backup ;;
  list-backups) list_backups ;;
  restore) restore "${2:-latest}" ;;
  restore-file) restore_file "${2:?file}" ;;
  time-travel) conf; w d1 time-travel restore "$MAIN" --timestamp="${2:?timestamp}" --config "$CONF" ;;
  rebuild) rebuild "${2:-latest}" ;;
  drill) drill ;;
  *) sed -n '2,22p' "$0"; exit 1 ;;
esac
