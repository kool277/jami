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
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'

import {
  AdminWizardState,
  defaultConferenceResolution,
  IAdminAccount,
  urlRegex,
} from '@savoirfairelinux/jami-web-common'

import { dataDir } from '../utils/env.js'
import { hashPassword } from '../utils/password.js'
import { genkeyCommand } from './genkeys.js'
import { closePrompt, confirm, prompt, promptPassword } from './prompt.js'

const MIN_ADMIN_PASSWORD_LENGTH = 8

function loadAdminAccount(filename: string): IAdminAccount {
  try {
    const buffer = readFileSync(filename)
    return JSON.parse(buffer.toString())
  } catch {
    return {} as IAdminAccount
  }
}

function initDefaults(account: IAdminAccount): IAdminAccount {
  if (!account.config) {
    account.config = {
      localAuthEnabled: true,
      jamsAuthEnabled: false,
      guestAccessEnabled: false,
      openIdAuthEnabled: false,
      noLocalMediaEnabled: true,
      conferenceResolution: defaultConferenceResolution,
      uploadPath: dataDir + '/uploads/',
    }
  }
  if (account.lastWizardState === undefined) {
    account.lastWizardState = AdminWizardState.account
  }
  if (account.autoDownloadLimit === undefined) {
    account.autoDownloadLimit = 20
  }
  if (!account.openIdProviders) {
    account.openIdProviders = {}
  }
  return account
}

async function saveAdminAccount(filename: string, account: IAdminAccount): Promise<void> {
  await writeFile(filename, JSON.stringify(account, null, 2) + '\n')
}

const DEFAULT_NAMESERVER = 'https://ns.jami.net'

interface SetupOptions {
  nonInteractive: boolean
  adminPassword?: string
  resetAdmin: boolean
  localAuth?: boolean
  jamsAuth?: boolean
  jamsUrl?: string
  openIdAuth?: boolean
  guestAccess?: boolean
  nameserver?: string
}

function flagValue(args: string[], name: string): string | undefined {
  const i = args.indexOf(name)
  if (i !== -1 && args[i + 1] !== undefined) {
    return args[i + 1]
  }
  return undefined
}

function boolFlag(args: string[], enableName: string, disableName: string): boolean | undefined {
  if (args.includes(enableName)) return true
  if (args.includes(disableName)) return false
  return undefined
}

function parseSetupArgs(args: string[]): SetupOptions {
  return {
    nonInteractive: args.includes('--non-interactive') || args.includes('-y') || args.includes('--yes'),
    adminPassword: flagValue(args, '--admin-password') ?? process.env.JAMI_WEB_ADMIN_PASSWORD,
    resetAdmin: args.includes('--reset-admin'),
    localAuth: boolFlag(args, '--enable-local', '--disable-local'),
    jamsAuth: boolFlag(args, '--enable-jams', '--disable-jams'),
    jamsUrl: flagValue(args, '--jams-url'),
    openIdAuth: boolFlag(args, '--enable-openid', '--disable-openid'),
    guestAccess: boolFlag(args, '--enable-guest', '--disable-guest'),
    nameserver: flagValue(args, '--nameserver'),
  }
}

function isValidUrl(url: string): boolean {
  return urlRegex.test(url)
}

async function promptUrl(question: string, current: string, required: boolean): Promise<string> {
  for (;;) {
    const answer = await prompt(question)
    const value = answer || current
    if (!value) {
      if (required) {
        console.log('A value is required. Please enter a URL (e.g. https://example.com).')
        continue
      }
      return ''
    }
    if (!isValidUrl(value)) {
      console.log('Invalid URL. Please enter a valid URL (e.g. https://example.com).')
      continue
    }
    return value
  }
}

async function resolveBool(
  question: string,
  current: boolean,
  override: boolean | undefined,
  nonInteractive: boolean,
): Promise<boolean> {
  if (override !== undefined) {
    return override
  }
  if (nonInteractive) {
    return current
  }
  return confirm(question, current)
}

