#!/bin/sh
# Configure a fresh JAMS through its REST API (the same calls as the web
# setup wizard), then create the Jami blueprint with our TURN server and
# DHT proxy, a group using it, and the test users from .env.
# Safe to re-run: finished steps are skipped; the blueprint and the test
# users' password are set again from .env.
# Passwords and tokens are read from .env and never printed.
set -eu
cd "$(dirname "$0")/.."

set -a
. ./.env
set +a
: "${JAMS_HOST:?}" "${JAMS_ADMIN_USER:?}" "${JAMS_ADMIN_PASSWORD:?}"
: "${JAMS_TEST_USERS:?}" "${JAMS_TEST_PASSWORD:?}"
: "${TURN_USER:?}" "${TURN_PASSWORD:?}"

base="https://$JAMS_HOST:${JAMS_HTTPS_PORT:-443}"
cacert=certs/jams-root.crt
[ "${JAMS_TLS:-internal}" = internal ] && [ ! -f "$cacert" ] && sh scripts/export-ca.sh >/dev/null
curl_opts="-sS --fail-with-body"
[ "${JAMS_TLS:-internal}" = internal ] && curl_opts="$curl_opts --cacert $cacert"

blueprint=jami-default
group=jami-users
token=

# api METHOD PATH [JSON]: JSON goes through stdin so that secrets do not
# appear in the process list.
api() {
    if [ -n "$token" ]; then
        printf '%s' "${3:-}" | curl $curl_opts -X "$1" "$base$2" \
            -H 'Content-Type: application/json' -H @/dev/fd/3 --data-binary @- \
            3<<EOF
Authorization: Bearer $token
EOF
    else
        printf '%s' "${3:-}" | curl $curl_opts -X "$1" "$base$2" \
            -H 'Content-Type: application/json' --data-binary @-
    fi
}

credentials() {
    jq -n --arg u "$1" --arg p "$2" '{username: $u, password: $p}'
}

step() { printf '%s\n' "- $*"; }

# 1. Setup wizard -------------------------------------------------------
# While the wizard runs, GET /api/install/start answers "showLogin: false"
# until an account exists; once setup is finished, /api/install/* is 404.
if curl -s $curl_opts -o /dev/null -D - "$base/api/install/start" 2>/dev/null |
        grep -qi '^showLogin: *false'; then
    step "create admin account '$JAMS_ADMIN_USER'"
    token=$(api PUT /api/install/start \
        "$(credentials "$JAMS_ADMIN_USER" "$JAMS_ADMIN_PASSWORD")" | jq -r .access_token)
else
    token=$(api POST /api/login \
        "$(credentials "$JAMS_ADMIN_USER" "$JAMS_ADMIN_PASSWORD")" | jq -r .access_token)
fi
[ -n "$token" ] && [ "$token" != null ] || { echo "admin login failed" >&2; exit 1; }
next=$(api GET /api/install/lastStep 2>/dev/null | jq -r .uri 2>/dev/null || true)

if [ "$next" = /api/install/ca ]; then
    step "create certificate authority (10 years)"
    api POST /api/install/ca "$(jq -n --arg cn "Jami $JAMS_HOST" '{fields: {
        commonName: $cn, organization: "Jami", city: "", state: "",
        country: "CA", lifetime: 315569520000}}')" >/dev/null
    next=/api/install/auth
fi
if [ "$next" = /api/install/auth ]; then
    step "authentication source: local database, JAMS name server"
    api POST /api/install/auth '{"type":"LOCAL","localAuthSettings":
        {"publicNames":false,"publicNameServer":"http://ns.jami.net"}}' >/dev/null
    next=/api/install/settings
fi
if [ "$next" = /api/install/settings ]; then
    step "server settings: $base behind a reverse proxy"
    api POST /api/install/settings "$(jq -n --arg d "$base" '{
        serverDomain: $d, reverseProxy: true, signingAlgorithm: "SHA512WITHRSA",
        crlLifetime: 300000, userLifetime: 31556952000,
        deviceLifetime: 31556952000}')" >/dev/null
fi
step "setup wizard complete"

# 2. Blueprint with TURN and DHT proxy ----------------------------------
# Devices reach both by the public name when there is one: from the
# internet through the router, on the LAN through its DNS entry for it.
host=${PUBLIC_HOST:-$JAMS_HOST}
policy=$(jq -n \
    --arg turn "$host:${TURN_PORT:-3479}" \
    --arg tu "$TURN_USER" --arg tp "$TURN_PASSWORD" \
    --arg proxy "$host:${DHT_PROXY_PORT:-8000}" '{
    videoEnabled: true, publicInCalls: false, autoAnswer: false,
    peerDiscovery: true, accountDiscovery: false, accountPublish: false,
    rendezVous: false, defaultModerators: "", upnpEnabled: true,
    allowLookup: true,
    turnEnabled: true, turnServer: $turn,
    turnServerUserName: $tu, turnServerPassword: $tp,
    proxyEnabled: true, proxyServer: $proxy, dhtProxyListUrl: "",
    uiCustomization: "{\"areTipsEnabled\":true,\"backgroundType\":\"default\"}"}')

if api GET "/api/admin/policy/$blueprint" >/dev/null 2>&1; then
    step "update blueprint '$blueprint' (TURN + DHT proxy at $host)"
    api PUT "/api/admin/policy?name=$blueprint" "$policy" >/dev/null
else
    step "create blueprint '$blueprint' (TURN + DHT proxy at $host)"
    api POST "/api/admin/policy?name=$blueprint" "$policy" >/dev/null
fi

# 3. Group and test users -----------------------------------------------
group_id=$(api GET /api/admin/groups | jq -r --arg g "$group" \
    '(if type == "array" then . else .groups // [] end)[] | select(.name == $g) | .id' | head -1)
if [ -z "$group_id" ]; then
    step "create group '$group' using '$blueprint'"
    group_id=$(api POST /api/admin/group \
        "$(jq -n --arg n "$group" --arg b "$blueprint" '{name: $n, blueprintName: $b}')" |
        jq -r .id)
fi

for user in $(printf '%s' "$JAMS_TEST_USERS" | tr ',' ' '); do
    if api GET "/api/admin/user?username=$user" >/dev/null 2>&1; then
        # To change the test users' password, change it in .env and run
        # this script again.
        step "user '$user' exists: password from .env"
        api PUT /api/admin/user "$(credentials "$user" "$JAMS_TEST_PASSWORD")" >/dev/null
    else
        step "create user '$user'"
        api POST /api/admin/user "$(credentials "$user" "$JAMS_TEST_PASSWORD")" >/dev/null
        api POST /api/admin/directory/entry "$(jq -n --arg u "$user" '{
            username: $u, firstName: $u, lastName: "", email: "",
            profilePicture: "", organization: "", faxNumber: "",
            phoneNumber: "", phoneNumberExtension: "", mobileNumber: "",
            jamiId: ""}')" >/dev/null
    fi
    api POST "/api/admin/group/members/$group_id" \
        "$(jq -n --arg u "$user" '{username: $u}')" >/dev/null 2>&1 || true
done

step "done: $base (admin '$JAMS_ADMIN_USER', users: $JAMS_TEST_USERS)"
