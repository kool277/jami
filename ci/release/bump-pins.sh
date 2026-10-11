#!/bin/sh
# Move the kool277 component submodules to the current master of their
# kool277 repository and stage the new pins, as the first step of a
# platform release (RELEASING.md). Fetches every component first and moves
# nothing if a fetch fails. Prints old -> new per component; commit the
# result yourself. Upstream-only submodules (jami-plugins, jami-nameservice)
# are left alone.
#   ci/release/bump-pins.sh
set -eu

ws=$(cd "$(dirname "$0")/../.." && pwd)
cd "$ws"

paths=$(git config -f .gitmodules --get-regexp '\.url$' | while read -r key url; do
    case "$url" in https://github.com/kool277/*) git config -f .gitmodules "${key%.url}.path" ;; esac
done)
short() { printf %s "$1" | cut -c1-10; }

for path in $paths; do
    git -C "$path" fetch -q origin master
    git -C "$path" update-ref refs/kool277/bump FETCH_HEAD
done

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
