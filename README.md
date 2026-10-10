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
| `jami-client-ios/` | [kool277/jami-client-ios](https://github.com/kool277/jami-client-ios) | macOS only |
| `jami-web/` | [kool277/jami-web](https://github.com/kool277/jami-web) | Uses `JAMI_DAEMON_DIR=../jami-daemon` |
| `jami-jams/` | [kool277/jami-jams](https://github.com/kool277/jami-jams) | Account management server |
| `dhtnet/` | [kool277/dhtnet](https://github.com/kool277/dhtnet) | Reference; the daemon builds its own via contrib |
| `jami-plugins/` | upstream [jami-plugins](https://review.jami.net/jami-plugins) | Upstream directly: its history has model files over GitHub's 100 MB limit |
| `jami-nameservice/` | upstream [jami-nameservice](https://review.jami.net/jami-nameservice) | Reference only; JAMS serves name lookup |

Each kool277 repository carries upstream's history
(`https://review.jami.net/<name>`, remote `upstream`); kool277 changes
go to `master` through pull requests. The clients' `daemon` submodules
point at kool277/jami-daemon.

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

Build, deployment and release docs: `docs/`, `deploy/`, `ci/`.
