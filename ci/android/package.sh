#!/bin/sh
# Collect the release APKs that build.sh made, one per push flavor, as
# jami-android/app/build/dist/jami-android-<VERSION>-<flavor>.apk, each
# with its .sha256. VERSION defaults to git describe. Run inside the
# container, from /src/jami-client-android.
#
# Signing: with ANDROID_KEYSTORE (path of the release keystore in the
# container), ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS and
# ANDROID_KEY_PASSWORD set, every APK is zipaligned and signed with
# apksigner (v1+v2+v3 signatures) and verified. Without them the APKs
# stay unsigned and are named ...-unsigned.apk, as upstream builds them.
# The pipeline takes these from the Jenkins credentials android-keystore,
# android-keystore-password, android-key-alias and android-key-password
# (see RELEASING.md in kool277/jami).
set -eu

VERSION=${VERSION:-$(git describe --tags --always)}
ver=$(printf %s "$VERSION" | tr / -)
dist=jami-android/app/build/dist
rm -rf "$dist"
mkdir -p "$dist"

sign=
if [ -n "${ANDROID_KEYSTORE:-}" ]; then
    : "${ANDROID_KEYSTORE_PASSWORD:?set ANDROID_KEYSTORE_PASSWORD}" \
      "${ANDROID_KEY_ALIAS:?set ANDROID_KEY_ALIAS}" \
      "${ANDROID_KEY_PASSWORD:?set ANDROID_KEY_PASSWORD}"
    [ -f "$ANDROID_KEYSTORE" ] || { echo "keystore $ANDROID_KEYSTORE not found" >&2; exit 1; }
    # zipalign and apksigner come with the newest build-tools of the SDK.
    sdk=${ANDROID_HOME:-${ANDROID_SDK_ROOT:-/opt/android}}
    tools=$(ls -d "$sdk"/build-tools/*/ | sort -V | tail -1)
    [ -x "${tools}apksigner" ] || { echo "no apksigner under $sdk/build-tools" >&2; exit 1; }
    sign=1
fi

found=0
for apk in jami-android/app/build/outputs/apk/*/release/*.apk; do
    [ -f "$apk" ] || continue
    flavor=$(basename "$(dirname "$(dirname "$apk")")")
    if [ -n "$sign" ]; then
        name=jami-android-$ver-$flavor.apk
        aligned=$dist/$name.aligned
        "${tools}zipalign" -p -f 4 "$apk" "$aligned"
        # The passwords are read from the environment, never from the
        # command line (which other users could see).
        "${tools}apksigner" sign --ks "$ANDROID_KEYSTORE" \
            --ks-pass env:ANDROID_KEYSTORE_PASSWORD \
            --ks-key-alias "$ANDROID_KEY_ALIAS" \
            --key-pass env:ANDROID_KEY_PASSWORD \
            --out "$dist/$name" "$aligned"
        rm -f "$aligned" "$dist/$name.idsig"
        "${tools}apksigner" verify --print-certs "$dist/$name" | grep -E '^Signer .* (DN|SHA-256)' || true
    else
        name=jami-android-$ver-$flavor-unsigned.apk
        cp "$apk" "$dist/$name"
    fi
    (cd "$dist" && sha256sum "$name" >"$name.sha256")
    found=$((found + 1))
done
[ "$found" -gt 0 ] || { echo "no release APK under jami-android/app/build/outputs/apk" >&2; exit 1; }
[ -n "$sign" ] && echo "signed $found APKs with $ANDROID_KEY_ALIAS from $ANDROID_KEYSTORE" || echo "$found unsigned APKs (no ANDROID_KEYSTORE)"
ls -l "$dist"
