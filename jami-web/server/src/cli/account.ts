/*
 * Copyright (C) 2022-2026 Savoir-faire Linux Inc.
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
import { parseArgs } from 'node:util'

import { loadEnv } from '../utils/env.js'
import { createCliAccountRequest, listCliAccountsRequest, removeCliAccountRequest } from './control/client.js'
import { choose, closePrompt, prompt, promptPassword } from './prompt.js'

interface AccountOptions {
  displayName?: string
  password?: string
}

interface RemoveAccountOptions {
  accountId?: string
}

interface ListAccountOptions {
  help: boolean
}

interface CreateAccountParseResult extends AccountOptions {
  help: boolean
}

interface RemoveAccountParseResult extends RemoveAccountOptions {
  help: boolean
}

interface ListedAccount {
  accountId: string
  hash: string
  displayName: string
  registeredName: string
  botOwner?: string
}

// The available subcommands for account management
const ACCOUNTS_SUBCOMMANDS = ['create', 'list', 'remove'] as const
type AccountsSubcommand = (typeof ACCOUNTS_SUBCOMMANDS)[number]

function printAccountsUsage() {
  console.log(`Usage: jami-web accounts <subcommand> [options]

Manage Jami accounts.

Subcommands:
  create      Create a new Jami account
  list        List all Jami accounts
  remove      Remove a Jami account

Run 'jami-web accounts <subcommand> --help' for subcommand options.
With no subcommand and a TTY, an interactive menu is shown.

Options:
  --help      Show this help message`)
}

function printCreateUsage() {
  console.log(`Usage: jami-web accounts create [options]

Create a Jami account.

The account can be used to:
  - Login to the web client with the account hash and password
  - Register a username later through the web client or web API

Options:
  --displayName <name>  Account display name (optional; prompted when omitted)
  --password <password>  Account password (required; prompted when omitted)
  --help                     Show this help message`)
}

function printListUsage() {
  console.log(`Usage: jami-web accounts list [options]

List all Jami accounts known to the local daemon and show whether each account is a bot.

Options:
  --help      Show this help message`)
}

function printRemoveUsage() {
  console.log(`Usage: jami-web accounts remove [options]

Remove a Jami account.

In TTY mode, if --accountId is omitted, you will be prompted to choose an account.

Options:
  --accountId <accountId>  Account ID to remove (optional in TTY mode; prompted when omitted)
  --help      Show this help message`)
}

function onParseError(error: unknown, printUsage: () => void): never {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  printUsage()
  process.exit(1)
}

function formatOptional(value: string | undefined): string {
  return value && value !== 'undefined' ? value : '-'
}

/**
 *
 * @param listedAccounts - The list of ListedAccouts to output to the console
 */
function printAccountList(listedAccounts: ListedAccount[]): void {
  if (listedAccounts.length === 0) {
    console.log('No Jami accounts are available.')
    return
  }

  console.log(`Jami accounts (${listedAccounts.length})`)
  for (const listedAccount of listedAccounts) {
    console.log(`- ${formatOptional(listedAccount.displayName)}`)
    console.log(`  Account ID:      ${listedAccount.accountId}`)
    console.log(`  Hash:            ${listedAccount.hash}`)
    console.log(`  Registered name: ${formatOptional(listedAccount.registeredName)}`)
    if (listedAccount.botOwner) {
      console.log(`  Bot owner:       ${formatOptional(listedAccount.botOwner)}`)
    }
  }
}

/**
 *
 * @returns A list of ListedAccount objects containing account information
 */
async function getListedAccounts(): Promise<ListedAccount[]> {
  const accounts = await listCliAccountsRequest()
  return accounts.map((account) => {
    return {
      accountId: account.accountId,
      hash: account.hash,
      displayName: account.displayName,
      registeredName: account.registeredName,
      botOwner: account.botOwner,
    }
  })
}

/**
 * @param args - The arguments for account list subcommand provided by the user
 */
function parseListArgs(args: string[]): ListAccountOptions {
  try {
    const { values } = parseArgs({
      args,
      allowPositionals: false,
      strict: true,
      options: {
        help: {
          type: 'boolean',
          short: 'h',
        },
      },
    })

    return {
      help: values.help ?? false,
    }
  } catch (error) {
    return onParseError(error, printListUsage)
  }
}

/**
 * Lists the known accounts with the following information:
 *  - Display name
 *  - Account ID
 *  - Account hash
 *  - Registered name
 *  - Bot owner account hash (if applicable)
 * @param listArgs - The arguments for the `accounts list` command provided by the user
 */
