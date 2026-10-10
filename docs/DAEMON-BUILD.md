# Building jami-daemon

`jami-daemon/` is the only daemon source in this workspace; the clients'
`daemon/` directories are symlinks to it. It builds in a container
(`ci/daemon/Dockerfile`, Ubuntu 24.04) with the source bind-mounted, so
`build/`, the contrib tree and the tarball cache persist between runs.

| Host path | Container path | Contents |
|-----------|----------------|----------|
| `jami-daemon/` | `/src` | source, `build/`, `contrib/x86_64-linux-gnu/` |
| `/var/cache/jami` | `/var/cache/jami` | contrib tarballs (`TARBALLS`), Rust crates (`CARGO_HOME`) |
| `ci/daemon/` | `/ci` (read-only) | helper scripts |

The container runs as the calling user, so no file in the tree is
owned by root.

## One-time setup

```sh
sudo mkdir -p /var/cache/jami
sudo chown "$USER" /var/cache/jami
```

## Build

```sh
ci/daemon/run.sh
```

With no arguments it builds the image `jami-daemon-build` (cached after the
first time) and runs:

```sh
mkdir -p build && cd build
cmake .. -GNinja -DJAMI_DBUS=On -DBUILD_TESTING=ON
ninja -j16
```

`JOBS=<n> ci/daemon/run.sh` changes the parallelism. A rebuild with
nothing changed ends with `ninja: no work to do.`

On this machine (32 threads, 31 GB RAM) the first build, contrib
included, took about 15 minutes. CMake builds contrib at configure time
(`BUILD_CONTRIB=ON`): `contrib/build-x86_64-linux-gnu/` holds the build
tree and `contrib/x86_64-linux-gnu/` the installed result. Tarballs go
to `/var/cache/jami` and are never downloaded twice.

Outputs in `jami-daemon/build/`: `jamid` (the D-Bus daemon),
`libjami-core.a`, `jamidst`, the `ut_*` test binaries.

## Smoke tests

```sh
ci/daemon/run.sh ctest --test-dir build \
    -R '^(base64|string_utils|utf8_utils|fileutils)$' --output-on-failure
```

Expected result: `100% tests passed, 0 tests failed out of 4`.

The full suite is large. After a change, run only the relevant tests,
for example `-R '^(account_archive|conversation|namedirectory)$'`;
`ctest --test-dir build -N` lists all of them.

## jamid on D-Bus

```sh
ci/daemon/run.sh dbus-run-session -- sh /ci/dbus-check.sh
```

This starts `build/jamid -c -p` on a private session bus with an empty
profile, waits until it owns `cx.ring.Ring`, lists its objects
(CallManager, ConfigurationManager, Instance, NetworkServiceManager,
PluginManagerInterface, PresenceManager, VideoManager), calls
`ConfigurationManager.getAccountList` and prints `OK`.

To see the version and options:

```sh
ci/daemon/run.sh build/jamid --help
```

```
Jami Core 16.0.0, by Savoir-faire Linux Inc.
[Video support enabled]
[Plugins support enabled]
```

There is no sound card in the container, so jamid logs that PulseAudio
is unavailable and it is falling back to ALSA. That is expected.

## Differences from jami-daemon/Dockerfile

`ci/daemon/Dockerfile` installs the same packages as upstream's
Dockerfile and adds the following:

- **Rust 1.97.1** (rustup, minimal profile): the `yffi` contrib (y-crdt,
  collaborative editing) is built with `cargo`. The upstream package list
  has no Rust, so without it contrib stops with
  `yffi: cargo not found` and CMake reports `None of the required 'yrs' found`.
- **python3, gawk, debianutils**: build tools listed in `BUILD.md`.
- **dbus, dbus-x11**: to run `jamid` for the D-Bus check.
- No `COPY`/build step: the source is bind-mounted instead.

## Troubleshooting

**Link errors in the `ut_*` binaries** (`undefined reference to
ixmlDocument_free`, `UpnpSendAction`, `llhttp_execute`,
`nettle_hmac_sha256_digest`, …) after a configure that failed partway,
such as an earlier contrib error. pkg-config results cached by that
run lack dhtnet's and opendht's dependencies. Remove only the cache and
build again; compiled objects are kept:

```sh
rm jami-daemon/build/CMakeCache.txt
ci/daemon/run.sh
```

**Rebuilding one contrib** (see `jami-daemon/.agents/skills/contrib`):

```sh
ci/daemon/run.sh sh -c 'cd contrib/build-x86_64-linux-gnu && make .<name>'
```
