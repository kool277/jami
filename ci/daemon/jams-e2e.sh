#!/bin/sh
# Run the JAMS end-to-end check (jams-e2e-container.sh) in the daemon
# build container against the server stack in deploy/. Needs a built
# jamid (ci/daemon/run.sh) and the stack set up by deploy/scripts.
#   ci/daemon/jams-e2e.sh
#
# JAMS keeps each user's contacts and conversations and syncs them to
# new devices, so a run cannot reuse the same users. Each run creates two
# users (e2e<time>a, e2e<time>b) with a random password in the
# jami-users group, and revokes them and their devices on exit. Revoked
# users stay listed in JAMS but can no longer sign in.
set -eu

here=$(cd "$(dirname "$0")" && pwd)
ws=$(cd "$here/../.." && pwd)
env_file=$ws/deploy/.env
ca=$ws/deploy/certs/jams-root.crt

[ -f "$env_file" ] || { echo "missing $env_file" >&2; exit 1; }
[ -f "$ca" ] || { echo "missing $ca (run deploy/scripts/export-ca.sh)" >&2; exit 1; }

value() { sed -n "s/^$1=//p" "$env_file" | tail -1; }
JAMS_HOST=$(value JAMS_HOST)
admin_user=$(value JAMS_ADMIN_USER)
admin_password=$(value JAMS_ADMIN_PASSWORD)
base=https://$JAMS_HOST

token=
api() { # <method> <path> [json body]; the body is passed on stdin
    printf '%s' "${3:-}" | curl -sS --fail-with-body --cacert "$ca" -X "$1" "$base$2" \
        -H 'Content-Type: application/json' -H "Authorization: Bearer $token" --data-binary @-
}

token=$(jq -n --arg u "$admin_user" --arg p "$admin_password" '{username: $u, password: $p}' |
    curl -sS --fail-with-body --cacert "$ca" -X POST "$base/api/login" \
        -H 'Content-Type: application/json' --data-binary @- | jq -r .access_token)
[ -n "$token" ] && [ "$token" != null ] || { echo "JAMS admin login failed" >&2; exit 1; }

group_id=$(api GET /api/admin/groups | jq -r \
    '(if type == "array" then . else .groups // [] end)[] | select(.name == "jami-users") | .id' | head -1)
[ -n "$group_id" ] || { echo "group jami-users not found (run deploy/scripts/jams-setup.sh)" >&2; exit 1; }

stamp=$(date +%Y%m%d%H%M%S)
E2E_USER_A=e2e${stamp}a
E2E_USER_B=e2e${stamp}b
E2E_PASSWORD=$(openssl rand -hex 16)
export JAMS_HOST E2E_USER_A E2E_USER_B E2E_PASSWORD

bundle=$(mktemp)
created=
cleanup() {
    rm -f "$bundle"
    # The profiles hold device keys and the TURN password pushed by JAMS;
    # keep only the logs.
    rm -rf "$ws/jami-daemon/build/e2e/alice" "$ws/jami-daemon/build/e2e/bob" \
        "$ws/jami-client-qt/build/jams-client-check/cfg" \
        "$ws/jami-client-qt/build/jams-client-check/data" \
        "$ws/jami-client-qt/build/jams-client-check/cache" \
        "$ws/jami-client-qt/build/jams-client-check/home"
    for u in $created; do
        api DELETE "/api/admin/user?username=$u" >/dev/null 2>&1 &&
            echo "      revoked JAMS user $u" || echo "WARN  could not revoke JAMS user $u" >&2
    done
}
trap cleanup EXIT

for u in "$E2E_USER_A" "$E2E_USER_B"; do
    api POST /api/admin/user "$(jq -n --arg u "$u" --arg p "$E2E_PASSWORD" \
        '{username: $u, password: $p}')" >/dev/null
    created="$created $u"
    api POST /api/admin/directory/entry "$(jq -n --arg u "$u" '{
        username: $u, firstName: $u, lastName: "", email: "",
        profilePicture: "", organization: "", faxNumber: "",
        phoneNumber: "", phoneNumberExtension: "", mobileNumber: "",
        jamiId: ""}')" >/dev/null
    api POST "/api/admin/group/members/$group_id" "$(jq -n --arg u "$u" '{username: $u}')" >/dev/null
done
echo "      JAMS users $E2E_USER_A and $E2E_USER_B created in jami-users"

# The system CA bundle plus the Caddy root that signs the JAMS certificate.
cat /etc/ssl/certs/ca-certificates.crt "$ca" >"$bundle"
chmod 644 "$bundle"

certs="-v $bundle:/etc/ssl/certs/ca-certificates.crt:ro"
DOCKER_RUN_ARGS="-e JAMS_HOST -e E2E_USER_A -e E2E_USER_B -e E2E_PASSWORD $certs" \
    "$here/run.sh" sh /ci/jams-e2e-container.sh

# Then the desktop client on alice's profile, if it is built (the user
# and its device are revoked on exit, so this must run first).
if [ -x "$ws/jami-client-qt/install/bin/jami" ]; then
    SKIP_IMAGE_BUILD=1 DOCKER_RUN_ARGS="-e E2E_PROFILE=/src/jami-daemon/build/e2e/alice $certs" \
        "$ws/ci/client-qt/run.sh" sh /ci/jams-client-check.sh
else
    echo "SKIP  client check: jami-client-qt/install/bin/jami not built"
fi
