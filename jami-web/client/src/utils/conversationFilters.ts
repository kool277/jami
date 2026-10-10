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
import { IConversationSummary } from '@savoirfairelinux/jami-web-common'

export type ConversationFilter = 'all' | 'unread' | 'groups'

export const isConversationUnread = (conversation: IConversationSummary) => conversation.unreadMessages > 0

export const filterConversationSummaries = (conversations: IConversationSummary[], filter: ConversationFilter) => {
  switch (filter) {
    case 'unread':
      return conversations.filter((conversation) => isConversationUnread(conversation))
    case 'groups':
      return conversations.filter((conversation) => conversation.mode !== '0')
    default:
      return conversations
  }
}
