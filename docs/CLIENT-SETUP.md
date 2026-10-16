# Clients with the local JAMS

How Jami clients connect to the JAMS in `deploy/` (see `SERVER-SETUP.md`),
how two JAMS users chat between the desktop client and the web client,
and the end-to-end check that two JAMS users can sign in, become
contacts, exchange a message and set up a call.

## Connecting a client (desktop)

1. Trust the JAMS certificate on the client machine: with
   `JAMS_TLS=internal`, install `deploy/certs/jams-root.crt` as described
   in `SERVER-SETUP.md` → TLS.
2. In the client's welcome page: **Advanced features** → **Connect to
   management server**.
3. **Management server URL**: `https://192.168.1.92` (the `JAMS_HOST`).
4. **Enter management server credentials**: a JAMS user, for example
   `alice` or `bob` with `JAMS_TEST_PASSWORD` from `deploy/.env`.
   **Connect**.

JAMS then issues a device certificate and pushes the blueprint
`jami-default`: TURN `192.168.1.92:3479` and the DHT proxy
`192.168.1.92:8000`. The DHT bootstrap stays `bootstrap.jami.net`; JAMS
cannot set it.

Every sign-in from a new profile registers a new device for that user in
JAMS, and JAMS syncs the user's contacts and conversations to it.

## The desktop client on jami-server

The desktop client built here (`jami-client-qt/install/bin/jami`, see
`CLIENT-QT-BUILD.md`) or released (`jami-client-qt-<version>-linux-x86_64.tar.gz`)
runs on the server's own Ubuntu 24.04 desktop with:

- Qt 6.12.0 in `/opt/qt/6.12.0/gcc_64`, copied from the build image (as
  root): `docker run --rm -v /opt/qt:/out --entrypoint sh jami-client-qt-build -c 'cp -a /opt/qt/6.12.0 /out/'`
- the system libraries it links that a desktop install lacks:
  `apt install libjsoncpp25 libsecp256k1-1 libvdpau1 libvpx9 libx264-164 libyaml-cpp0.8 libxcb-cursor0`
  (without `libxcb-cursor0`, Qt's X11 plugin does not load and the client
  exits at once)
- the JAMS certificate trusted system-wide (`SERVER-SETUP.md` → TLS):
  `/usr/local/share/ca-certificates/jams-root.crt`, then
  `update-ca-certificates`

`~/.local/share/applications/net.jami.Jami.desktop` (the installed one,
with `Exec` and `Icon` set to absolute paths) puts **Jami** in the
application launcher.

## The web client

Open http://127.0.0.1:8090 on jami-server, or `https://192.168.1.92:8443`
from another machine (trust `deploy/certs/jams-root.crt` in that browser,
or accept the warning), and sign in with a JAMS user: `bob` and
`JAMS_TEST_PASSWORD`, for instance. See `SERVER-SETUP.md` → Web client.

## Chat between the desktop and web clients

Checked on 2026-10-16 with `alice` in the desktop client on jami-server
(signed in with **Connect to management server**) and `bob` in the web
client:

- alice adds bob as a contact; the conversation request reaches bob's web
  client within 5 seconds, with alice's name resolved by JAMS;
- bob accepts; the conversation is ready on both sides within 5 seconds
  (bob a member on alice's side);
- a message from the desktop client reaches the web client, and the
  reply reaches the desktop client, each within 10 seconds, and the
  desktop window shows the conversation with the unread reply.

Both clients were driven through their local APIs, which serve the same
routes: the web client's `/api` (a session token from
`POST /api/auth/login`) and the desktop client's API on localhost
(**Settings** → enable the API, or `EnableApi=true` and `ApiPort` in
`~/.config/jami.net/Jami.conf`, with an API token).

## End-to-end check

```sh
ci/daemon/jams-e2e.sh
```

Needs a built daemon (`ci/daemon/run.sh`), the server stack running and
set up (`deploy/scripts/jams-setup.sh`, `export-ca.sh`) and `curl`,
`jq` and `openssl` on the host. If `jami-client-qt/install/bin/jami` is
built (`ci/client-qt/run.sh`), the desktop client is checked too. A run
takes about 30 seconds.

What it does:

1. **Users**: logs in to the JAMS admin API (`JAMS_ADMIN_USER` from
   `deploy/.env`) and creates two users, `e2e<time>a` and `e2e<time>b`,
   with a random password, in the `jami-users` group. A run cannot reuse
   the same users: JAMS keeps their contacts and conversations and syncs
   them to every new device, so a second run would find them already
   contacts. On exit, whether the run passed or not, both users and
   their devices are revoked (`DELETE /api/admin/user`). Revoked users
   stay listed in JAMS but can no longer sign in.
2. **Daemon** (`ci/daemon/jams-e2e-container.sh`, daemon build
   container): starts two `build/jamid` instances, "alice" and "bob",
   each on its own D-Bus session bus with its own profile, and drives
   them with `gdbus`, the same libjami API the clients use:
   - `addAccount` with `Account.managerUri`, `managerUsername` and
     `archivePassword`, the details the desktop client's "Connect to
     management server" sends; waits for `REGISTERED` and prints the TURN
     server and DHT proxy JAMS pushed;
   - waits until both devices are announced on the DHT
     (`Account.deviceAnnounced`): a contact request only reaches devices
     already announced;
   - alice `addContact`s bob, bob accepts the conversation request; the
     check then waits until the conversation is set up on both sides:
     bob's `conversationReady`, and bob listed as a member (no longer
     "invited") on alice's side;
   - alice sends one text message, bob receives it
     (`swarmMessageReceived`);
   - alice places an audio call (`placeCallWithMedia`), bob `accept`s it
     when it rings, the call reaches `CURRENT`, alice hangs up and it ends.
