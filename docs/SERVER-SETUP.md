# Server side: JAMS, coturn, dhtnode, Caddy, web client

Everything runs from `deploy/` with Docker Compose on `jami-server`
(192.168.1.92).

| Service | Image | Host port(s) | Role |
|---------|-------|--------------|------|
| `jams` | `jams:local`, built from `jami-jams/` (`--target prod`) | none (8080 inside the network) | Jami Account Management Server: accounts, name lookup, policies |
| `caddy` | `caddy:2.10.2-alpine` | 443/tcp, 8443/tcp; with access from the internet also 9443/tcp, 8081/tcp | TLS reverse proxy for JAMS (443, and 9443 from the internet) and the web client (8443); 8081 answers Let's Encrypt |
| `coturn` | `coturn/coturn:4.6.3` | 3479/udp+tcp, relays 49160-49200/udp (host network) | TURN server pushed to clients by JAMS |
| `dhtnode` | `jami-dhtnode:local` (Ubuntu 24.04 `dhtnode`, OpenDHT 3.0) | 4222/udp (DHT), 8000/tcp (proxy) | DHT node and DHT proxy pushed to clients by JAMS |
| `web` | `jami-web:local`, built from `jami-web/` (`--target production`) | 127.0.0.1:8090/tcp (HTTPS for other machines through Caddy on 8443) | Jami web client; users sign in with their JAMS account |

These existing host services are left untouched: `coturn.service` (3478),
`nginx` (80), `asterisk`, `postgresql`, `jenkins` (8080). Caddy
therefore has no port 80 listener: it serves HTTPS, and plain HTTP only on
8081 for Let's Encrypt.

## Configuration

```sh
cd deploy
cp .env.example .env     # .env is git-ignored
chmod 600 .env
# fill in JAMS_ADMIN_PASSWORD, JAMS_TEST_PASSWORD, TURN_PASSWORD,
# JAMI_WEB_ADMIN_PASSWORD, e.g.
#   openssl rand -hex 16
```

