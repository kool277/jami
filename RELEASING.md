# Releasing

A platform release is a tag `vMAJOR.MINOR.PATCH` on kool277/jami, for
example `v1.0.0`: raise PATCH for fixes only, MINOR for new features and
MAJOR for changes that break deployments or clients. Each component in it
has its own version, `v<upstream version>-kool277.<n>`, so that it can be
compared with upstream (review.jami.net):

| Component | Upstream version | Example |
|-----------|------------------|---------|
| jami-daemon | `version` of meson.build or CMakeLists.txt, the higher one (upstream bumps only meson.build now) | `v17.0.0-kool277.1` |
| jami-client-qt | the newest upstream `beta/<timestamp>` tag in its history: it has no version in its sources | `v202609211303-kool277.1` |
| jami-client-android | `versionCode` of jami-android/app/build.gradle.kts (upstream tags `android/release_<versionCode>`) | `v505-kool277.1` |
| jami-client-ios | the highest `MARKETING_VERSION` of Ring/Ring.xcodeproj | `v4.20-kool277.1` |
| jami-jams | `<revision>` of pom.xml | `v3.8-kool277.1` |
| jami-web | `version` of package.json | `v1.0.0-kool277.1` |
| jami-plugins-store | `version` of package.json | `v1.0.0-kool277.1` |

`<n>` counts the kool277 releases of one upstream version, from 1. A
component that did not change since the previous platform release keeps
its version and its release. `VERSIONS` lists the version of each
component at its pinned commit; `ci/release/versions.sh` writes it and
`ci/release/platform-release.sh` tags the components from it.

Jenkins turns a platform tag into a GitHub release of the workspace and
one per new component version, plus GHCR images (`<version>` is the
component's version):

| Component | Release asset | Image |
|-----------|---------------|-------|
| jami-daemon | `jami-daemon-<version>-linux-x86_64.tar.gz`: jamid, libjami-core.a, headers, jami.pc (prefix `/usr/local`) | |
| jami-client-qt | `jami-client-qt-<version>-linux-x86_64.tar.gz`: bin/jami and share/ (needs Qt 6.12.0 in `/opt/qt/6.12.0/gcc_64`) | |
| jami-client-android | `jami-android-<version>-<flavor>.apk` for the noPush, withFirebase and withUnifiedPush flavors (arm64-v8a, x86_64, armeabi-v7a), signed with the release keystore (`android-keystore` below) | |
| jami-client-ios | `jami-ios-<version>-unsigned.ipa`: the app for devices (arm64), unsigned: it has to be signed with an Apple identity before it installs | |
| jami-jams | `jams-<version>.zip`: the jams folder (jams-launcher.jar) and versions.json | `ghcr.io/kool277/jams:<version>`, `:latest` |
| jami-web | `jami-web-<version>.tar.gz`: jami-web-production with install.sh | `ghcr.io/kool277/jami-web:<version>`, `:latest` |
| jami-plugins-store | `jami-plugins-store-<version>.tar.gz`: the server's sources, to run it without Docker (`npm ci && npm start`, Node.js 18) | `ghcr.io/kool277/jami-plugins-store:<version>`, `:latest` |
| kool277/jami | release notes linking the above, with each component's version, upstream version and commit | |

Every asset has a `.sha256` next to it. The other submodules (dhtnet,
jami-plugins) are listed in the notes with their pins but not built.

jami-client-ios builds on GitHub Actions instead of Jenkins, because an
iOS build needs macOS and Xcode and Jenkins runs on Linux: its
`.github/workflows/kool277.yml` runs on a GitHub-hosted macOS runner
(free for public repositories) by the same rules as the Jenkins
pipelines. Follow it at https://github.com/kool277/jami-client-ios/actions.
Before a platform release, its release path can be tried without
publishing anything: `gh workflow run kool277.yml -R kool277/jami-client-ios
-f platform=main` builds the device app against the daemon that `main`
pins and keeps the `.ipa` as a workflow artifact for a week.

## Prerequisites

Jenkins at http://localhost:8080 with the jobs from `ci/jenkins/setup.sh`
(see that script): the plugins of `ci/jenkins/plugins.txt`, the
credentials below, the `jenkins` user in the `docker` group, and write
access to `/var/cache/jami`. `ci/jenkins/setup.sh status` shows what is
missing. The credentials (all in System > Global credentials
(unrestricted), the only store the jobs can read):

- `github-kool277`, for the scans and the GitHub releases: the GitHub
  App installed on the kool277 repositories, or kool277 + a token with
  `repo`.
- `ghcr-kool277`, for the GHCR images: kool277 + a personal access
  token (classic) with `write:packages`. A GitHub App token cannot
  create packages on GHCR.
- `android-keystore` (secret file: the release keystore, PKCS12),
  `android-keystore-password`, `android-key-alias` and
  `android-key-password` (secret texts), for signing the Android APKs.
  Make the keystore once and keep it and its passwords backed up
  outside the server: Android only installs an update over an app
  signed with the same key, so a lost keystore means every member has
  to uninstall and reinstall. From the workspace:

  ```sh
  mkdir -p -m 700 ~/secure
  docker run --rm -it -u "$(id -u):$(id -g)" -e HOME=/tmp -v ~/secure:/out jami-android-build \
      keytool -genkeypair -v -keystore /out/jami-release.jks -storetype PKCS12 \
      -alias jami -keyalg RSA -keysize 4096 -validity 10000
  ```

  (`jami-android-build` is the image the Android pipeline builds; it has
  a JDK.) keytool asks for the keystore password and the owner's name;
  with PKCS12 the key password is the keystore password. Then add the
  four credentials in Jenkins and the next `v*` tag ships signed APKs.

## Release

1. Merge the component changes through pull requests on kool277/<name>.
2. Move the workspace to those commits and check what will ship:

   ```sh
   ci/release/bump-pins.sh            # stages the new pins and VERSIONS, prints them
   git commit -m "workspace: bump components for v1.0.0"
   git push origin main
   DRY_RUN=1 ci/release/platform-release.sh v1.0.0   # preview
   ```

   Wait for the `jami` job's build of `main` (it checks that every pin
   exists on its remote).
