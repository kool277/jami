/*
 * Copyright (C) 2025 Savoir-faire Linux Inc.
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
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { arch, platform } from 'node:process'

const daemonDir = resolve(process.env.JAMI_DAEMON_DIR ?? 'daemon')
const buildDir = join(daemonDir, 'build')
const daemonBuildType = process.env.DAEMON_BUILD_TYPE ?? 'Debug'
const nativeSource = join(daemonDir, 'bin', 'nodejs', 'build', daemonBuildType, 'jamid.node')
const packageName = `@savoirfairelinux/jami-core-${platform}-${arch}`
const installedPackageDir = resolve('node_modules', '@savoirfairelinux', `jami-core-${platform}-${arch}`)

if (!existsSync(join(daemonDir, 'CMakeLists.txt'))) {
  console.error(`Jami daemon source was not found at ${daemonDir}`)
  console.error('Set JAMI_DAEMON_DIR to the daemon source directory or populate ./daemon.')
  process.exit(1)
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' })
  if (result.error) {
    console.error(`Unable to run ${command}: ${result.error.message}`)
    process.exit(1)
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

run('cmake', [
  '-S',
  daemonDir,
  '-B',
  buildDir,
  '-G',
  'Ninja',
  '-DJAMI_NODEJS=ON',
  '-DBUILD_TESTING=OFF',
  `-DCMAKE_BUILD_TYPE=${daemonBuildType}`,
])
run('cmake', ['--build', buildDir])

if (!existsSync(nativeSource)) {
  console.error(`The daemon build completed without producing ${nativeSource}`)
  process.exit(1)
}

if (!existsSync(join(installedPackageDir, 'package.json'))) {
  console.error(`Package ${packageName} was not found at ${installedPackageDir}`)
  console.error('Run npm install before building the local daemon.')
  process.exit(1)
}
copyFileSync(nativeSource, join(installedPackageDir, 'jamid.node'))

console.log(`Using locally built daemon from ${nativeSource}`)
console.log(`Installed local addon at ${installedPackageDir}/jamid.node`)
