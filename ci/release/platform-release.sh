#!/bin/sh
# Platform release of the workspace at tag TAG (run by the kool277/jami
# pipeline on v* tags, from a checkout of that tag; needs gh with GH_TOKEN):
# 1. tag every component that has a release pipeline (jami-daemon,
#    jami-client-qt, jami-jams, jami-web) with TAG at its pinned commit, so
#    that its own pipeline builds and publishes its release;
# 2. create the kool277/jami release TAG with notes that list each
#    component's commit, its release and the GHCR images.
# It does not wait for the component builds: their releases appear when
# those pipelines finish. Re-running is safe: existing tags must already
# point at the pinned commit, and an existing release is left as it is.
# DRY_RUN=1 only prints what it would tag and the release notes.
#   GH_TOKEN=... ci/release/platform-release.sh v2026.10.10
#   DRY_RUN=1 ci/release/platform-release.sh v2026.10.10
set -eu

TAG=${1:?usage: platform-release.sh <tag>}
ws=$(cd "$(dirname "$0")/../.." && pwd)
cd "$ws"
released="jami-daemon jami-client-qt jami-client-android jami-jams jami-web"
notes=$(mktemp)
trap 'rm -f "$notes"' EXIT

pin() { git ls-tree HEAD "$1" | awk '{print $3}'; }
short() { printf %s "$1" | cut -c1-10; }

{
    echo "Jami platform $TAG, built from kool277/jami $(short "$(git rev-parse HEAD)")."
    echo
    echo "| Component | Commit | Release |"
    echo "|-----------|--------|---------|"
} >"$notes"

for repo in $released; do
    sha=$(pin "$repo")
    [ -n "$sha" ] || { echo "$repo: no submodule pin" >&2; exit 1; }
    # The commit the tag points at, through its tag object if annotated.
    existing=$(gh api "repos/kool277/$repo/commits/$TAG" -q .sha 2>/dev/null || true)
    if [ -z "$existing" ] && [ -n "${DRY_RUN:-}" ]; then
        echo "$repo: would tag $TAG at $(short "$sha")"
    elif [ -z "$existing" ]; then
        # Annotated, not lightweight: Jenkins dates a lightweight tag by its
        # commit, and the jobs only build tags younger than 7 days.
        obj=$(gh api -X POST "repos/kool277/$repo/git/tags" -f tag="$TAG" \
            -f message="Jami platform $TAG" -f object="$sha" -f type=commit -q .sha)
        gh api -X POST "repos/kool277/$repo/git/refs" -f ref="refs/tags/$TAG" -f sha="$obj" >/dev/null
        echo "$repo: tagged $TAG at $(short "$sha")"
    elif [ "$existing" = "$sha" ]; then
        echo "$repo: $TAG already at $(short "$sha")"
    else
        echo "$repo: $TAG exists at $(short "$existing"), not at the pinned $(short "$sha")" >&2
        exit 1
    fi
    echo "| $repo | [\`$(short "$sha")\`](https://github.com/kool277/$repo/commit/$sha) | [$TAG](https://github.com/kool277/$repo/releases/tag/$TAG) |" >>"$notes"
done

{
    echo
    echo "Images: \`ghcr.io/kool277/jams:$TAG\`, \`ghcr.io/kool277/jami-web:$TAG\`."
    echo
    echo "Also pinned, without a release build here:"
    for p in jami-plugins jami-nameservice dhtnet jami-client-ios; do
        url=$(git config -f .gitmodules "submodule.$p.url" || true)
        [ -n "$url" ] && echo "- $p: \`$(short "$(pin "$p")")\` ($url)"
    done
    echo
    echo "Component releases are built by their own pipelines and appear shortly after this one."
} >>"$notes"

if [ -n "${DRY_RUN:-}" ]; then
    echo "--- release notes for kool277/jami $TAG:"
    cat "$notes"
elif gh release view "$TAG" --repo kool277/jami >/dev/null 2>&1; then
    echo "kool277/jami: release $TAG already exists, left as it is"
else
    gh release create "$TAG" --repo kool277/jami --verify-tag \
        --title "Jami platform $TAG" --notes-file "$notes"
fi
