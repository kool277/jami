#!/bin/sh
# Package the daemon from build/: jamid, libjami-core.a, the public
# headers, jami.pc, the D-Bus service and interfaces and the ringtones,
# as installed by the daemon's own install rules (prefix /usr/local).
# Writes build/dist/jami-daemon-<VERSION>-linux-<arch>.tar.gz and its
# .sha256. Run inside the daemon build container after the build:
#   VERSION=v17.0.0-kool277.1 DOCKER_RUN_ARGS="-e VERSION" ci/daemon/run.sh sh /ci/package.sh
# Install the result with: sudo tar -C / -xzf <tarball>
set -eu

: "${VERSION:?set VERSION, e.g. the release tag}"
# Tags such as beta/2026... contain slashes.
name=jami-daemon-$(printf %s "$VERSION" | tr / -)-linux-$(uname -m)
dist=build/dist
stage=$dist/stage

rm -rf "$dist"
mkdir -p "$stage"
DESTDIR="$PWD/$stage" cmake --install build >/dev/null
tar --owner=0 --group=0 -C "$stage" -czf "$dist/$name.tar.gz" .
rm -rf "$stage"
(cd "$dist" && sha256sum "$name.tar.gz" >"$name.tar.gz.sha256")
echo "$dist/$name.tar.gz"
