#!/bin/sh
# Start the desktop client (install/bin/jami) under Xvfb on a copy of a
# JAMS account profile made by ci/daemon/jams-e2e-container.sh, and check
# from its log that it comes up: the main window loads, JAMS hands the
# account a device token and the account announces itself on the DHT. Runs inside the client-qt build
# container; ci/daemon/jams-e2e.sh starts it while the JAMS user exists.
#   E2E_PROFILE=/src/jami-daemon/build/e2e/alice sh /ci/jams-client-check.sh
set -eu

: "${E2E_PROFILE:?}"
TIMEOUT=${TIMEOUT:-90}
work=${CHECK_DIR:-build/jams-client-check}
rm -rf "$work"
mkdir -p "$work/home"
work=$(cd "$work" && pwd) # XDG paths must be absolute
cp -a "$E2E_PROFILE/cfg" "$E2E_PROFILE/data" "$E2E_PROFILE/cache" "$work/"

export HOME="$work/home" XDG_CONFIG_HOME="$work/cfg" XDG_DATA_HOME="$work/data" \
    XDG_CACHE_HOME="$work/cache"
# A real (virtual) display instead of the offscreen platform the image
# sets for tests: the client needs GTK and an X display to start.
unset QT_QPA_PLATFORM
log=$work/jami.log
xvfb-run -a -s "-screen 0 1280x800x24" install/bin/jami -d >"$log" 2>&1 &
pid=$!
trap 'kill "$pid" 2>/dev/null || true; pkill -f install/bin/jami 2>/dev/null || true' EXIT

check() {
    sed 's/\x1b\[[0-9;]*m//g' "$log" | grep -q "$1"
}
up() {
    check "Initializing main view" && check "Identity announcement succeeded"
}
i=0
until up; do
    i=$((i + 1))
    if [ "$i" -gt "$((TIMEOUT * 2))" ] || ! kill -0 "$pid" 2>/dev/null; then
        echo "FAIL  client: main view or account did not come up (log: $log)" >&2
        sed 's/\x1b\[[0-9;]*m//g' "$log" | grep -vE "upnp|UPnP|NAT-PMP|ALSA" | tail -25 >&2
        exit 1
    fi
    sleep 0.5
done
# The device token proves the JAMS session (client certificate via Caddy);
# it is the only [Auth] response logged with a status code.
check "\[Auth\] Got server response: 200 (" ||
    { echo "FAIL  client: no JAMS device token (log: $log)" >&2; exit 1; }
qml_errors=$(grep -cE "qrc:/.*(Error|TypeError|ReferenceError)" "$log" || true)
echo "OK    client started under Xvfb with the JAMS account: main view loaded," \
    "device token from JAMS, identity announced on the DHT ($qml_errors QML errors in log)"