3. **Desktop client** (`ci/client-qt/jams-client-check.sh`, client-qt
   build container): starts `install/bin/jami -d` under Xvfb on a copy
   of alice's profile and checks its log: JAMS issues the device token,
   the account announces itself on the DHT, and the main window loads.

The containers trust the JAMS certificate through a CA bundle (system
bundle plus `deploy/certs/jams-root.crt`) mounted over
`/etc/ssl/certs/ca-certificates.crt`. Passwords go to the containers as
environment variables and are never printed. The profiles, which hold
device keys and the TURN password JAMS pushes, are deleted on exit.

Logs of the last run: `jami-daemon/build/e2e/` (`alice.log`, `bob.log`,
and `*.signals`: the `callStateChanged`, `conversationReady` and
`swarmMessageReceived` signals from `gdbus monitor`; other signals are
not kept because `accountDetailsChanged` carries the TURN password) and
`jami-client-qt/build/jams-client-check/jami.log`.

### Result (2026-10-10)

The final version passed three consecutive runs, desktop client check
included. Output of the last run:

```
      JAMS users e2e20261010233000a and e2e20261010233000b created in jami-users
OK    two jamid instances on separate session buses
OK    alice (e2e20261010233000a) and bob (e2e20261010233000b) signed in to https://192.168.1.92 and registered
      alice eaba02ee48e0de7c7238347a49815de2913613b4
      bob   b71707a11077ca6c56a2033a594e5cd968c130e8
      pushed by JAMS: TURN.server=192.168.1.92:3479 Account.proxyServer=192.168.1.92:8000
OK    both devices announced on the DHT
OK    contact request accepted, conversation 9d5dc790145a21027e75820f3e6c892e2717d4b4 ready on both sides
OK    text message delivered to bob: "hello bob from alice 1791657015"
OK    call 3384463966101655 rang on bob's device, answered (state CURRENT)
OK    call hung up
PASS
OK    client started under Xvfb with the JAMS account: main view loaded, device token from JAMS, identity announced on the DHT (0 QML errors in log)
      revoked JAMS user e2e20261010233000a
      revoked JAMS user e2e20261010233000b
```

### Why scripted, not through the client UI

There is no display in the build containers, the desktop client cannot
start without one (GTK exits with `cannot open display`, even with
`QT_QPA_PLATFORM=offscreen`), and its HTTP API cannot create accounts or
place calls. The account, message and call steps therefore run through
jamid; the client check shows that the desktop client itself starts
with a JAMS account.

## Found while setting this up

- **Device token rejected (fixed in `deploy/caddy/Caddyfile`).** After
  signing in, each device asks JAMS for a device token at `/api/login`
  with its client certificate. Caddy neither requested nor forwarded
  client certificates, so every device got 401: contacts and
  conversations did not sync with JAMS. See `SERVER-SETUP.md` → TLS.
- **Message sent while the peer is still cloning.** If alice's message
  notification reaches bob while he is still cloning the conversation he
  just accepted, bob logs `Already fetching conv`, drops it, and does not
  fetch the message later (no further trigger within 120 s). The check
  waits for the conversation to be ready on both sides before sending.
  Whether the message arrives at a later sync was not checked.
- **`Account.autoAnswer`** set in `addAccount` had no effect on the JAMS
  accounts: the call rang for 30 s and the daemon then ended it as
  `BUSY` (486). The check answers explicitly instead. Not investigated
  further.
- **Calls in the client test suites** (`CLIENT-QT-BUILD.md`): there,
  two accounts in one daemon on the public DHT, the test call ends with
  SIP 480. Here, two daemons with JAMS and the local DHT proxy, the call
  connects.

- **IP addresses rejected by the web client (fixed in kool277/jami-web#6).**
  Its URL check accepted only domain names, so the JAMS URL
  `https://192.168.1.92` could not be set (`Invalid JAMS server URL`).
- **Web client sign-in failed whatever the password (fixed in
  kool277/jami-web#7).** Its image had no CA store, so its daemon could
  verify no HTTPS server and every JAMS sign-in ended in `Invalid JAMS
  credentials`. `ci/web/build.sh` now checks the image for a CA bundle.
- **The desktop client could not run on jami-server**: no Qt 6.12, seven
  missing libraries, and the JAMS certificate not trusted system-wide
  (see above).

## Troubleshooting

- `FAIL  bob receives alice's conversation request`: check that both
  devices got a device token (`[Auth] Got server response: 200 (` in
  `jami-daemon/build/e2e/*.log`); a 401 means the client certificate
  does not reach JAMS (Caddyfile).
- `JAMS admin login failed`: `JAMS_ADMIN_USER` / `JAMS_ADMIN_PASSWORD`
  in `deploy/.env` do not match JAMS.
- `group jami-users not found`: run `deploy/scripts/jams-setup.sh`.
- `WARN  could not revoke JAMS user …`: revoke it in the JAMS admin UI
  (Users).
