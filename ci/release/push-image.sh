#!/bin/sh
# Push the local image IMAGE to ghcr.io/kool277/NAME as :TAG and :latest.
# The registry login lives in a temporary DOCKER_CONFIG, so the token is
# never stored in the agent's ~/.docker. Needs GH_USER and GH_TOKEN (scope
# write:packages).
#   ci/release/push-image.sh jams:v3.8-kool277.1 jams v3.8-kool277.1
set -eu

IMAGE=${1:?usage: push-image.sh <local image> <name> <tag>}
NAME=${2:?usage: push-image.sh <local image> <name> <tag>}
TAG=${3:?usage: push-image.sh <local image> <name> <tag>}
: "${GH_USER:?set GH_USER}" "${GH_TOKEN:?set GH_TOKEN}"
ref=ghcr.io/kool277/$NAME

DOCKER_CONFIG=$(mktemp -d)
export DOCKER_CONFIG
trap 'rm -rf "$DOCKER_CONFIG"' EXIT
printf %s "$GH_TOKEN" | docker login ghcr.io -u "$GH_USER" --password-stdin >/dev/null

for t in "$TAG" latest; do
    docker tag "$IMAGE" "$ref:$t"
    docker push -q "$ref:$t"
done
echo "$ref:$TAG and :latest"
