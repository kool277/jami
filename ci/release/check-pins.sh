#!/bin/sh
# Check that every submodule pin of the workspace exists on its remote, so
# that a fresh clone with `git submodule update --init` works. kool277
# repositories are checked through the GitHub API (gh; set GH_TOKEN to
# avoid the anonymous rate limit); for the others the pin must be the head
# of a branch or a tag.
#   ci/release/check-pins.sh
set -eu

ws=$(cd "$(dirname "$0")/../.." && pwd)
cd "$ws"
status=0
paths=$(git config -f .gitmodules --get-regexp '\.path$' | awk '{print $2}')

for path in $paths; do
    url=$(git config -f .gitmodules "submodule.$path.url")
    sha=$(git ls-tree HEAD "$path" | awk '{print $3}')
    # A remote that cannot be reached is an error, not a missing pin.
    case "$url" in
    https://github.com/kool277/*)
        repo=${url#https://github.com/}
        repo=${repo%.git}
        if out=$(gh api "repos/$repo/commits/$sha" -q .sha 2>&1); then
            found=$out
        else
            case "$out" in
            *"HTTP 404"* | *"HTTP 422"*) found= ;;
            *) echo "ERROR $path: GitHub API: $(printf %s "$out" | head -1)" >&2; status=1; continue ;;
            esac
        fi
        ;;
    *)
        if ! refs=$(git ls-remote "$url" 2>&1); then
            echo "ERROR $path: $(printf %s "$refs" | head -1)" >&2
            status=1
            continue
        fi
        found=$(printf '%s\n' "$refs" | cut -f1 | grep -x "$sha" | head -1 || true)
        ;;
    esac
    if [ "$found" = "$sha" ]; then
        echo "OK    $path $(printf %s "$sha" | cut -c1-10) on $url"
    else
        echo "FAIL  $path $(printf %s "$sha" | cut -c1-10) not found on $url" >&2
        status=1
    fi
done
exit $status
