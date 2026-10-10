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
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { chmod, mkdir, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const SERVICE_NAME = 'jami-web.service'
const SYSTEM_SERVICE_PATH = `/etc/systemd/system/${SERVICE_NAME}`
const SYSTEM_SERVICE_USER = 'jami-web'
const SYSTEM_DATA_DIRECTORY = '/var/lib/jami-web'
const LAUNCH_AGENT_LABEL = 'net.jami.web'

type SystemdUnitOptions =
  | { scope: 'user' }
  | {
      scope: 'system'
      user: string
      home: string
    }

function systemdQuote(value: string): string {
  return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('%', '%%')}"`
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

export function renderSystemdUnit(
  nodePath: string,
  cliPath: string,
  options: SystemdUnitOptions = { scope: 'user' },
): string {
  const systemSettings =
    options.scope === 'system'
      ? `User=${options.user}
Group=${options.user}
Environment=${systemdQuote(`HOME=${options.home}`)}
Environment=${systemdQuote(`JAMI_WEB_DATA_DIR=${options.home}`)}
StateDirectory=jami-web
StateDirectoryMode=0700
`
      : ''
  const target = options.scope === 'system' ? 'multi-user.target' : 'default.target'

  return `[Unit]
Description=Jami Web
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=${systemdQuote(nodePath)} ${systemdQuote(cliPath)} start
${systemSettings}Environment=NODE_ENV=production
Restart=on-failure
RestartSec=10

[Install]
WantedBy=${target}
`
}

export function renderLaunchAgent(nodePath: string, cliPath: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LAUNCH_AGENT_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${escapeXml(nodePath)}</string>
    <string>${escapeXml(cliPath)}</string>
    <string>start</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>NODE_ENV</key>
    <string>production</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
  </dict>
</dict>
</plist>
`
}

async function installSystemdService(nodePath: string, cliPath: string): Promise<string> {
  const servicePath = join(homedir(), '.config', 'systemd', 'user', SERVICE_NAME)
  await mkdir(dirname(servicePath), { recursive: true })
  await writeFile(servicePath, renderSystemdUnit(nodePath, cliPath), { mode: 0o644 })
  await chmod(servicePath, 0o644)

  try {
    await execFileAsync('systemctl', ['--user', 'daemon-reload'])
    await execFileAsync('systemctl', ['--user', 'enable', '--now', SERVICE_NAME])
  } catch (error) {
    throw new Error(`Failed to enable the systemd user service: ${(error as Error).message}`, {
      cause: error,
    })
  }

  return servicePath
}

async function ensureGlobalServiceUser(): Promise<void> {
  if (process.getuid?.() !== 0) {
    throw new Error('Global installation requires root privileges. Run "sudo jami-web install --global".')
  }

  let userExists = false
  try {
    await execFileAsync('id', ['--user', SYSTEM_SERVICE_USER])
    userExists = true
  } catch (error) {
    if ((error as CommandError).code !== 1) {
      throw error
    }
  }

  if (userExists) {
    const { stdout } = await execFileAsync('getent', ['passwd', SYSTEM_SERVICE_USER])
    const fields = stdout.trim().split(':')
    const home = fields[5]
    const shell = fields[6]
    if (home !== SYSTEM_DATA_DIRECTORY || (shell !== '/usr/sbin/nologin' && shell !== '/bin/false')) {
      throw new Error(
        `The existing "${SYSTEM_SERVICE_USER}" account is not a compatible system account ` +
          `(expected home ${SYSTEM_DATA_DIRECTORY} and a disabled login shell).`,
      )
    }
  }

  await execFileAsync('groupadd', ['--system', '--force', SYSTEM_SERVICE_USER])
  if (userExists) {
    return
  }

  const shell = existsSync('/usr/sbin/nologin') ? '/usr/sbin/nologin' : '/bin/false'
  await execFileAsync('useradd', [
    '--system',
    '--gid',
    SYSTEM_SERVICE_USER,
    '--home-dir',
    SYSTEM_DATA_DIRECTORY,
    '--no-create-home',
    '--shell',
    shell,
    SYSTEM_SERVICE_USER,
  ])
}

async function assertInvokingUserServiceIsAbsent(): Promise<void> {
  const invokingUser = process.env.SUDO_USER
  if (!invokingUser || invokingUser === 'root') {
    return
  }

  const { stdout } = await execFileAsync('getent', ['passwd', invokingUser])
  const invokingUserHome = stdout.trim().split(':')[5]
  if (!invokingUserHome) {
    throw new Error(`Could not resolve the home directory for ${invokingUser}.`)
  }

  const userServicePath = join(invokingUserHome, '.config', 'systemd', 'user', SERVICE_NAME)
  if (existsSync(userServicePath)) {
    throw new Error('A per-user service is already installed. Run "jami-web uninstall" before installing globally.')
  }
}

async function installGlobalSystemdService(nodePath: string, cliPath: string): Promise<string> {
  if (process.getuid?.() !== 0) {
    throw new Error('Global installation requires root privileges. Run "sudo jami-web install --global".')
  }
  await assertInvokingUserServiceIsAbsent()
  await ensureGlobalServiceUser()

  await writeFile(
    SYSTEM_SERVICE_PATH,
    renderSystemdUnit(nodePath, cliPath, {
      scope: 'system',
      user: SYSTEM_SERVICE_USER,
      home: SYSTEM_DATA_DIRECTORY,
    }),
    { mode: 0o644 },
  )
  await chmod(SYSTEM_SERVICE_PATH, 0o644)

  try {
    await execFileAsync('systemctl', ['daemon-reload'])
    await execFileAsync('systemctl', ['enable', '--now', SERVICE_NAME])
  } catch (error) {
    throw new Error(`Failed to enable the system-wide systemd service: ${(error as Error).message}`, {
      cause: error,
    })
  }

  return SYSTEM_SERVICE_PATH
}

async function uninstallSystemdService(): Promise<boolean> {
  const servicePath = join(homedir(), '.config', 'systemd', 'user', SERVICE_NAME)

  try {
    await execFileAsync('systemctl', ['--user', 'disable', '--now', SERVICE_NAME])
  } catch (error) {
    if (existsSync(servicePath)) {
      throw new Error(`Failed to remove the systemd user service: ${(error as Error).message}`, {
        cause: error,
      })
    }

    try {
      const { stdout } = await execFileAsync('systemctl', [
        '--user',
        'show',
        '--property=LoadState',
        '--value',
        SERVICE_NAME,
      ])
      if (stdout.trim() === 'not-found') {
        return false
      }

      await execFileAsync('systemctl', ['--user', 'stop', SERVICE_NAME])
      await execFileAsync('systemctl', ['--user', 'daemon-reload'])
      return true
    } catch (recoveryError) {
      throw new Error(`Failed to remove the systemd user service: ${(recoveryError as Error).message}`, {
        cause: recoveryError,
      })
    }
  }

  if (existsSync(servicePath)) {
    await rm(servicePath)
  }
  await execFileAsync('systemctl', ['--user', 'daemon-reload'])

  return true
}

async function uninstallGlobalSystemdService(): Promise<boolean> {
  if (process.getuid?.() !== 0) {
    throw new Error('Global uninstallation requires root privileges. Run "sudo jami-web uninstall --global".')
  }
  if (!existsSync(SYSTEM_SERVICE_PATH)) {
    return false
  }

  try {
    await execFileAsync('systemctl', ['disable', '--now', SERVICE_NAME])
    await rm(SYSTEM_SERVICE_PATH)
    await execFileAsync('systemctl', ['daemon-reload'])
  } catch (error) {
    throw new Error(`Failed to remove the system-wide systemd service: ${(error as Error).message}`, {
      cause: error,
    })
  }

  return true
}

interface CommandError extends Error {
  code?: number | string
}

async function isLaunchAgentLoaded(target: string): Promise<boolean> {
  try {
    await execFileAsync('launchctl', ['print', target])
    return true
  } catch (error) {
    if ((error as CommandError).code === 113) {
      return false
    }
    throw error
  }
}

async function installLaunchAgent(nodePath: string, cliPath: string): Promise<string> {
  const uid = process.getuid?.()
  if (uid === undefined) {
    throw new Error('Unable to determine the current user ID.')
  }

  const launchAgentPath = join(homedir(), 'Library', 'LaunchAgents', `${LAUNCH_AGENT_LABEL}.plist`)
  const domain = `gui/${uid}`
  const target = `${domain}/${LAUNCH_AGENT_LABEL}`

  await mkdir(dirname(launchAgentPath), { recursive: true })
  await writeFile(launchAgentPath, renderLaunchAgent(nodePath, cliPath), { mode: 0o644 })
  await chmod(launchAgentPath, 0o644)

  try {
    if (await isLaunchAgentLoaded(target)) {
      await execFileAsync('launchctl', ['bootout', target])
    }
    await execFileAsync('launchctl', ['bootstrap', domain, launchAgentPath])
    await execFileAsync('launchctl', ['enable', target])
    await execFileAsync('launchctl', ['kickstart', '-k', target])
  } catch (error) {
    throw new Error(`Failed to enable the launch agent: ${(error as Error).message}`, {
      cause: error,
    })
  }

  return launchAgentPath
}

async function uninstallLaunchAgent(): Promise<boolean> {
  const uid = process.getuid?.()
  if (uid === undefined) {
    throw new Error('Unable to determine the current user ID.')
  }

  const launchAgentPath = join(homedir(), 'Library', 'LaunchAgents', `${LAUNCH_AGENT_LABEL}.plist`)
  const target = `gui/${uid}/${LAUNCH_AGENT_LABEL}`
  const exists = existsSync(launchAgentPath)

  try {
    const loaded = await isLaunchAgentLoaded(target)
    if (loaded) {
      await execFileAsync('launchctl', ['bootout', target])
    }
    if (exists) {
      await rm(launchAgentPath)
    }
    return exists || loaded
  } catch (error) {
    throw new Error(`Failed to remove the launch agent: ${(error as Error).message}`, {
      cause: error,
    })
  }
}

export async function installCommand(args: string[]): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`Usage: jami-web install [--global]

Install Jami Web as a startup service and start it immediately.
By default, uses a systemd user service on Linux and a LaunchAgent on macOS.

Options:
  --global    Linux only: install a system-wide service that starts at boot
  --help      Show this help message

Run the global installation with: sudo jami-web install --global`)
    return
  }

  const unknownOption = args.find((arg) => arg !== '--global')
  if (unknownOption) {
    throw new Error(`Unknown option: ${unknownOption}`)
  }

  const global = args.includes('--global')
  const nodePath = resolve(process.execPath)
  const cliPath = resolve(process.argv[1])
  let servicePath: string

  if (process.platform === 'linux') {
    if (!global && existsSync(SYSTEM_SERVICE_PATH)) {
      throw new Error('A system-wide service is already installed. Remove it with "sudo jami-web uninstall --global".')
    }
    servicePath = global
      ? await installGlobalSystemdService(nodePath, cliPath)
      : await installSystemdService(nodePath, cliPath)
  } else if (process.platform === 'darwin') {
    if (global) {
      throw new Error('Global startup installation is currently supported only on Linux.')
    }
    servicePath = await installLaunchAgent(nodePath, cliPath)
  } else {
    throw new Error(`Startup installation is not supported on ${process.platform}.`)
  }

  console.log('Jami Web is installed and running as a startup service.')
  console.log(`  Service definition: ${servicePath}`)
}

export async function uninstallCommand(args: string[]): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`Usage: jami-web uninstall [--global]

Stop and remove a Jami Web startup service.

Options:
  --global    Linux only: stop and remove the system-wide service
  --help      Show this help message`)
    return
  }

  const unknownOption = args.find((arg) => arg !== '--global')
  if (unknownOption) {
    throw new Error(`Unknown option: ${unknownOption}`)
  }

  const global = args.includes('--global')
  let removed: boolean
  if (process.platform === 'linux') {
    removed = global ? await uninstallGlobalSystemdService() : await uninstallSystemdService()
  } else if (process.platform === 'darwin') {
    if (global) {
      throw new Error('Global startup installation is currently supported only on Linux.')
    }
    removed = await uninstallLaunchAgent()
  } else {
    throw new Error(`Startup installation is not supported on ${process.platform}.`)
  }

  console.log(removed ? 'Jami Web startup service removed.' : 'Jami Web startup service is not installed.')
}
