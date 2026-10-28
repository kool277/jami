#!/bin/sh
# Put the apps of a platform release in deploy/downloads/ for the users:
# Caddy serves the folder at https://JAMS_HOST:WEB_HTTPS_PORT/downloads/
# (caddy/Caddyfile) and, with PUBLIC_HOST, at
# https://PUBLIC_HOST:WEB_HTTPS_PORT/downloads/ (caddy/sites/public.caddy),
# with a page that says how to install each app and reach this server.
#   scripts/fetch-apps.sh [platform tag]    (default: the newest v* tag)
# The files come from the components' GitHub releases (VERSIONS at the
# tag) and must match their .sha256 files. Where Qt is installed in
# /opt/qt (docs/CLIENT-SETUP.md), the Qt runtime that the Linux desktop
# app needs is packed too: other computers don't have it.
set -eu
cd "$(dirname "$0")/.."

. ./.env
tag=${1:-$(git describe --tags --abbrev=0 --match 'v*')}
versions=$(git show "$tag:VERSIONS")
version() { printf '%s\n' "$versions" | awk -v c="$1" '$1 == c { print $3 }'; }
android=$(version jami-client-android)
ios=$(version jami-client-ios)
desktop=$(version jami-client-qt)
# ci/client-qt/Dockerfile: the desktop app finds Qt in this directory.
qt_version=6.12.0
qt=/opt/qt/$qt_version/gcc_64

out=downloads
mkdir -p "$out/$tag"

# get <url> <file>: the site's internet connection drops for minutes, and
# a stalled transfer (under 1 kB/s for a minute) starts again.
get() {
    curl -fsSL --retry 20 --retry-delay 30 --retry-all-errors \
        --speed-limit 1000 --speed-time 60 -o "$2" "$1"
}

# fetch <repo> <release> <asset>: the asset and its .sha256 in $out/$tag,
# unless a copy that matches is already there.
fetch() {
    dir=$out/$tag
    if [ -f "$dir/$3" ] && (cd "$dir" && sha256sum --quiet --check "$3.sha256") >/dev/null 2>&1; then
        echo "have  $3"
        return
    fi
    echo "fetch $3"
    url=https://github.com/kool277/$1/releases/download/$2/$3
    get "$url.sha256" "$dir/$3.sha256"
    get "$url" "$dir/$3.part"
    want=$(cut -d ' ' -f 1 "$dir/$3.sha256")
    have=$(sha256sum "$dir/$3.part" | cut -d ' ' -f 1)
    if [ "$want" != "$have" ]; then
        rm -f "$dir/$3.part"
        echo "$3 does not match its SHA-256" >&2
        exit 1
    fi
    mv "$dir/$3.part" "$dir/$3"
}

apk() { echo "jami-android-$android-$1.apk"; }
ipa=jami-ios-$ios-unsigned.ipa
tarball=jami-client-qt-$desktop-linux-x86_64.tar.gz
fetch jami-client-android "$android" "$(apk noPush)"
fetch jami-client-android "$android" "$(apk withUnifiedPush)"
fetch jami-client-android "$android" "$(apk withFirebase)"
fetch jami-client-ios "$ios" "$ipa"
fetch jami-client-qt "$desktop" "$tarball"

qt_tar=qt-$qt_version-gcc_64-runtime.tar.xz
if [ ! -f "$out/$qt_tar" ] && [ -d "$qt/lib" ]; then
    echo "pack  $qt_tar"
    part=$(pwd)/$out/$qt_tar.part
    q=${qt#/}
    (cd / && XZ_OPT=-T0 tar --owner=0 --group=0 -cJf "$part" \
        "$q"/lib/*.so* "$q/plugins" "$q/qml" "$q/libexec" "$q/resources" "$q/translations")
    mv "$out/$qt_tar.part" "$out/$qt_tar"
    (cd "$out" && sha256sum "$qt_tar" >"$qt_tar.sha256")
fi

root_ca=
if [ "${JAMS_TLS:-internal}" = internal ]; then
    cp certs/jams-root.crt "$out/jams-root.crt"
    root_ca=$(openssl x509 -in certs/jams-root.crt -noout -fingerprint -sha256 | cut -d = -f 2)
fi
# Android shows no signer before the install: the fingerprint lets users
# check the file, and every later version must have the same signer.
signer=$(keytool -printcert -jarfile "$out/$tag/$(apk noPush)" 2>/dev/null |
    sed -n 's/^[[:space:]]*SHA256: //p' | head -n 1)

# entry <file under downloads/> [note]: a download with its size and SHA-256.
entry() {
    size=$(stat -c %s "$out/$1" | numfmt --to=si --suffix=B)
    sum=$(cut -d ' ' -f 1 "$out/$1.sha256")
    note=
    [ -z "${2:-}" ] || note=" <span class=\"note\">$2</span>"
    cat <<EOF
<li class="file"><a href="$1" download>${1##*/}</a>$note<span class="meta">$size</span>
<code>SHA-256 $sum</code></li>
EOF
}

