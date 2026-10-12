#!/bin/sh
# Run the libjamiclient unit tests (plain JVM, no device needed) after
# build.sh. Results: jami-android/libjamiclient/build/test-results/test/.
# Run inside the container, from /src/jami-client-android.
set -eu

mkdir -p "$HOME"
cd jami-android
./gradlew --no-daemon :libjamiclient:test
