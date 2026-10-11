# Building jami-client-qt

`jami-client-qt/` builds in a container (`ci/client-qt/Dockerfile`)
layered on the daemon build image (`ci/daemon`, Ubuntu 24.04). The
whole workspace is bind-mounted, and `jami-daemon/` is mounted again
over the client's (uninitialized) `daemon` submodule, so the client
builds libjami from the same tree and contrib as `ci/daemon/run.sh`
(see `DAEMON-BUILD.md`).

| Host path | Container path | Contents |
|-----------|----------------|----------|
| workspace root | `/src` | working directory `/src/jami-client-qt`: source, `build/`, `install/` |
| `jami-daemon/` | `/src/jami-client-qt/daemon` | the client's `daemon` submodule |
| `/var/cache/jami` | `/var/cache/jami` | contrib tarballs (`TARBALLS`), Rust crates (`CARGO_HOME`) |
| `ci/client-qt/` | `/ci` (read-only) | helper scripts |

Both containers must see the daemon at `/src/jami-daemon`: contrib's
installed CMake and pkg-config files record absolute paths, and the
two containers share `jami-daemon/contrib/x86_64-linux-gnu/`.

## Build

Build the daemon first (`ci/daemon/run.sh`, about 15 minutes the first
time), then:

```sh
ci/client-qt/run.sh
```

With no arguments it builds the images `jami-daemon-build` and
`jami-client-qt-build` (cached after the first time; the client image
is about 5 GB, most of it Qt) and runs `ci/client-qt/ci-build.sh`:

```sh
cmake -S . -B build -GNinja -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_INSTALL_PREFIX="$PWD/install" -DCMAKE_PREFIX_PATH="$QT_ROOT" \
    -DBUILD_TESTING=On
cmake --build build -j16
cmake --install build
```

`SKIP_IMAGE_BUILD=1` skips the two `docker build` steps; `JOBS=<n>`
changes the parallelism. On this machine (32 threads, 31 GB RAM) the
client build, with the daemon already built, took about 5 minutes.

Outputs: `jami-client-qt/build/` (build tree, `tests/qml_tests`,
`tests/unit_tests`) and `jami-client-qt/install/` (`bin/jami`, the test
binaries, `share/jami/translations/`).

## Tests

```sh
ci/client-qt/run.sh sh /ci/ci-test.sh
```

This runs the two CTest suites in sequence, as upstream CI does: both
use `/tmp/jami_test` and wipe it at startup. Both suites run even if the
first fails, and their results also go to `build/qml-tests.xml` and
`build/unit-tests.xml` (JUnit).
To run one suite, or a subset:

```sh
SKIP_IMAGE_BUILD=1 ci/client-qt/run.sh ctest --test-dir build/tests -V -R '^Unit_Tests$'
SKIP_IMAGE_BUILD=1 ci/client-qt/run.sh sh -c \
    'cd build/tests && ./unit_tests --gtest_filter="ApiServerFixture.*"'
SKIP_IMAGE_BUILD=1 ci/client-qt/run.sh sh -c \
    'cd build/tests && ./qml_tests -input /src/jami-client-qt/tests/qml/src/tst_CallPipWindowManager.qml'
```

`ci-test.sh` passes `--mutejamid`; running a binary directly as above
shows the daemon log.

## Results (2026-10-10)

Qt 6.12.0, VM with the host CPU model passed through.

| Suite | Result |
|-------|--------|
| Daemon smoke tests (`DAEMON-BUILD.md`) | 4/4 |
| `Unit_Tests` | 111/111, in repeated runs |
| `Qml_Tests` | 196 cases; all pass in most runs, see below |

Known intermittent failures:

- **`CallPipWindowContent::test_popInButtonDeactivatesPip`,
  `CallPipWindowManager::test_accountSwitch_doesNotClosePip`** fail
  together in some runs. The test call from Alice to Bob (two accounts
  in the same daemon) ends after about 0.5 s with SIP 480: the SIP
  channel to Bob's device is not established. The PiP manager closes
  PiP when its call ends, so when that lands while a test is checking,
  the test sees an extra `isPipActiveChanged` or finds PiP already
  closed. Both pass when the file runs alone. A fix belongs in the
  tests (keep the call alive or wait for it to connect).
- **`Create Sip account ui flow::test_createSipAccountUiFlow`** failed
  once in several runs (`testServerName` field empty). Not investigated.
- **`ApiServerFixture.Nameserver*`** query ns.jami.net over the
  network. In one run every lookup failed within milliseconds (the
  daemon logs `failed with code=0`) and these tests failed; the API
  then reported the failure as 404. Since `89b38cc6` such failures
  return 502, covered by the `*UnreachableServerReturns502` tests,
  which use a closed local port and do not need the network.

`--network host` does not help: the PiP pair still fails
intermittently, and `PreviewEngineFixture` aborts the unit suite
because its fixed port is already in use on the host. The containers
use Docker's default bridge network.

## Differences from extras/build/docker/Dockerfile.client-qt-gnulinux

- **Base image**: `jami-daemon-build` instead of `ubuntu:24.04`; it
  already has the daemon build dependencies, which upstream's file
  lists again.
- **Qt 6.12.0 from the Qt online repository** (aqtinstall 3.3.0, in
  `/opt/qt/6.12.0/gcc_64`) instead of the `libqt-jami` package, which
  is still 6.10.x. Modules: qt5compat, qtmultimedia, qtpositioning,
  qthttpserver, qtwebsockets, qtwebengine, qtwebchannel,
  qtimageformats, qtshadertools, qtpdf. Hence the added Qt runtime
  libraries (`libxcb-*`, `libxkbcommon-x11-0`, `libegl1`, `libgbm1`,
  `libopengl0`, `libfontconfig1`, `libdrm2`, …) and `python3-venv`.
- **gsettings-desktop-schemas**: without it the QML tests abort with
  SIGTRAP on `Settings schema 'org.gnome.desktop.interface' is not
  installed`.
- **pandoc, clang-format**.
- Offscreen, software-rendering environment (`QT_QPA_PLATFORM`,
  `QT_QUICK_BACKEND`, `QTWEBENGINE_CHROMIUM_FLAGS`).

## Troubleshooting

**CMake: `Imported target "restinio::restinio" includes non-existent
path "/src/contrib/x86_64-linux-gnu/include"`** (also `PkgConfig::dhtnet`,
`opendht`, `git2`). The daemon contrib was built with `jami-daemon/`
mounted at `/src`, the layout before `3e50e4d0`. Rebuild it with the
current `ci/daemon/run.sh` (tarballs stay cached):

```sh
rm -rf jami-daemon/contrib/x86_64-linux-gnu jami-daemon/contrib/build-x86_64-linux-gnu \
    jami-daemon/build jami-client-qt/build
ci/daemon/run.sh && ci/client-qt/run.sh
```

**Expected log noise**: no PulseAudio (falls back to ALSA), no sound
card, `dbus not connected`, NetworkManager unavailable, UPnP mapping
failures, spell-check dictionary download failures, and
`Unknown key "software" for QSG_RHI_BACKEND`.
