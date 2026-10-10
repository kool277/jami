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
import { MessageStatusCode } from '../enums/message-status-code.js'
import { IContact } from './contact.js'

export interface IConversationMember {
  role?: ConversationMemberRole
  contact: IContact
}

export type ConversationMemberRole = 'admin' | 'member' | 'invited' | 'banned' | 'left'

export interface Reaction {
  id?: string
  author: string
  body: string
  timestamp: string
  'react-to': string
  parents: string
}

export interface Message {
  id: string
  author: string
  timestamp: number
  type:
    | 'application/call-history+json'
    | 'application/data-transfer+json'
    | 'application/update-profile'
    | 'initial'
    | 'member'
    | 'merge'
    | 'text/plain'
    | 'vote'
  linearizedParent: string
  parents: string
  action?: 'add' | 'join' | 'remove' | 'ban' | 'unban'
  body: any
  duration?: string
  to?: string
  invited?: string
  fileId?: string
  reactions: Array<Reaction>
  displayName?: string
  sha3sum?: string
  tid?: string
  totalSize?: number
  editions?: string | Message[]
  status: Map<string, MessageStatusCode>
  'reply-to'?: string | Message
  animate?: boolean
}

export interface ConversationInfos {
  avatar?: string
  description?: string
  mode?: string
  title?: string
}

export interface ConversationPreferences {
  color?: string
  emoji?: string
  ignoreNotifications?: boolean
}

export interface NewConversationRequestBody {
  members: string[]
}

export interface NewMessageRequestBody {
  body: string
  replyTo?: string
  messageId?: string
}

export interface IConversationSummary {
  id: string
  avatar: ConversationInfos['avatar']
  title: ConversationInfos['title']
  mode: ConversationInfos['mode']
  membersNames: string[]
  lastMessage: Message
  unreadMessages: number
}

export interface IConversationRequest {
  conversationId: string
  infos: ConversationInfos
  from: IContact
  received: string
  membersNames: string[]
}
