#!/usr/bin/env node
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
import { accountsCommand } from './cli/account.js'
import { createBotCommand } from './cli/bot.js'
import { configCommand } from './cli/config.js'
import { doctorCommand } from './cli/doctor.js'
import { genkeyCommand } from './cli/genkeys.js'
import { installCommand, uninstallCommand } from './cli/install.js'
import { setupCommand } from './cli/setup.js'

const args = process.argv.slice(2)
const command = args[0]

function printUsage() {
  console.log(`Usage: jami-web [command] [options]

Commands:
  start       Start the Jami Web server (default)
  install     Install and start Jami Web as a per-user startup service
  uninstall   Stop and remove the per-user Jami Web startup service
  setup       Interactive setup wizard (create admin account and configure server)
  genkeys     Generate JWT signing keys and write them to .env
  accounts    Manage Jami accounts (create, list, remove)
  create-bot  Create a Jami bot account and API token
  config      Show or update server configuration
  doctor      Run health checks on the installation and configuration

Options:
  --help      Show this help message

Run 'jami-web <command> --help' for more information on a command.`)
}

async function startCommand() {
  process.env.NODE_ENV = process.env.NODE_ENV || 'production'
  await import('./index.js')
}

async function main() {
  if (command === '--help' || command === '-h') {
    printUsage()
    process.exit(0)
  }

  if (!command) {
    await startCommand()
    return
  }

  switch (command) {
    case 'setup':
      await setupCommand(args.slice(1))
      break
    case 'genkeys':
      await genkeyCommand(args.slice(1))
      break
    case 'install':
      await installCommand(args.slice(1))
      break
    case 'uninstall':
      await uninstallCommand(args.slice(1))
      break
    case 'accounts':
      await accountsCommand(args.slice(1))
      break
    case 'create-bot':
      await createBotCommand(args.slice(1))
      break
    case 'config':
      await configCommand(args.slice(1))
      break
    case 'doctor':
      await doctorCommand(args.slice(1))
      break
    case 'start': {
      await startCommand()
      break
    }
    default:
      console.error(`Unknown command: ${command}`)
      printUsage()
      process.exit(1)
  }
}

main().catch((err) => {
  console.error('Fatal error:', err.message)
  process.exit(1)
})
