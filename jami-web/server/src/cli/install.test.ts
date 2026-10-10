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
import { afterEach, describe, it, mock } from 'node:test'
import { promisify } from 'node:util'

import { renderLaunchAgent, renderSystemdUnit, uninstallCommand } from './install.js'

interface Command {
  command: string
  args: string[]
}

type CommandResult = { stdout: string; stderr: string }
type CommandHandler = (command: string, args: string[]) => Promise<CommandResult>

const processPlatformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform')
if (!processPlatformDescriptor) {
  throw new Error('Unable to determine the process platform descriptor.')
}

function commandError(message: string, code = 1): Error & { code: number } {
  return Object.assign(new Error(message), { code })
}

function commandResult(stdout = '', stderr = ''): CommandResult {
  return { stdout, stderr }
}

async function setupUninstall(platform: 'darwin' | 'linux', unitFileExists: boolean, commandHandler: CommandHandler) {
  const commands: Command[] = []
  const removedPaths: string[] = []
  const runSystemctl = async (command: string, args: string[]) => {
    commands.push({ command, args })
    return commandHandler(command, args)
  }
  const execFile = Object.assign(
    (command: string, args: string[], callback: (error: Error | null, stdout: string, stderr: string) => void) => {
      void runSystemctl(command, args).then(
        ({ stdout, stderr }) => callback(null, stdout, stderr),
        (error) => callback(error, '', ''),
      )
    },
    { [promisify.custom]: runSystemctl },
  )

  mock.module('node:child_process', {
    namedExports: {
      execFile,
    },
  })
  mock.module('node:fs', {
    namedExports: {
      existsSync: () => unitFileExists,
    },
  })
  mock.module('node:fs/promises', {
    namedExports: {
      chmod: async () => undefined,
      mkdir: async () => undefined,
      rm: async (path: string) => {
        removedPaths.push(path)
      },
      writeFile: async () => undefined,
    },
  })
  Object.defineProperty(process, 'platform', { value: platform })

  return {
    installModule: await import(`./install.ts?uninstall=${Date.now()}-${Math.random()}`),
    commands,
    removedPaths,
  }
}

