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
import 'reflect-metadata'

import { chmodSync, existsSync, lstatSync, mkdirSync, unlinkSync } from 'node:fs'
import { createServer } from 'node:http'
import { createConnection } from 'node:net'
import { dirname, resolve } from 'node:path'

import express, { json } from 'express'
import log from 'loglevel'
import { Container } from 'typedi'

import { App } from './app.js'
import { Jamid } from './jamid/jamid.js'
import { cliControlRouter } from './routers/cli-control-router.js'
import { SigningKeys } from './storage/signing-keys.js'
import { defaultEnvPath, loadEnv } from './utils/env.js'
import type { RuntimeSettings } from './utils/runtime.js'
import { resolveRuntimeSettings } from './utils/runtime.js'
import { WebSocketServer } from './websocket/websocket-server.js'

loadEnv()

let runtime: RuntimeSettings
try {
  runtime = resolveRuntimeSettings()
} catch (error) {
  console.error((error as Error).message)
  process.exit(1)
}

const KNOWN_NODE_ENVS = ['development', 'production', 'test']
const nodeEnv = runtime.nodeEnv
if (!KNOWN_NODE_ENVS.includes(nodeEnv)) {
  console.warn(
    `Warning: unknown NODE_ENV "${nodeEnv}". Expected one of: ${KNOWN_NODE_ENVS.join(', ')}. ` +
      `Defaulting to production behaviour.`,
  )
}

const isDev = runtime.isDev

log.setLevel(isDev ? 'trace' : 'error')

await Container.get(SigningKeys).build()
const jamid = Container.get(Jamid)
const app = Container.get(App)
const webSocketServer = Container.get(WebSocketServer)

const server = createServer()
const cliControlApp = express()
const cliControlServer = createServer(cliControlApp)

server.on('request', app.app)
server.on('upgrade', webSocketServer.upgrade.bind(webSocketServer))
cliControlApp.use(json())
cliControlApp.use('/cli', cliControlRouter)

server.listen(runtime.publicPort, runtime.publicHost)
server.on('error', onPublicApiError)
server.on('listening', onPublicApiListening)

try {
  await prepareCliControlSocketPath(runtime.cliControlSocketPath)
  await listenCliControlServer(cliControlServer, runtime.cliControlSocketPath)
  chmodSync(runtime.cliControlSocketPath, 0o600)
} catch (error) {
  console.error((error as Error).message)
  process.exit(1)
}

logCliControlListener()

process.once('SIGTERM', shutdown)
process.once('SIGINT', shutdown)

function onPublicApiError(error: NodeJS.ErrnoException) {
  if (error.syscall !== 'listen') {
    throw error
  }

  const bind = `Port ${runtime.publicPort}`

  switch (error.code) {
    case 'EACCES':
      console.error(
        `${bind} requires elevated privileges. ` +
          `Ports below 1024 are privileged; choose a port >= 1024 (e.g. PORT=8080) ` +
          `or run behind a reverse proxy.`,
      )
      process.exit(1)
      break
    case 'EADDRINUSE':
      console.error(
        `${bind} is already in use. ` +
          `Stop the process using it, or set a different port with PORT=<port>. ` +
          `Run "jami-web doctor" to check port availability.`,
      )
      process.exit(1)
      break
    default:
      throw error
  }
}

function onPublicApiListening() {
  const address = server.address()
  const bind = typeof address === 'string' ? `pipe ${address}` : `${address?.address}:${address?.port}`
  const envFile = process.env.JAMI_WEB_ENV_FILE ? resolve(process.env.JAMI_WEB_ENV_FILE) : defaultEnvPath
  // In development the UI is served by the Vite dev server (default :3000); in
  // production this server serves the built client on its own port.
  // ponytail: dev URL assumes Vite's default port 3000, as used across the repo.
  const port = typeof address === 'string' ? undefined : address?.port
  const webUrl = nodeEnv === 'development' ? 'http://localhost:3000' : `http://localhost:${port}`
  console.log('Jami Web server started')
  console.log(`  Environment: ${nodeEnv}`)
  console.log(`  Env file:    ${envFile}`)
  console.log(`  Listening:   ${bind}`)
  console.log(`  Web UI:      ${webUrl}`)
  console.log(`  CLI control: ${runtime.cliControlSocketPath}`)
  log.debug('Listening on ' + bind)
}

function canConnectToSocket(socketPath: string): Promise<boolean> {
  return new Promise((resolvePromise) => {
    const client = createConnection({ path: socketPath })
    client.once('connect', () => {
      client.end()
      resolvePromise(true)
    })
    client.once('error', () => {
      resolvePromise(false)
    })
  })
}

async function prepareCliControlSocketPath(socketPath: string): Promise<void> {
  const socketDirectory = dirname(socketPath)
  mkdirSync(socketDirectory, { recursive: true })

  if (!existsSync(socketPath)) {
    return
  }

  const existing = lstatSync(socketPath)
  if (!existing.isSocket()) {
    throw new Error(`CLI control socket path exists and is not a socket: ${socketPath}`)
  }

  if (await canConnectToSocket(socketPath)) {
    throw new Error(`CLI control socket is already in use: ${socketPath}`)
  }

  unlinkSync(socketPath)
}

async function listenCliControlServer(listener: ReturnType<typeof createServer>, socketPath: string): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const onError = (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        rejectPromise(
          new Error(
            `CLI control socket is already in use: ${socketPath}. ` +
              `Remove any stale socket file and restart jami-web.`,
          ),
        )
        return
      }

      if (error.code === 'EACCES') {
        rejectPromise(new Error(`CLI control socket requires write access: ${socketPath}`))
        return
      }

      rejectPromise(error)
    }

    listener.once('error', onError)
    listener.listen(socketPath, () => {
      listener.off('error', onError)
      resolvePromise()
    })
  })
}

function logCliControlListener(): void {
  const address = cliControlServer.address()
  if (!address) {
    console.warn('No CLI control listeners were started.')
    return
  }

  console.log(`  CLI listener:  ${typeof address === 'string' ? address : `${address.address}:${address.port}`}`)
}

function closeServer(serverToClose: ReturnType<typeof createServer>): Promise<void> {
  if (!serverToClose.listening) {
    return Promise.resolve()
  }

  return new Promise((resolvePromise) => {
    serverToClose.close(() => {
      resolvePromise()
    })
  })
}

function shutdown(signal: NodeJS.Signals) {
  log.debug(`${signal} received: shutting down server`)
  jamid.stop()

  Promise.all([closeServer(server), closeServer(cliControlServer)]).finally(() => {
    if (existsSync(runtime.cliControlSocketPath)) {
      try {
        if (lstatSync(runtime.cliControlSocketPath).isSocket()) {
          unlinkSync(runtime.cliControlSocketPath)
        }
      } catch {
        // Ignore cleanup failures during shutdown.
      }
    }

    log.debug('Server shut down')
    // Needed in order to actually exit the process as its shutdown is blocked by something else
    process.exit()
  })
}
