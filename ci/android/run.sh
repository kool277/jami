#!/bin/sh
# Run a command in the jami-client-android build container, built from the
# client's own docker/Dockerfile (target build: JDK, Android SDK and NDK,
# Rust, Node). The client source is mounted at /src/jami-client-android
# (the working directory) and the daemon source at
# /src/jami-client-android/daemon, where compile.sh looks for it.
# /var/cache/jami holds the contrib tarballs and Gradle's cache (gradle/),
# shared between builds.
#   ci/android/run.sh                       # = build.sh
#   ci/android/run.sh sh /ci/test.sh
# ANDROID_DIR and DAEMON_DIR are the sources (default: jami-client-android/
# and jami-daemon/ of this workspace, whose client daemon submodule stays
# uninitialized). SKIP_IMAGE_BUILD=1 reuses the image. DOCKER_RUN_ARGS adds
# options to docker run (word-split).
set -eu

here=$(cd "$(dirname "$0")" && pwd)
android=$(cd "${ANDROID_DIR:-$here/../../jami-client-android}" && pwd)
daemon=$(cd "${DAEMON_DIR:-$here/../../jami-daemon}" && pwd)
cache=${TARBALLS_HOST:-/var/cache/jami}
image=${ANDROID_BUILD_IMAGE:-jami-android-build}

[ -d "$cache" ] || { echo "missing $cache (sudo mkdir -p $cache && sudo chown \$USER $cache)" >&2; exit 1; }

# sdkmanager exits 0 when its downloads fail, so with no connection the image
# builds without the SDK platform, build tools and NDK, and Docker caches that
# step: every later build would then fail in Gradle ("NDK not configured").
# The license step before it fails the same way: it then accepts no license,
# and the install step skips every package, even once the connection is back.
sdk_installed() {
    docker run --rm --entrypoint sh "$image" -c 'test -d "$ANDROID_NDK" &&
        test -n "$(ls -A "$ANDROID_SDK_ROOT/platforms")" && test -n "$(ls -A "$ANDROID_SDK_ROOT/build-tools")"' 2>/dev/null
}

# The cached results of the image's sdkmanager steps, the install step first:
# a record can only be pruned once no other record builds on it.
sdk_steps() {
    for step in 'sdkmanager --channel=1' 'sdkmanager --licenses' 'sdkmanager --update'; do
        docker buildx du --verbose 2>/dev/null | awk -v step="$step" 'BEGIN { RS = ""; FS = "\n" }
            index($0, step) {
                for (i = 1; i <= NF; i++) if ($i ~ /^ID:/) { sub(/^ID:[ \t]+/, "", $i); print $i }
            }'
    done
}

if [ -z "${SKIP_IMAGE_BUILD:-}" ]; then
    docker build -q --target build -t "$image" "$android/docker" >/dev/null
    if ! sdk_installed; then
        echo "The $image image has no Android SDK or NDK: sdkmanager could not download them." >&2
        echo "Removing the image and the cached sdkmanager steps, so that the next build downloads them again." >&2
        docker rmi "$image" >/dev/null || true
        for id in $(sdk_steps); do docker buildx prune -f --filter "id=$id" >/dev/null || true; done
        exit 1
    fi
fi

[ $# -eq 0 ] && set -- sh /ci/build.sh

tty=
[ -t 0 ] && tty=-it
# The host's user database, so that the caller's uid has a name in the
# container (Gradle and the NDK tools look the user up).
# sdkDownload=false: the image has no platform-tools (adb), which nothing
# here needs, so the Android Gradle plugin would try to install them in
# every build. It reads the SDK package lists from dl.google.com without a
# read timeout, and a connection that stalls hangs the build for good.
exec docker run --rm $tty \
    --user "$(id -u):$(id -g)" \
    -v /etc/passwd:/etc/passwd:ro -v /etc/group:/etc/group:ro \
    -e HOME=/tmp/home -e TARBALLS=/var/cache/jami \
    -e GRADLE_USER_HOME=/var/cache/jami/gradle \
    -e GRADLE_OPTS=-Dorg.gradle.project.android.builder.sdkDownload=false \
    -v "$android:/src/jami-client-android" -v "$daemon:/src/jami-client-android/daemon" \
    -v "$cache:/var/cache/jami" -v "$here:/ci:ro" \
    ${DOCKER_RUN_ARGS:-} \
    -w /src/jami-client-android "$image" "$@"
