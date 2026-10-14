#!/bin/sh
# Platform release TAG (vMAJOR.MINOR.PATCH) of the workspace, run by the
# kool277/jami pipeline on v* tags, from a checkout of that tag; needs gh
# with GH_TOKEN:
# 1. tag every component listed in VERSIONS with its version at its pinned
#    commit, so that its own pipeline builds and publishes its release. The
#    tag message has a "Platform: TAG" line: the component pipeline builds
#    with the CI scripts and pins of that platform release;
# 2. create the kool277/jami release TAG with notes that list each
#    component's version, upstream version, commit and release, and the
#    GHCR images.
# A component that did not change since an earlier release keeps its
# version, whose tag exists already: it is left as it is. The script does
# not wait for the component builds: their releases appear when those
# pipelines finish. Re-running is safe: existing tags must already point at
# the pinned commit, and an existing release is left as it is. DRY_RUN=1
# only prints what it would tag and the release notes.
#   GH_TOKEN=... ci/release/platform-release.sh v1.0.0
#   DRY_RUN=1 ci/release/platform-release.sh v1.0.0
set -eu

TAG=${1:?usage: platform-release.sh <tag>}
printf %s "$TAG" | grep -Eqx 'v[0-9]+\.[0-9]+\.[0-9]+' ||
    { echo "$TAG: a platform release is tagged vMAJOR.MINOR.PATCH, e.g. v1.0.0" >&2; exit 1; }
ws=$(cd "$(dirname "$0")/../.." && pwd)
cd "$ws"
notes=$(mktemp)
trap 'rm -f "$notes"' EXIT

pin() { git ls-tree HEAD "$1" | awk '{print $3}'; }
short() { printf %s "$1" | cut -c1-10; }
# <component> <commit> <version> <upstream> per line.
versions=$(grep -v '^#' VERSIONS | awk 'NF')
version_of() { printf '%s\n' "$versions" | awk -v c="$1" '$1 == c {print $3}'; }

# VERSIONS must describe these pins: check them all before tagging any.
printf '%s\n' "$versions" | while read -r repo sha version upstream; do
    p=$(pin "$repo")
    if [ "$p" != "$sha" ]; then
        echo "VERSIONS has $repo at $(short "$sha"), the workspace pins $(short "${p:-none}"): run ci/release/versions.sh" >&2
        exit 1
    fi
done || exit 1

{
    echo "Jami platform $TAG, built from kool277/jami $(short "$(git rev-parse HEAD)")."
    echo
    echo "| Component | Version | Upstream | Commit |"
    echo "|-----------|---------|----------|--------|"
} >"$notes"

printf '%s\n' "$versions" | while read -r repo sha version upstream; do
    # The commit the tag points at, through its tag object if annotated.
    # gh prints the error body on stdout when the tag does not exist, so
    # keep its output only when it succeeds.
    existing=$(gh api "repos/kool277/$repo/commits/$version" -q .sha 2>/dev/null) || existing=
    if [ -z "$existing" ] && [ -n "${DRY_RUN:-}" ]; then
        echo "$repo: would tag $version at $(short "$sha")"
    elif [ -z "$existing" ]; then
        # Annotated, not lightweight: Jenkins dates a lightweight tag by its
        # commit, and the jobs only build tags younger than 7 days.
        obj=$(gh api -X POST "repos/kool277/$repo/git/tags" -f tag="$version" \
            -f message="$(printf '%s %s\n\nPlatform: %s\nUpstream: %s\n' "$repo" "$version" "$TAG" "$upstream")" \
            -f object="$sha" -f type=commit -q .sha)
        gh api -X POST "repos/kool277/$repo/git/refs" -f ref="refs/tags/$version" -f sha="$obj" >/dev/null
        echo "$repo: tagged $version at $(short "$sha")"
    elif [ "$existing" = "$sha" ]; then
        echo "$repo: $version already at $(short "$sha")"
    else
        echo "$repo: $version exists at $(short "$existing"), not at the pinned $(short "$sha")" >&2
        exit 1
    fi
    echo "| $repo | [$version](https://github.com/kool277/$repo/releases/tag/$version) | $upstream | [\`$(short "$sha")\`](https://github.com/kool277/$repo/commit/$sha) |" >>"$notes"
done || exit 1

{
    echo
    images=
    for c in jams:jami-jams jami-web:jami-web jami-plugins-store:jami-plugins-store; do
        v=$(version_of "${c#*:}")
        [ -n "$v" ] && images="$images${images:+, }\`ghcr.io/kool277/${c%%:*}:$v\`"
    done
    [ -n "$images" ] && echo "Images: $images." && echo
    echo "Also pinned, without a release build here:"
    for p in $(git config -f .gitmodules --get-regexp '\.path$' | awk '{print $2}'); do
        [ -n "$(version_of "$p")" ] && continue
        echo "- $p: \`$(short "$(pin "$p")")\` ($(git config -f .gitmodules "submodule.$p.url"))"
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
