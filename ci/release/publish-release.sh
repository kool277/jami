#!/bin/sh
# Create (or reuse) the GitHub release TAG of kool277/REPO and upload FILES
# to it, replacing assets of the same name, so a rebuilt tag can publish
# again. Run by the component pipelines on v* tags; needs gh with GH_TOKEN.
#   GH_TOKEN=... ci/release/publish-release.sh jami-daemon v2026.10.10 build/dist/*
set -eu

REPO=${1:?usage: publish-release.sh <repo> <tag> <file>...}
TAG=${2:?usage: publish-release.sh <repo> <tag> <file>...}
shift 2
[ $# -gt 0 ] || { echo "no files to upload" >&2; exit 1; }

if gh release view "$TAG" --repo "kool277/$REPO" >/dev/null 2>&1; then
    echo "kool277/$REPO: release $TAG exists, replacing its assets"
else
    gh release create "$TAG" --repo "kool277/$REPO" --verify-tag \
        --title "$REPO $TAG" \
        --notes "Part of [Jami platform $TAG](https://github.com/kool277/jami/releases/tag/$TAG). Every asset has a .sha256 next to it."
fi
gh release upload "$TAG" --repo "kool277/$REPO" --clobber "$@"
