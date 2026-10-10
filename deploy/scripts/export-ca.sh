#!/bin/sh
# Copy the root certificate of Caddy's local CA (JAMS_TLS=internal) to
# deploy/certs/jams-root.crt. Clients and curl must trust it to reach
# JAMS over HTTPS. It is a public certificate, not a secret.
set -eu
cd "$(dirname "$0")/.."

mkdir -p certs
i=0
until docker compose exec -T caddy test -f /data/caddy/pki/authorities/local/root.crt; do
    i=$((i + 1))
    [ "$i" -gt 30 ] && { echo "Caddy has not created its local CA" >&2; exit 1; }
    sleep 1
done
docker compose exec -T caddy cat /data/caddy/pki/authorities/local/root.crt > certs/jams-root.crt
openssl x509 -in certs/jams-root.crt -noout -subject -enddate