describe('startup service installer', () => {
  afterEach(() => {
    mock.restoreAll()
    Object.defineProperty(process, 'platform', processPlatformDescriptor)
  })

  it('renders a systemd user service with exact executable paths', () => {
    const unit = renderSystemdUnit('/opt/node/bin/node', '/opt/jami web/dist/cli.js')

    assert.match(unit, /^Description=Jami Web$/m)
    assert.match(unit, /^ExecStart="\/opt\/node\/bin\/node" "\/opt\/jami web\/dist\/cli\.js" start$/m)
    assert.match(unit, /^Environment=NODE_ENV=production$/m)
    assert.match(unit, /^WantedBy=default\.target$/m)
  })

  it('escapes systemd path metacharacters', () => {
    const unit = renderSystemdUnit('/opt/node%20/bin/node', '/opt/jami\\"web/cli.js')

    assert.match(unit, /ExecStart="\/opt\/node%%20\/bin\/node" "\/opt\/jami\\\\\\"web\/cli\.js" start/)
  })

  it('renders a system-wide service with a dedicated account and data directory', () => {
    const unit = renderSystemdUnit('/usr/bin/node', '/usr/bin/jami-web', {
      scope: 'system',
      user: 'jami-web',
      home: '/var/lib/jami-web',
    })

    assert.match(unit, /^User=jami-web$/m)
    assert.match(unit, /^Group=jami-web$/m)
    assert.match(unit, /^Environment="HOME=\/var\/lib\/jami-web"$/m)
    assert.match(unit, /^Environment="JAMI_WEB_DATA_DIR=\/var\/lib\/jami-web"$/m)
    assert.match(unit, /^StateDirectory=jami-web$/m)
    assert.match(unit, /^StateDirectoryMode=0700$/m)
    assert.match(unit, /^WantedBy=multi-user\.target$/m)
  })

  it('renders a launch agent with escaped executable paths', () => {
    const plist = renderLaunchAgent('/opt/node&tools/node', '/opt/jami<web>/cli.js')

    assert.match(plist, /<string>\/opt\/node&amp;tools\/node<\/string>/)
    assert.match(plist, /<string>\/opt\/jami&lt;web&gt;\/cli\.js<\/string>/)
    assert.match(plist, /<key>RunAtLoad<\/key>\s*<true\/>/)
    assert.match(plist, /<key>SuccessfulExit<\/key>\s*<false\/>/)
  })

  it('documents how to uninstall the startup service', async () => {
    const logs: string[] = []
    const logMock = mock.method(console, 'log', (...args: unknown[]) => {
      logs.push(args.map(String).join(' '))
    })

    try {
      await uninstallCommand(['--help'])
    } finally {
      logMock.mock.restore()
    }

    assert.match(logs.join('\n'), /^Usage: jami-web uninstall/m)
    assert.match(logs.join('\n'), /--global/)
    assert.match(logs.join('\n'), /Stop and remove/)
  })

  it('removes an installed Linux systemd service', async () => {
    const { installModule, commands, removedPaths } = await setupUninstall('linux', true, async () => commandResult())

    await installModule.uninstallCommand([])

    assert.deepEqual(commands, [
      { command: 'systemctl', args: ['--user', 'disable', '--now', 'jami-web.service'] },
      { command: 'systemctl', args: ['--user', 'daemon-reload'] },
    ])
    assert.equal(removedPaths.length, 1)
  })

  it('reports a Linux systemd service as not installed when its unit is absent', async () => {
    const { installModule, commands, removedPaths } = await setupUninstall('linux', false, async (_command, args) => {
      if (args[1] === 'disable') {
        throw commandError('Unit file jami-web.service does not exist.')
      }
      return commandResult('not-found\n')
    })

    await installModule.uninstallCommand([])

    assert.deepEqual(commands, [
      { command: 'systemctl', args: ['--user', 'disable', '--now', 'jami-web.service'] },
      { command: 'systemctl', args: ['--user', 'show', '--property=LoadState', '--value', 'jami-web.service'] },
    ])
    assert.deepEqual(removedPaths, [])
  })

  it('stops a loaded Linux systemd service after its unit file was removed', async () => {
    const { installModule, commands } = await setupUninstall('linux', false, async (_command, args) => {
      if (args[1] === 'disable') {
        throw commandError('Unit file jami-web.service does not exist.')
      }
      if (args[1] === 'show') {
        return commandResult('loaded\n')
      }
      return commandResult()
    })

    await installModule.uninstallCommand([])

    assert.deepEqual(commands, [
      { command: 'systemctl', args: ['--user', 'disable', '--now', 'jami-web.service'] },
      { command: 'systemctl', args: ['--user', 'show', '--property=LoadState', '--value', 'jami-web.service'] },
      { command: 'systemctl', args: ['--user', 'stop', 'jami-web.service'] },
      { command: 'systemctl', args: ['--user', 'daemon-reload'] },
    ])
  })

  it('reports a Linux systemd command failure', async () => {
    const { installModule, commands } = await setupUninstall('linux', true, async () => {
      throw commandError('Failed to connect to bus.')
    })

    await assert.rejects(() => installModule.uninstallCommand([]), /Failed to connect to bus/)

    assert.deepEqual(commands, [{ command: 'systemctl', args: ['--user', 'disable', '--now', 'jami-web.service'] }])
  })

  it('removes an installed macOS launch agent', async () => {
    const { installModule, commands, removedPaths } = await setupUninstall('darwin', true, async () => commandResult())

    await installModule.uninstallCommand([])

    assert.deepEqual(commands, [
      { command: 'launchctl', args: ['print', `gui/${process.getuid?.()}/net.jami.web`] },
      { command: 'launchctl', args: ['bootout', `gui/${process.getuid?.()}/net.jami.web`] },
    ])
    assert.equal(removedPaths.length, 1)
  })

  it('reports a macOS launch agent as not installed when it is not loaded', async () => {
    const { installModule, commands, removedPaths } = await setupUninstall('darwin', false, async () => {
      throw commandError('Could not find service.', 113)
    })

    await installModule.uninstallCommand([])

    assert.deepEqual(commands, [{ command: 'launchctl', args: ['print', `gui/${process.getuid?.()}/net.jami.web`] }])
    assert.deepEqual(removedPaths, [])
  })

  it('reports a macOS launchctl command failure', async () => {
    const { installModule, commands } = await setupUninstall('darwin', true, async (_command, args) => {
      if (args[0] === 'bootout') {
        throw commandError('Operation not permitted.')
      }
      return commandResult()
    })

    await assert.rejects(() => installModule.uninstallCommand([]), /Operation not permitted/)

    assert.deepEqual(commands, [
      { command: 'launchctl', args: ['print', `gui/${process.getuid?.()}/net.jami.web`] },
      { command: 'launchctl', args: ['bootout', `gui/${process.getuid?.()}/net.jami.web`] },
    ])
  })
})
