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
  IConversationRequest,
  IConversationSummary,
  MAX_UNREAD_MESSAGE_COUNT,
  Message,
  WebSocketMessageType,
} from '@savoirfairelinux/jami-web-common'
import { Container, Service } from 'typedi'

import { ConversationRequestMetadata } from '../jamid/conversation-request-metadata.js'
import { Jamid } from '../jamid/jamid.js'
import { getLastDisplayableMessage } from '../utils/conversation-summary.js'
import { countUnreadMessages } from '../utils/unread-message-count.js'
import { WebSocketServer } from '../websocket/websocket-server.js'
import { ContactService } from './ContactService.js'
import { PresenceService } from './PresenceService.js'

const jamid = Container.get(Jamid)
const presenceService = Container.get(PresenceService)
const webSocketServer = Container.get(WebSocketServer)
const contactService = Container.get(ContactService)

@Service()
export class ConversationService {
  constructor() {
    jamid.events.onConversationRequestReceived.subscribe(async (signal) => {
      const conversationRequest = await this.createConversationRequest(signal.accountId, signal.metadata)
      webSocketServer.send(signal.accountId, WebSocketMessageType.ConversationRequest, conversationRequest)
    })
  }

  async createConversationRequest(
    accountId: string,
    jamidRequest: ConversationRequestMetadata,
  ): Promise<IConversationRequest> {
    const contact = await contactService.getContactFromUri(accountId, jamidRequest.from)
    const membersNames = await this.getMembersNames(accountId, jamidRequest.id)

    // Currently, this does not work.
    // It seems the members are unable to be accessed yet. Same on jami-android
    if (membersNames.length === 0) {
      membersNames.push(contact.displayName || contact.registeredName || contact.uri)
    }

    return {
      conversationId: jamidRequest.id,
      received: jamidRequest.received,
      from: contact,
      infos: {
        // Build a dataUrl from the avatar
        // TODO: Host the image and use a "normal" URL instead
        avatar: jamidRequest.avatar ? `data:image/jpeg;base64,${jamidRequest.avatar}` : undefined,
        description: jamidRequest.description,
        mode: jamidRequest.mode,
        title: jamidRequest.title,
      },
      membersNames,
    }
  }

  async createConversationSummary(
    accountId: string,
    conversationId: string,
  ): Promise<IConversationSummary | undefined> {
    const infos = jamid.getConversationInfos(accountId, conversationId)
    if (Object.keys(infos).length === 0) {
      return undefined
    }
    // Build a dataUrl from the avatar
    // TODO: Host the image and use a "normal" url instead
    infos.avatar = infos.avatar ? `data:image/jpeg;base64,${infos.avatar}` : undefined
    jamid.clearCache(accountId, conversationId)

    const accountUri = jamid.getAccountDetails(accountId)['Account.username']
    const lastDisplayed = jamid
      .getConversationMembers(accountId, conversationId)
      .find((member) => member.uri === accountUri)?.lastDisplayed

    // A single bounded load serves both the preview and the unread count. The
    // daemon returns messages newest first, including internal group metadata.
    const [membersNames, messages] = await Promise.all([
      this.getMembersNames(accountId, conversationId),
      this.getMessagesForSummary(accountId, conversationId, accountUri, lastDisplayed ?? ''),
    ])

    const lastMessage: Message = getLastDisplayableMessage(messages)
    return {
      id: conversationId,
      avatar: infos.avatar,
      title: infos.title,
      mode: infos.mode,
      membersNames,
      lastMessage,
      unreadMessages: countUnreadMessages(messages, accountUri, lastDisplayed),
    }
  }

  private async getMessagesForSummary(
    accountId: string,
    conversationId: string,
    accountUri: string,
    lastDisplayed: string,
  ): Promise<Message[]> {
    const pageSize = MAX_UNREAD_MESSAGE_COUNT + 1
    const messages: Message[] = []
    let fromMessage = ''

    for (let page = 0; page < 100; page++) {
      const nextMessages = await jamid.getSwarmMessages(accountId, conversationId, fromMessage, pageSize)
      if (nextMessages.length === 0) {
        break
      }

      for (const message of nextMessages) {
        if (!messages.some((existing) => existing.id === message.id)) {
          messages.push(message)
        }
      }
      if (
        countUnreadMessages(messages, accountUri, lastDisplayed) >= MAX_UNREAD_MESSAGE_COUNT ||
        nextMessages.some((message) => message.id === lastDisplayed) ||
        nextMessages.length < pageSize
      ) {
        break
      }

      const nextFromMessage = nextMessages[nextMessages.length - 1]?.id
      if (!nextFromMessage || nextFromMessage === fromMessage) {
        break
      }
      fromMessage = nextFromMessage
    }

    return messages
  }

  async getMembersNames(accountId: string, conversationId: string): Promise<string[]> {
    // Retrieve the URI of the current account (Account.username actually stores the URI rather than the username)
    const accountUri = jamid.getAccountDetails(accountId)['Account.username']
    const members = jamid.getConversationMembers(accountId, conversationId)

    const membersNamesPromises = members.map(async (member) => {
      if (member.uri === accountUri) {
        return
      }

      presenceService.subscribe(accountId, member.uri)

      // The vCard display name is what the peer chose to be called; it takes
      // precedence over the registered name so profile updates are visible.
      const contact = await contactService.getContactFromUri(accountId, member.uri)
      return contact.displayName || contact.registeredName || member.uri
    })
    const membersNames = (await Promise.all(membersNamesPromises)).filter((name): name is string => name !== undefined)
    return membersNames
  }
}
