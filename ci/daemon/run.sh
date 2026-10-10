#!/bin/sh
# Run a command in the jami-daemon build container with the source
# tree at /src and the contrib tarball cache at /var/cache/jami.
#   ci/daemon/run.sh                      # configure + build
#   ci/daemon/run.sh ctest --test-dir build -R '^base64$'
set -eu

here=$(cd "$(dirname "$0")" && pwd)
src=$(cd "$here/../../jami-daemon" && pwd)
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
exec docker run --rm $tty \
    --user "$(id -u):$(id -g)" \
    -e HOME=/tmp -e TARBALLS=/var/cache/jami -e CARGO_HOME=/var/cache/jami/cargo \
    -e JOBS="${JOBS:-16}" \
    -v "$src:/src" -v "$cache:/var/cache/jami" -v "$here:/ci:ro" \
    -w /src "$image" "$@"
