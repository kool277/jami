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
import { LoadSwarmUntil, WebSocketMessageType } from '@savoirfairelinux/jami-web-common'
import { Container } from 'typedi'

import { Jamid } from '../jamid/jamid.js'
import { WebSocketServer } from './websocket-server.js'

const jamid = Container.get(Jamid)
const webSocketServer = Container.get(WebSocketServer)

export function bindLoadSwarmUntilCallback() {
  webSocketServer.bind<WebSocketMessageType.LoadSwarmUntil>(
    WebSocketMessageType.LoadSwarmUntil,
    async (accountId, data: LoadSwarmUntil) => {
      const { conversationId, fromMessageId, toMessageId } = data as LoadSwarmUntil

      if (fromMessageId === undefined || fromMessageId === '') {
        return
      }
      if (toMessageId === undefined || toMessageId === '') {
        return
      }

      if (data.firstSection) {
        jamid.clearCache(accountId, conversationId)
      }
      const from = data.firstSection ? '' : fromMessageId

      const messages = await jamid.loadSwarmUntil(accountId, conversationId, from, toMessageId)
      const loadSwarmUntilData: LoadSwarmUntil = {
        accountId: accountId,
        conversationId: conversationId,
        fromMessageId: from,
        toMessageId: toMessageId,
        messages: messages,
        firstSection: data.firstSection,
      }

      webSocketServer.send(accountId, WebSocketMessageType.LoadSwarmUntil, loadSwarmUntilData)
    },
  )
}
