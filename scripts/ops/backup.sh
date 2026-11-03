#!/usr/bin/env bash
# V29 — logical backup of the Hangyul Univ database: pg_dump custom format + SHA-256 + manifest.
#
#   scripts/ops/backup.sh [OUT_DIR]          (default: ./var/backups under server/)
#
# Connection: PGHOST/PGPORT/PGUSER/PGDATABASE (+ PGPASSWORD or ~/.pgpass / PGPASSFILE) — never a URL with a password on
# the command line. Defaults match local development. The manifest records object-storage *configuration metadata*
# (backend, bucket, region, SSE mode, prefix) so a restore knows where the files live; it never records a secret.
# Object bytes are NOT in this dump: S3 versioning / replication covers them (docs/ARCHITECTURE.md#backups).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT_DIR="${1:-$ROOT/server/var/backups}"
export PGHOST="${PGHOST:-localhost}" PGPORT="${PGPORT:-5432}" PGUSER="${PGUSER:-hangyul}" PGDATABASE="${PGDATABASE:-hangyul_univ}"
mkdir -p "$OUT_DIR"
chmod 700 "$OUT_DIR"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
BASE="$OUT_DIR/${PGDATABASE}_${TS}"
T0=$(date +%s.%N)
pg_dump --format=custom --compress=6 --no-owner --no-privileges --file="$BASE.dump" "$PGDATABASE"
T1=$(date +%s.%N)
chmod 600 "$BASE.dump"
SHA="$(sha256sum "$BASE.dump" | cut -d' ' -f1)"
echo "$SHA  $(basename "$BASE.dump")" > "$BASE.dump.sha256"
SIZE="$(stat -c %s "$BASE.dump")"
COUNTS="$(psql -XAtq -v ON_ERROR_STOP=1 -c "select json_object_agg(t, n) from (
  select 'users' t, count(*) n from users union all select 'documents', count(*) from documents union all
  select 'document_versions', count(*) from document_versions union all select 'applications', count(*) from applications union all
  select 'orders', count(*) from orders union all select 'audit_logs', count(*) from audit_logs union all
  select 'universities', count(*) from universities union all select 'consent_records', count(*) from consent_records) x")"
REV="$(psql -XAtq -c 'select version_num from alembic_version')"
PGV="$(psql -XAtq -c 'show server_version')"
python3 - "$BASE.manifest.json" <<PY
import json, os, sys
env = os.environ
manifest = {
  "kind": "hangyul-univ-db-backup", "created_at": "$TS", "database": "$PGDATABASE", "host": "$PGHOST", "server_version": "$PGV",
  "alembic_revision": "$REV", "format": "pg_dump custom (-Fc, compress 6)", "file": os.path.basename("$BASE.dump"),
  "size_bytes": $SIZE, "sha256": "$SHA", "dump_seconds": round($T1 - $T0, 2), "row_counts": json.loads('''$COUNTS'''),
  "object_storage": {  # configuration metadata only — never credentials
    "backend": env.get("HG_STORAGE_BACKEND", "local"), "bucket": env.get("HG_S3_BUCKET"), "region": env.get("HG_S3_REGION"),
    "endpoint": env.get("HG_S3_ENDPOINT_URL"), "sse": env.get("HG_S3_SSE"), "key_prefix": env.get("HG_S3_KEY_PREFIX"),
    "note": "object bytes are not in this dump; rely on bucket versioning/replication",
  },
}
json.dump(manifest, open(sys.argv[1], "w"), indent=2)
PY
chmod 600 "$BASE.manifest.json"
echo "backup: $BASE.dump ($SIZE bytes, sha256 $SHA, $(printf '%.1f' "$(echo "$T1 - $T0" | bc)") s)"
echo "manifest: $BASE.manifest.json"
