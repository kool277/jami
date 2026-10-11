# Releasing

A platform release is a `v*` tag on kool277/jami, for example
`v2026.10.10`. Jenkins turns it into a GitHub release of the workspace and
one per component, plus GHCR images:

| Component | Release asset | Image |
|-----------|---------------|-------|
| jami-daemon | `jami-daemon-<tag>-linux-x86_64.tar.gz`: jamid, libjami-core.a, headers, jami.pc (prefix `/usr/local`) | |
| jami-client-qt | `jami-client-qt-<tag>-linux-x86_64.tar.gz`: bin/jami and share/ (needs Qt 6.12.0 in `/opt/qt/6.12.0/gcc_64`) | |
| jami-jams | `jams-<tag>.zip`: the jams folder (jams-launcher.jar) and versions.json | `ghcr.io/kool277/jams:<tag>`, `:latest` |
| jami-web | `jami-web-<tag>.tar.gz`: jami-web-production with install.sh | `ghcr.io/kool277/jami-web:<tag>`, `:latest` |
| kool277/jami | release notes linking the above, with every pinned commit | |

Every asset has a `.sha256` next to it. The other submodules (dhtnet,
jami-client-android, jami-client-ios, jami-plugins, jami-nameservice) are
listed in the notes with their pins but not built.

## Prerequisites

Jenkins at http://localhost:8080 with the jobs from `ci/jenkins/setup.sh`
(see that script): the plugins of `ci/jenkins/plugins.txt`, the
credential `github-kool277` (kool277 + a GitHub token with `repo` and
`write:packages`), the `jenkins` user in the `docker` group, and write
access to `/var/cache/jami`. `ci/jenkins/setup.sh status` shows what is
missing.

## Release

1. Merge the component changes through pull requests on kool277/<name>.
2. Move the workspace to those commits and check what will ship:

   ```sh
   ci/release/bump-pins.sh            # stages the new pins, prints old -> new
   git commit -m "workspace: bump components for v2026.10.10"
   git push origin main
   DRY_RUN=1 ci/release/platform-release.sh v2026.10.10   # preview
   ```

   Wait for the `jami` job's build of `main` (it checks that every pin
   exists on its remote).
3. Tag and push:

   ```sh
   git tag -a v2026.10.10 -m "Jami platform v2026.10.10"
   git push origin v2026.10.10
   ```

What follows, without webhooks (the jobs scan GitHub every 5 minutes):

- the `jami` job builds the tag and runs `ci/release/platform-release.sh`:
  it tags jami-daemon, jami-client-qt, jami-jams and jami-web with
  `v2026.10.10` at their pinned commits and creates the kool277/jami
  release;
- at their next scan the component jobs build those tags (they build tags
  created in the last 7 days) and their Release/Publish stages upload the
  assets and push the images.

Follow it at http://localhost:8080/job/<job>/view/tags/. A first build in
a fresh Jenkins workspace builds the daemon's contrib (about 15 minutes for
jami-daemon, longer for jami-client-qt); later builds reuse it.

## Fixing or rolling back

- **A component stage failed**: fix the cause and rebuild that tag in
  Jenkins (Build Now on the tag). The Release stages are idempotent: they
  reuse an existing GitHub release and replace its assets.
- **The release itself is bad**: do not move tags. Fix on `master` of the
  component, bump the pins and release a new tag (`v2026.10.10.1` or the
  next date). `platform-release.sh` refuses a component tag that points
  elsewhere than the pinned commit.
- **Roll back the server in `deploy/`**: it builds JAMS from the
  `jami-jams` submodule, so check out the previous release and rebuild:

  ```sh
  git checkout v2026.10.09 && git submodule update jami-jams
  cd deploy && docker compose up -d --build jams
  ```

- **Roll back `:latest` on GHCR** (for deployments that pull it): point it
  at the previous version.

  ```sh
  docker pull ghcr.io/kool277/jams:v2026.10.09
  docker tag ghcr.io/kool277/jams:v2026.10.09 ghcr.io/kool277/jams:latest
  docker push ghcr.io/kool277/jams:latest    # after docker login ghcr.io
  ```

- **Withdraw a release**: `gh release edit v2026.10.10 --repo kool277/<name> --prerelease`
  marks it as not for use; `gh release delete` removes it, keeping the tag.
