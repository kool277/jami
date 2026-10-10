#!/bin/sh
# Configure and build jami-client-qt (and jami-core through the daemon
# symlink) with tests, as upstream CI does. Run inside the container,
# from /src/jami-client-qt.
set -eu

mkdir -p "$HOME"
cmake -S . -B build -GNinja \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_INSTALL_PREFIX="$PWD/install" \
    -DCMAKE_PREFIX_PATH="$QT_ROOT" \
    -DBUILD_TESTING=On
cmake --build build -j"${JOBS:-16}"
cmake --install build