3. Tag and push:

   ```sh
   git tag -a v1.0.0 -m "Jami platform v1.0.0"
   git push origin v1.0.0
   ```

What follows:

- the `jami` job builds the tag and runs `ci/release/platform-release.sh`:
  it tags each component with its version from `VERSIONS`, at its pinned
  commit, and creates the kool277/jami release. The message of each
  component tag names the platform release (`Platform: v1.0.0`): the
  component pipeline builds with the CI scripts and pins of that release;
- the component jobs build those tags (they build tags created in the last
  7 days) and their Release stages upload the assets and push the images.

Jenkins receives GitHub's push events, so these builds start at once (the
jobs also scan GitHub every 5 minutes). Follow them at
http://localhost:8080/job/<job>/view/tags/. A tag build starts from an
empty workspace (it is wiped when the build ends), so it builds the
daemon's contrib: about 15 minutes for jami-daemon, longer for
jami-client-qt and jami-client-android.

## Fixing or rolling back

- **A component stage failed**: fix the cause and rebuild that tag in
  Jenkins (Build Now on the tag). The Release stages are idempotent: they
  reuse an existing GitHub release and replace its assets. A rebuild uses
  the CI scripts of the platform release named in the tag, so when the fix
  is in `ci/` of kool277/jami, release again instead: commit the fix, run
  `RENEW=<component> ci/release/bump-pins.sh` (the component gets the next
  `<n>` on the same commit) and tag the next patch version.
- **The release itself is bad**: do not move tags. Fix on `master` of the
  component, bump the pins and release the next patch version (`v1.0.1`),
  in which the fixed component gets the next `<n>`. `platform-release.sh`
  refuses a component tag that points elsewhere than the pinned commit.
- **Roll back the server in `deploy/`**: it builds JAMS from the
  `jami-jams` submodule, so check out the previous release and rebuild:

  ```sh
  git checkout v1.0.0 && git submodule update jami-jams
  cd deploy && docker compose up -d --build jams
  ```

- **Roll back `:latest` on GHCR** (for deployments that pull it): point it
  at the previous version. The packages are public (pulls need no login;
  only pushes do), set once in each package's settings on GitHub.

  ```sh
  docker pull ghcr.io/kool277/jams:v3.8-kool277.1
  docker tag ghcr.io/kool277/jams:v3.8-kool277.1 ghcr.io/kool277/jams:latest
  docker push ghcr.io/kool277/jams:latest    # after docker login ghcr.io
  ```

- **Withdraw a release**: `gh release edit <tag> --repo kool277/<name> --prerelease`
  marks it as not for use; `gh release delete` removes it, keeping the tag.
