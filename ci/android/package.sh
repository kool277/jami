#!/bin/sh
# Collect the release APKs that build.sh made, one per push flavor, as
# jami-android/app/build/dist/jami-android-<VERSION>-<flavor>-unsigned.apk,
# each with its .sha256. VERSION defaults to git describe. Run inside the
# container, from /src/jami-client-android.
set -eu

VERSION=${VERSION:-$(git describe --tags --always)}
ver=$(printf %s "$VERSION" | tr / -)
dist=jami-android/app/build/dist
rm -rf "$dist"
mkdir -p "$dist"
found=0
for apk in jami-android/app/build/outputs/apk/*/release/*.apk; do
    [ -f "$apk" ] || continue
    flavor=$(basename "$(dirname "$(dirname "$apk")")")
    name=jami-android-$ver-$flavor-unsigned.apk
    cp "$apk" "$dist/$name"
    (cd "$dist" && sha256sum "$name" >"$name.sha256")
    found=$((found + 1))
done
[ "$found" -gt 0 ] || { echo "no release APK under jami-android/app/build/outputs/apk" >&2; exit 1; }
ls -l "$dist"
