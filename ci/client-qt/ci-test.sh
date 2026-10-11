#!/bin/sh
# Run the jami-client-qt test suites like upstream CI: sequentially,
# because both use /tmp/jami_test and wipe it at startup. Both suites run
# even if the first fails; results also go to build/qml-tests.xml and
# build/unit-tests.xml (JUnit). Run inside the container, from
# /src/jami-client-qt, after ci-build.sh.
set -u

mkdir -p "$HOME"
status=0
ctest --test-dir build/tests -V -C Release -R '^Qml_Tests$' \
    --output-junit "$PWD/build/qml-tests.xml" || status=1
ctest --test-dir build/tests -V -C Release -R '^Unit_Tests$' \
    --output-junit "$PWD/build/unit-tests.xml" || status=1
exit $status
