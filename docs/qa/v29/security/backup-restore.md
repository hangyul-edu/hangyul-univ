# V29 backup & restore drill — measured

Run on 2026-10-30 against the **development** database `hangyul_univ` (PostgreSQL 16.15, 41 MB on disk, alembic `v29sec0001`) on the WSL QA host.

    scripts/ops/backup.sh          # pg_dump -Fc + sha256 + manifest → server/var/backups/
    scripts/ops/restore-test.sh    # restore into hangyul_restore_test_<ts>, verify, time, drop

## Output

```
restore drill: /root/hangyul-univ/server/var/backups/hangyul_univ_20261030T141612Z.dump
  temp database: hangyul_restore_test_20261030141614 (dropped afterwards)
  sha256: verified (920523a90eb24ae2…)   size: 2372472 bytes   dump took 1.44 s
  pg_restore elapsed: 11.95 s   public tables: 128
  alembic revision: source v29sec0001 / restored v29sec0001 OK
  users              source      227  restored      227  OK
  documents          source      473  restored      473  OK
  document_versions  source      475  restored      475  OK
  applications       source      100  restored      100  OK
  orders             source       57  restored       57  OK
  audit_logs         source      701  restored      701  OK
  universities       source       10  restored       10  OK
  consent_records    source      184  restored      184  OK
RESULT: PASS
```

The temporary database was dropped by the script's exit trap (`pg_database` has no `hangyul_restore_test_%` afterwards).

## Measured

| | value |
|---|---|
| dump (pg_dump -Fc, compress 6) | 1.44 s → 2,372,472 bytes |
| restore (pg_restore --jobs=2) | **11.95 s** for 128 tables |
| integrity | sha256 verified; alembic revision and 8 key-table row counts equal the source |

**RTO (database step, measured): ≈ 12 s for the current 41 MB dataset.** This is the time to restore a dump onto a
running PostgreSQL server; it does not include provisioning a server, fetching the dump from off-host storage, DNS or
application redeploy, and it grows roughly linearly with data size. Re-measure on production-sized data.

**RPO (assumption, not a commitment): daily dump → RPO ≤ 24 h** unless WAL archiving / point-in-time recovery
(e.g. managed-PostgreSQL PITR or pgBackRest) is configured, which would reduce it to minutes. No scheduler for
`backup.sh` and no off-host copy are configured on this host — both are infrastructure (BLOCKED_EXTERNAL).

## What the manifest contains

Backend/bucket/region/endpoint/SSE/prefix of object storage (metadata only), database name and host, server version,
alembic revision, file size, sha256, dump duration, key row counts. **No secrets**: the scripts take credentials only from
`PGPASSWORD` / `~/.pgpass`, never on the command line, and the manifest reads no secret variable.

## Not covered by the database dump

Document bytes live in object storage. Production relies on S3 bucket versioning + (cross-region) replication for them;
a document whose row is restored but whose object is gone reads as `file_unavailable` and is never served.