export async function listAccountsCommand(listArgs: string[]): Promise<void> {
  const options = parseListArgs(listArgs)
  if (options.help) {
    printListUsage()
    return
  }

  loadEnv()
  let exitCode = 0

  try {
    const accounts = await getListedAccounts()
    printAccountList(accounts)
  } catch (error) {
    exitCode = 1
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
  } finally {
    closePrompt()
    process.exit(exitCode)
  }
}

/**
 * Parse the arguments passed into the account cli's `accounts create` command
 * @param args - The args to parse
 * @returns The account options object given the arguments
 */
function parseCreateAccountArgs(args: string[]): CreateAccountParseResult {
  try {
    const { values } = parseArgs({
      args,
      allowPositionals: false,
      strict: true,
      options: {
        help: {
          type: 'boolean',
          short: 'h',
        },
        displayName: {
          type: 'string',
        },
        password: {
          type: 'string',
        },
      },
    })

    return {
      help: values.help ?? false,
      displayName: values.displayName,
      password: values.password,
    }
  } catch (error) {
    return onParseError(error, printCreateUsage)
  }
}

/**
 * Resolve the display name for the account
 * @param options - The account options provided by the user
 * @returns The display name, limited to 50 characters (empty string allowed)
 */
async function resolveDisplayName(options: AccountOptions): Promise<string> {
  let displayName = options.displayName?.trim() ?? ''
  const maxLength = 50

  // If provided via CLI args, warn and limit to 50 characters
  if (displayName && displayName.length > maxLength) {
    console.log(`Display name will be trimmed to ${maxLength} characters (you provided ${displayName.length}).`)
    displayName = displayName.substring(0, maxLength)
    return displayName
  }

  // If in TTY mode and no display name provided, prompt the user
  if (!displayName && process.stdin.isTTY) {
    while (true) {
      displayName = (await prompt('Display name (optional, max 50 characters): ')).trim()
      // Empty is allowed
      if (displayName.length === 0) {
        break
      }
      // If too long, reject and re-prompt
      if (displayName.length > maxLength) {
        console.log(
          `Display name must be ${maxLength} characters or less (you entered ${displayName.length}). Please try again.`,
        )
        continue
      }
      // Valid
      break
    }
  }

  return displayName
}

/**
 * Resolve the password for the account
 * @param options - The account options provided by the user
 * @returns The password for the account
 */
async function resolvePassword(options: AccountOptions): Promise<string> {
  let password = options.password?.trim() ?? ''
  while (!password) {
    if (!process.stdin.isTTY) {
      console.error('Password is required. Use --password <password>.')
      process.exit(1)
    }
    password = await promptPassword('Password: ')
    if (!password) {
      console.log('Password is required.')
    }
  }
  return password
}

/**
 * Create a Jami account with the given options
 * @param createArgs The arguments for the `accounts create` command provided by the user
 */
export async function createAccountCommand(createArgs: string[]): Promise<void> {
  const options = parseCreateAccountArgs(createArgs)
  if (options.help) {
    printCreateUsage()
    return
  }

  loadEnv()

  const displayName = await resolveDisplayName(options)
  const password = await resolvePassword(options)
  let exitCode = 0

  try {
    const account = await createCliAccountRequest({
      displayName,
      password,
    })

    console.log('Jami account created')
    if (displayName) {
      console.log(`  Display name: ${displayName}`)
    }
    console.log(`  Account ID:   ${account.accountId}`)
    console.log(`  Account hash: ${account.accountHash}`)
    console.log()
    console.log('Web client login:')
    console.log(`  Account:  ${account.accountHash}`)
    console.log(`  Password: ${password}`)
  } catch (error) {
    exitCode = 1
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
  } finally {
    closePrompt()
    process.exit(exitCode)
  }
}

/**
 * Parse the arguments passed into the account cli's `accounts remove` command
 * @param args - The args to parse
 * @returns The remove options object given the arguments
 */
function parseRemoveAccountArgs(args: string[]): RemoveAccountParseResult {
  try {
    const { values } = parseArgs({
      args,
      allowPositionals: false,
      strict: true,
      options: {
        help: {
          type: 'boolean',
          short: 'h',
        },
        accountId: {
          type: 'string',
        },
      },
    })

    const accountId = values.accountId
    if (accountId === '') {
      console.error('Missing value for --accountId')
      printRemoveUsage()
      process.exit(1)
    }

    return {
      help: values.help ?? false,
      accountId,
    }
  } catch (error) {
    return onParseError(error, printRemoveUsage)
  }
}

