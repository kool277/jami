#!/bin/sh
# Run a command in the jami-client-qt build container. The whole workspace
# is mounted at /src (jami-client-qt/daemon is a symlink to ../jami-daemon)
# and /var/cache/jami holds the contrib tarballs and Rust crates.
#   ci/client-qt/run.sh                         # = ci-build.sh
#   ci/client-qt/run.sh sh /ci/ci-test.sh
# DOCKER_RUN_ARGS adds options to docker run (word-split).
set -eu

here=$(cd "$(dirname "$0")" && pwd)
ws=$(cd "$here/../.." && pwd)
cache=${TARBALLS_HOST:-/var/cache/jami}
image=${CLIENT_QT_BUILD_IMAGE:-jami-client-qt-build}

[ -d "$cache" ] || { echo "missing $cache (sudo mkdir -p $cache && sudo chown \$USER $cache)" >&2; exit 1; }

if [ -z "${SKIP_IMAGE_BUILD:-}" ]; then
    docker build -q -t "${DAEMON_BUILD_IMAGE:-jami-daemon-build}" "$ws/ci/daemon" >/dev/null
    docker build -q -t "$image" \
        --build-arg BASE="${DAEMON_BUILD_IMAGE:-jami-daemon-build}" "$here" >/dev/null
fi

[ $# -eq 0 ] && set -- sh /ci/ci-build.sh

tty=
[ -t 0 ] && tty=-it
exec docker run --rm $tty \
    --user "$(id -u):$(id -g)" \
    --shm-size=1g \
    -e HOME=/tmp/home -e TARBALLS=/var/cache/jami -e CARGO_HOME=/var/cache/jami/cargo \
    -e JOBS="${JOBS:-16}" \
    -v "$ws:/src" -v "$cache:/var/cache/jami" -v "$here:/ci:ro" \
    ${DOCKER_RUN_ARGS:-} \
    -w /src/jami-client-qt "$image" "$@"
