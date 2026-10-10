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
import { ReactionAdded, SendMessageType, WebSocketMessageType } from '@savoirfairelinux/jami-web-common'
import { Container } from 'typedi'

import { Jamid } from '../jamid/jamid.js'
import { WebSocketServer } from './websocket-server.js'

const jamid = Container.get(Jamid)
const webSocketServer = Container.get(WebSocketServer)

export function bindReactionAddedCallBack() {
  webSocketServer.bind<WebSocketMessageType.ReactionAdded>(
    WebSocketMessageType.ReactionAdded,
    (accountId: string, { conversationId, messageId, reaction }: ReactionAdded) => {
      console.debug('Received ReactionAdded from client', accountId, messageId, conversationId, reaction)
      jamid.sendConversationMessage(accountId, conversationId, reaction.body, messageId, SendMessageType.REACTION)
    },
  )
}
