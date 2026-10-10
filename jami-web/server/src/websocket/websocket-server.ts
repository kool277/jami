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
import { IncomingMessage } from 'node:http'
import { Duplex } from 'node:stream'

import { WebSocketMessage, WebSocketMessageTable, WebSocketMessageType } from '@savoirfairelinux/jami-web-common'
import log from 'loglevel'
import { Container, Service } from 'typedi'
import { URL } from 'whatwg-url'
import * as WebSocket from 'ws'

import { Accounts } from '../storage/accounts.js'
import { isElectronMode } from '../utils/electron.js'
import { verifyJwt } from '../utils/jwt.js'
const accounts = Container.get(Accounts)

type WebSocketCallback<T extends WebSocketMessageType> = (accountId: string, data: WebSocketMessageTable[T]) => void

type WebSocketCallbacks = {
  [key in WebSocketMessageType]: Set<WebSocketCallback<key>>
}

const buildWebSocketCallbacks = (): WebSocketCallbacks => {
  const webSocketCallback = {} as WebSocketCallbacks
  for (const messageType of Object.values(WebSocketMessageType)) {
    // TODO: type this properly to prevent mistakes
    // The end result of the function is still typed properly
    webSocketCallback[messageType] = new Set() as any
  }
  return webSocketCallback
}

@Service()
export class WebSocketServer {
  private wss = new WebSocket.WebSocketServer({ noServer: true })
  private sockets = new Map<string, WebSocket.WebSocket[]>()
  private callbacks: WebSocketCallbacks

  constructor() {
    this.callbacks = buildWebSocketCallbacks()

    this.wss.on('connection', (ws: WebSocket.WebSocket, _request: IncomingMessage, accountId: string) => {
      log.info('New connection for account', accountId)
      const accountSockets = this.sockets.get(accountId)
      if (accountSockets) {
        accountSockets.push(ws)
      } else {
        this.sockets.set(accountId, [ws])
      }

      ws.on('message', <T extends WebSocketMessageType>(messageString: string) => {
        const message: WebSocketMessage<T> = JSON.parse(messageString)
        if (message.type === undefined || message.data === undefined) {
          log.warn('WebSocket message is not a valid WebSocketMessage (missing type or data fields)')
          return
        }

        if (!Object.values(WebSocketMessageType).includes(message.type)) {
          log.warn(`Invalid WebSocket message type: ${message.type}`)
          return
        }

        const callbacks = this.callbacks[message.type]
        for (const callback of callbacks) {
          callback(accountId, message.data)
        }
      })

      ws.on('close', () => {
        log.info('Closing connection for account', accountId)

        if (accounts.isInPendingAccounts(accountId)) {
          accounts.removeAndDeletePendingAccount(accountId)
          accounts.save()
        }

        const accountSockets = this.sockets.get(accountId)
        if (accountSockets === undefined) {
          return
        }

        const index = accountSockets.indexOf(ws)
        if (index !== -1) {
          accountSockets.splice(index, 1)
          if (accountSockets.length === 0) {
            // Presence subscriptions are deliberately kept alive: the daemon
            // tracks buddy state for the account, so a reconnecting client can
            // be served an up-to-date snapshot (see PresenceService.getStatuses).
            this.sockets.delete(accountId)
          }
        }
      })
    })
  }

  async upgrade(request: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> {
    // Do not use parseURL because it returns a URLRecord and not a URL
    const url = new URL(request.url ?? '/api', 'http://localhost/api')
    const token = url.searchParams.get('accessToken') ?? undefined
    if (token === undefined) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
      return
    }

    try {
      const { payload } = await verifyJwt(token)
      const accountId = payload.accountId as string

      if (!isElectronMode && !accounts.isSessionValid(accountId, payload.iat)) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
        socket.destroy()
        return
      }

      log.info('Authentication successful for account', accountId)
      this.wss.handleUpgrade(request, socket, head, (ws) => {
        this.wss.emit('connection', ws, request, accountId)
      })
    } catch (e) {
      log.debug('Authentication failed:', e)
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
    }
  }

  bind<T extends WebSocketMessageType>(type: T, callback: WebSocketCallback<T>): void {
    this.callbacks[type].add(callback)
  }

  closeAccountSockets(accountId: string): void {
    for (const socket of this.sockets.get(accountId) ?? []) {
      socket.close(4401, 'Session invalidated')
    }
  }

  send<T extends WebSocketMessageType>(accountId: string, type: T, data: WebSocketMessageTable[T]): boolean {
    const accountSockets = this.sockets.get(accountId)
    if (accountSockets === undefined) {
      return false
    }

    const webSocketMessageString = JSON.stringify({ type, data })
    for (const accountSocket of accountSockets) {
      accountSocket.send(webSocketMessageString)
    }
    return true
  }
}
