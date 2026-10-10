# jami

Self-hosted Jami platform: daemon, clients, JAMS account server, TURN
and DHT bootstrap/proxy, built and released from this single repository.

## Layout

| Directory | Upstream | Notes |
|-----------|----------|-------|
| `jami-daemon/` | `jami-daemon` | Core (libjami + jamid). The only daemon copy. |
| `jami-client-qt/` | `jami-client-qt` | Desktop client; `daemon -> ../jami-daemon` |
| `jami-client-android/` | `jami-client-android` | `daemon -> ../jami-daemon` |
| `jami-client-ios/` | `jami-client-ios` | macOS only; `daemon -> ../jami-daemon` |
| `jami-web/` | `jami-web` | Uses `JAMI_DAEMON_DIR=../jami-daemon` |
| `jami-jams/` | `jami-jams` | Account management server |
| `dhtnet/` | `dhtnet` | Reference; the daemon builds its own via contrib |
| `jami-plugins/` | `jami-plugins` | `daemon -> ../jami-daemon` |
| `jami-nameservice/` | `jami-nameservice` | Reference only; JAMS serves name lookup |

Components are plain directories (no submodules, no upstream remotes).
Each keeps its own `.gitignore`; new upstream files matching those
patterns must be added with `git add -f`.

Build, deployment and release docs: `docs/`, `deploy/`, `ci/`.
