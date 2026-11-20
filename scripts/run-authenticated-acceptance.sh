#!/usr/bin/env bash
set -euo pipefail
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
test "${NEXUSTALENT_EMULATOR_TEST:-}" = 1
test "${VITE_NEXUSTALENT_EMULATOR_TEST:-}" = 1
test "${FIREBASE_PROJECT_ID:-}" = demo-nexustalent-acceptance
test "${NODE_ENV:-}" = development
test "${PORT:-}" = 4179
mkdir -p acceptance-evidence
# Own the entire process group, including Vite/esbuild descendants.
setsid ./node_modules/.bin/tsx server.ts > acceptance-evidence/server.log 2>&1 &
pid=$!
cleanup() {
  kill -- -"$pid" 2>/dev/null || true
  sleep 1
  kill -KILL -- -"$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
}
trap cleanup EXIT
for i in $(seq 1 45); do
  if curl --max-time 2 --fail --silent http://127.0.0.1:4179/api/health > /dev/null; then
    echo "Acceptance server ready"
    timeout --kill-after=10s 180s node tests/acceptance.browser.mjs 2>&1 | tee acceptance-evidence/browser.log
    exit 0
  fi
  if ! kill -0 "$pid" 2>/dev/null; then break; fi
  sleep 1
done
cat acceptance-evidence/server.log
exit 1
