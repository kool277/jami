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
# options to docker run (word-split); BUILD_CPUS, BUILD_MEM, BUILD_MEM_SWAP
# and BUILD_OOM_ADJ set its limits.
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

# Resource limits of the build container, so that a build which outgrows
# the host is what gets killed, not JAMS or Jenkins: BUILD_CPUS is a cpuset
# (it also caps what nproc reports, so make, ninja and Gradle start that
# many jobs), BUILD_MEM caps RAM, BUILD_MEM_SWAP caps RAM plus swap, and
# BUILD_OOM_ADJ makes its processes the OOM killer's first choice. The
# server services run with -800 (deploy/docker-compose.yml).
cpus=$(nproc); [ "$cpus" -gt 12 ] && cpus=12
limits="--cpuset-cpus=${BUILD_CPUS:-0-$((cpus - 1))} --memory=${BUILD_MEM:-18g} \
--memory-swap=${BUILD_MEM_SWAP:-28g} --oom-score-adj=${BUILD_OOM_ADJ:-800}"

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
    $limits ${DOCKER_RUN_ARGS:-} \
    -w /src/jami-client-android "$image" "$@"
