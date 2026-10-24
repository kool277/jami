#!/bin/sh
# Run a command in the jami-daemon build container with the daemon source
# at /src/jami-daemon (the working directory) and the contrib tarball
# cache at /var/cache/jami. The daemon must sit at the same path as in
# ci/client-qt: contrib's installed CMake and pkg-config files record
# absolute paths, and both containers share its contrib.
#   ci/daemon/run.sh                      # configure + build
#   ci/daemon/run.sh ctest --test-dir build -R '^base64$'
# DAEMON_DIR is the daemon source (default: jami-daemon/ of this
# workspace). DOCKER_RUN_ARGS adds options to docker run (word-split);
# BUILD_CPUS, BUILD_MEM, BUILD_MEM_SWAP and BUILD_OOM_ADJ set its limits.
set -eu

here=$(cd "$(dirname "$0")" && pwd)
daemon=$(cd "${DAEMON_DIR:-$here/../../jami-daemon}" && pwd)
cache=${TARBALLS_HOST:-/var/cache/jami}
image=${DAEMON_BUILD_IMAGE:-jami-daemon-build}

[ -d "$cache" ] || { echo "missing $cache (sudo mkdir -p $cache && sudo chown \$USER $cache)" >&2; exit 1; }

docker build -q -t "$image" "$here" >/dev/null

# A configure that fails (contrib stopped by a network drop, say) leaves
# the pkg-config results of a half-built contrib in CMakeCache.txt, and
# the next configure keeps them: it then links without some of their
# libraries. So the cache goes with the failed configure. And each
# configure asks pkg-config again (-U): the cache would keep what it found
# in an older contrib, include directories that a new version moves.
if [ $# -eq 0 ]; then
    set -- sh -c 'mkdir -p build && cd build &&
        { cmake .. -GNinja -DJAMI_DBUS=On -DBUILD_TESTING=ON -U "__pkg_config_checked_*" ||
          { echo "configure failed: removing build/CMakeCache.txt" >&2; rm -f CMakeCache.txt; exit 1; }; } &&
        ninja -j"${JOBS:-12}"'
fi

# contrib decides what to rebuild by file times, which the shared tarball
# cache defeats: build again the packages whose rules changed.
sh "$here/contrib-refresh.sh" "$daemon"

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

tty=
[ -t 0 ] && tty=-it
# The host's user database, so that the caller's uid has a name in the
# container: dbus-daemon refuses to start for an unknown uid, which the
# jenkins user's is (the image only has ubuntu, uid 1000).
exec docker run --rm $tty \
    --user "$(id -u):$(id -g)" \
    -v /etc/passwd:/etc/passwd:ro -v /etc/group:/etc/group:ro \
    -e HOME=/tmp -e TARBALLS=/var/cache/jami -e CARGO_HOME=/var/cache/jami/cargo \
    -e MESON_PACKAGE_CACHE_DIR="/var/cache/jami/$meson_cache" \
    -e JOBS="${JOBS:-12}" \
    -v "$daemon:/src/jami-daemon" -v "$cache:/var/cache/jami" -v "$here:/ci:ro" \
    $limits ${DOCKER_RUN_ARGS:-} \
    -w /src/jami-daemon "$image" "$@"
