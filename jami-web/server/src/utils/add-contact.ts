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
import { ContactDetails } from '@savoirfairelinux/jami-web-common'
import { Observable } from 'rxjs'

import { ConversationReady } from '../jamid/jami-signal-interfaces.js'

const DEFAULT_CONVERSATION_READY_TIMEOUT_MS = 5000

export interface ContactAdder {
  readonly events: { onConversationReady: Observable<ConversationReady> }
  addContact(accountId: string, contactId: string): void
  sendTrustRequest(accountId: string, contactId: string): void
  getContactDetails(accountId: string, contactId: string): ContactDetails
}

/**
 * Adds a contact and answers with the one-to-one conversation that carries the
 * invitation. The daemon creates that swarm asynchronously, so its ID is usually
 * still missing right after the contact is added; clients need it to send their
 * first message, so wait for the daemon to catch up instead of making them poll.
 *
 * Returns `undefined` when the daemon knows no such contact.
 */
export const addContactAndResolveConversation = async (
  jamid: ContactAdder,
  accountId: string,
  contactId: string,
  timeoutMs: number = DEFAULT_CONVERSATION_READY_TIMEOUT_MS,
): Promise<ContactDetails | undefined> => {
  jamid.addContact(accountId, contactId)
  // We need to manually send a conversation request
  jamid.sendTrustRequest(accountId, contactId)

  const getContactDetails = () => {
    const contactDetails = jamid.getContactDetails(accountId, contactId)
    return Object.keys(contactDetails).length === 0 ? undefined : contactDetails
  }

  const contactDetails = getContactDetails()
  if (!contactDetails || contactDetails.conversationId) {
    return contactDetails
  }

  await waitForConversation(jamid, accountId, () => Boolean(getContactDetails()?.conversationId), timeoutMs)

  return getContactDetails()
}

const waitForConversation = (
  jamid: ContactAdder,
  accountId: string,
  isConversationKnown: () => boolean,
  timeoutMs: number,
): Promise<void> =>
  new Promise((resolve) => {
    const stopWaiting = () => {
      clearTimeout(timer)
      subscription.unsubscribe()
      resolve()
    }

    const timer = setTimeout(stopWaiting, timeoutMs)
    const subscription = jamid.events.onConversationReady.subscribe((signal) => {
      // The signal carries no contact, so let the daemon tell us whether this
      // swarm is the one that now backs the contact we just added.
      if (signal.accountId === accountId && isConversationKnown()) {
        stopWaiting()
      }
    })
  })