export async function setupCommand(args: string[]): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`Usage: jami-web setup [options]

Interactive setup wizard for Jami Web server.
Equivalent to the web-based admin setup wizard.

Steps:
  1. Generate JWT signing keys (if missing)
  2. Create an admin account with a password
  3. Configure authentication methods
  4. Configure the nameserver
  5. Configure guest access

Options:
  --non-interactive, -y     Run without prompts (for automation/CI)
  --admin-password <pw>     Admin password (or set JAMI_WEB_ADMIN_PASSWORD)
  --reset-admin             Reset the admin password if one already exists
  --enable-local            Enable local authentication
  --disable-local           Disable local authentication
  --enable-jams             Enable JAMS authentication
  --disable-jams            Disable JAMS authentication
  --jams-url <url>          JAMS server URL (required when JAMS is enabled)
  --enable-openid           Enable OpenID authentication
  --disable-openid          Disable OpenID authentication
  --enable-guest            Enable guest access
  --disable-guest           Disable guest access
  --nameserver <url>        Name server URL (default: ${DEFAULT_NAMESERVER})
  --help                    Show this help message

In non-interactive mode, unspecified options keep their current value.
Creating a new admin account requires --admin-password (or JAMI_WEB_ADMIN_PASSWORD).`)
    return
  }

  const options = parseSetupArgs(args)

  console.log('╔══════════════════════════════════════╗')
  console.log('║       Jami Web — Server Setup        ║')
  console.log('╚══════════════════════════════════════╝')
  console.log()

  // Ensure data directory exists
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
  }
  const uploadPath = dataDir + '/uploads/'
  if (!existsSync(uploadPath)) {
    mkdirSync(uploadPath, { recursive: true })
  }

  const filename = dataDir + '/admin.json'
  let account = loadAdminAccount(filename)
  account = initDefaults(account)

  console.log(`Data directory: ${dataDir}`)
  console.log()

  // Step 1: Generate signing keys
  console.log('── Step 1: JWT Signing Keys ──')
  await genkeyCommand([])
  console.log()

  // Step 2: Admin password
  console.log('── Step 2: Admin Account ──')
  await setupAdmin(account, options)
  console.log()

  // Step 3: Authentication methods
  console.log('── Step 3: Authentication ──')
  await configureAuth(account, options)
  console.log()

  // Step 4: Nameserver
  console.log('── Step 4: Name Server ──')
  console.log('Enter the name server users will use to find each other by username.')
  await configureNameserver(account, options)
  console.log()

  // Step 5: Guest access
  console.log('── Step 5: Guest Access ──')
  console.log('Allow users to join with an ephemeral account without providing credentials.')
  account.config.guestAccessEnabled = await resolveBool(
    'Enable guest access?',
    account.config.guestAccessEnabled,
    options.guestAccess,
    options.nonInteractive,
  )
  console.log(`✓ Guest access: ${account.config.guestAccessEnabled ? 'enabled' : 'disabled'}`)
  console.log()

  // Mark setup as complete
  account.lastWizardState = AdminWizardState.complete

  // Save
  await saveAdminAccount(filename, account)
  printSummary(account, filename)

  closePrompt()
}

async function setupAdmin(account: IAdminAccount, options: SetupOptions): Promise<void> {
  const hasExistingAdmin = account.admin !== undefined

  if (options.nonInteractive) {
    if (hasExistingAdmin && !options.resetAdmin) {
      console.log('Admin account already exists; keeping the current password.')
      return
    }
    if (!options.adminPassword) {
      throw new Error(
        hasExistingAdmin
          ? '--reset-admin requires --admin-password (or JAMI_WEB_ADMIN_PASSWORD).'
          : 'An admin password is required in non-interactive mode. Use --admin-password or set JAMI_WEB_ADMIN_PASSWORD.',
      )
    }
    if (options.adminPassword.length < MIN_ADMIN_PASSWORD_LENGTH) {
      throw new Error(`Admin password must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters long.`)
    }
    account.admin = await hashPassword(options.adminPassword)
    console.log('✓ Admin password set.')
    return
  }

  if (hasExistingAdmin) {
    console.log('An admin account already exists.')
    console.log('Warning: resetting the password will replace the current admin credentials.')
    const resetAdmin = await confirm('Reset admin password?', false)
    if (resetAdmin) {
      await setAdminPassword(account)
    } else {
      console.log('Keeping the current admin password.')
    }
  } else {
    await setAdminPassword(account)
  }
}

