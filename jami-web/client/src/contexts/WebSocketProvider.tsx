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
import { useEffect, useMemo, useRef } from 'react'

import { createOptionalContext } from '../hooks/createOptionalContext.js'
import { WebSocketClient } from '../services/WebSocketClient.js'
import { apiUrl } from '../utils/constants.js'
import { WithChildren } from '../utils/utils.js'
import { useAuthContext } from './AuthProvider.js'

export interface IWebSocketContext {
  bind: WebSocketClient['bind']
  unbind: WebSocketClient['unbind']
  send: WebSocketClient['send']
}

const optionalWebSocketContext = createOptionalContext<IWebSocketContext>('WebSocketContext')
export const useWebSocketContext = optionalWebSocketContext.useOptionalContext

export default ({ children }: WithChildren) => {
  const webSocketClientRef = useRef<WebSocketClient>(new WebSocketClient())

  const { token: accessToken, logout } = useAuthContext()

  useEffect(() => {
    webSocketClientRef.current.connect(apiUrl, accessToken, logout)
  }, [accessToken, logout])

  const value = useMemo(
    () => ({
      bind: webSocketClientRef.current.bind.bind(webSocketClientRef.current),
      unbind: webSocketClientRef.current.unbind.bind(webSocketClientRef.current),
      send: webSocketClientRef.current.send.bind(webSocketClientRef.current),
    }),
    [],
  )

  return <optionalWebSocketContext.Context value={value}>{children}</optionalWebSocketContext.Context>
}
