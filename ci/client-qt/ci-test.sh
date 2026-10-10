#!/bin/sh
# Run the jami-client-qt test suites like upstream CI: sequentially,
# because both use /tmp/jami_test and wipe it at startup. Run inside the
# container, from /src/jami-client-qt, after ci-build.sh.
set -eu

mkdir -p "$HOME"
ctest --test-dir build/tests -V -C Release -R '^Qml_Tests$'
ctest --test-dir build/tests -V -C Release -R '^Unit_Tests$'
