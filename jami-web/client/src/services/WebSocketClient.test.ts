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
import { afterEach, describe, expect, it, vi } from 'vitest'

import { getWebSocketUrl, WebSocketClient } from './WebSocketClient.js'

class MockWebSocket {
  static instances: MockWebSocket[] = []
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSED = 3
  readyState = MockWebSocket.CONNECTING
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent<string>) => void) | null = null
  onopen: (() => void) | null = null

  constructor(_url: URL) {
    MockWebSocket.instances.push(this)
  }

  close() {}

  send() {}
}

describe('WebSocketClient', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    MockWebSocket.instances = []
  })

  it('uses the page transport for the WebSocket connection', () => {
    expect(getWebSocketUrl('http://localhost:8080/api').toString()).toBe('ws://localhost:8080/api')
    expect(getWebSocketUrl('https://chat.example.com/api').toString()).toBe('wss://chat.example.com/api')
  })

  it('logs out and does not reconnect after the server closes an invalidated session', () => {
    vi.useFakeTimers()
    vi.stubGlobal('WebSocket', MockWebSocket)
    const client = new WebSocketClient()
    const onSessionInvalidated = vi.fn()

    client.connect('http://localhost/api', 'invalidated-token', onSessionInvalidated)
    MockWebSocket.instances[0].readyState = MockWebSocket.CLOSED
    MockWebSocket.instances[0].onclose?.({ code: 4401 } as CloseEvent)
    vi.advanceTimersByTime(2000)

    expect(onSessionInvalidated).toHaveBeenCalledOnce()
    expect(MockWebSocket.instances).toHaveLength(1)
  })

  it('still logs out on an invalidated session after reconnecting from a dropped connection', () => {
    vi.useFakeTimers()
    vi.stubGlobal('WebSocket', MockWebSocket)
    const client = new WebSocketClient()
    const onSessionInvalidated = vi.fn()

    client.connect('http://localhost/api', 'access-token', onSessionInvalidated)
    MockWebSocket.instances[0].readyState = MockWebSocket.CLOSED
    MockWebSocket.instances[0].onclose?.({ code: 1006 } as CloseEvent)
    vi.advanceTimersByTime(2000)

    expect(MockWebSocket.instances).toHaveLength(2)

    MockWebSocket.instances[1].readyState = MockWebSocket.CLOSED
    MockWebSocket.instances[1].onclose?.({ code: 4401 } as CloseEvent)
    vi.advanceTimersByTime(2000)

    expect(onSessionInvalidated).toHaveBeenCalledOnce()
    expect(MockWebSocket.instances).toHaveLength(2)
  })
})
