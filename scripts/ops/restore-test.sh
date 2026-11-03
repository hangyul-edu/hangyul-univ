#!/usr/bin/env bash
# V29 — restore drill: restore a backup into a throwaway database, verify it, time it, drop it.
#
#   scripts/ops/restore-test.sh [BACKUP.dump]   (default: newest dump in server/var/backups; makes one first if none)
#
# Checks: sha256 matches the manifest; pg_restore succeeds; alembic revision and row counts of key tables equal the
# manifest (i.e. the source at dump time). Prints elapsed restore time (the measured RTO for the database step).
# The temporary database (hangyul_restore_test_<ts>) is always dropped, also on failure.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
export PGHOST="${PGHOST:-localhost}" PGPORT="${PGPORT:-5432}" PGUSER="${PGUSER:-hangyul}"
DUMP="${1:-}"
if [ -z "$DUMP" ]; then
  DUMP="$(ls -1t "$ROOT"/server/var/backups/*.dump 2>/dev/null | head -1 || true)"
  if [ -z "$DUMP" ]; then "$ROOT/scripts/ops/backup.sh" >/dev/null; DUMP="$(ls -1t "$ROOT"/server/var/backups/*.dump | head -1)"; fi
fi
MAN="${DUMP%.dump}.manifest.json"
[ -f "$MAN" ] || { echo "manifest $MAN missing" >&2; exit 2; }
want="$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['sha256'])" "$MAN")"
got="$(sha256sum "$DUMP" | cut -d' ' -f1)"
[ "$want" = "$got" ] || { echo "CHECKSUM MISMATCH for $DUMP" >&2; exit 3; }
TMPDB="hangyul_restore_test_$(date -u +%Y%m%d%H%M%S)"
cleanup() { dropdb --if-exists "$TMPDB" 2>/dev/null || true; }
trap cleanup EXIT
createdb "$TMPDB"
T0=$(date +%s.%N)
pg_restore --no-owner --no-privileges --exit-on-error --jobs=2 --dbname="$TMPDB" "$DUMP"
T1=$(date +%s.%N)
COUNTS="$(psql -XAtq -d "$TMPDB" -v ON_ERROR_STOP=1 -c "select json_object_agg(t, n) from (
  select 'users' t, count(*) n from users union all select 'documents', count(*) from documents union all
  select 'document_versions', count(*) from document_versions union all select 'applications', count(*) from applications union all
  select 'orders', count(*) from orders union all select 'audit_logs', count(*) from audit_logs union all
  select 'universities', count(*) from universities union all select 'consent_records', count(*) from consent_records) x")"
REV="$(psql -XAtq -d "$TMPDB" -c 'select version_num from alembic_version')"
TABLES="$(psql -XAtq -d "$TMPDB" -c "select count(*) from information_schema.tables where table_schema='public'")"
python3 - "$MAN" "$COUNTS" "$REV" "$TABLES" "$(echo "$T1 - $T0" | bc)" "$TMPDB" "$DUMP" <<'PY'
import json, sys
man = json.load(open(sys.argv[1])); restored = json.loads(sys.argv[2]); rev, tables, secs, tmpdb, dump = sys.argv[3:8]
ok = True
print(f"restore drill: {dump}")
print(f"  temp database: {tmpdb} (dropped afterwards)")
print(f"  sha256: verified ({man['sha256'][:16]}…)   size: {man['size_bytes']} bytes   dump took {man['dump_seconds']} s")
print(f"  pg_restore elapsed: {float(secs):.2f} s   public tables: {tables}")
print(f"  alembic revision: source {man['alembic_revision']} / restored {rev}", "OK" if rev == man["alembic_revision"] else "MISMATCH")
ok &= rev == man["alembic_revision"]
for t, n in man["row_counts"].items():
    m = restored.get(t)
    print(f"  {t:18s} source {n:>8}  restored {m:>8}  {'OK' if m == n else 'MISMATCH'}")
    ok &= m == n
print("RESULT:", "PASS" if ok else "FAIL")
sys.exit(0 if ok else 1)
PY
