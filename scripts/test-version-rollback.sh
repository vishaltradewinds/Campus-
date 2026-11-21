#!/usr/bin/env bash
set -euo pipefail
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
test "${NEXUSTALENT_EMULATOR_TEST:-}" = 1
test "${FIREBASE_PROJECT_ID:-}" = demo-nexustalent-acceptance
test "${NODE_ENV:-}" = development
test "${PORT:-}" = 4179
root="$(pwd)"
previous="${RUNNER_TEMP:?}/nexus-rollback-baseline"
expected=e1c790abca97c10c0f8ce02a485dec2241307899
test "$(git -C "$previous" rev-parse HEAD)" = "$expected"
mkdir -p acceptance-evidence
pid=""
cleanup() {
  if [ -n "$pid" ]; then
    kill -- -"$pid" 2>/dev/null || true
    sleep 1
    kill -KILL -- -"$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
    pid=""
  fi
}
trap cleanup EXIT
probe() {
  local phase="$1" dir="$2"
  local sha
  sha="$(git -C "$dir" rev-parse HEAD)"
  # No other application must be listening: avoid false success from a stale process.
  if curl --max-time 1 -fsS http://127.0.0.1:4179/api/health >/dev/null 2>&1; then
    echo "Unexpected existing server on rollback test port"; exit 1
  fi
  (
    cd "$dir"
    exec setsid ./node_modules/.bin/tsx server.ts
  ) > "$root/acceptance-evidence/rollback-$phase.log" 2>&1 &
  pid=$!
  for i in $(seq 1 30); do
    if curl --max-time 1 -fsS http://127.0.0.1:4179/api/health >/dev/null; then
      timeout 35s node tests/rollbackProbe.mjs "$phase" "$sha"
      cleanup
      return
    fi
    if ! kill -0 "$pid" 2>/dev/null; then break; fi
    sleep 1
  done
  cat "$root/acceptance-evidence/rollback-$phase.log"
  return 1
}
probe candidate-before "$root"
probe rollback-baseline "$previous"
probe candidate-after "$root"
echo "Local version rollback/reapply passed: candidate -> verified previous version -> candidate."
