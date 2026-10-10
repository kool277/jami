# Server side: JAMS, coturn, dhtnode, Caddy

Everything runs from `deploy/` with Docker Compose on `jami-server`
(192.168.1.92).

| Service | Image | Host port(s) | Role |
|---------|-------|--------------|------|
| `jams` | `jams:local`, built from `jami-jams/` (`--target prod`) | none (8080 inside the network) | Jami Account Management Server: accounts, name lookup, policies |
| `caddy` | `caddy:2.10.2-alpine` | 443/tcp | TLS reverse proxy for JAMS |
| `coturn` | `coturn/coturn:4.6.3` | 3479/udp+tcp, relays 49160-49200/udp (host network) | TURN server pushed to clients by JAMS |
| `dhtnode` | `jami-dhtnode:local` (Ubuntu 24.04 `dhtnode`, OpenDHT 3.0) | 4222/udp (DHT), 8000/tcp (proxy) | DHT node and DHT proxy pushed to clients by JAMS |

These existing host services are left untouched: `coturn.service` (3478),
`nginx` (80), `asterisk`, `postgresql`, `jenkins` (8080). Caddy
therefore serves HTTPS only and has no port 80 listener.

## Configuration

```sh
cd deploy
cp .env.example .env     # .env is git-ignored
chmod 600 .env
# fill in JAMS_ADMIN_PASSWORD, JAMS_TEST_PASSWORD, TURN_PASSWORD, e.g.
#   openssl rand -hex 16
```

| Variable | Meaning |
|----------|---------|
| `JAMS_HOST` | Address clients use for JAMS (IP or DNS name). Also used as the TURN and DHT proxy host in the blueprint. |
| `JAMS_TLS` | `internal` = Caddy's local CA; an e-mail address = Let's Encrypt |
| `JAMS_ADMIN_USER` / `JAMS_ADMIN_PASSWORD` | JAMS administrator |
| `JAMS_TEST_USERS` / `JAMS_TEST_PASSWORD` | Test users (comma-separated) |
| `TURN_REALM`, `TURN_USER`, `TURN_PASSWORD`, `TURN_PORT`, `TURN_MIN_PORT`, `TURN_MAX_PORT` | coturn (long-term credentials). Keep `TURN_REALM=ring`: JAMS does not push `TURN.realm`, and Jami clients default to `ring`, so any other realm makes their TURN authentication fail. |
| `TURN_EXTERNAL_IP` | Public IP when clients reach the host through NAT |
| `DHT_PORT`, `DHT_PROXY_PORT`, `DHT_BOOTSTRAP` | OpenDHT node |

## Start

```sh
docker compose up -d --build
docker compose ps          # all four: running (healthy)
sh scripts/export-ca.sh    # Caddy root CA -> certs/jams-root.crt
sh scripts/jams-setup.sh   # JAMS setup wizard + blueprint + users
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

JAMS reads its state from its working directory, which also holds its
jars. `deploy/jams/entrypoint.sh` therefore runs JAMS from the volume
and copies the image's jars into it on every start. Rebuilding the
image upgrades JAMS and keeps its data. Back up by stopping `jams`
and copying `jami_jams-data`.

## JAMS setup

`scripts/jams-setup.sh` makes the same REST calls as the web setup
wizard. Re-running it is safe: finished steps are skipped and the
blueprint is updated.

| Wizard page (https://192.168.1.92/) | REST call | Values |
|------------------------------|-----------|--------|
| 1. Create admin account | `PUT /api/install/start` | `JAMS_ADMIN_USER` / `JAMS_ADMIN_PASSWORD` |
| 2. Certificate authority | `POST /api/install/ca` | CN `Jami <JAMS_HOST>`, O `Jami`, 10 years |
| 3. User database | `POST /api/install/auth` | Local database (no LDAP/AD) |
| 4. Server parameters | `POST /api/install/settings` | Domain `https://<JAMS_HOST>:443`, behind a reverse proxy, SHA512WITHRSA, device and user certificates 1 year, CRL 5 min |
| Blueprints → new `jami-default` | `POST`/`PUT /api/admin/policy?name=jami-default` | TURN: custom, `<JAMS_HOST>:3479`, `TURN_USER`/`TURN_PASSWORD`. DHT proxy: custom, `<JAMS_HOST>:8000`. UPnP, peer discovery and video on |
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

## Verification (`scripts/verify.sh`)

```
== JAMS over HTTPS (https://192.168.1.92:443)
OK    GET / -> 200, certificate verified
      issuer=CN = Caddy Local Authority - ECC Intermediate
      X509v3 Subject Alternative Name: critical
          IP Address:192.168.1.92
OK    user 'alice' can log in
      turnEnabled=true turnServer=192.168.1.92:3479 turnServerUserName=jami turnServerPassword=(set)
      proxyEnabled=true proxyServer=192.168.1.92:8000
OK    blueprint 'jami-default' pushes TURN and DHT proxy
== TURN allocation (192.168.1.92:3479)
OK    allocation succeeded, 20 messages relayed, 0 lost
OK    wrong password is rejected
== DHT proxy (http://192.168.1.92:8000)
      node_id=8dadb2ef… ipv4 good=12 dubious=27
OK    proxy answers and the node has DHT peers
```

Equivalent manual checks:

```sh
curl --cacert certs/jams-root.crt https://192.168.1.92/          # JAMS UI
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
- Android: Settings → Security → Install a certificate → CA certificate
- In containers: copy it into the image's CA store the same way as on Linux.

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

## Operations

```sh
docker compose logs -f jams          # or caddy / coturn / dhtnode
docker compose restart jams
docker compose down                  # stops; volumes stay
docker compose build jams && docker compose up -d jams   # after updating jami-jams/
```
