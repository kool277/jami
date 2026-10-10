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

import { WebSocketMessage, WebSocketMessageTable, WebSocketMessageType } from '@savoirfairelinux/jami-web-common'

type WebSocketCallback<T extends WebSocketMessageType> = (data: WebSocketMessageTable[T]) => void

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

export const getWebSocketUrl = (apiUrl: string): URL => {
  const url = new URL(apiUrl)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return url
}

export class WebSocketClient {
  private webSocket: WebSocket | null = null
  private accessToken: string | null = null
  private callbacks: WebSocketCallbacks = buildWebSocketCallbacks()
  private reconnectionTimeout: ReturnType<typeof setTimeout> | null = null
  private onSessionInvalidated?: () => void

  // Queue of messages waiting for connection
  // TODO: Add timeout (or something else) for messages that should be discarded when it takes too long
  private sendQueue: Parameters<WebSocketClient['send']>[] = []

  connect(apiUrl: string, accessToken: string, onSessionInvalidated?: () => void) {
    if (this.accessToken === accessToken) {
      if (this.webSocket?.readyState === WebSocket.OPEN || this.webSocket?.readyState === WebSocket.CONNECTING) {
        return // Connection is already OK
      }
    } else {
      // Clean up to make sure messages for previous token won't be sent or received accidentaly
      this.disconnect()
    }

    this.accessToken = accessToken
    // Reconnections re-enter this method without the caller's arguments, so the handler is kept on
    // the instance to survive them. Otherwise a dropped connection would silently disable logout.
    if (onSessionInvalidated) {
      this.onSessionInvalidated = onSessionInvalidated
    }
    const url = getWebSocketUrl(apiUrl)
    url.searchParams.set('accessToken', accessToken)

    this.webSocket = new WebSocket(url)
    const webSocket = this.webSocket

    webSocket.onopen = () => {
      console.debug('WebSocket connected')

      // Send queued messages
      const oldSendQueue = this.sendQueue
      this.sendQueue = []
      oldSendQueue.forEach(([type, data]) => this.send(type, data))
    }

    webSocket.onclose = (event) => {
      if (event.code === 4401) {
        console.debug('WebSocket session was invalidated')
        this.onSessionInvalidated?.()
        return
      }
      // Involuntary disconnection. See 'disconnect' method to disconnect voluntarily.
      console.debug(`WebSocket has been involuntarily disconnected (code: ${event.code}). Reconnecting...`)
      this.reconnectionTimeout = setTimeout(() => this.connect(apiUrl, accessToken), 2000)
    }

    webSocket.onmessage = <T extends WebSocketMessageType>(event: MessageEvent<string>) => {
      const messageString = event.data
      console.debug('WebSocket received message', messageString)

      const message: WebSocketMessage<T> = JSON.parse(messageString)
      if (!message.type || !message.data) {
        console.warn('WebSocket message is not a valid WebSocketMessage (missing type or data fields)')
        return
      }

      if (!Object.values(WebSocketMessageType).includes(message.type)) {
        console.warn(`Invalid WebSocket message type: ${message.type}`)
        return
      }

      const callbacksForType = this.callbacks[message.type]
      for (const callback of callbacksForType) {
        callback(message.data)
      }
    }

    webSocket.onerror = (event: Event) => {
      console.error('WebSocket errored', event)
    }
  }

  disconnect() {
    // Cancel any previous reconnection attempt
    if (this.reconnectionTimeout) {
      clearTimeout(this.reconnectionTimeout)
      this.reconnectionTimeout = null
    }

    this.sendQueue = []
    this.accessToken = null
    this.onSessionInvalidated = undefined

    if (this.webSocket) {
      this.webSocket.onclose = (event) =>
        console.debug(`WebSocket has been voluntarily disconnected (code: ${event.code})`)
      this.webSocket.close()
      this.webSocket = null
    }
  }

  bind<T extends WebSocketMessageType>(type: T, callback: (data: WebSocketMessageTable[T]) => void) {
    const callbacksForType = this.callbacks[type]
    callbacksForType.add(callback)
  }

  unbind<T extends WebSocketMessageType>(type: T, callback: (data: WebSocketMessageTable[T]) => void) {
    const callbacksForType = this.callbacks[type]
    callbacksForType.delete(callback)
  }

  send<T extends WebSocketMessageType>(type: T, data: WebSocketMessageTable[T]) {
    if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
      this.sendQueue.push([type, data])
      return
    }
    this.webSocket.send(JSON.stringify({ type, data }))
  }
}