async function setAdminPassword(account: IAdminAccount): Promise<void> {
  for (;;) {
    const password = await promptPassword(`Enter admin password (min ${MIN_ADMIN_PASSWORD_LENGTH} characters): `)
    if (password.length < MIN_ADMIN_PASSWORD_LENGTH) {
      console.log(`Password must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters long.`)
      continue
    }
    const passwordConfirm = await promptPassword('Confirm admin password: ')
    if (password !== passwordConfirm) {
      console.log('Passwords do not match. Please try again.')
      continue
    }
    account.admin = await hashPassword(password)
    console.log('✓ Admin password set.')
    break
  }
}

async function configureAuth(account: IAdminAccount, options: SetupOptions): Promise<void> {
  // Local auth
  console.log('Local authentication: let users sign in with an account created on this server.')
  account.config.localAuthEnabled = await resolveBool(
    'Enable local authentication?',
    account.config.localAuthEnabled,
    options.localAuth,
    options.nonInteractive,
  )

  // JAMS auth
  console.log('JAMS authentication: let users sign in with credentials managed by a JAMS server.')
  const enableJams = await resolveBool(
    'Enable JAMS authentication?',
    account.config.jamsAuthEnabled,
    options.jamsAuth,
    options.nonInteractive,
  )
  account.config.jamsAuthEnabled = enableJams
  if (enableJams) {
    const currentUrl = account.jamsUrl || ''
    if (options.nonInteractive) {
      const url = options.jamsUrl || currentUrl
      if (!url) {
        throw new Error('JAMS authentication is enabled but no JAMS URL was provided. Use --jams-url.')
      }
      if (!isValidUrl(url)) {
        throw new Error(`Invalid JAMS server URL: ${url}`)
      }
      account.jamsUrl = url
    } else {
      account.jamsUrl = await promptUrl(`JAMS server URL${currentUrl ? ` [${currentUrl}]` : ''}: `, currentUrl, true)
    }
  }

  // OpenID — simplified; detailed per-provider config is better done via the web UI
  console.log(
    'OpenID authentication: let users sign in through an external identity provider (Google, GitHub, GitLab, Discord, LinkedIn).',
  )
  account.config.openIdAuthEnabled = await resolveBool(
    'Enable OpenID authentication?',
    account.config.openIdAuthEnabled,
    options.openIdAuth,
    options.nonInteractive,
  )

  console.log('✓ Authentication configured:')
  console.log(`    Local:  ${account.config.localAuthEnabled ? 'enabled' : 'disabled'}`)
  console.log(`    JAMS:   ${account.config.jamsAuthEnabled ? 'enabled' : 'disabled'}`)
  console.log(`    OpenID: ${account.config.openIdAuthEnabled ? 'enabled' : 'disabled'}`)
}

async function configureNameserver(account: IAdminAccount, options: SetupOptions): Promise<void> {
  const currentNs = account.nameserver || DEFAULT_NAMESERVER
  let finalNs: string
  if (options.nonInteractive) {
    finalNs = options.nameserver || currentNs
    if (finalNs && !isValidUrl(finalNs)) {
      throw new Error(`Invalid name server URL: ${finalNs}`)
    }
  } else {
    finalNs = await promptUrl(`Name server URL [${currentNs}]: `, currentNs, true)
  }

  if (finalNs && finalNs !== DEFAULT_NAMESERVER) {
    account.nameserver = finalNs
  } else {
    // Default — remove override
    delete account.nameserver
  }
  console.log(`✓ Name server: ${finalNs}`)
}

function printSummary(account: IAdminAccount, filename: string): void {
  console.log('── Setup Summary ──')
  console.log(`  Data directory:   ${dataDir}`)
  console.log(`  Config file:      ${filename}`)
  console.log(`  Admin account:    ${account.admin ? 'configured' : 'not configured'}`)
  console.log(`  Local auth:       ${account.config.localAuthEnabled ? 'enabled' : 'disabled'}`)
  console.log(
    `  JAMS auth:        ${account.config.jamsAuthEnabled ? 'enabled' : 'disabled'}` +
      (account.jamsUrl ? ` (${account.jamsUrl})` : ''),
  )
  console.log(`  OpenID auth:      ${account.config.openIdAuthEnabled ? 'enabled' : 'disabled'}`)
  console.log(`  Guest access:     ${account.config.guestAccessEnabled ? 'enabled' : 'disabled'}`)
  console.log(`  Name server:      ${account.nameserver || `${DEFAULT_NAMESERVER} (default)`}`)
  console.log()
  console.log('✓ Configuration saved to', filename)
  console.log()
  console.log('You can now start the server with:')
  console.log('  jami-web start')
}
