#!/bin/sh
# Run a command in the jami-daemon build container with the daemon source
# at /src/jami-daemon (the working directory) and the contrib tarball
# cache at /var/cache/jami. The daemon must sit at the same path as in
# ci/client-qt: contrib's installed CMake and pkg-config files record
# absolute paths, and both containers share its contrib.
#   ci/daemon/run.sh                      # configure + build
#   ci/daemon/run.sh ctest --test-dir build -R '^base64$'
# DAEMON_DIR is the daemon source (default: jami-daemon/ of this
# workspace). DOCKER_RUN_ARGS adds options to docker run (word-split).
set -eu

here=$(cd "$(dirname "$0")" && pwd)
daemon=$(cd "${DAEMON_DIR:-$here/../../jami-daemon}" && pwd)
cache=${TARBALLS_HOST:-/var/cache/jami}
image=${DAEMON_BUILD_IMAGE:-jami-daemon-build}

[ -d "$cache" ] || { echo "missing $cache (sudo mkdir -p $cache && sudo chown \$USER $cache)" >&2; exit 1; }

docker build -q -t "$image" "$here" >/dev/null

if [ $# -eq 0 ]; then
    set -- sh -c 'mkdir -p build && cd build &&
        cmake .. -GNinja -DJAMI_DBUS=On -DBUILD_TESTING=ON &&
        ninja -j"${JOBS:-16}"'
fi

tty=
[ -t 0 ] && tty=-it
# The host's user database, so that the caller's uid has a name in the
# container: dbus-daemon refuses to start for an unknown uid, which the
# jenkins user's is (the image only has ubuntu, uid 1000).
exec docker run --rm $tty \
    --user "$(id -u):$(id -g)" \
    -v /etc/passwd:/etc/passwd:ro -v /etc/group:/etc/group:ro \
    -e HOME=/tmp -e TARBALLS=/var/cache/jami -e CARGO_HOME=/var/cache/jami/cargo \
    -e JOBS="${JOBS:-16}" \
    -v "$daemon:/src/jami-daemon" -v "$cache:/var/cache/jami" -v "$here:/ci:ro" \
    ${DOCKER_RUN_ARGS:-} \
    -w /src/jami-daemon "$image" "$@"