/**
 * Finds the account to remove from the given accountId and account list
 * @param accounts - A list of the current Jami accounts
 * @param accountId - The accountId of the account to remove
 * @returns The ListedAccount to remove
 */
function findAccountToRemove(accounts: ListedAccount[], accountId: string): ListedAccount | undefined {
  const normalizedAccountId = accountId.toLowerCase()
  return accounts.find((account) => account.accountId.toLowerCase() === normalizedAccountId)
}

/**
 * Formats the ListedAccount as a deletion list item
 * @param account The listed to be formatted
 * @returns The ListedAccount represented as a string of its hash and accountId
 */
function formatRemoveChoice(account: ListedAccount): string {
  const names = [account.displayName, account.registeredName].filter((value) => value && value !== 'undefined')
  const label = names.length > 0 ? `${names.join(' / ')} - ` : ''
  return `${label}${account.hash} (${account.accountId})`
}

/**
 * Resolves the accountId of the account to remove
 * @param options - The remove options provided by the user
 * @returns The accountId of the account to remove
 */
async function resolveRemoveAccountId(options: RemoveAccountOptions): Promise<string> {
  const listedAccounts = await getListedAccounts()

  if (listedAccounts.length === 0) {
    console.log('No Jami accounts are available.')
    process.exit(1)
  }

  const accountId = options.accountId?.trim()
  if (accountId) {
    const account = findAccountToRemove(listedAccounts, accountId)
    if (!account) {
      console.error(`Account not found: ${accountId}`)
      process.exit(1)
    }
    return account.accountId
  }

  if (!process.stdin.isTTY) {
    console.error('Account ID is required. Use --accountId <accountId>.')
    process.exit(1)
  }

  const selectedIndex = await choose(
    'Which account should be removed?',
    listedAccounts.map((account) => formatRemoveChoice(account)),
  )
  return listedAccounts[selectedIndex].accountId
}

/**
 * Remove a Jami account given the options
 * @param removeArgs The arguments for the `accounts remove` command provided by the user
 */
async function removeAccountCommand(removeArgs: string[]): Promise<void> {
  const options = parseRemoveAccountArgs(removeArgs)
  if (options.help) {
    printRemoveUsage()
    return
  }

  loadEnv()
  let exitCode = 0

  try {
    const accountId = await resolveRemoveAccountId(options)
    await removeCliAccountRequest(accountId)
    console.log(`Jami account removed: ${accountId}`)
  } catch (error) {
    exitCode = 1
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
  } finally {
    closePrompt()
    process.exit(exitCode)
  }
}

/**
 *
 * @param accountsSubcommand - The subcommand provided by the user
 * @returns The resolved subcommand or undefined if the subcommand could not be determined
 */
async function resolveAccountsSubcommand(accountsSubcommand: string): Promise<AccountsSubcommand | undefined> {
  const subcommand = accountsSubcommand as AccountsSubcommand

  // Check if the subcommand provided is one we can handle
  if (ACCOUNTS_SUBCOMMANDS.includes(subcommand)) {
    return subcommand
  }

  // We are in TTY, determine the subcommand interactively
  if (!subcommand && process.stdin.isTTY) {
    const index = await choose('What would you like to do?', [
      'Create a new account',
      'List accounts',
      'Remove an account',
    ])
    return ACCOUNTS_SUBCOMMANDS[index]
  }
  return undefined
}

/**
 * Processes the arguments provided for the accounts command and runs
 * the appropriate account management subcommand.
 * @param args - The account management subcommand provided by the user
 */
export async function accountsCommand(args: string[]): Promise<void> {
  // Print top-level help only when no subcommand is provided.
  if (args[0] === '--help' || args[0] === '-h' || (!args[0] && (args.includes('--help') || args.includes('-h')))) {
    printAccountsUsage()
    return
  }

  // Determine the account subcommand provided by the user (if any)
  const subcommand = await resolveAccountsSubcommand(args[0])
  // Get the arguments of the subcommand
  const subcommandArgs = args.slice(subcommand === args[0] ? 1 : 0)

  switch (subcommand) {
    case 'create':
      await createAccountCommand(subcommandArgs)
      break
    case 'list':
      await listAccountsCommand(subcommandArgs)
      break
    case 'remove':
      await removeAccountCommand(subcommandArgs)
      break
    default:
      console.error(args[0] ? `Unknown subcommand: ${args[0]}` : 'A subcommand is required in non-interactive mode.')
      printAccountsUsage()
      process.exit(1)
  }
}
