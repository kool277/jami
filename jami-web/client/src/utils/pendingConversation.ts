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

import { Contact } from '../models/contact.js'

export const jamiAddressPattern = /^[0-9a-f]{40}$/i

/**
 * A conversation that does not exist yet lives under its own path segment:
 * conversation IDs and account URIs are both 40-hex strings, so a flat
 * `/conversation/:id` route could not tell a swarm from a peer.
 */
export const pendingConversationPath = (contactUri: string) => `/conversation/new/${contactUri}`

export type PendingConversationTarget =
  /** The peer is already a contact, so their conversation should be shown instead. */
  | { type: 'existing'; conversationId: string }
  /** The peer can be invited by sending them a first message. */
  | { type: 'pending'; contact: Contact }
  /** Nothing in the URL identifies a Jami account. */
  | { type: 'unknown' }

/**
 * Decides what `/conversation/new/:contactUri` should show. The URL segment is
 * user input: it may be an account URI, a registered name, or nonsense.
 */
export const resolvePendingConversationTarget = (
  contactUri: string,
  contacts: ContactDetails[] | undefined,
  lookupResults: Contact[] | undefined,
): PendingConversationTarget => {
  const resolved = lookupResults?.find((contact) => contact.uri)
  const uri = resolved?.uri || contactUri

  // A peer that is already a contact has a conversation, whether or not the name
  // server could be reached to resolve them.
  const knownContact = contacts?.find((candidate) => candidate.id === uri)
  if (knownContact?.conversationId) {
    return { type: 'existing', conversationId: knownContact.conversationId }
  }

  if (!resolved && !jamiAddressPattern.test(contactUri)) {
    return { type: 'unknown' }
  }

  return { type: 'pending', contact: resolved ?? new Contact(contactUri) }
}
