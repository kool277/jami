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

if [ -z "${SKIP_IMAGE_BUILD:-}" ]; then
    docker build -q --target build -t "$image" "$android/docker" >/dev/null
fi

[ $# -eq 0 ] && set -- sh /ci/build.sh

tty=
[ -t 0 ] && tty=-it
# The host's user database, so that the caller's uid has a name in the
# container (Gradle and the NDK tools look the user up).
exec docker run --rm $tty \
    --user "$(id -u):$(id -g)" \
    -v /etc/passwd:/etc/passwd:ro -v /etc/group:/etc/group:ro \
    -e HOME=/tmp/home -e TARBALLS=/var/cache/jami \
    -e GRADLE_USER_HOME=/var/cache/jami/gradle \
    -v "$android:/src/jami-client-android" -v "$daemon:/src/jami-client-android/daemon" \
    -v "$cache:/var/cache/jami" -v "$here:/ci:ro" \
    ${DOCKER_RUN_ARGS:-} \
    -w /src/jami-client-android "$image" "$@"
