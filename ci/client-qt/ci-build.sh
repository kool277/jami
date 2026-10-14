#!/bin/sh
# Configure and build jami-client-qt (and jami-core from the jami-daemon
# tree that run.sh mounts as daemon/) with tests, as upstream CI does. Run inside the container,
# from /src/jami-client-qt.
# Configuring downloads dependencies (FetchContent: qwindowkit and its
# submodules) from GitHub, so a configure that fails on the network is
# retried: up to 10 tries, 30 s apart, like withNetRetry in the
# Jenkinsfiles. Any other configure error fails at once.
set -eu

network_errors="Could not resolve host|Couldn't resolve host|Failed to connect|Couldn't connect to server|Connection refused|Connection timed out|Timeout was reached|Temporary failure in name resolution|Network is unreachable|unable to access|early EOF|remote end hung up|RPC failed"
log=$(mktemp)
trap 'rm -f "$log" "$log.status"' EXIT
configure() {
    { set +e
      cmake -S . -B build -GNinja \
          -DCMAKE_BUILD_TYPE=Release \
          -DCMAKE_INSTALL_PREFIX="$PWD/install" \
          -DCMAKE_PREFIX_PATH="$QT_ROOT" \
          -DBUILD_TESTING=On
      echo $? >"$log.status"; } 2>&1 | tee "$log"
    return "$(cat "$log.status")"
}

mkdir -p "$HOME"
try=1
until configure; do
    grep -qE "$network_errors" "$log" || exit 1
    [ "$try" -lt 10 ] || exit 1
    echo "== configure failed on the network (try $try of 10), retrying in 30 s" >&2
    try=$((try + 1))
    sleep 30
done
cmake --build build -j"${JOBS:-12}"
cmake --install build
