#!/bin/sh
# Run a command in the jami-client-qt build container. The client source
# is mounted at /src/jami-client-qt (the working directory) and the
# daemon source at /src/jami-client-qt/daemon and /src/jami-daemon, the
# path ci/daemon uses, so the client builds against the same daemon tree
# and contrib. /var/cache/jami holds the contrib tarballs and Rust crates.
#   ci/client-qt/run.sh                         # = ci-build.sh
#   ci/client-qt/run.sh sh /ci/ci-test.sh
# CLIENT_DIR and DAEMON_DIR are the sources (default: jami-client-qt/ and
# jami-daemon/ of this workspace, whose client daemon submodule stays
# uninitialized). DOCKER_RUN_ARGS adds options to docker run (word-split);
# BUILD_CPUS, BUILD_MEM, BUILD_MEM_SWAP and BUILD_OOM_ADJ set its limits.
set -eu

here=$(cd "$(dirname "$0")" && pwd)
client=$(cd "${CLIENT_DIR:-$here/../../jami-client-qt}" && pwd)
daemon=$(cd "${DAEMON_DIR:-$here/../../jami-daemon}" && pwd)
cache=${TARBALLS_HOST:-/var/cache/jami}
image=${CLIENT_QT_BUILD_IMAGE:-jami-client-qt-build}

[ -d "$cache" ] || { echo "missing $cache (sudo mkdir -p $cache && sudo chown \$USER $cache)" >&2; exit 1; }

if [ -z "${SKIP_IMAGE_BUILD:-}" ]; then
    docker build -q -t "${DAEMON_BUILD_IMAGE:-jami-daemon-build}" "$here/../daemon" >/dev/null
    docker build -q -t "$image" \
        --build-arg BASE="${DAEMON_BUILD_IMAGE:-jami-daemon-build}" "$here" >/dev/null
fi

[ $# -eq 0 ] && set -- sh /ci/ci-build.sh

# contrib decides what to rebuild by file times, which the shared tarball
# cache defeats: build again the packages whose rules changed.
sh "$here/../daemon/contrib-refresh.sh" "$daemon"

# Resource limits of the build container, so that a build which outgrows
# the host is what gets killed, not JAMS or Jenkins: BUILD_CPUS is a cpuset
# (it also caps what nproc reports, so make, ninja and Gradle start that
# many jobs), BUILD_MEM caps RAM, BUILD_MEM_SWAP caps RAM plus swap, and
# BUILD_OOM_ADJ makes its processes the OOM killer's first choice. The
# server services run with -800 (deploy/docker-compose.yml).
cpus=$(nproc); [ "$cpus" -gt 12 ] && cpus=12
limits="--cpuset-cpus=${BUILD_CPUS:-0-$((cpus - 1))} --memory=${BUILD_MEM:-18g} \
--memory-swap=${BUILD_MEM_SWAP:-28g} --oom-score-adj=${BUILD_OOM_ADJ:-800}"

# Meson downloads the wraps of some contrib packages (abseil-cpp for
# webrtc-audio-processing) at configure time; keep them in the cache, as
# the contrib tarballs, so that a network drop does not fail the build.
# One directory per user: meson writes its files readable by their owner
# only.
meson_cache=meson/$(id -u)
mkdir -p "$cache/$meson_cache"

# --init: an init process as PID 1 passes on the SIGTERM of an aborted
# build. A shell as PID 1 ignores it, and the container went on building
# after Jenkins had aborted jami-client-android master #6.
tty=
[ -t 0 ] && tty=-it
exec docker run --rm --init $tty \
    --user "$(id -u):$(id -g)" \
    --shm-size=1g \
    -e HOME=/tmp/home -e TARBALLS=/var/cache/jami -e CARGO_HOME=/var/cache/jami/cargo \
    -e MESON_PACKAGE_CACHE_DIR="/var/cache/jami/$meson_cache" \
    -e JOBS="${JOBS:-12}" \
    -v "$client:/src/jami-client-qt" -v "$daemon:/src/jami-client-qt/daemon" \
    -v "$daemon:/src/jami-daemon" -v "$cache:/var/cache/jami" -v "$here:/ci:ro" \
    $limits ${DOCKER_RUN_ARGS:-} \
    -w /src/jami-client-qt "$image" "$@"
