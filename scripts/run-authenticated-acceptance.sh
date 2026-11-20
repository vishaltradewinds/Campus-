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
npm run dev > acceptance-evidence/server.log 2>&1 &
pid=$!
trap 'kill "$pid" 2>/dev/null || true' EXIT
for i in $(seq 1 60); do
  if curl --fail --silent http://127.0.0.1:4179/api/health > /dev/null; then
    node tests/acceptance.browser.mjs
    exit 0
  fi
  sleep 1
done
cat acceptance-evidence/server.log
exit 1
