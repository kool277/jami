#!/bin/sh
# Check the running stack: JAMS over HTTPS (and the blueprint clients
# receive), a TURN allocation against coturn, the DHT proxy, the web
# client. Secrets come from .env and are never printed.
set -eu
cd "$(dirname "$0")/.."

set -a
. ./.env
set +a

base="https://$JAMS_HOST:${JAMS_HTTPS_PORT:-443}"
curl_opts="-sS --fail-with-body"
[ "${JAMS_TLS:-internal}" = internal ] && curl_opts="$curl_opts --cacert certs/jams-root.crt"
fail=0
ok() { printf 'OK    %s\n' "$*"; }
ko() { printf 'FAIL  %s\n' "$*"; fail=1; }

echo "== Containers"
docker compose ps --format '{{.Service}}: {{.State}} ({{.Health}})'

echo "== JAMS over HTTPS ($base)"
if out=$(curl $curl_opts -o /dev/null -w '%{http_code} %{ssl_verify_result}' "$base/"); then
    [ "$out" = "200 0" ] && ok "GET / -> 200, certificate verified" || ko "GET / -> $out"
else
    ko "GET / failed"
fi
openssl s_client -connect "$JAMS_HOST:${JAMS_HTTPS_PORT:-443}" </dev/null 2>/dev/null |
    openssl x509 -noout -subject -issuer -ext subjectAltName 2>/dev/null | sed 's/^/      /'

user=$(printf '%s' "$JAMS_TEST_USERS" | cut -d, -f1)
token=$(jq -n --arg u "$user" --arg p "$JAMS_TEST_PASSWORD" '{username: $u, password: $p}' |
    curl $curl_opts -X POST "$base/api/login" --data-binary @- | jq -r .access_token)
[ -n "$token" ] && [ "$token" != null ] && ok "user '$user' can log in" || ko "user '$user' login"

admin=$(jq -n --arg u "$JAMS_ADMIN_USER" --arg p "$JAMS_ADMIN_PASSWORD" '{username: $u, password: $p}' |
    curl $curl_opts -X POST "$base/api/login" --data-binary @- | jq -r .access_token)
policy=$(curl $curl_opts "$base/api/admin/policy/jami-default" -H @/dev/fd/3 3<<EOF
Authorization: Bearer $admin
EOF
)
printf '%s' "$policy" | jq -r '.policyData // . | (if type == "string" then fromjson else . end)
    | "      turnEnabled=\(.turnEnabled) turnServer=\(.turnServer) turnServerUserName=\(.turnServerUserName) turnServerPassword=\(if (.turnServerPassword // "") != "" then "(set)" else "(empty)" end)\n      proxyEnabled=\(.proxyEnabled) proxyServer=\(.proxyServer)"'
printf '%s' "$policy" | grep -q "$JAMS_HOST:${TURN_PORT:-3479}" &&
    printf '%s' "$policy" | grep -q "$JAMS_HOST:${DHT_PROXY_PORT:-8000}" &&
    ok "blueprint 'jami-default' pushes TURN and DHT proxy" || ko "blueprint values"

echo "== TURN allocation ($JAMS_HOST:${TURN_PORT:-3479})"
out=$(docker compose exec -T coturn sh -c 'turnutils_uclient -p "$TURN_PORT" \
    -u "$TURN_USER" -w "$TURN_PASSWORD" -r "$TURN_REALM" -y -n 5 -m 1 -l 100 '"$JAMS_HOST"' 2>&1')
lost=$(printf '%s\n' "$out" | sed -n 's/.*Total lost packets \([0-9]*\).*/\1/p')
recv=$(printf '%s\n' "$out" | sed -n 's/.*tot_recv_msgs=\([0-9]*\)$/\1/p' | tail -1)
[ -n "$recv" ] && [ "$recv" -gt 0 ] && [ "$lost" = 0 ] &&
    ok "allocation succeeded, $recv messages relayed, $lost lost" || ko "TURN allocation"
docker compose exec -T coturn sh -c 'turnutils_uclient -p "$TURN_PORT" -u "$TURN_USER" \
    -w not-the-password -r "$TURN_REALM" -y -n 1 -m 1 '"$JAMS_HOST"' 2>&1' |
    grep -q 'Cannot complete Allocation' && ok "wrong password is rejected" || ko "wrong password accepted"

echo "== DHT proxy (http://$JAMS_HOST:${DHT_PROXY_PORT:-8000})"
info=$(curl -sS --fail-with-body "http://$JAMS_HOST:${DHT_PROXY_PORT:-8000}/node/info") &&
    printf '%s' "$info" | jq -r '"      node_id=\(.node_id) ipv4 good=\(.ipv4.good) dubious=\(.ipv4.dubious)"' &&
    [ "$(printf '%s' "$info" | jq -r '.ipv4.good')" -gt 0 ] &&
    ok "proxy answers and the node has DHT peers" || ko "DHT proxy"

echo "== Web client (http://127.0.0.1:${WEB_PORT:-8090}, https://$JAMS_HOST:${WEB_HTTPS_PORT:-8443})"
code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${WEB_PORT:-8090}/" || true)
[ "$code" = 200 ] && ok "GET / on this host -> 200" || ko "web client on 127.0.0.1: $code"
code=$(curl $curl_opts -o /dev/null -w '%{http_code}' "https://$JAMS_HOST:${WEB_HTTPS_PORT:-8443}/" || true)
[ "$code" = 200 ] && ok "GET / through Caddy -> 200, certificate verified" || ko "web client through Caddy: $code"
# Its daemon runs in Node.js and verifies JAMS with the OpenSSL of Node.js
# and its default CA locations (SSL_CERT_FILE), not with
# NODE_EXTRA_CA_CERTS: node --use-openssl-ca trusts the same certificates.
code=$(docker compose exec -T web env -u NODE_EXTRA_CA_CERTS node --use-openssl-ca -e '
require("https").get(process.argv[1], { agent: false }, (r) => { console.log(r.statusCode); r.resume() })
    .on("error", (e) => console.log(e.code))' "$base/api/auth/device" 2>/dev/null || true)
[ "$code" = 401 ] && ok "its daemon trusts the JAMS certificate (GET /api/auth/device -> 401)" ||
    ko "the web client's daemon cannot verify JAMS: $code"

exit "$fail"