web=https://$JAMS_HOST:${WEB_HTTPS_PORT:-8443}
jams=https://$JAMS_HOST
[ "${JAMS_HTTPS_PORT:-443}" = 443 ] || jams=$jams:$JAMS_HTTPS_PORT
# The phone apps trust only the certificate authorities they ship with.
phone_cas=../jami-client-android/jami-android/app/src/main/assets/cacert.pem
# With a public certificate, every app uses the public addresses, at home
# (the router's DNS answers this host's address) and outside.
public=
if [ -n "${PUBLIC_HOST:-}" ]; then
    port=${JAMS_PUBLIC_PORT:-9443}
    phones="<code>https://$PUBLIC_HOST:$port</code>"
    if [ -f "$phone_cas" ] && curl -s -m 10 -o /dev/null --cacert "$phone_cas" \
        --resolve "$PUBLIC_HOST:$port:$JAMS_HOST" "https://$PUBLIC_HOST:$port/"; then
        public=https://$PUBLIC_HOST:$port
        public_web=https://$PUBLIC_HOST:${WEB_HTTPS_PORT:-8443}
    else
        phones="$phones, once it has a certificate from a public authority such as
Let's Encrypt: the phone apps trust no other. Until then, create a regular Jami
account in the app."
    fi
else
    phones="none: the phone apps trust only certificates from public authorities such
as Let's Encrypt (docs/SERVER-SETUP.md). Create a regular Jami account in the app."
fi

