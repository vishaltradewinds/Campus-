#!/usr/bin/env bash
# Synthetic CI only. No external connections, uploads or live credentials.
set -euo pipefail
[[ "$GITHUB_ACTIONS" == true && "$RUNNER_OS" == Linux ]]
cid="$NEXUSTALENT_CI_POSTGRES_CONTAINER"
[[ "$cid" =~ ^[0-9a-f]{64}$ ]]
[[ "$(docker inspect --format '{{.Config.Image}}' "$cid")" == postgres:16 ]]
source_db=nexustalent_ci
target_db=nexustalent_restore_ci
pg() { local db="$1"; shift; docker exec -i "$cid" psql -X -q -t -A -v ON_ERROR_STOP=1 -U postgres -d "$db" "$@"; }
[[ "$(pg "$source_db" -c "SELECT current_database()||':'||current_user||':'||(current_setting('server_version_num')::int/10000)::text")" == "$source_db:postgres:16" ]]
[[ "$(pg "$source_db" -c "SELECT count(*) FROM pg_database WHERE datname='nexustalent_restore_ci'")" == 0 ]]
umask 077
tmp="$(mktemp -d)"
created=0
cleanup() {
  if [[ "$created" == 1 ]]; then docker exec "$cid" dropdb -U postgres "$target_db"; fi
  rm -rf "$tmp"
}
trap cleanup EXIT
start="$(date +%s)"
docker exec "$cid" pg_dump -U postgres -Fc "$source_db" > "$tmp/backup.dump"
test -s "$tmp/backup.dump"
docker exec "$cid" createdb -U postgres -T template0 "$target_db"
created=1
docker exec -i "$cid" pg_restore -U postgres --exit-on-error --single-transaction -d "$target_db" < "$tmp/backup.dump"
# Compare all application and identity table rows privately, including
# synthetic credential/session/recovery data, without emitting values.
table_sql="SELECT format('%I.%I',n.nspname,c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('nexustalent','nexustalent_identity') AND c.relkind IN ('r','p') ORDER BY 1"
pg "$source_db" -c "$table_sql" > "$tmp/source-tables"
pg "$target_db" -c "$table_sql" > "$tmp/target-tables"
cmp "$tmp/source-tables" "$tmp/target-tables"
grep -qx 'nexustalent.records' "$tmp/source-tables"
grep -qx 'nexustalent_identity.principals' "$tmp/source-tables"
while IFS= read -r table; do
  [[ "$table" =~ ^nexustalent(_identity)?\.[a-z_][a-z_0-9]*$ ]]
  query="COPY (SELECT to_jsonb(t)::text FROM $table t ORDER BY to_jsonb(t)::text COLLATE \"C\") TO STDOUT"
  a="$(pg "$source_db" -c "$query" | sha256sum | cut -d' ' -f1)"
  b="$(pg "$target_db" -c "$query" | sha256sum | cut -d' ' -f1)"
  [[ "$a" == "$b" ]]
done < "$tmp/source-tables"
node scripts/audit-production-pg-privileges.mjs --disposable-sql-json > "$tmp/catalog.sql"
pg "$source_db" < "$tmp/catalog.sql" > "$tmp/source-catalog"
pg "$target_db" < "$tmp/catalog.sql" > "$tmp/target-catalog"
node --input-type=module - "$tmp/source-catalog" "$tmp/target-catalog" <<'NODE'
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assessDisposablePrivilegeRows} from './scripts/audit-production-pg-privileges.mjs';
const source=JSON.parse(readFileSync(process.argv[2],'utf8'));
const restored=JSON.parse(readFileSync(process.argv[3],'utf8'));
assert.equal(source.length,17);
assert.equal(restored.length,17);
assert.ok(restored.every(r=>r.database_name==='nexustalent_restore_ci'));
assert.deepEqual(restored.map(r=>({...r,database_name:'nexustalent_ci'})),source);
assert.deepEqual(assessDisposablePrivilegeRows(source).blockers,['PROVIDER_ATTESTATION_AND_NEGATIVE_TESTS_REQUIRED']);
NODE
[[ "$(pg "$target_db" -c "SELECT has_table_privilege('nexustalent_app_session','nexustalent_identity.credentials','SELECT')")" == f ]]
[[ "$(pg "$target_db" -c "SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid='nexustalent.records'::regclass")" == t ]]
elapsed="$(( $(date +%s) - start ))"
printf 'PASS: disposable logical backup/restore, %s tables, 17 role catalog rows, elapsed %ss. Existing cluster roles only; not production RPO/RTO or disaster recovery evidence.\n' "$(wc -l < "$tmp/source-tables")" "$elapsed"
