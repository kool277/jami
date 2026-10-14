#!/bin/sh
# Lint, test, build, smoke-test and package jami-plugins-store
# (PLUGINS_STORE_DIR, default jami-plugins-store/ of this workspace) with the
# targets of its own Dockerfile, built from the committed tree (git archive),
# so that nothing else in the checkout reaches an image:
# - target lint (npm run lint) and target test (npm test: jest), each run in
#   a container;
# - production image (target server), tagged jami-plugins-store:<VERSION>;
# - smoke test: the production image starts and lists the plugins for an
#   architecture on GET /?arch= (200 and a JSON list; none are installed);
# - out/dist/jami-plugins-store-<VERSION>.tar.gz and its .sha256: the
#   server's sources as jami-plugins-store/, to run it without Docker
#   (npm ci && npm start, Node.js 18).
# VERSION defaults to git describe. Needs docker and curl on the host.
#   ci/plugins-store/build.sh
set -eu

here=$(cd "$(dirname "$0")" && pwd)
src=$(cd "${PLUGINS_STORE_DIR:-$here/../../jami-plugins-store}" && pwd)
cd "$src"
VERSION=${VERSION:-$(git describe --tags --always)}
ver=$(printf %s "$VERSION" | tr / -)
step() { printf '\n== %s\n' "$*"; }
build() { # <Dockerfile target> <image>
    git archive --format=tar HEAD | docker build --target "$1" -t "$2" -
}

step "lint (target lint)"
build lint "jami-plugins-store-lint:$ver"
docker run --rm "jami-plugins-store-lint:$ver"
step "tests (target test)"
build test "jami-plugins-store-test:$ver"
docker run --rm "jami-plugins-store-test:$ver"
step "production image jami-plugins-store:$ver"
build server "jami-plugins-store:$ver"

step "smoke test"
body=$(mktemp)
cid=$(docker run -d -p 127.0.0.1::3000 "jami-plugins-store:$ver")
trap 'docker rm -f "$cid" >/dev/null 2>&1 || true; rm -f "$body"' EXIT
port=$(docker port "$cid" 3000/tcp | head -1 | sed 's/.*://')
url="http://127.0.0.1:$port/?arch=x86_64-linux-gnu"
i=0
code=000
until [ "$code" = 200 ]; do
    i=$((i + 1))
    if [ "$i" -gt 60 ] || [ "$(docker inspect -f '{{.State.Running}}' "$cid")" != true ]; then
        echo "FAIL  GET /?arch= did not answer 200 within 120 s (last: $code)" >&2
        docker logs --tail 40 "$cid" >&2
        exit 1
    fi
    sleep 2
    code=$(curl -s -o "$body" -w '%{http_code}' "$url" || true)
done
if ! grep -q '^\[' "$body"; then
    echo "FAIL  GET /?arch= did not return a JSON list: $(head -c 200 "$body")" >&2
    exit 1
fi
echo "OK    GET /?arch= listed the plugins (200, $(head -c 80 "$body")) after about $((i * 2)) s"
docker rm -f "$cid" >/dev/null
rm -f "$body"
trap - EXIT

step "package"
dist=out/dist
rm -rf "$dist"
mkdir -p "$dist"
git archive --format=tar.gz --prefix=jami-plugins-store/ -o "$dist/jami-plugins-store-$ver.tar.gz" HEAD
(cd "$dist" && sha256sum "jami-plugins-store-$ver.tar.gz" >"jami-plugins-store-$ver.tar.gz.sha256")
echo "$src/$dist/jami-plugins-store-$ver.tar.gz (image jami-plugins-store:$ver)"
