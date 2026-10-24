#!/bin/sh
# Make the daemon's contrib build again the packages whose rules changed
# since its build directories last built them. contrib goes by file times:
# it unpacks a package again when the package's tarball is newer than its
# unpacked source (or its SHA512SUMS newer than its .sum stamp). The
# tarballs are shared by every build in /var/cache/jami, so a tarball that
# another tree downloaded earlier looks older than this tree's stale build,
# and packages fetched as git archives (dhtnet, opendht, ...) have no
# SHA512SUMS to catch it: when the daemon moved to dhtnet 01333a9, whose
# tarball was downloaded on 10-10, the Android master workspace kept the
# dhtnet it had built on 10-13, and the daemon failed to compile against it.
#
# So contrib/build.kool277-rules records a hash of every package's
# contrib/src/<pkg>/ as of the last build. For each package whose hash
# changed since, this removes the package's unpacked source and stamps
# from every build directory: contrib then builds it again, and after it
# the packages that depend on it, whose stamps are now older than its own.
# With no record (build directories from before this script), every
# package is built again once.
#
# The other arguments are build trees to remove until contrib has built
# those packages again (contrib/build.kool277-pending lists the ones it has
# not): trees whose CMake configure builds contrib and keeps what
# pkg-config found there, but does not run again by itself, as Gradle's.
# A package that contrib no longer builds stays listed, and the trees go
# at every build: remove its line. Run on the host, before the build.
#   ci/daemon/contrib-refresh.sh <daemon source> [<build tree>...]
set -eu

contrib=$1/contrib
shift
record=$contrib/build.kool277-rules
pending=$contrib/build.kool277-pending
sums=$(for src in "$contrib"/src/*/; do
    printf '%s %s\n' "$(basename "$src")" \
        "$(cd "$src" && find . -type f | LC_ALL=C sort | xargs -r sha256sum | sha256sum | cut -c1-64)"
done | LC_ALL=C sort)

if [ -f "$record" ]; then
    changed=$(printf '%s\n' "$sums" | LC_ALL=C comm -13 "$record" - | cut -d' ' -f1)
else
    changed=$(printf '%s\n' "$sums" | cut -d' ' -f1)
fi

[ -f "$pending" ] || : >"$pending"
for build in "$contrib"/build-*/; do
    [ -d "$build" ] || continue
    again=
    for pkg in $changed; do
        if [ -e "$build.$pkg" ] || [ -e "$build$pkg" ]; then
            rm -rf "$build$pkg" "$build.$pkg" "$build.sum-$pkg"
            again="$again $pkg"
            echo "$(basename "$build") $pkg" >>"$pending"
        fi
    done
    [ -z "$again" ] || echo "contrib/$(basename "$build"): rules changed, building again:$again" >&2
done
printf '%s\n' "$sums" >"$record"

waiting=$(while read -r build pkg; do
    if [ -d "$contrib/src/$pkg" ] && [ ! -e "$contrib/$build/.$pkg" ]; then
        echo "$build $pkg"
    fi
done <"$pending" | LC_ALL=C sort -u)
if [ -z "$waiting" ]; then
    : >"$pending"
    exit 0
fi
printf '%s\n' "$waiting" >"$pending"
for tree in "$@"; do
    if [ -e "$tree" ]; then
        echo "contrib has yet to build again$(printf '%s\n' "$waiting" | cut -d' ' -f2 | LC_ALL=C sort -u | tr '\n' ' ' | sed 's/^/ /; s/ $//'): removing $tree" >&2
        rm -rf "$tree"
    fi
done
