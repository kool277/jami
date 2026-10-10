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
import { IConversationRequest, WebSocketMessageType } from '@savoirfairelinux/jami-web-common'
import { createContext, ReactNode, useEffect, useMemo, useState } from 'react'

import { useAddConversationRequestToCache } from '../services/conversationQueries.js'
import { useWebSocketContext } from './WebSocketProvider.js'

export interface IMessengerContext {
  lastConversationId?: string
  setLastConversationId: (conversationId: string | undefined) => void
}

const defaultMessengerContext: IMessengerContext = {
  lastConversationId: undefined,
  setLastConversationId: () => undefined,
}

export const MessengerContext = createContext<IMessengerContext>(defaultMessengerContext)

export default ({ children }: { children: ReactNode }) => {
  const webSocket = useWebSocketContext()
  const addConversationRequestToCache = useAddConversationRequestToCache()
  const [lastConversationId, setLastConversationId] = useState<string>()

  useEffect(() => {
    const conversationRequestListener = (conversationRequest: IConversationRequest) => {
      addConversationRequestToCache(conversationRequest)
    }

    webSocket.bind(WebSocketMessageType.ConversationRequest, conversationRequestListener)

    return () => {
      webSocket.unbind(WebSocketMessageType.ConversationRequest, conversationRequestListener)
    }
  }, [addConversationRequestToCache, webSocket])

  const value = useMemo<IMessengerContext>(() => ({ lastConversationId, setLastConversationId }), [lastConversationId])

  return <MessengerContext value={value}>{children}</MessengerContext>
}
