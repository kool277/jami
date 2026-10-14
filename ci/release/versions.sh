#!/bin/sh
# Write VERSIONS: the release version of each component that has a release
# pipeline, at the commit the workspace pins (the staged pin, so it can run
# right after ci/release/bump-pins.sh). A version is the component's
# upstream version plus a kool277 release number, v<upstream>-kool277.<n>,
# with the upstream version taken from the pinned sources:
#   jami-daemon          version of meson.build or CMakeLists.txt, the
#                        higher one (upstream bumps meson.build only)
#   jami-client-qt       the newest upstream beta/<timestamp> tag in its
#                        history (it has no version in its sources)
#   jami-client-android  versionCode of jami-android/app/build.gradle.kts
#   jami-client-ios      the highest MARKETING_VERSION of Ring/Ring.xcodeproj
#   jami-jams            <revision> of pom.xml
#   jami-web             version of package.json
# A pin that already has such a tag on kool277/<component> keeps it: the
# component did not change since that release. Otherwise n is one more
# than the highest n of the v<upstream>-kool277.* tags there. RENEW names
# components that get a new number anyway, for instance to release again a
# commit whose release failed for a reason outside it. Fetches the upstream
# beta tags of jami-client-qt and the tags of each kool277 repository
# first, and writes nothing if a fetch fails.
#   ci/release/versions.sh
#   RENEW="jami-jams jami-web" ci/release/versions.sh
set -eu

ws=$(cd "$(dirname "$0")/../.." && pwd)
cd "$ws"
components="jami-daemon jami-client-qt jami-client-android jami-client-ios jami-jams jami-web"
qt_upstream=https://review.jami.net/jami-client-qt
RENEW=${RENEW:-}

# The staged pin of a submodule (gitlink in the index).
pin() { git ls-files -s -- "$1" | awk '$1 == "160000" {print $2}'; }

upstream_version() { # <component> <commit>
    case $1 in
    jami-daemon)
        {
            git -C "$1" show "$2:meson.build" 2>/dev/null |
                sed -n "/^project(/,/^)/s/^ *version: *'\([0-9][0-9.]*\)'.*/\1/p"
            git -C "$1" show "$2:CMakeLists.txt" |
                sed -n '/^project(jami-core/,/)/s/^ *VERSION \([0-9][0-9.]*\).*/\1/p'
        } | sort -V | tail -1
        ;;
    jami-client-qt)
        git -C "$1" describe --tags --abbrev=0 --match 'beta/*' "$2" | sed 's|^beta/||'
        ;;
    jami-client-android)
        git -C "$1" show "$2:jami-android/app/build.gradle.kts" |
            sed -n 's/^ *versionCode = \([0-9][0-9]*\).*/\1/p' | head -1
        ;;
    jami-client-ios)
        git -C "$1" show "$2:Ring/Ring.xcodeproj/project.pbxproj" |
            sed -n 's/^[[:space:]]*MARKETING_VERSION = \([0-9][0-9.]*\);.*/\1/p' | sort -V | tail -1
        ;;
    jami-jams)
        git -C "$1" show "$2:pom.xml" | sed -n 's|.*<revision>\(.*\)</revision>.*|\1|p' | head -1
        ;;
    jami-web)
        git -C "$1" show "$2:package.json" | jq -r .version
        ;;
    esac
}

# Fetch everything first, so that a failure leaves VERSIONS as it was.
git -C jami-client-qt fetch -q --no-tags "$qt_upstream" '+refs/tags/beta/*:refs/tags/beta/*'
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
for c in $components; do
    # "<name> <commit>" for each tag, through the tag object if annotated.
    git ls-remote --tags "$(git config -f .gitmodules "submodule.$c.url")" >"$tmp/$c.raw"
    awk '{ r = $2; sub("^refs/tags/", "", r)
           if (r ~ /\^\{\}$/) { sub(/\^\{\}$/, "", r); peeled[r] = $1 } else plain[r] = $1 }
         END { for (r in plain) print r, (r in peeled ? peeled[r] : plain[r]) }' "$tmp/$c.raw" >"$tmp/$c.tags"
done

{
    echo "# Release version of each component at its pinned commit, written by"
    echo "# ci/release/versions.sh: v<upstream version>-kool277.<n>. The platform"
    echo "# release tags each component with it (see RELEASING.md)."
    printf '# %-19s %-40s %-25s %s\n' component commit version upstream
} >"$tmp/VERSIONS"

for c in $components; do
    sha=$(pin "$c")
    [ -n "$sha" ] || { echo "$c: not a submodule here" >&2; exit 1; }
    up=$(upstream_version "$c" "$sha")
    [ -n "$up" ] || { echo "$c: no upstream version found at $sha" >&2; exit 1; }
    case " $RENEW " in *" $c "*) renew=1 ;; *) renew= ;; esac
    # An existing version tag at the pin, the highest if several.
    version=
    [ -n "$renew" ] || version=$(awk -v sha="$sha" '$2 == sha && $1 ~ /^v.+-kool277\.[0-9]+$/ {print $1}' "$tmp/$c.tags" |
        sort -V | tail -1)
    if [ -n "$version" ]; then
        note="unchanged since its release"
    else
        n=$(awk -v p="v$up-kool277." 'index($1, p) == 1 && substr($1, length(p) + 1) ~ /^[0-9]+$/ {
                n = substr($1, length(p) + 1) + 0; if (n > max) max = n }
            END { print max + 1 }' "$tmp/$c.tags")
        version=v$up-kool277.$n
        note=new
    fi
    case $c in jami-client-qt) upstream=beta/$up ;; *) upstream=$up ;; esac
    printf '%-21s %-40s %-25s %s\n' "$c" "$sha" "$version" "$upstream" >>"$tmp/VERSIONS"
    echo "$c: $version ($note; upstream $upstream)"
done

mv "$tmp/VERSIONS" VERSIONS
