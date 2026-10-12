#!/bin/sh
# Build the jami-client-android release APKs and app bundles for every ABI
# (gradle.properties: arm64-v8a, x86_64, armeabi-v7a) and push flavor, as
# upstream's compile.sh --release does: the daemon for Android first, then
# the app. They are unsigned: the release build type has no signing
# config. Run inside the container, from /src/jami-client-android.
set -eu

mkdir -p "$HOME"
./compile.sh --release
