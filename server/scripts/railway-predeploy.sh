#!/usr/bin/env sh
# Runs on every Railway deploy BEFORE the server process starts.
# Idempotent: all migration scripts guard against "already exists"; seeds use
# ON CONFLICT DO NOTHING / upserts. Seed failures are logged but do not abort
# the deploy; migration failures do abort, which is intentional.
set -eu

DIST=dist/server/src/database

log() { printf '\n=== %s ===\n' "$*"; }
run_migration() { log "migrate: $1"; node "$DIST/$1"; }
run_seed() { log "seed: $1"; node "$DIST/$1" || echo "  (seed $1 failed, continuing)"; }

log "Railway pre-deploy: migrations + seeds"

run_migration run-migrations.js
run_migration run-daily-health-metrics-migration.js
run_migration run-leaderboard-migration.js
run_migration run-role-permissions-migration.js
run_migration run-activity-automation-migration.js
run_migration run-schedule-automation-migration.js
run_migration run-access-token-migration.js

run_seed seed-assessment-questions.js
run_seed seed-subscription-plans.js
run_seed seed-blogs.js
run_seed seed-community-group.js
run_seed seed-ai-coach-user.js
run_seed seed-competitions.js

log "Pre-deploy complete"
