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

# TURN_EXTERNAL_IP=PUBLIC/PRIVATE behind a router that maps the TURN ports
# of PUBLIC to PRIVATE: relays open on PRIVATE, and clients are given
# PUBLIC as their relay address. Given as PUBLIC/PRIVATE, coturn would also
# let relays reach PRIVATE, every port of this host; given apart, it does
# not. Relays then cannot reach one another either: that would take the
# router passing traffic for its public address back in.
if [ -n "${TURN_EXTERNAL_IP:-}" ]; then
    set -- "$@" --external-ip="${TURN_EXTERNAL_IP%%/*}"
    case $TURN_EXTERNAL_IP in
    */*) set -- "$@" --relay-ip="${TURN_EXTERNAL_IP#*/}" ;;
    esac
fi

# No relaying to private, loopback or reserved addresses: every device has
# the TURN credentials (the blueprint gives them, and the web client gives
# them to browsers), and through a relay it could otherwise reach the LAN
# and the containers. Peers on the LAN reach each other directly; a peer
# outside reaches one on the LAN through the relay that the LAN peer opens.
for range in 0.0.0.0-0.255.255.255 10.0.0.0-10.255.255.255 \
    100.64.0.0-100.127.255.255 127.0.0.0-127.255.255.255 \
    169.254.0.0-169.254.255.255 172.16.0.0-172.31.255.255 \
    192.0.0.0-192.0.0.255 192.0.2.0-192.0.2.255 192.88.99.0-192.88.99.255 \
    192.168.0.0-192.168.255.255 198.18.0.0-198.19.255.255 \
    198.51.100.0-198.51.100.255 203.0.113.0-203.0.113.255 \
    240.0.0.0-255.255.255.255 ::1 64:ff9b::-64:ff9b::ffff:ffff \
    ::ffff:0.0.0.0-::ffff:255.255.255.255 \
    fc00::-fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff \
    fe80::-febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff; do
    set -- "$@" --denied-peer-ip="$range"
done

exec turnserver "$@"
