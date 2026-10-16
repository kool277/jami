#!/bin/sh
# Configure the Jami web client (service web): its JWT keys, its admin
# account (JAMI_WEB_ADMIN_PASSWORD from .env) and sign-in with JAMS
# accounts only (https://JAMS_HOST), without local accounts, OpenID or
# guests. Runs `jami-web setup --non-interactive` in the container, then
# restarts it. Safe to re-run: the keys and the admin account are kept.
# The password is read from .env and never printed.
set -eu
cd "$(dirname "$0")/.."

set -a
. ./.env
set +a
: "${JAMS_HOST:?}" "${JAMI_WEB_ADMIN_PASSWORD:?}"
jams="https://$JAMS_HOST"
[ "${JAMS_HTTPS_PORT:-443}" = 443 ] || jams="$jams:$JAMS_HTTPS_PORT"

[ -f certs/ca-bundle.crt ] || sh scripts/export-ca.sh >/dev/null
docker compose up -d --wait web
# The password reaches the container through its environment (exported
# above), not on a command line.
docker compose exec -T -e JAMI_WEB_ADMIN_PASSWORD web \
    node server/dist/cli.js setup --non-interactive \
    --disable-local --enable-jams --jams-url "$jams" --disable-openid --disable-guest
docker compose restart web
docker compose up -d --wait web
echo "Jami web client: http://127.0.0.1:${WEB_PORT:-8090} on this host, https://$JAMS_HOST:${WEB_HTTPS_PORT:-8443} from other machines"
