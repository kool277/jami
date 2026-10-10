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
import { WebSocketMessageTable, WebSocketMessageType } from '@savoirfairelinux/jami-web-common'
import { Container } from 'typedi'

import { Jamid } from '../jamid/jamid.js'
import { WebSocketServer } from './websocket-server.js'

const jamid = Container.get(Jamid)
const webSocketServer = Container.get(WebSocketServer)

export function bindWebRtcCallbacks() {
  webSocketServer.bind(WebSocketMessageType.sendCallInvite, (accountId, data) => {
    const members = jamid.getConversationMembers(accountId, data.conversationId)
    members.forEach((member) => {
      sendWebRtcData(WebSocketMessageType.onCallInvite, data, accountId, member.uri)
    })
  })

  webSocketServer.bind(WebSocketMessageType.sendCallExit, (accountId, data) => {
    const members = jamid.getConversationMembers(accountId, data.conversationId)
    members.forEach((member) => {
      sendWebRtcData(WebSocketMessageType.onCallExit, data, accountId, member.uri)
    })
  })

  webSocketServer.bind(WebSocketMessageType.sendCallJoin, (accountId, data) => {
    const members = jamid.getConversationMembers(accountId, data.conversationId)
    members.forEach((member) => {
      sendWebRtcData(WebSocketMessageType.onCallJoin, data, accountId, member.uri)
    })
  })

  webSocketServer.bind(WebSocketMessageType.sendWebRtcDescription, (accountId, data) => {
    const { receiverId, ...partialData } = data
    sendWebRtcData(WebSocketMessageType.onWebRtcDescription, partialData, accountId, receiverId)
  })

  webSocketServer.bind(WebSocketMessageType.sendWebRtcIceCandidate, (accountId, data) => {
    const { receiverId, ...partialData } = data
    sendWebRtcData(WebSocketMessageType.onWebRtcIceCandidate, partialData, accountId, receiverId)
  })
}

function sendWebRtcData<T extends WebSocketMessageType>(
  type: T,
  // TODO: Guarantee WebSocketMessageTable[T] has WithSender Properties
  partialData: Omit<WebSocketMessageTable[T], 'senderId'>,
  accountId: string,
  receiverId: string,
) {
  const account = jamid.getAccountDetails(accountId)
  const senderId = account['Account.username']
  if (senderId === receiverId) {
    return
  }
  // TODO: Guarantee newData is of WebSocketMessageTable[T] type
  const data = {
    ...partialData,
    senderId,
  }
  jamid.sendAccountTextMessage(accountId, receiverId, JSON.stringify({ type, data }))
}
