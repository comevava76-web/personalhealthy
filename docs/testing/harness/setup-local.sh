#!/usr/bin/env bash
# HINT 365 QA: prepares a LOCAL copy of the Worker in a scratch folder and starts it (wrangler dev --local).
# Nothing in the repository is changed: wrangler.toml is copied with a dummy database id, secrets are dummy values.
# Usage: bash docs/testing/harness/setup-local.sh <scratch-dir>      (stop it later with: pkill -f "wrangler dev")
set -euo pipefail
REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
W="${1:?scratch dir}/w"
rm -rf "$W" && mkdir -p "$W"
cp -r "$REPO/worker/src" "$REPO/worker/public" "$REPO/worker/schema.sql" "$REPO/worker/package.json" "$W/"
[ -d "$REPO/worker/node_modules" ] || (cd "$REPO/worker" && npm install --no-audit --no-fund)
ln -s "$REPO/worker/node_modules" "$W/node_modules"
sed 's/D1_DATABASE_ID/00000000-0000-0000-0000-000000000000/' "$REPO/worker/wrangler.toml" > "$W/wrangler.toml"
cat > "$W/.dev.vars" <<EOF
ANTHROPIC_API_KEY=sk-ant-dummy-not-a-real-key-000000000000
FAMILY_CODE=QA-FAMILY-CODE-DUMMY
KEY_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
EOF
cd "$W"
export WRANGLER_SEND_METRICS=false
npx wrangler d1 execute personalhealthy --local --file=schema.sql >/dev/null
# the columns .github/workflows/build.yml adds with add_col (errors for columns already in schema.sql are ignored)
for c in "persons created_at_local TEXT" "scans taken_at_local TEXT" "scans created_at_local TEXT" \
         "measurements taken_at_local TEXT" "measurements created_at_local TEXT" "ledger created_at_local TEXT" \
         "persons pays TEXT NOT NULL DEFAULT 'owner'" "ledger payer TEXT" "persons google_sub TEXT" "persons email TEXT" \
         "persons consent_at INTEGER" "person_keys status TEXT" "person_keys checked_at INTEGER" "persons sub_token TEXT" \
         "persons sub_until INTEGER" "persons sub_state TEXT" "persons sub_checked_at INTEGER" "persons last_seen_at INTEGER" \
         "persons app_version TEXT"; do
  set -- $c; t=$1; shift
  npx wrangler d1 execute personalhealthy --local --command "ALTER TABLE $t ADD COLUMN $*" >/dev/null 2>&1 || true
done
npx wrangler d1 execute personalhealthy --local --command "CREATE UNIQUE INDEX IF NOT EXISTS idx_persons_google ON persons (google_sub)" >/dev/null
nohup npx wrangler dev --local --port 8787 --ip 127.0.0.1 --test-scheduled > ../wrangler.log 2>&1 &
for i in $(seq 1 60); do curl -s -m 2 http://127.0.0.1:8787/v1/health >/dev/null && break; sleep 1; done
echo "Local worker ready at http://127.0.0.1:8787 (worker dir: $W)"
