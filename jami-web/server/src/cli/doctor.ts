/*
 * Copyright (C) 2022-2025 Savoir-faire Linux Inc.
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
import { accessSync, constants, existsSync, lstatSync, readFileSync } from 'node:fs'
import { createConnection, createServer } from 'node:net'
import { dirname, resolve } from 'node:path'

import { IAdminAccount } from '@savoirfairelinux/jami-web-common'

import { dataDir, defaultEnvPath } from '../utils/env.js'
import { resolveRuntimeSettings } from '../utils/runtime.js'

type CheckStatus = 'ok' | 'warn' | 'fail'

interface CheckResult {
  name: string
  status: CheckStatus
  detail: string
  hint?: string
}

function envFilePath(): string {
  return process.env.JAMI_WEB_ENV_FILE ? resolve(process.env.JAMI_WEB_ENV_FILE) : defaultEnvPath
}

function checkDataDirectory(): CheckResult {
  const name = 'Data directory'
  if (!existsSync(dataDir)) {
    return {
      name,
      status: 'warn',
      detail: `${dataDir} does not exist yet`,
      hint: 'Run "jami-web setup" to create it, or it will be created on first start.',
    }
  }
  try {
    accessSync(dataDir, constants.W_OK)
    return { name, status: 'ok', detail: dataDir }
  } catch {
    return {
      name,
      status: 'fail',
      detail: `${dataDir} is not writable`,
      hint: 'Ensure the user running jami-web owns the data directory and can write to it.',
    }
  }
}

function checkSigningKeys(): CheckResult {
  const name = 'JWT signing keys'
  if (process.env.PRIVATE_KEY && process.env.PUBLIC_KEY) {
    return { name, status: 'ok', detail: 'provided via environment variables' }
  }
  const envPath = envFilePath()
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf-8')
    if (content.includes('PRIVATE_KEY=') && content.includes('PUBLIC_KEY=')) {
      return { name, status: 'ok', detail: envPath }
    }
  }
  return {
    name,
    status: 'fail',
    detail: `no signing keys found in ${envPath}`,
    hint: 'Run "jami-web genkeys" (or "jami-web setup") to generate them.',
  }
}

function checkAdminAccount(): CheckResult {
  const name = 'Admin account'
  const filename = dataDir + '/admin.json'
  if (!existsSync(filename)) {
    return {
      name,
      status: 'warn',
      detail: 'no admin account configured',
      hint: 'Run "jami-web setup" or create one from the web UI on first launch.',
    }
  }
  try {
    const account = JSON.parse(readFileSync(filename, 'utf-8')) as IAdminAccount
    if (account.admin) {
      return { name, status: 'ok', detail: filename }
    }
    return {
      name,
      status: 'warn',
      detail: 'admin.json exists but no admin password is set',
      hint: 'Run "jami-web setup" or create an admin from the web UI.',
    }
  } catch {
    return {
      name,
      status: 'fail',
      detail: `${filename} is corrupted or unreadable`,
      hint: 'Fix or remove the file, then run "jami-web setup".',
    }
  }
}

async function checkNativeModule(): Promise<CheckResult> {
  const name = 'Jami daemon module'
  try {
    const { loadNativeModule } = await import('../jamid/jami-swig.js')
    loadNativeModule()
    return { name, status: 'ok', detail: 'loaded successfully' }
  } catch (err) {
    const platform = `${process.platform}-${process.arch}`
    return {
      name,
      status: 'fail',
      detail: `failed to load native module for ${platform}: ${(err as Error).message}`,
      hint: `Ensure "@savoirfairelinux/jami-core-${platform}" is installed for your platform.`,
    }
  }
}

function resolvePort(): number {
  return resolveRuntimeSettings().publicPort
}

function checkPort(name: string, port: number, host?: string): Promise<CheckResult> {
  if (Number.isNaN(port)) {
    return Promise.resolve({
      name,
      status: 'fail',
      detail: `invalid PORT value: ${process.env.PORT}`,
      hint: 'Set PORT to a valid number.',
    })
  }

  return new Promise((resolvePromise) => {
    const tester = createServer()
    tester.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        resolvePromise({
          name,
          status: 'fail',
          detail: `port ${port} is already in use`,
          hint: 'Stop the process using the port or set a different PORT.',
        })
      } else if (err.code === 'EACCES') {
        resolvePromise({
          name,
          status: 'warn',
          detail: `port ${port} requires elevated privileges`,
          hint: 'Use a port >= 1024 or run behind a reverse proxy.',
        })
      } else {
        resolvePromise({ name, status: 'warn', detail: `could not test port ${port}: ${err.message}` })
      }
    })
    tester.once('listening', () => {
      tester.close(() => resolvePromise({ name, status: 'ok', detail: `port ${port} is available` }))
    })
    tester.listen(port, host)
  })
}

async function checkCliControlSocket(): Promise<CheckResult> {
  const name = 'CLI control socket'
  const socketPath = resolveRuntimeSettings().cliControlSocketPath
  const socketDirectory = dirname(socketPath)

  if (!existsSync(socketDirectory)) {
    return {
      name,
      status: 'warn',
      detail: `socket directory does not exist: ${socketDirectory}`,
      hint: 'Start jami-web to create the runtime directory, or set JAMI_WEB_CLI_SOCKET to a writable location.',
    }
  }

  try {
    accessSync(socketDirectory, constants.W_OK)
  } catch {
    return {
      name,
      status: 'fail',
      detail: `socket directory is not writable: ${socketDirectory}`,
      hint: 'Ensure the user running jami-web can write to the socket directory.',
    }
  }

  if (!existsSync(socketPath)) {
    return {
      name,
      status: 'ok',
      detail: `${socketPath} (path is available; socket will be created on server start)`,
    }
  }

  try {
    const stat = lstatSync(socketPath)
    if (!stat.isSocket()) {
      return {
        name,
        status: 'fail',
        detail: `path exists but is not a socket: ${socketPath}`,
        hint: 'Remove or rename the existing file and restart jami-web.',
      }
    }
  } catch (error) {
    return {
      name,
      status: 'warn',
      detail: `could not inspect socket path ${socketPath}: ${(error as Error).message}`,
    }
  }

  return new Promise((resolvePromise) => {
    const client = createConnection({ path: socketPath })
    client.once('connect', () => {
      client.end()
      resolvePromise({ name, status: 'ok', detail: `${socketPath} is reachable` })
    })
    client.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'ECONNREFUSED') {
        resolvePromise({
          name,
          status: 'warn',
          detail: `${socketPath} exists but is not accepting connections`,
          hint: 'A stale socket file may be present. Restart jami-web.',
        })
        return
      }

      resolvePromise({
        name,
        status: 'warn',
        detail: `could not connect to socket ${socketPath}: ${error.message}`,
      })
    })
  })
}

const STATUS_MARK: Record<CheckStatus, string> = {
  ok: '✓',
  warn: '!',
  fail: '✗',
}

export async function doctorCommand(args: string[]): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`Usage: jami-web doctor

Run health checks on the Jami Web installation and configuration.
Reports the data directory, signing keys, admin account, native daemon
module, and runtime listener availability.

Exit code is non-zero if any check fails.

Options:
  --help      Show this help message`)
    return
  }

  console.log('Jami Web — Health Check')
  console.log(`  Data directory: ${dataDir}`)
  console.log(`  Env file:       ${envFilePath()}`)
  console.log(`  Environment:    ${process.env.NODE_ENV || 'production'}`)
  console.log()

  const runtime = resolveRuntimeSettings()
  const results: CheckResult[] = [
    checkDataDirectory(),
    checkSigningKeys(),
    checkAdminAccount(),
    await checkNativeModule(),
    await checkPort('Server port', resolvePort(), runtime.publicHost),
    await checkCliControlSocket(),
  ]

  for (const result of results) {
    console.log(`${STATUS_MARK[result.status]} ${result.name}: ${result.detail}`)
    if (result.hint && result.status !== 'ok') {
      console.log(`    → ${result.hint}`)
    }
  }

  console.log()
  const failed = results.filter((r) => r.status === 'fail').length
  const warned = results.filter((r) => r.status === 'warn').length
  if (failed > 0) {
    console.log(`${failed} check(s) failed, ${warned} warning(s).`)
    process.exit(1)
  } else if (warned > 0) {
    console.log(`All critical checks passed, ${warned} warning(s).`)
  } else {
    console.log('All checks passed.')
  }
}
