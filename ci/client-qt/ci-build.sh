#!/bin/sh
# Configure and build jami-client-qt (and jami-core from the jami-daemon
# tree that run.sh mounts as daemon/) with tests, as upstream CI does. Run inside the container,
# from /src/jami-client-qt.
# Configuring downloads dependencies (FetchContent: qwindowkit and its
# submodules) from GitHub, so it is retried through network outages: up
# to 10 tries, 30 s apart, like withNetRetry in the Jenkinsfiles.
set -eu

mkdir -p "$HOME"
try=1
until cmake -S . -B build -GNinja \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_INSTALL_PREFIX="$PWD/install" \
    -DCMAKE_PREFIX_PATH="$QT_ROOT" \
    -DBUILD_TESTING=On; do
    [ "$try" -lt 10 ] || exit 1
    echo "== configure failed (try $try of 10), retrying in 30 s" >&2
    try=$((try + 1))
    sleep 30
done
cmake --build build -j"${JOBS:-16}"
cmake --install build
