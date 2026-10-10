#!/bin/sh
# End-to-end check against the local JAMS: two jamid instances ("alice"
# and "bob", each on its own session bus and profile) sign in to JAMS as
# E2E_USER_A and E2E_USER_B, become contacts, exchange a text message and
# set up a call. Runs inside the daemon build container; start it with
# ci/daemon/jams-e2e.sh, which creates the users and provides JAMS_HOST,
# E2E_USER_A, E2E_USER_B, E2E_PASSWORD and a CA bundle trusting JAMS.
set -eu

: "${JAMS_HOST:?}" "${E2E_USER_A:?}" "${E2E_USER_B:?}" "${E2E_PASSWORD:?}"
JAMS_URI=${JAMS_URI:-https://$JAMS_HOST}
TIMEOUT=${TIMEOUT:-120}
work=${E2E_DIR:-build/e2e}
rm -rf "$work"
mkdir -p "$work"

pids=
cleanup() {
    for p in $pids; do kill "$p" 2>/dev/null || true; done
}
trap cleanup EXIT

fail() {
    echo "FAIL  $*" >&2
    for n in alice bob; do
        echo "--- $n jamid log (tail)" >&2
        tail -15 "$work/$n.log" >&2 || true
    done
    exit 1
}

# Each instance gets a bus address in $work/<name>.bus.
start_instance() {
    name=$1
    mkdir -p "$work/$name"
    dbus-daemon --session --fork --print-address=3 --print-pid=4 \
        3>"$work/$name.bus" 4>"$work/$name.buspid"
    pids="$pids $(cat "$work/$name.buspid")"
    DBUS_SESSION_BUS_ADDRESS=$(cat "$work/$name.bus") \
        XDG_CONFIG_HOME="$work/$name/cfg" XDG_DATA_HOME="$work/$name/data" \
        XDG_CACHE_HOME="$work/$name/cache" \
        build/jamid -c -p >"$work/$name.log" 2>&1 &
    pids="$pids $!"
    # Keep only the signals the checks read: others, such as
    # accountDetailsChanged, carry the TURN password pushed by JAMS.
    DBUS_SESSION_BUS_ADDRESS=$(cat "$work/$name.bus") \
        gdbus monitor --session --dest cx.ring.Ring 2>&1 |
        grep --line-buffered -E "\.(callStateChanged|conversationReady|swarmMessageReceived) " \
            >"$work/$name.signals" &
    pids="$pids $!"
}

# gd <name> <object> <method> [args...]
gd() {
    name=$1 obj=$2 method=$3
    shift 3
    DBUS_SESSION_BUS_ADDRESS=$(cat "$work/$name.bus") gdbus call --session \
        --dest cx.ring.Ring --object-path "/cx/ring/Ring/$obj" \
        --method "cx.ring.Ring.$obj.$method" "$@"
}

# wait_for <seconds> <description> <command...>
wait_for() {
    secs=$1 what=$2
    shift 2
    i=0
    until "$@" >/dev/null 2>&1; do
        i=$((i + 1))
        [ "$i" -le "$((secs * 2))" ] || fail "$what (no result after ${secs}s)"
        sleep 0.5
    done
}

bus_ready() {
    DBUS_SESSION_BUS_ADDRESS=$(cat "$work/$1.bus") gdbus call --session \
        --dest org.freedesktop.DBus --object-path /org/freedesktop/DBus \
        --method org.freedesktop.DBus.NameHasOwner cx.ring.Ring | grep -q true
}

detail() { # <name> <accountId> <key>
    gd "$1" ConfigurationManager getVolatileAccountDetails "$2" |
        grep -o "'$3': '[^']*'" | cut -d"'" -f4
}

for n in alice bob; do
    start_instance "$n"
done
for n in alice bob; do
    wait_for 30 "$n: jamid owns cx.ring.Ring" bus_ready "$n"
done
echo "OK    two jamid instances on separate session buses"

add_account() { # <instance> <JAMS user> [extra dict entries]
    gd "$1" ConfigurationManager addAccount \
        "{'Account.type': 'RING', 'Account.alias': '$2', 'Account.managerUri': '$JAMS_URI', 'Account.managerUsername': '$2', 'Account.archivePassword': '$E2E_PASSWORD'$3}" |
        cut -d"'" -f2
}
alice=$(add_account alice "$E2E_USER_A" "")
bob=$(add_account bob "$E2E_USER_B" "")
[ -n "$alice" ] && [ -n "$bob" ] || fail "addAccount returned no account ID"

registered() { detail "$1" "$2" Account.registrationStatus | grep -qx REGISTERED; }
wait_for "$TIMEOUT" "alice registered through JAMS" registered alice "$alice"
wait_for "$TIMEOUT" "bob registered through JAMS" registered bob "$bob"

uri() {
    gd "$1" ConfigurationManager getAccountDetails "$2" |
        grep -o "'Account.username': '[^']*'" | cut -d"'" -f4 | sed 's/^jami://'
}
alice_uri=$(uri alice "$alice")
bob_uri=$(uri bob "$bob")
echo "OK    alice ($E2E_USER_A) and bob ($E2E_USER_B) signed in to $JAMS_URI and registered"
echo "      alice $alice_uri"
echo "      bob   $bob_uri"

# The JAMS blueprint pushes TURN and the DHT proxy; check they arrived.
pushed() {
    gd alice ConfigurationManager getAccountDetails "$alice" |
        grep -o "'$1': '[^']*'" | cut -d"'" -f4
}
echo "      pushed by JAMS: TURN.server=$(pushed TURN.server)" \
    "Account.proxyServer=$(pushed Account.proxyServer)"

# A trust request only reaches devices already announced on the DHT, and
# each run signs in with a new device, so wait for both announcements.
announced() { detail "$1" "$2" Account.deviceAnnounced | grep -qx true; }
wait_for "$TIMEOUT" "alice's device announced on the DHT" announced alice "$alice"
wait_for "$TIMEOUT" "bob's device announced on the DHT" announced bob "$bob"
echo "OK    both devices announced on the DHT"

# Contact request -> conversation request on bob's side -> accept.
gd alice ConfigurationManager addContact "$alice" "$bob_uri" >/dev/null
request_id() {
    gd bob ConfigurationManager getConversationRequests "$bob" |
        grep -o "'id': '[^']*'" | head -1 | cut -d"'" -f4
}
has_request() { [ -n "$(request_id)" ]; }
wait_for "$TIMEOUT" "bob receives alice's conversation request" has_request
conv=$(request_id)
gd bob ConfigurationManager acceptConversationRequest "$bob" "$conv" >/dev/null
# Wait until the conversation is set up on both sides before sending: a
# message notification that reaches bob while he is still cloning the
# conversation is dropped ("Already fetching conv") and not fetched later.
bob_ready() { grep "conversationReady" "$work/bob.signals" | grep -q "$conv"; }
wait_for "$TIMEOUT" "bob has cloned the conversation" bob_ready
bob_member() { # alice has fetched bob's join: bob is no longer "invited"
    gd alice ConfigurationManager getConversationMembers "$alice" "$conv" |
        grep -o "{[^}]*}" | grep "'$bob_uri'" | grep -qE "'role': '(member|admin)'"
}
wait_for "$TIMEOUT" "alice sees bob as a member" bob_member
echo "OK    contact request accepted, conversation $conv ready on both sides"

text="hello bob from alice $(date +%s)"
gd alice ConfigurationManager sendMessage "$alice" "$conv" "$text" "" 0 >/dev/null
got_message() { grep -q "$text" "$work/bob.signals"; }
wait_for "$TIMEOUT" "bob receives alice's message" got_message
echo "OK    text message delivered to bob: \"$text\""

# Audio call from alice; bob answers once it rings.
media="[{'MEDIA_TYPE': 'MEDIA_TYPE_AUDIO', 'ENABLED': 'true', 'MUTED': 'false', 'SOURCE': '', 'LABEL': 'audio_0'}]"
call=$(gd alice CallManager placeCallWithMedia "$alice" "jami:$bob_uri" "$media" | cut -d"'" -f2)
[ -n "$call" ] || fail "placeCallWithMedia returned no call ID"
incoming_id() { # callStateChanged ('<account>', '<call>', 'INCOMING', 0)
    grep "callStateChanged" "$work/bob.signals" | grep "'INCOMING'" |
        tail -1 | cut -d"'" -f4
}
ringing() { [ -n "$(incoming_id)" ]; }
wait_for "$TIMEOUT" "bob's device rings" ringing
gd bob CallManager accept "$bob" "$(incoming_id)" >/dev/null
in_call() { grep "callStateChanged" "$work/alice.signals" | grep "$call" | grep -q "'CURRENT'"; }
wait_for "$TIMEOUT" "call reaches CURRENT (answered)" in_call
echo "OK    call $call rang on bob's device, answered (state CURRENT)"
gd alice CallManager hangUp "$alice" "$call" >/dev/null
ended() { grep "callStateChanged" "$work/alice.signals" | grep "$call" | grep -q "'OVER'"; }
wait_for 30 "call ends after hangUp" ended
echo "OK    call hung up"
echo "PASS"
