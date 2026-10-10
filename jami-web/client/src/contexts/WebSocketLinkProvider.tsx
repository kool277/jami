/*
 * Copyright (C) 2022-2024 Savoir-faire Linux Inc.
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
import { useEffect, useMemo, useRef, useState } from 'react'

import { createOptionalContext } from '../hooks/createOptionalContext.js'
import { WebSocketClient } from '../services/WebSocketClient.js'
import { apiUrl } from '../utils/constants.js'
import { WithChildren } from '../utils/utils.js'

export interface IWebSocketLinkContext {
  bind: WebSocketClient['bind']
  unbind: WebSocketClient['unbind']
  send: WebSocketClient['send']
  setToken: (token: string) => void
  token: string | undefined
}

const optionalWebSocketLinkContext = createOptionalContext<IWebSocketLinkContext>('WebSocketLinkContext')
export const WebSocketLinkContext = optionalWebSocketLinkContext.Context
export const useWebSocketLinkContext = optionalWebSocketLinkContext.useOptionalContext

export default ({ children }: WithChildren) => {
  const webSocketClientRef = useRef<WebSocketClient>(new WebSocketClient())
  const [token, setToken] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (token) {
      webSocketClientRef.current.connect(apiUrl, token)
    }
  }, [token])

  const value = useMemo(
    () => ({
      bind: webSocketClientRef.current.bind.bind(webSocketClientRef.current),
      unbind: webSocketClientRef.current.unbind.bind(webSocketClientRef.current),
      send: webSocketClientRef.current.send.bind(webSocketClientRef.current),
      setToken,
      token,
    }),
    [token],
  )

  return <optionalWebSocketLinkContext.Context value={value}>{children}</optionalWebSocketLinkContext.Context>
}
