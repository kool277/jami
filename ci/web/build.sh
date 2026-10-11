#!/bin/sh
# Lint, build, smoke-test and package jami-web (WEB_DIR, default jami-web/
# of this workspace):
# - Dockerfile target test (npm run lint);
# - production image (target production), tagged jami-web:<VERSION>;
# - smoke test: the production image starts and answers 200 on /;
# - out/dist/jami-web-<VERSION>.tar.gz and its .sha256: the production tree
#   (/web-client without node_modules) as jami-web-production/, with
#   install.sh and jami-web.service, the layout install.sh expects.
# The server uses the prebuilt @savoirfairelinux/jami-core npm package, not
# a daemon built here. VERSION defaults to git describe. Needs docker and
# curl on the host.
#   ci/web/build.sh
set -eu

here=$(cd "$(dirname "$0")" && pwd)
web=$(cd "${WEB_DIR:-$here/../../jami-web}" && pwd)
cd "$web"
VERSION=${VERSION:-$(git describe --tags --always)}
# Tags such as beta/2026... contain slashes.
ver=$(printf %s "$VERSION" | tr / -)
commit=$(git rev-parse HEAD)
step() { printf '\n== %s\n' "$*"; }

step "lint (target test)"
docker build --target test --build-arg GIT_COMMIT_HASH="$commit" -t "jami-web-test:$ver" .
step "production image jami-web:$ver"
docker build --target production --build-arg GIT_COMMIT_HASH="$commit" -t "jami-web:$ver" .

step "smoke test"
cid=$(docker run -d -p 127.0.0.1::8080 "jami-web:$ver")
trap 'docker rm -f "$cid" >/dev/null 2>&1 || true' EXIT
port=$(docker port "$cid" 8080/tcp | head -1 | sed 's/.*://')
i=0
code=000
until [ "$code" = 200 ]; do
    i=$((i + 1))
    if [ "$i" -gt 60 ] || [ "$(docker inspect -f '{{.State.Running}}' "$cid")" != true ]; then
        echo "FAIL  / did not answer 200 within 120 s (last: $code)" >&2
        docker logs --tail 40 "$cid" >&2
        exit 1
    fi
    sleep 2
    code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$port/" || true)
done
echo "OK    / answered 200 after about $((i * 2)) s"
docker rm -f "$cid" >/dev/null
trap - EXIT

step "package"
dist=out/dist
pkg=$dist/stage/jami-web-production
rm -rf "$dist"
mkdir -p "$pkg"
cid=$(docker create "jami-web:$ver")
docker cp "$cid:/web-client/." "$pkg"
docker rm -v "$cid" >/dev/null
find "$pkg" -name node_modules -type d -prune -exec rm -rf {} +
cp install.sh jami-web.service "$pkg/"
tar --owner=0 --group=0 -C "$dist/stage" -czf "$dist/jami-web-$ver.tar.gz" jami-web-production
rm -rf "$dist/stage"
(cd "$dist" && sha256sum "jami-web-$ver.tar.gz" >"jami-web-$ver.tar.gz.sha256")
echo "$web/$dist/jami-web-$ver.tar.gz (image jami-web:$ver)"
