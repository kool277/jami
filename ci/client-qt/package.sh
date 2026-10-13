#!/bin/sh
# Package the client that ci-build.sh installed in install/ as
# build/dist/jami-client-qt-<VERSION>-linux-<arch>.tar.gz and its .sha256
# (bin/jami and share/, the layout of a /usr/local install). The binary
# finds Qt in /opt/qt/6.12.0/gcc_64/lib (its RUNPATH), where the build
# image installs it with aqtinstall; the other runtime libraries are the
# Ubuntu 24.04 packages listed in ci/client-qt/Dockerfile. Run inside the
# client-qt build container after ci-build.sh:
#   VERSION=v202609211303-kool277.1 DOCKER_RUN_ARGS="-e VERSION" ci/client-qt/run.sh sh /ci/package.sh
set -eu

: "${VERSION:?set VERSION, e.g. the release tag}"
# Tags such as beta/2026... contain slashes.
name=jami-client-qt-$(printf %s "$VERSION" | tr / -)-linux-$(uname -m)
dist=build/dist

[ -x install/bin/jami ] || { echo "install/bin/jami missing: run ci-build.sh first" >&2; exit 1; }
rm -rf "$dist"
mkdir -p "$dist/$name/bin"
cp -a install/bin/jami "$dist/$name/bin/"
cp -a install/share "$dist/$name/"
tar --owner=0 --group=0 -C "$dist" -czf "$dist/$name.tar.gz" "$name"
rm -rf "${dist:?}/$name"
(cd "$dist" && sha256sum "$name.tar.gz" >"$name.tar.gz.sha256")
echo "$dist/$name.tar.gz"
