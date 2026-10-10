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

import { NewBuddyNotification, WebSocketMessageType } from '@savoirfairelinux/jami-web-common'
import { createContext, ReactNode, useCallback, useEffect, useMemo, useState } from 'react'

import { useWebSocketContext } from '../contexts/WebSocketProvider.js'
import { usePresenceQuery } from '../services/presenceQueries.js'

interface IPresenceContext {
  getPresence: (buddy: string) => number
  presence: Map<string, number>
}

export const PresenceContext = createContext<IPresenceContext>({
  getPresence: () => 0,
  presence: new Map(),
})

interface PresenceProviderProps {
  children: ReactNode
}

const PresenceProvider: React.FC<PresenceProviderProps> = ({ children }) => {
  const [livePresence, setLivePresence] = useState<Map<string, number>>(() => new Map())
  const webSocket = useWebSocketContext()
  const { data: knownStatuses } = usePresenceQuery()

  // The daemon emits a status once, so a notification can land before this
  // provider is mounted. The snapshot fills those gaps, while notifications
  // received since then always take precedence over it.
  const presence = useMemo(() => {
    const merged = new Map<string, number>(Object.entries(knownStatuses ?? {}))
    for (const [buddyUri, status] of livePresence) {
      merged.set(buddyUri, status)
    }
    return merged
  }, [knownStatuses, livePresence])

  const getPresence = useCallback(
    (buddy: string) => {
      return presence.get(buddy) || 0
    },
    [presence],
  )

  useEffect(() => {
    function handlePresence(data: NewBuddyNotification) {
      setLivePresence((prev) => {
        const newPresence = new Map(prev)
        newPresence.set(data.buddyUri, data.status)
        return newPresence
      })
    }

    webSocket.bind(WebSocketMessageType.NewBuddyNotification, handlePresence)
    return () => {
      webSocket.unbind(WebSocketMessageType.NewBuddyNotification, handlePresence)
    }
  }, [webSocket])

  const value = useMemo(() => ({ getPresence, presence }), [getPresence, presence])

  return <PresenceContext value={value}>{children}</PresenceContext>
}

export default PresenceProvider
