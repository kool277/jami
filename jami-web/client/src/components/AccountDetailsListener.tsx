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

import {
  ContactDetails,
  IAccountDetails,
  IKnownDevicesChanged,
  ProfileReceived,
  WebSocketMessageType,
} from '@savoirfairelinux/jami-web-common'
import { type QueryClient, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { useAuthContext } from '../contexts/AuthProvider.js'
import { useWebSocketContext } from '../contexts/WebSocketProvider.js'

interface AccountDetailsListenerProps {
  children: React.ReactNode
}

type ProfileQueryClient = Pick<QueryClient, 'invalidateQueries' | 'removeQueries' | 'refetchQueries' | 'setQueryData'>

export function refreshContactProfile(queryClient: ProfileQueryClient, peer: string, displayName?: string) {
  if (displayName) {
    queryClient.setQueryData<ContactDetails>(['contacts', peer], (contact) =>
      contact ? { ...contact, displayName } : contact,
    )
  }
  queryClient.invalidateQueries({ queryKey: ['picture', peer] })
  queryClient.removeQueries({ queryKey: ['picture', peer] })
  queryClient.refetchQueries({ queryKey: ['picture', peer] })
  queryClient.invalidateQueries({ queryKey: ['contacts', peer] })
  queryClient.invalidateQueries({ queryKey: ['contact', 'list'] })
}

export default function AccountDetailsListener({ children }: AccountDetailsListenerProps) {
  const { account, updateDevices } = useAuthContext()
  const webSocket = useWebSocketContext()
  const queryClient = useQueryClient()

  useEffect(() => {
    const profileReceivedHandler = (data: ProfileReceived) => {
      refreshContactProfile(queryClient, data.peer, data.displayName)
    }

    const knownDevicesChangedHandler = (data: IKnownDevicesChanged) => {
      updateDevices(data.devices)
    }

    webSocket.bind(WebSocketMessageType.KnownDevicesChanged, knownDevicesChangedHandler)
    webSocket.bind(WebSocketMessageType.ProfileReceived, profileReceivedHandler)
    return () => {
      webSocket.unbind(WebSocketMessageType.KnownDevicesChanged, knownDevicesChangedHandler)
      webSocket.unbind(WebSocketMessageType.ProfileReceived, profileReceivedHandler)
    }
  }, [queryClient, webSocket, account, updateDevices])

  useEffect(() => {
    const accountDetailsChangedListener = (data: IAccountDetails) => {
      account?.setDetails(data.details)
    }

    webSocket.bind(WebSocketMessageType.AccountDetails, accountDetailsChangedListener)
    return () => {
      webSocket.unbind(WebSocketMessageType.AccountDetails, accountDetailsChangedListener)
    }
  }, [account, webSocket])

  return children
}
