#!/bin/sh
# Move the kool277 component submodules to the head of their branch on
# their kool277 repository (the branch that .gitmodules names, else master)
# and stage the new pins, as the first step of a
# platform release (RELEASING.md). Fetches every component first and moves
# nothing if a fetch fails. Then writes and stages VERSIONS with
# ci/release/versions.sh (RENEW goes to it). Prints old -> new per
# component and the versions; commit the result yourself. Upstream-only
# submodules (jami-plugins, jami-nameservice) are left alone.
#   ci/release/bump-pins.sh
set -eu

ws=$(cd "$(dirname "$0")/../.." && pwd)
cd "$ws"

# "<path> <branch>" per kool277 submodule.
subs=$(git config -f .gitmodules --get-regexp '\.url$' | while read -r key url; do
    case "$url" in
    https://github.com/kool277/*)
        name=${key%.url}
        echo "$(git config -f .gitmodules "$name.path") $(git config -f .gitmodules "$name.branch" || echo master)"
        ;;
    esac
done)
paths=$(printf '%s\n' "$subs" | awk '{print $1}')
short() { printf %s "$1" | cut -c1-10; }

printf '%s\n' "$subs" | while read -r path branch; do
    git -C "$path" fetch -q origin "$branch"
    git -C "$path" update-ref refs/kool277/bump FETCH_HEAD
done || exit 1

for path in $paths; do
    old=$(git ls-tree HEAD "$path" | awk '{print $3}')
    new=$(git -C "$path" rev-parse refs/kool277/bump)
    git -C "$path" update-ref -d refs/kool277/bump
    if [ "$old" = "$new" ]; then
        echo "$path: unchanged ($(short "$old"))"
    elif [ -n "$(git -C "$path" status --porcelain)" ]; then
        echo "$path: has local changes, not moved" >&2
    else
        git -C "$path" checkout -q "$new"
        git add "$path"
        echo "$path: $(short "$old") -> $(short "$new")"
    fi
done

"$ws/ci/release/versions.sh"
git add VERSIONS
