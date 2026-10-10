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
import { useCallback, useMemo, useState, useSyncExternalStore } from 'react'

import { IWebSocketContext } from '../contexts/WebSocketProvider.js'
import { Account } from '../models/account.js'
import { CallData } from '../services/CallManager.js'
import { Listener } from '../utils/utils.js'
import { RTCPeerConnectionHandler, RTCPeerConnectionInfos } from './RtcPeerConnectionHandler.js'

export const useWebRtcManager = () => {
  const [webRtcManager] = useState(() => new WebRtcManager())
  const subscribe = useCallback((listener: Listener) => webRtcManager.subscribe(listener), [webRtcManager])
  const getSnapshot = useCallback(() => webRtcManager.getSnapshot(), [webRtcManager])
  const connectionsInfos = useSyncExternalStore(subscribe, getSnapshot)

  return useMemo(
    () => ({
      addConnection: webRtcManager.addConnection.bind(webRtcManager),
      removeConnection: webRtcManager.removeConnection.bind(webRtcManager),
      updateLocalStreams: webRtcManager.updateLocalStreams.bind(webRtcManager),
      clean: webRtcManager.clean.bind(webRtcManager),
      connectionsInfos: connectionsInfos,
    }),
    [connectionsInfos, webRtcManager],
  )
}

class WebRtcManager {
  private connections: Record<string, RTCPeerConnectionHandler> = {} // key is contactUri

  private listeners: Listener[] = []
  private snapshot: Record<string, RTCPeerConnectionInfos> = {} // key is contactUri

  addConnection(
    webSocket: IWebSocketContext,
    account: Account,
    contactUri: string,
    callData: CallData,
    localStream: MediaStream | undefined,
    screenShareLocalStream: MediaStream | undefined,
  ) {
    if (this.connections[contactUri]) {
      console.debug('Attempted to establish an WebRTC connection with the same peer more than once')
      return
    }

    const connection = new RTCPeerConnectionHandler(
      webSocket,
      account,
      contactUri,
      callData,
      localStream,
      screenShareLocalStream,
      this.emitChange.bind(this),
    )
    this.connections[contactUri] = connection
  }

  removeConnection(contactUri: string) {
    const connection = this.connections[contactUri]
    connection.disconnect()
    delete this.connections[contactUri]
  }

  updateLocalStreams(localStream: MediaStream | undefined, screenShareLocalStream: MediaStream | undefined) {
    Object.values(this.connections).forEach((connection) =>
      connection.updateLocalStreams(localStream, screenShareLocalStream),
    )
  }

  subscribe(listener: Listener) {
    this.listeners.push(listener)
    return () => {
      this.listeners.filter((otherListener) => otherListener !== listener)
    }
  }

  getSnapshot(): Record<string, RTCPeerConnectionInfos> {
    return this.snapshot
  }

  emitChange() {
    this.snapshot = Object.entries(this.connections).reduce(
      (acc, [contactUri, connection]) => {
        acc[contactUri] = connection.getInfos()
        return acc
      },
      {} as Record<string, RTCPeerConnectionInfos>,
    )

    this.listeners.forEach((listener) => listener())
  }

  clean() {
    Object.values(this.connections).forEach((connection) => connection.disconnect())
    this.connections = {}
    this.emitChange()
  }
}