{
    cat <<EOF
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Jami apps</title>
<style>
:root { --bg: #f7f7f0; --fg: #1c1c14; --muted: #5d5d4e; --line: #dcdccd; --card: #ffffff;
  --accent: #666600; --on-accent: #ffffff; color-scheme: light dark; }
@media (prefers-color-scheme: dark) {
  :root { --bg: #13130e; --fg: #ebebdc; --muted: #a5a58e; --line: #34342a; --card: #1c1c15;
    --accent: #caca73; --on-accent: #13130e; }
}
body { margin: 0; background: var(--bg); color: var(--fg);
  font: 16px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
main { max-width: 46rem; margin: 0 auto; padding: 1.5rem 1rem 3rem; }
h1 { font-size: 1.6rem; margin: 0; }
h2 { font-size: 1.15rem; margin: 2.25rem 0 .5rem; padding-bottom: .3rem; border-bottom: 2px solid var(--accent); }
a { color: var(--accent); }
.lead, .meta, footer { color: var(--muted); }
ul.files { list-style: none; padding: 0; margin: .75rem 0; }
.file { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: .7rem .9rem; margin: .5rem 0; }
.file a { font-weight: 600; overflow-wrap: anywhere; }
.meta { margin-left: .5rem; font-size: .875rem; white-space: nowrap; }
.note { display: inline-block; margin-left: .4rem; padding: 0 .5rem; border-radius: 999px;
  background: var(--accent); color: var(--on-accent); font-size: .75rem; font-weight: 600; }
code { font: .8rem/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; overflow-wrap: anywhere; }
.file code { display: block; margin-top: .25rem; color: var(--muted); }
pre { background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: .75rem; overflow-x: auto; }
dt { font-weight: 600; margin-top: .75rem; }
dd { margin: .1rem 0 0; }
footer { margin-top: 3rem; font-size: .875rem; }
</style>
</head>
<body>
<main>
<h1>Jami apps</h1>
<p class="lead">Release $tag for the users of this server.</p>

<h2>Connect to this server</h2>
<dl>
EOF
    if [ -n "$public" ]; then
        cat <<EOF
<dt>Web client, in any browser</dt>
<dd><a href="$public_web/">$public_web</a></dd>
<dt>Desktop and phone apps: management server</dt>
<dd><code>$public</code>, typed in full, with <code>https://</code> and the port.
The same addresses work at home and outside.</dd>
EOF
    else
        cat <<EOF
<dt>Web client, in any browser</dt>
<dd><a href="$web/">$web</a></dd>
<dt>Desktop app: management server</dt>
<dd><code>$jams</code></dd>
<dt>Phone apps: management server</dt>
<dd>$phones</dd>
EOF
    fi
    if [ -n "$root_ca" ]; then
        if [ -n "$public" ]; then
            cat <<EOF
<dt>Older addresses, on the LAN only</dt>
<dd>Web client <code>$web</code>, desktop app <code>$jams</code>: these need the server
certificate below.</dd>
EOF
        fi
        cat <<EOF
<dt>Server certificate</dt>
<dd><a href="jams-root.crt">jams-root.crt</a>: browsers and the desktop app trust
this server's LAN address once it is installed; until then browsers show a warning.
<ul>
<li>Android: Settings → Security → Encryption &amp; credentials → Install a
certificate → CA certificate.</li>
<li>iPhone: open the file, install it in Settings → General → VPN &amp; Device
Management, then turn it on in Settings → General → About → Certificate Trust
Settings.</li>
<li>SHA-256 fingerprint: <code>$root_ca</code></li>
</ul></dd>
EOF
    fi
    cat <<EOF
</dl>

<h2>Android</h2>
<p>Version $android, for Android 8 and later.</p>
<ul class="files">
$(entry "$tag/$(apk noPush)" Recommended)
$(entry "$tag/$(apk withUnifiedPush)")
$(entry "$tag/$(apk withFirebase)")
</ul>
<ul>
<li>Uninstall Jami from Google Play or F-Droid first, after backing up its accounts:
these builds use the same app ID with another signature, so Android won't install
one over the other.</li>
<li>noPush keeps its own connection to the network. The other two wait for push
notifications, which this server doesn't send yet.</li>
EOF
    [ -z "$signer" ] || echo "<li>Signing certificate SHA-256: <code>$signer</code></li>"
    cat <<EOF
</ul>

<h2>iPhone and iPad</h2>
<p>Version $ios, for iOS 15 and later.</p>
<ul class="files">
$(entry "$tag/$ipa")
</ul>
<ul>
<li>This file is unsigned. Sign and install it from a Mac or Windows computer with
Sideloadly or AltStore and your Apple ID.</li>
<li>With a free Apple ID the app stops opening after 7 days until you install it
again, and notifications don't work.</li>
</ul>

<h2>Linux desktop</h2>
<p>Version $desktop, for Ubuntu 24.04 on x86_64.</p>
<ul class="files">
$(entry "$tag/$tarball")
EOF
    if [ -f "$out/$qt_tar" ]; then
        entry "$qt_tar" "Qt $qt_version"
        qt_step="sudo tar -C / -xJf $qt_tar"
    else
        qt_step="# Qt $qt_version in $qt (docs/CLIENT-SETUP.md)"
    fi
    cat <<EOF
</ul>
<p>In the folder with the downloads:</p>
<pre>sudo apt install libjsoncpp25 libsecp256k1-1 libvdpau1 libvpx9 libx264-164 libyaml-cpp0.8 libxcb-cursor0
$qt_step
EOF
    # The public address has a certificate that the system already trusts.
    [ -z "$root_ca" ] || [ -n "$public" ] ||
        echo "sudo cp jams-root.crt /usr/local/share/ca-certificates/ &amp;&amp; sudo update-ca-certificates"
    cat <<EOF
tar -xzf $tarball
${tarball%.tar.gz}/bin/jami</pre>
<p>Then in Jami: <b>Advanced features</b> → <b>Connect to management server</b>,
and the address above.</p>

<h2>Windows and macOS</h2>
<p>No builds yet.</p>

<footer>Files from the GitHub releases of
<a href="https://github.com/kool277/jami/releases/tag/$tag">Jami platform $tag</a>,
checked against their SHA-256 sums. Updated $(date +%F) by
<code>deploy/scripts/fetch-apps.sh</code>.</footer>
</main>
</body>
</html>
EOF
} >"$out/index.html.part"
mv "$out/index.html.part" "$out/index.html"
echo "page  $out/index.html -> $web/downloads/"
[ -z "$public" ] || echo "      and $public_web/downloads/"