| Variable | Meaning |
|----------|---------|
| `JAMS_HOST` | Address clients use for JAMS (IP or DNS name). Also used as the TURN and DHT proxy host in the blueprint. |
| `JAMS_TLS` | `internal` = Caddy's local CA; an e-mail address = Let's Encrypt |
| `JAMS_ADMIN_USER` / `JAMS_ADMIN_PASSWORD` | JAMS administrator |
| `JAMS_TEST_USERS` / `JAMS_TEST_PASSWORD` | Test users (comma-separated) |
| `TURN_REALM`, `TURN_USER`, `TURN_PASSWORD`, `TURN_PORT`, `TURN_MIN_PORT`, `TURN_MAX_PORT` | coturn (long-term credentials). Keep `TURN_REALM=ring`: JAMS does not push `TURN.realm`, and Jami clients default to `ring`, so any other realm makes their TURN authentication fail. |
| `TURN_EXTERNAL_IP` | `PUBLIC/PRIVATE` when clients reach the host through NAT: the router's public IP and this host's address ([Access from the internet](#access-from-the-internet)) |
| `PUBLIC_HOST`, `JAMS_PUBLIC_PORT`, `COMPOSE_FILE` | Access from the internet: the public name, the port of JAMS on it (default 9443), and `docker-compose.yml:docker-compose.public.yml` to turn it on |
| `DHT_PORT`, `DHT_PROXY_PORT`, `DHT_BOOTSTRAP` | OpenDHT node |
| `WEB_PORT`, `WEB_HTTPS_PORT` | Web client: plain HTTP on 127.0.0.1 (default 8090), HTTPS through Caddy for other machines (default 8443) |
| `JAMI_WEB_ADMIN_PASSWORD` | Web client administrator (its `/admin` pages) |

## Start

```sh
docker compose up -d --build
docker compose ps          # all five: running (healthy)
sh scripts/export-ca.sh    # Caddy root CA -> certs/jams-root.crt, certs/ca-bundle.crt
sh scripts/jams-setup.sh   # JAMS setup wizard + blueprint + users
sh scripts/web-setup.sh    # web client: admin account, JAMS sign-in
sh scripts/verify.sh       # checks below; exit code 0 = all OK
```

Building `jams:local` the first time takes about 5 minutes (Maven and
npm downloads, `mvn package` with tests).

### Persistence

| Volume | Contents |
|--------|----------|
| `jami_jams-data` | `/home/jams/data`: JAMS state (Derby DB `jams/`, `config.json`, `CA.pem`, `keystore.jks`, `oauth.*`, `jams.crl`, `images/`) |
| `jami_caddy-data` | Caddy local CA and certificates |
| `jami_coturn-data` | coturn SQLite user DB |
| `jami_web-data` | `/data/jami-web`: web client settings (`admin.json`), JWT keys, its users (`accounts.json`) |
| `jami_web-daemon-config`, `jami_web-daemon-data` | The web client's daemon: its accounts (`~/.config/jami`) and their data (`~/.local/share/jami`), so a user keeps the same JAMS device across restarts |

JAMS reads its state from its working directory, which also holds its
jars. `deploy/jams/entrypoint.sh` therefore runs JAMS from the volume
and copies the image's jars into it on every start. Rebuilding the
image upgrades JAMS and keeps its data. Back up by stopping `jams`
and copying `jami_jams-data`. The entrypoint also caps JAMS's Java
heap at 2 GB: JAMS keeps about 350 MB in use, but without a cap its
heap grew to 12 GB, a quarter of this host's memory.

## JAMS setup

`scripts/jams-setup.sh` makes the same REST calls as the web setup
wizard. Re-running it is safe: finished steps are skipped, and the
blueprint and the test users' password are set again from `.env` (to
change that password, change it there and run the script).

| Wizard page (https://192.168.1.92/) | REST call | Values |
|------------------------------|-----------|--------|
| 1. Create admin account | `PUT /api/install/start` | `JAMS_ADMIN_USER` / `JAMS_ADMIN_PASSWORD` |
| 2. Certificate authority | `POST /api/install/ca` | CN `Jami <JAMS_HOST>`, O `Jami`, 10 years |
| 3. User database | `POST /api/install/auth` | Local database (no LDAP/AD) |
| 4. Server parameters | `POST /api/install/settings` | Domain `https://<JAMS_HOST>:443`, behind a reverse proxy, SHA512WITHRSA, device and user certificates 1 year, CRL 5 min |
| Blueprints → new `jami-default` | `POST`/`PUT /api/admin/policy?name=jami-default` | TURN: custom, `<host>:3479`, `TURN_USER`/`TURN_PASSWORD`. DHT proxy: custom, `<host>:8000`. `<host>` is `PUBLIC_HOST`, else `JAMS_HOST`. UPnP, peer discovery and video on |
| Groups → new `jami-users` | `POST /api/admin/group` | Blueprint `jami-default` |
| Users → new user | `POST /api/admin/user` + `/api/admin/directory/entry` + `/api/admin/group/members/<id>` | `alice`, `bob`; password `JAMS_TEST_PASSWORD` |

After setup, `/api/install/*` returns 404. The admin UI is at
`https://192.168.1.92/`, where you log in as `JAMS_ADMIN_USER`.

What JAMS pushes to a device on enrollment (`DeviceServlet`):
`TURN.enable/server/username/password` and
`Account.proxyEnabled/proxyServer/dhtProxyListUrl` from the user's group
blueprint. JAMS also answers name lookups itself
(`/api/nameserver/name/<name>`, `/api/nameserver/addr/<id>`).
It cannot set the DHT bootstrap host, so clients keep
`bootstrap.jami.net`. That is why `dhtnode` bootstraps from the public
network: as a proxy, it must reach the same DHT as the clients.

## Web client (`scripts/web-setup.sh`)

The `web` service runs the Jami web client from the `jami-web`
submodule. `scripts/web-setup.sh` runs its non-interactive setup
(`jami-web setup`): JWT keys, the admin account (`JAMI_WEB_ADMIN_PASSWORD`)
and sign-in with JAMS accounts at `https://<JAMS_HOST>`, with local
accounts, OpenID and guests disabled. Re-running it is safe.

- On this host: http://127.0.0.1:8090 (plain HTTP, which browsers treat
  as a secure context on 127.0.0.1, so the microphone and camera work).
- From other machines: `https://<JAMS_HOST>:8443` through Caddy, with
  the same certificate as JAMS (browsers must trust `certs/jams-root.crt`
  or accept the warning).

A user signs in with a JAMS user's credentials; the web client's daemon
then enrolls a device for that user, like a desktop client. That daemon
reaches JAMS at `https://<JAMS_HOST>` and must trust Caddy's CA: the
container mounts `certs/ca-bundle.crt` (written by `export-ca.sh`: the
host's CA bundle plus `jams-root.crt`) as its system bundle, and
`SSL_CERT_FILE` names it. The daemon runs inside Node.js and verifies
certificates with the OpenSSL of Node.js, which looks for
`/etc/ssl/cert.pem` (absent on Debian) and for hashed files in
`/etc/ssl/certs`, so without `SSL_CERT_FILE` it would not read the
bundle. Node itself gets `jams-root.crt` through `NODE_EXTRA_CA_CERTS`,
which the daemon ignores. `verify.sh` checks the daemon's view with
`node --use-openssl-ca` in the container, which trusts the same
certificates.

When a sign-in fails, the web client tells why: `Invalid JAMS
credentials` (401) only when JAMS refused them; otherwise 502 with the
cause, also in the container's log (`docker compose logs web`): JAMS
unreachable, its certificate not verified, no JAMS at that URL, or a
JAMS error.

## Apps page (`scripts/fetch-apps.sh`)

`scripts/fetch-apps.sh [platform tag]` puts the apps of a platform
release (default: the newest `v*` tag) in `downloads/`, which Caddy
serves at `https://<JAMS_HOST>:8443/downloads/`, and with access from the
internet at `https://<PUBLIC_HOST>:8443/downloads/` too: the Android APKs, the
unsigned iOS `.ipa`, the Linux desktop archive and `jams-root.crt`, with
a page that says how to install each one and which address each app
connects to. The files come from the components' GitHub releases and
must match their `.sha256` files. On a server with Qt in `/opt/qt`
(`CLIENT-SETUP.md`), the script also packs the Qt runtime that the
desktop app needs (`qt-6.12.0-gcc_64-runtime.tar.xz`, about 750 MB
unpacked), since other computers don't have it. Run it again after each
release; files of older releases stay in `downloads/<tag>/` until you
delete them.

## Verification (`scripts/verify.sh`)

```
== JAMS over HTTPS (https://192.168.1.92:443)
OK    GET / -> 200, certificate verified
      issuer=CN = Caddy Local Authority - ECC Intermediate
      X509v3 Subject Alternative Name: critical
          IP Address:192.168.1.92
OK    user 'alice' can log in
      turnEnabled=true turnServer=jams.jaybi.uz:3479 turnServerUserName=jami turnServerPassword=(set)
      proxyEnabled=true proxyServer=jams.jaybi.uz:8000
OK    blueprint 'jami-default' pushes TURN and DHT proxy at jams.jaybi.uz
== TURN allocation (192.168.1.92:3479)
OK    allocation succeeded, relay address 5.133.122.43 (public)
OK    relaying to this host (192.168.1.92) is refused
OK    wrong password is rejected
== DHT proxy (http://192.168.1.92:8000)
      node_id=e8086490… ipv4 good=55 dubious=0
OK    proxy answers and the node has DHT peers
== Web client (http://127.0.0.1:8090, https://192.168.1.92:8443)
OK    GET / on this host -> 200
OK    GET / through Caddy -> 200, certificate verified
OK    its daemon trusts the JAMS certificate (GET /api/auth/device -> 401)
OK    apps page (scripts/fetch-apps.sh) -> 200
== Access from the internet (https://jams.jaybi.uz:9443, https://jams.jaybi.uz:8443)
OK    JAMS: GET / -> 200, certificate trusted by the phone apps
OK    certificate valid until Jan 26 05:28:09 2027 GMT (Caddy renews it 30 days ahead)
OK    user 'alice' can log in
OK    JAMS administration is refused (403)
OK    JAMS setup is refused (404)
OK    web client: GET / -> 200
OK    apps page
OK    port 8081 for Let's Encrypt answers
```

Without access from the internet (`TURN_EXTERNAL_IP` empty), the TURN
check relays 20 messages between two allocations instead.

Equivalent manual checks:

```sh
curl --cacert certs/jams-root.crt https://192.168.1.92/          # JAMS UI
# without TURN_EXTERNAL_IP; behind the router, coturn refuses the relay
# (403 Forbidden IP), as it does any relay to a private address
docker compose exec coturn sh -c 'turnutils_uclient -p "$TURN_PORT" \
  -u "$TURN_USER" -w "$TURN_PASSWORD" -r "$TURN_REALM" -y 192.168.1.92'
curl http://192.168.1.92:8000/node/info                          # DHT proxy
```

For the device path (client certificate, contacts, messages, calls)
run `ci/daemon/jams-e2e.sh`, described in `CLIENT-SETUP.md`.

## TLS

Currently `JAMS_TLS=internal`: Caddy issues a certificate for
`192.168.1.92` from its own CA. Clients must trust
`deploy/certs/jams-root.crt`:

- Linux: copy it to `/usr/local/share/ca-certificates/jams-root.crt`,
  then run `update-ca-certificates`
- A phone's browser (the web client): on Android, Settings → Security →
  Install a certificate → CA certificate; on iOS, install it as a profile,
  then turn on full trust in Settings → General → About → Certificate
  Trust Settings.
- In containers: copy it into the image's CA store the same way as on Linux.

The Android and iOS apps cannot use it. Their daemon trusts only the CA
list bundled in the app (`cacert.pem`, which the app sets as
`CA_ROOT_FILE`), not the phone's certificate store, so they sign in only
once JAMS has a Let's Encrypt certificate (below).

Clients that connect by IP send no SNI, so the Caddyfile sets
`default_sni`.

**Device certificates.** After signing in, a Jami device gets its JAMS
device token from `POST /api/login` with its client certificate, which
it needs for contact and conversation sync. Behind a reverse proxy, JAMS
reads that certificate from the `X-Client-Cert` header, URL-decoded
(nginx's `$ssl_client_escaped_cert`). The Caddyfile therefore:

- requests a client certificate without requiring one
  (`client_auth { mode request }`), so the web UI still works;
- sets `X-Client-Cert` to the certificate in base64 DER with `+` sent as
  `%2B`, and only when there is one: if the header is present, even
  empty, JAMS skips username/password login. Any `X-Client-Cert` sent by
  a client is removed first;
- turns off `strict_sni_host`: with `client_auth` on, Caddy otherwise
  answers 421 whenever `Host` differs from the SNI, which is every
  request by IP.

Without this every device gets 401 from `/api/login`, and contact
requests between JAMS users do not arrive.

To switch to **Let's Encrypt** when you have a domain:

1. Create a DNS record `jams.example.org → <public IP>` and forward
   443/tcp to this host. For TURN, also forward 3479/udp+tcp and
   49160-49200/udp, and set `TURN_EXTERNAL_IP`. For the DHT, forward
   4222/udp and 8000/tcp.
2. In `.env`, set `JAMS_HOST=jams.example.org` and `JAMS_TLS=you@example.org`.
3. `docker compose up -d caddy`, then `sh scripts/jams-setup.sh`. The
   blueprint then points at the new host.
4. JAMS stores its public URL from installation in
   `/home/jams/data/config.json`: `serverPublicURI`, and `serverDomain`
   inside the `caConfiguration` JSON string. The admin UI only shows these
   in the setup wizard. Edit both in the `jams-data` volume (for example
   with `docker compose exec jams vi /home/jams/data/config.json`; busybox
   vi is available), then run `docker compose restart jams`.

With port 80 taken by nginx, Caddy uses the TLS-ALPN challenge on 443.
Where the router keeps ports 80 and 443 for other sites, as here, see the
next section instead.

## Access from the internet

The router (Kerio Control at 192.168.1.5) keeps its public ports 80 and
443 for its own reverse proxy, which serves other sites
(dechat.systemhost.uz, ...). That proxy decrypts the connection, which
would drop the client certificate a Jami device logs in with. So JAMS and
the web client get their own ports, which the router forwards to this host
unchanged, at the public name `jams.jaybi.uz` (a CNAME to
dechat.systemhost.uz, the router's address 5.133.122.43):

| Address | What | Router |
|---------|------|--------|
| `https://jams.jaybi.uz:9443` | JAMS for the apps: sign-in, device certificates, contacts and conversations, names. In a browser, each user's own profile, devices and contacts. Its administration (`/api/admin/*`, 403) and setup (`/api/install/*`, 404) stay on the LAN, at `https://192.168.1.92` | TCP 9443 |
| `https://jams.jaybi.uz:8443` | The web client, and the apps page at `/downloads/` | TCP 8443 |
| `jams.jaybi.uz:3479`, relays 49160-49200 | TURN | TCP and UDP 3479, UDP 49160-49200 |
| `jams.jaybi.uz:8000` | DHT proxy | TCP 8000 |
| port 4222 | DHT node | UDP 4222 |
| `http://jams.jaybi.uz` | Let's Encrypt's HTTP challenge, which the router's reverse proxy passes on to port 8081 | reverse proxy rule |

On the LAN the router's DNS answers `jams.jaybi.uz` with 192.168.1.92, so
devices use the same addresses at home and outside, and at home they reach
this host directly. The router does not pass traffic for its public address
back into the LAN.

**Router** (Kerio Control administration, https://192.168.1.5:4081):

1. Proxy Server → Reverse Proxy: a rule for host `jams.jaybi.uz`, protocol
   HTTP only, server `192.168.1.92:8081`, without "Use secured
   connection", HTTPS redirection or antivirus; above any rule for `*`.
2. Traffic Rules: source Internet interfaces, destination Firewall,
   services TCP 9443, TCP 8443, TCP and UDP 3479, UDP 49160-49200, UDP
   4222, TCP 8000, action Allow, translation Destination NAT to
   192.168.1.92 with the ports unchanged; above the rule that blocks the
   rest. Never 80 or 443: they belong to the router's other sites.
3. DNS: `192.168.1.92 jams.jaybi.uz` in the hosts table, then clear the
   DNS cache.
4. DHCP Server: reserve 192.168.1.92 for this host (MAC
   `bc:24:11:9e:9f:21`): coturn and the blueprint depend on it.

**Server**, from `deploy/`:

1. In `.env`: `COMPOSE_FILE=docker-compose.yml:docker-compose.public.yml`,
   `PUBLIC_HOST=jams.jaybi.uz` (`JAMS_PUBLIC_PORT` defaults to 9443) and
   `TURN_EXTERNAL_IP=5.133.122.43/192.168.1.92`.
2. `docker compose up -d`: Caddy serves `caddy/sites/public.caddy` and gets
   the certificate from Let's Encrypt through the router's port 80 (the
   TLS-ALPN challenge is off: port 443 is the router's). It renews it 30
   days ahead.
3. JAMS's public URL, which goes into the OCSP and CRL addresses of every
   device certificate it issues: set `serverPublicURI` and the
   `serverDomain` inside `caConfiguration` to `https://jams.jaybi.uz:9443`
   in `/home/jams/data/config.json` (see "Let's Encrypt" above), then
   `docker compose restart jams`. Certificates issued before keep the LAN
   address: away from home, devices skip that check when it fails.
4. `sh scripts/jams-setup.sh`: the blueprint gives devices TURN and the DHT
   proxy at `jams.jaybi.uz`.
5. `sh scripts/fetch-apps.sh`: the apps page gives the public addresses.
6. `sh scripts/verify.sh`: its "Access from the internet" part checks the
   public addresses through this host, with the certificate authorities the
   phone apps ship with. It does not go through the router: to check the
   port forwarding, open `https://jams.jaybi.uz:8443` on a phone on mobile
   data.

**TURN behind the router.** coturn opens relays on 192.168.1.92 and gives
clients 5.133.122.43 as their relay address, which the router forwards
back. It relays nothing to private or reserved addresses
(`coturn/entrypoint.sh`): every device gets the TURN credentials from the
blueprint, and the web client gives them to every browser, so a relay must
not reach into the LAN or into this host's other services. Given as
`PUBLIC/PRIVATE` in one `--external-ip`, coturn would allow every port of
192.168.1.92 (`mainrelay.c`: "Whitelisting external-ip private part"), so
the entrypoint passes the two parts as `--external-ip` and `--relay-ip`.
What this leaves out:

- Devices on the LAN connect to each other directly, not through relays.
  A device outside reaches one on the LAN through the relay of the LAN
  device.
- Two relays of this server cannot reach each other, since the router does
  not pass traffic for its public address back in. A call where neither
  side can reach the other except through relays fails.
- For the same reason, Docker networks on this host that are isolated
  from each other no longer reach each other through TURN: a container
  with a Jami daemon that talks to the web client's daemon belongs on its
  network (`jami_default`).

**Using it.** People sign in with their JAMS user name and password:

| App | Address |
|-----|---------|
| Web client | `https://jams.jaybi.uz:8443` |
| Android, iOS and desktop apps: Advanced features → Connect to management server | `https://jams.jaybi.uz:9443`, typed in full |
| Apps | `https://jams.jaybi.uz:8443/downloads/` |
| Your devices (revoke a lost one there) and contacts | `https://jams.jaybi.uz:9443` in a browser |
| JAMS administration (users, devices) | `https://192.168.1.92`, on the LAN only |

On Android at home, a "Private DNS" setting makes the phone ask a public
DNS server, which answers with the router's public address: turn it off.
`https://jams.jaybi.uz` without a port shows the router's own page.

## Operations

```sh
docker compose logs -f jams          # or caddy / coturn / dhtnode
docker compose restart jams
docker compose down                  # stops; volumes stay
docker compose build jams && docker compose up -d jams   # after updating jami-jams/
```
