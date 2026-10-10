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

import { join, resolve } from 'node:path'

import { dataDir } from './env.js'

export interface RuntimeSettings {
  nodeEnv: string
  isDev: boolean
  publicPort: number
  publicHost?: string
  cliControlSocketPath: string
}

export const DEFAULT_PUBLIC_PORT_DEV = 5002
export const DEFAULT_PUBLIC_PORT_PROD = 8080
export const DEFAULT_CLI_CONTROL_SOCKET_NAME = 'cli.sock'

function parsePort(rawPort: string | undefined, fallbackPort: number, envName: string): number {
  if (!rawPort) {
    return fallbackPort
  }

  const parsedPort = Number.parseInt(rawPort, 10)
  if (Number.isNaN(parsedPort)) {
    throw new Error(`Invalid ${envName} value: "${rawPort}". ${envName} must be a number.`)
  }

  return parsedPort
}

function getRuntimeDirectory(): string | undefined {
  const runtimeDirectory = process.env.RUNTIME_DIRECTORY
  if (!runtimeDirectory) {
    return undefined
  }

  return runtimeDirectory
    .split(':')
    .map((entry) => entry.trim())
    .find((entry) => entry.length > 0)
}

export function resolveCliControlSocketPath(): string {
  if (process.env.JAMI_WEB_CLI_SOCKET) {
    return resolve(process.env.JAMI_WEB_CLI_SOCKET)
  }

  const runtimeDirectory = getRuntimeDirectory()
  if (runtimeDirectory) {
    return join(runtimeDirectory, DEFAULT_CLI_CONTROL_SOCKET_NAME)
  }

  if (process.env.XDG_RUNTIME_DIR) {
    return join(process.env.XDG_RUNTIME_DIR, 'jami-web', DEFAULT_CLI_CONTROL_SOCKET_NAME)
  }

  return join(dataDir, DEFAULT_CLI_CONTROL_SOCKET_NAME)
}

export function resolveRuntimeSettings(): RuntimeSettings {
  const nodeEnv = process.env.NODE_ENV || 'production'
  const isDev = nodeEnv === 'development'
  const defaultPublicPort = isDev ? DEFAULT_PUBLIC_PORT_DEV : DEFAULT_PUBLIC_PORT_PROD

  return {
    nodeEnv,
    isDev,
    publicPort: parsePort(process.env.PORT, defaultPublicPort, 'PORT'),
    publicHost: process.env.HOST,
    cliControlSocketPath: resolveCliControlSocketPath(),
  }
}
