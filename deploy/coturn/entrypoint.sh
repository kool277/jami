#!/bin/sh
# Start coturn for Jami: long-term credentials in a SQLite user DB,
# one user created (or updated) with turnadmin from TURN_USER and
# TURN_PASSWORD, then turnserver in the foreground.
set -eu

: "${TURN_REALM:?}" "${TURN_USER:?}" "${TURN_PASSWORD:?}"
: "${TURN_PORT:=3479}" "${TURN_MIN_PORT:=49160}" "${TURN_MAX_PORT:=49200}"

db=/var/lib/coturn/turndb
turnadmin --add --userdb="$db" --realm="$TURN_REALM" \
    --user="$TURN_USER" --password="$TURN_PASSWORD" >/dev/null

set -- \
    --listening-port="$TURN_PORT" \
    --min-port="$TURN_MIN_PORT" \
    --max-port="$TURN_MAX_PORT" \
    --lt-cred-mech \
    --fingerprint \
    --realm="$TURN_REALM" \
    --userdb="$db" \
    --no-tls --no-dtls \
    --no-cli \
    --no-multicast-peers \
    --log-file=stdout --simple-log

if [ -n "${TURN_EXTERNAL_IP:-}" ]; then
    set -- "$@" --external-ip="$TURN_EXTERNAL_IP"
fi

exec turnserver "$@"
