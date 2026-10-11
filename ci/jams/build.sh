#!/bin/sh
# Lint, test, build and package JAMS (JAMS_DIR, default jami-jams/ of this
# workspace) the way upstream's Jenkinsfile does:
# - test image (extras/CI/Dockerfile.test): client lint and TypeScript
#   compile, google-java-format check, mvn verify;
# - production image (Dockerfile, target prod), tagged jams:<VERSION>;
# - out/dist/jams-<VERSION>.zip with the jams folder (/app/jams, which holds
#   jams-launcher.jar) and versions.json, plus its .sha256.
# VERSION defaults to git describe. Needs docker and zip on the host.
#   ci/jams/build.sh
set -eu

here=$(cd "$(dirname "$0")" && pwd)
jams=$(cd "${JAMS_DIR:-$here/../../jami-jams}" && pwd)
cd "$jams"
VERSION=${VERSION:-$(git describe --tags --always)}
# Tags such as beta/2026... contain slashes.
ver=$(printf %s "$VERSION" | tr / -)
step() { printf '\n== %s\n' "$*"; }

step "test image"
docker build -f extras/CI/Dockerfile.test -t "jams-test:$ver" .
step "client lint"
docker run --rm "jams-test:$ver" sh -c "cd jams-react-client && npm run lint:check"
step "client TypeScript compile"
docker run --rm "jams-test:$ver" sh -c "cd jams-react-client && npm run compile"
step "server format check (google-java-format)"
docker run --rm "jams-test:$ver" google-java-format -a --skip-reflowing-long-strings \
    --set-exit-if-changed '--glob=**/*.java'
step "mvn verify"
docker run --rm "jams-test:$ver" mvn -B verify

step "production image jams:$ver"
docker build -f Dockerfile --target prod -t "jams:$ver" .

step "package"
dist=out/dist
rm -rf "$dist"
mkdir -p "$dist/stage"
cid=$(docker create "jams:$ver")
docker cp "$cid:/app/jams/." "$dist/stage/jams"
docker cp "$cid:/app/versions.json" "$dist/stage/"
docker rm -v "$cid" >/dev/null
(cd "$dist/stage" && zip -qr "../jams-$ver.zip" jams versions.json)
rm -rf "$dist/stage"
(cd "$dist" && sha256sum "jams-$ver.zip" >"jams-$ver.zip.sha256")
echo "$jams/$dist/jams-$ver.zip (image jams:$ver)"
