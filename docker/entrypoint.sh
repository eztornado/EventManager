#!/bin/sh
set -eu

APP_ROOT="${LARUST_APP_ROOT:-/app}"
mkdir -p "$APP_ROOT/database" "$APP_ROOT/storage/logs"

# Coolify can mount persistent volumes owned by root. Fix ownership once as
# root, then re-enter this same script as the unprivileged runtime user.
if [ "$(id -u)" = "0" ]; then
    chown -R eventmanager:eventmanager "$APP_ROOT/database" "$APP_ROOT/storage" 2>/dev/null || true
    exec gosu eventmanager "$0" "$@"
fi

cd "$APP_ROOT"

echo "Applying database migrations..."
/usr/local/bin/eventmanager migrate

if [ "${SEED_DEMO_DATA:-false}" = "true" ]; then
    echo "Loading demo data (the seeder skips databases that already have users)..."
    /usr/local/bin/eventmanager db:seed
fi

if [ -n "${ADMIN_EMAIL:-}" ] && [ -n "${ADMIN_PASSWORD:-}" ]; then
    echo "Ensuring bootstrap administrator exists..."
    /usr/local/bin/eventmanager admin:create
fi

exec /usr/local/bin/eventmanager
