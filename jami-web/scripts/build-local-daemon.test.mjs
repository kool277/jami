/*
 * Copyright (C) 2026 Savoir-faire Linux Inc.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation; either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public
 * License along with this program.  If not, see
 * <https://www.gnu.org/licenses/>.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { arch, platform } from 'node:process'
import { afterEach, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const builderPath = fileURLToPath(new URL('./build-local-daemon.mjs', import.meta.url))
const packageDirectoryName = `jami-core-${platform}-${arch}`
const workspaces = []

function createWorkspace() {
  const workspace = mkdtempSync(join(tmpdir(), 'jami-web-daemon-builder-'))
  workspaces.push(workspace)

  const daemonDirectory = join(workspace, 'daemon')
  const nativeSource = join(daemonDirectory, 'bin', 'nodejs', 'build', 'Release', 'jamid.node')
  const sourcePackageDirectory = join(daemonDirectory, 'bin', 'nodejs', 'npm', `${platform}-${arch}`)
  const installedPackageDirectory = join(workspace, 'node_modules', '@savoirfairelinux', packageDirectoryName)
  const cmakeDirectory = join(workspace, 'bin')
  const cmakeLog = join(workspace, 'cmake.log')

  mkdirSync(daemonDirectory, { recursive: true })
  writeFileSync(join(daemonDirectory, 'CMakeLists.txt'), '')
  for (const packageDirectory of [sourcePackageDirectory, installedPackageDirectory]) {
    mkdirSync(packageDirectory, { recursive: true })
    writeFileSync(join(packageDirectory, 'package.json'), '{}')
  }

  mkdirSync(cmakeDirectory)
  const cmakePath = join(cmakeDirectory, 'cmake')
  writeFileSync(
    cmakePath,
    `#!/bin/sh
printf '%s\\n' "$@" >> "$TEST_CMAKE_LOG"
if [ "$1" = "--build" ]; then
  if [ "$TEST_CMAKE_MODE" = "build-failure" ]; then
    exit 7
  fi
  if [ "$TEST_CMAKE_MODE" != "missing-addon" ]; then
    mkdir -p "$(dirname "$TEST_NATIVE_SOURCE")"
    printf 'local addon' > "$TEST_NATIVE_SOURCE"
  fi
fi
`,
  )
  chmodSync(cmakePath, 0o755)

  return {
    workspace,
    daemonDirectory,
    nativeSource,
    sourcePackageDirectory,
    installedPackageDirectory,
    cmakeDirectory,
    cmakeLog,
  }
}

function runBuilder(fixture, environment = {}) {
  return spawnSync(process.execPath, [builderPath], {
    cwd: fixture.workspace,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${fixture.cmakeDirectory}:${process.env.PATH}`,
      TEST_CMAKE_LOG: fixture.cmakeLog,
      TEST_NATIVE_SOURCE: fixture.nativeSource,
      ...environment,
    },
  })
}

function cmakeCalls(fixture) {
  return existsSync(fixture.cmakeLog) ? readFileSync(fixture.cmakeLog, 'utf8').trim().split('\n') : []
}

afterEach(() => {
  for (const workspace of workspaces.splice(0)) {
    rmSync(workspace, { recursive: true, force: true })
  }
})

describe('build-local-daemon', () => {
  it('fails when the daemon source is absent', () => {
    const fixture = createWorkspace()
    const absentDaemonDirectory = join(fixture.workspace, 'missing-daemon')

    const result = runBuilder(fixture, { JAMI_DAEMON_DIR: absentDaemonDirectory })

    assert.equal(result.status, 1)
    assert.match(result.stderr, /Jami daemon source was not found/)
    assert.equal(existsSync(fixture.cmakeLog), false)
  })

  it('configures CMake only when the build cache is absent', () => {
    const fixture = createWorkspace()

    const firstBuild = runBuilder(fixture)
    assert.equal(firstBuild.status, 0, firstBuild.stderr)
    assert.deepEqual(cmakeCalls(fixture), [
      '-S',
      fixture.daemonDirectory,
      '-B',
      join(fixture.daemonDirectory, 'build'),
      '-G',
      'Ninja',
      '-DJAMI_NODEJS=ON',
      '-DBUILD_TESTING=OFF',
      '-DCMAKE_BUILD_TYPE=Debug',
      '--build',
      join(fixture.daemonDirectory, 'build'),
    ])

    mkdirSync(join(fixture.daemonDirectory, 'build'), { recursive: true })
    writeFileSync(join(fixture.daemonDirectory, 'build', 'CMakeCache.txt'), '')
    writeFileSync(fixture.cmakeLog, '')
    const cachedBuild = runBuilder(fixture)

    assert.equal(cachedBuild.status, 0, cachedBuild.stderr)
    assert.deepEqual(cmakeCalls(fixture), ['--build', join(fixture.daemonDirectory, 'build')])
  })

  it('propagates CMake build failures without copying an addon', () => {
    const fixture = createWorkspace()

    const result = runBuilder(fixture, { TEST_CMAKE_MODE: 'build-failure' })

    assert.equal(result.status, 7)
    assert.equal(existsSync(join(fixture.sourcePackageDirectory, 'jamid.node')), false)
    assert.equal(existsSync(join(fixture.installedPackageDirectory, 'jamid.node')), false)
  })

  it('fails when CMake completes without producing the native addon', () => {
    const fixture = createWorkspace()

    const result = runBuilder(fixture, { TEST_CMAKE_MODE: 'missing-addon' })

    assert.equal(result.status, 1)
    assert.match(result.stderr, /without producing/)
    assert.equal(existsSync(join(fixture.sourcePackageDirectory, 'jamid.node')), false)
    assert.equal(existsSync(join(fixture.installedPackageDirectory, 'jamid.node')), false)
  })

  it('uses daemon overrides and copies the addon to both package locations', () => {
    const fixture = createWorkspace()
    const customDaemonDirectory = join(fixture.workspace, 'custom-daemon')
    mkdirSync(customDaemonDirectory, { recursive: true })
    writeFileSync(join(customDaemonDirectory, 'CMakeLists.txt'), '')
    const customNativeSource = join(customDaemonDirectory, 'bin', 'nodejs', 'build', 'Release', 'jamid.node')
    const customSourcePackageDirectory = join(customDaemonDirectory, 'bin', 'nodejs', 'npm', `${platform}-${arch}`)
    mkdirSync(customSourcePackageDirectory, { recursive: true })
    writeFileSync(join(customSourcePackageDirectory, 'package.json'), '{}')

    const result = runBuilder(fixture, {
      DAEMON_BUILD_TYPE: 'Release',
      JAMI_DAEMON_DIR: customDaemonDirectory,
      TEST_NATIVE_SOURCE: customNativeSource,
    })

    assert.equal(result.status, 0, result.stderr)
    assert.equal(readFileSync(join(customSourcePackageDirectory, 'jamid.node'), 'utf8'), 'local addon')
    assert.equal(readFileSync(join(fixture.installedPackageDirectory, 'jamid.node'), 'utf8'), 'local addon')
    assert.deepEqual(cmakeCalls(fixture), [
      '-S',
      customDaemonDirectory,
      '-B',
      join(customDaemonDirectory, 'build'),
      '-G',
      'Ninja',
      '-DJAMI_NODEJS=ON',
      '-DBUILD_TESTING=OFF',
      '-DCMAKE_BUILD_TYPE=Release',
      '--build',
      join(customDaemonDirectory, 'build'),
    ])
  })
})
