# jami

Self-hosted Jami platform: daemon, clients, JAMS account server, TURN
and DHT bootstrap/proxy. This workspace pins every component as a git
submodule and holds the server deployment (`deploy/`), the build
containers (`ci/`) and the documentation (`docs/`).

## Layout

| Directory | Repository | Notes |
|-----------|------------|-------|
| `jami-daemon/` | [kool277/jami-daemon](https://github.com/kool277/jami-daemon) | Core (libjami + jamid); the daemon every build here uses |
| `jami-client-qt/` | [kool277/jami-client-qt](https://github.com/kool277/jami-client-qt) | Desktop client |
| `jami-client-android/` | [kool277/jami-client-android](https://github.com/kool277/jami-client-android) | |
| `jami-client-ios/` | [kool277/jami-client-ios](https://github.com/kool277/jami-client-ios) | Builds on macOS only: on GitHub Actions, not Jenkins |
| `jami-web/` | [kool277/jami-web](https://github.com/kool277/jami-web) | Web client; its server uses the prebuilt `@savoirfairelinux/jami-core` npm package |
| `jami-jams/` | [kool277/jami-jams](https://github.com/kool277/jami-jams) | Account management server |
| `jami-plugins-store/` | [kool277/jami-plugins-store](https://github.com/kool277/jami-plugins-store) | Plugin store server (the API of plugins.jami.net); branch `main`, as upstream's |
| `dhtnet/` | [kool277/dhtnet](https://github.com/kool277/dhtnet) | Reference; the daemon builds its own via contrib |
| `jami-plugins/` | upstream [jami-plugins](https://review.jami.net/jami-plugins) | Upstream directly: its history has model files over GitHub's 100 MB limit |

Each kool277 repository carries upstream's history
(`https://review.jami.net/<name>`, remote `upstream`); kool277 changes
go to `master` (`main` for jami-plugins-store) through pull requests. The clients' `daemon` submodules
point at kool277/jami-daemon.

## Architecture

```
 desktop / Android / iOS / web clients (each runs jami-core: libjami)
      |  account, name lookup,       |  calls and messages: DHT +
      |  device certificates         |  ICE, relayed by TURN if needed
      v                              v
 caddy :443 (TLS, client certs) -> JAMS     dhtnode :4222/udp, proxy :8000
                                            coturn :3479, relays 49160-49200/udp
```

JAMS manages accounts and pushes the TURN server, DHT bootstrap and DHT
proxy settings to the clients it enrolls. Everything server-side runs
from `deploy/` with Docker Compose on `jami-server` (192.168.1.92).

| Port | Service |
|------|---------|
| 443/tcp | Caddy, TLS proxy for JAMS |
| 3479/udp+tcp, 49160-49200/udp | coturn (TURN) |
| 4222/udp | dhtnode (DHT) |
| 8000/tcp | dhtnode (DHT proxy) |
| 8080/tcp | Jenkins (public as https://dechat.systemhost.uz/) |

The host's own `coturn.service` (3478), nginx (80), asterisk, PostgreSQL
and Jenkins are left as they are.

## Build, run, test

| What | How | Docs |
|------|-----|------|
| Daemon | `ci/daemon/run.sh` (build container, contrib cache in `/var/cache/jami`) | `docs/DAEMON-BUILD.md` |
| Desktop client | `ci/client-qt/run.sh` (builds against `jami-daemon/`) | `docs/CLIENT-QT-BUILD.md` |
| Server side | `cd deploy && docker compose up -d --build`, then `scripts/jams-setup.sh`, `scripts/verify.sh` | `docs/SERVER-SETUP.md` |
| Client against JAMS | enroll a device, end-to-end check `ci/daemon/jams-e2e.sh` | `docs/CLIENT-SETUP.md` |

## CI and releases

Jenkins runs one multibranch job per repository, each from its
`Jenkinsfile.kool277` (upstream CI files are untouched); the scripts
they run live in `ci/` here and are fetched from `main` at build time.

| Job | Builds |
|-----|--------|
| [jami-daemon](https://dechat.systemhost.uz/job/jami-daemon/) | jamid + libjami, smoke tests, D-Bus check |
| [jami-client-qt](https://dechat.systemhost.uz/job/jami-client-qt/) | client, unit and QML tests, package |
| [jami-client-android](https://dechat.systemhost.uz/job/jami-client-android/) | unsigned release APKs (3 ABIs, 3 push flavors), libjamiclient unit tests |
| [jami-jams](https://dechat.systemhost.uz/job/jami-jams/) | lint, `mvn verify`, image `ghcr.io/kool277/jams` |
| [jami-web](https://dechat.systemhost.uz/job/jami-web/) | lint, image, smoke test, image `ghcr.io/kool277/jami-web` |
| [jami-plugins-store](https://dechat.systemhost.uz/job/jami-plugins-store/) | lint, jest tests, smoke test, image `ghcr.io/kool277/jami-plugins-store` |
| [jami](https://dechat.systemhost.uz/job/jami/) | checks every submodule pin; platform release on `v*` tags |

jami-client-ios needs macOS and Xcode, so it builds on a GitHub-hosted
macOS runner instead, by the same rules (simulator build and unit tests,
an unsigned `.ipa` for its releases):
https://github.com/kool277/jami-client-ios/actions.

Pull requests are built too. A `v*` tag on this repository releases
the platform: see `RELEASING.md`.

## What only the owner can do

- A real domain and public TLS certificate for JAMS (Caddy uses its
  internal CA now; see `docs/SERVER-SETUP.md`, TLS).
- FCM (Android) and APNs (iOS) keys for mobile push notifications.
- iOS builds, which need a Mac with Xcode.
- An Android signing keystore, stored as a Jenkins credential, for
  signed APKs.

## Clone

```sh
git clone https://github.com/kool277/jami.git
cd jami
git submodule update --init
git -C jami-client-qt submodule update --init --recursive \
    3rdparty/hunspell 3rdparty/md4c 3rdparty/tidy-html5 3rdparty/zxing-cpp
```

Do not use `--recursive` at the top level: it would clone the daemon
again inside every client (and the plugins' dependencies). In this
workspace the clients' `daemon` submodules stay uninitialized;
`ci/client-qt/run.sh` mounts `jami-daemon/` in their place, so all
builds share one daemon tree and its contrib. dhtnet's own
dependencies (`git -C dhtnet submodule update --init`) are only needed
to build dhtnet on its own.

## Updating a component

1. In the component, `git fetch upstream` and merge `upstream/master`
   into a branch; open a pull request on kool277/<name> and merge it.
2. Here, check out the new `master` in the submodule and commit the new
   pin with `git add <dir>`.

Build, deployment and CI docs: `docs/`, `deploy/`, `ci/`. Releases:
`RELEASING.md`.
