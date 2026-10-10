#!/bin/sh
# Start build/jamid on a private session bus and check that it answers
# over D-Bus. Runs inside the build container:
#   ci/daemon/run.sh dbus-run-session -- sh /ci/dbus-check.sh
set -eu

export XDG_CONFIG_HOME=/tmp/cfg XDG_DATA_HOME=/tmp/data XDG_CACHE_HOME=/tmp/cache
build/jamid -c -p > /tmp/jamid.log 2>&1 &
pid=$!
trap 'kill "$pid" 2>/dev/null || true' EXIT

call() {
    dbus-send --session --print-reply --dest=cx.ring.Ring "$@"
}

i=0
until dbus-send --session --print-reply --dest=org.freedesktop.DBus / \
        org.freedesktop.DBus.NameHasOwner string:cx.ring.Ring 2>/dev/null |
        grep -q 'boolean true'; do
    i=$((i + 1))
    if [ "$i" -gt 60 ] || ! kill -0 "$pid" 2>/dev/null; then
        echo "jamid did not claim cx.ring.Ring" >&2
        tail -20 /tmp/jamid.log >&2
        exit 1
    fi
    sleep 0.5
done

head -1 /tmp/jamid.log
echo "cx.ring.Ring is owned; objects:"
call /cx/ring/Ring org.freedesktop.DBus.Introspectable.Introspect |
    grep -o 'node name="[^"]*"'
echo "getAccountList:"
call /cx/ring/Ring/ConfigurationManager \
    cx.ring.Ring.ConfigurationManager.getAccountList | tail -n +2
echo "OK"
