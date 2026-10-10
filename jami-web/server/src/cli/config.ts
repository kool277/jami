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
import { existsSync, readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { IAdminAccount, IAdminConfigState } from '@savoirfairelinux/jami-web-common'

import { dataDir, defaultEnvPath, loadEnv } from '../utils/env.js'
import { resolveRuntimeSettings } from '../utils/runtime.js'

const VALID_KEYS: (keyof IAdminConfigState)[] = [
  'localAuthEnabled',
  'jamsAuthEnabled',
  'guestAccessEnabled',
  'openIdAuthEnabled',
  'noLocalMediaEnabled',
  'conferenceResolution',
  'uploadPath',
]

function loadAdminAccount(filename: string): IAdminAccount | undefined {
  try {
    const buffer = readFileSync(filename)
    return JSON.parse(buffer.toString())
  } catch {
    return undefined
  }
}

interface EffectiveRuntime {
  envFile: string
  envFileExists: boolean
  nodeEnv: string
  port: number
  host: string
  cliControlSocket: string
}

function resolveRuntime(): EffectiveRuntime {
  // Load the env file so resolved values reflect what the server will see.
  loadEnv()
  const runtime = resolveRuntimeSettings()
  const envFile = process.env.JAMI_WEB_ENV_FILE ? resolve(process.env.JAMI_WEB_ENV_FILE) : defaultEnvPath
  const host = runtime.publicHost || '(all interfaces)'
  return {
    envFile,
    envFileExists: existsSync(envFile),
    nodeEnv: runtime.nodeEnv,
    port: runtime.publicPort,
    host,
    cliControlSocket: runtime.cliControlSocketPath,
  }
}

export async function configCommand(args: string[]): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`Usage: jami-web config [options]

Show or update server configuration.

Without arguments, shows the current configuration.

Options:
  --set <key>=<value>   Set a configuration value
  --json                Output configuration as JSON
  --help                Show this help message

Configurable keys:
  localAuthEnabled      Enable/disable local authentication (true/false)
  jamsAuthEnabled       Enable/disable JAMS authentication (true/false)
  guestAccessEnabled    Enable/disable guest access (true/false)
  openIdAuthEnabled     Enable/disable OpenID authentication (true/false)
  noLocalMediaEnabled   Start without local media devices (true/false; restart required)
  conferenceResolution  Conference video resolution (720p/1080p/1440p)
  uploadPath            Path for file uploads

Examples:
  jami-web config
  jami-web config --json
  jami-web config --set localAuthEnabled=true
  jami-web config --set noLocalMediaEnabled=false
  jami-web config --set conferenceResolution=1080p
  jami-web config --set guestAccessEnabled=false`)
    return
  }

  const filename = dataDir + '/admin.json'

  if (!existsSync(filename)) {
    console.error('No configuration found. Run "jami-web setup" first.')
    process.exit(1)
  }

  const account = loadAdminAccount(filename)
  if (!account) {
    console.error('Failed to read configuration from', filename)
    process.exit(1)
  }

  // Handle --set
  const setIdx = args.indexOf('--set')
  if (setIdx !== -1) {
    const pair = args[setIdx + 1]
    if (!pair || !pair.includes('=')) {
      console.error('Usage: --set <key>=<value>')
      process.exit(1)
    }
    const eqIdx = pair.indexOf('=')
    const key = pair.substring(0, eqIdx) as keyof IAdminConfigState
    const rawValue = pair.substring(eqIdx + 1)

    if (!VALID_KEYS.includes(key)) {
      console.error(`Unknown key: ${key}`)
      console.error('Valid keys:', VALID_KEYS.join(', '))
      process.exit(1)
    }

    let value: boolean | string
    if (rawValue === 'true') value = true
    else if (rawValue === 'false') value = false
    else value = rawValue

    if (!account.config) {
      console.error('No config found. Run "jami-web setup" first.')
      process.exit(1)
    }

    ;(account.config as unknown as Record<string, boolean | string>)[key] = value
    await writeFile(filename, JSON.stringify(account, null, 2) + '\n')
    console.log(`✓ ${key} = ${value}`)
    return
  }

  // Show config
  const asJson = args.includes('--json')
  const runtime = resolveRuntime()
  if (asJson) {
    const output: Record<string, unknown> = {}
    output.dataDirectory = dataDir
    output.configFile = filename
    output.envFile = runtime.envFile
    output.envFileExists = runtime.envFileExists
    output.nodeEnv = runtime.nodeEnv
    output.port = runtime.port
    output.cliControlSocket = runtime.cliControlSocket
    output.host = process.env.HOST ?? null
    if (account.config) output.config = account.config
    output.adminConfigured = account.admin !== undefined
    output.lastWizardState = account.lastWizardState
    if (account.nameserver) output.nameserver = account.nameserver
    if (account.jamsUrl) output.jamsUrl = account.jamsUrl
    if (account.autoDownloadLimit !== undefined) output.autoDownloadLimit = account.autoDownloadLimit
    console.log(JSON.stringify(output, null, 2))
    return
  }

  // Pretty-print
  console.log('Jami Web Server Configuration')
  console.log(`  Data directory:    ${dataDir}`)
  console.log(`  Config file:       ${filename}`)
  console.log(`  Env file:          ${runtime.envFile}${runtime.envFileExists ? '' : ' (missing)'}`)
  console.log()
  console.log('  Effective runtime:')
  console.log(`    Environment:     ${runtime.nodeEnv}`)
  console.log(`    Port:            ${runtime.port}`)
  console.log(`    CLI control:     ${runtime.cliControlSocket} (unix socket)`)
  console.log(`    Host:            ${runtime.host}`)
  console.log()
  console.log(`  Admin configured:  ${account.admin !== undefined ? 'yes' : 'no'}`)
  console.log(`  Wizard state:      ${account.lastWizardState || 'not started'}`)
  console.log()
  if (account.config) {
    console.log('  Authentication:')
    console.log(`    Local auth:      ${account.config.localAuthEnabled ? 'enabled' : 'disabled'}`)
    console.log(`    JAMS auth:       ${account.config.jamsAuthEnabled ? 'enabled' : 'disabled'}`)
    console.log(`    Guest access:    ${account.config.guestAccessEnabled ? 'enabled' : 'disabled'}`)
    console.log(`    OpenID auth:     ${account.config.openIdAuthEnabled ? 'enabled' : 'disabled'}`)
    console.log()
    console.log(`  Daemon local media: ${account.config.noLocalMediaEnabled ? 'disabled' : 'enabled'}`)
    console.log(`  Conference video:  ${account.config.conferenceResolution}`)
    console.log(`  Upload path:       ${account.config.uploadPath}`)
  }
  if (account.nameserver) {
    console.log(`  Name server:       ${account.nameserver}`)
  }
  if (account.jamsUrl) {
    console.log(`  JAMS server:       ${account.jamsUrl}`)
  }
  if (account.autoDownloadLimit !== undefined) {
    console.log(`  Auto-download:     ${account.autoDownloadLimit} MB`)
  }
}
