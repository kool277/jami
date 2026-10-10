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
import { describe, expect, it } from 'vitest'

import { Contact } from '../models/contact.js'
import { pendingConversationPath, resolvePendingConversationTarget } from './pendingConversation.js'

const uri = '260d9aaee80c84ffda86bdc579a0be8d07a70b65'

const contactDetails = (details: Partial<ContactDetails>): ContactDetails =>
  ({ id: uri, conversationId: '', ...details }) as ContactDetails

describe('pendingConversationPath', () => {
  it('keeps pending conversations under their own path segment', () => {
    expect(pendingConversationPath(uri)).toBe(`/conversation/new/${uri}`)
  })
})

describe('resolvePendingConversationTarget', () => {
  it('shows the existing conversation when the peer is already a contact', () => {
    expect(
      resolvePendingConversationTarget(uri, [contactDetails({ conversationId: 'conversation-id' })], undefined),
    ).toEqual({ type: 'existing', conversationId: 'conversation-id' })
  })

  it('invites a contact that has no conversation yet', () => {
    const target = resolvePendingConversationTarget(uri, [contactDetails({})], undefined)

    expect(target).toEqual({ type: 'pending', contact: new Contact(uri) })
  })

  it('invites an account URI that belongs to no contact', () => {
    const target = resolvePendingConversationTarget(uri, [], undefined)

    expect(target).toEqual({ type: 'pending', contact: new Contact(uri) })
  })

  it('resolves a registered name to its account URI', () => {
    const target = resolvePendingConversationTarget('ada', undefined, [new Contact(uri, 'ada')])

    expect(target).toEqual({ type: 'pending', contact: new Contact(uri, 'ada') })
  })

  it('shows the existing conversation of a peer found by registered name', () => {
    const target = resolvePendingConversationTarget(
      'ada',
      [contactDetails({ conversationId: 'conversation-id' })],
      [new Contact(uri, 'ada')],
    )

    expect(target).toEqual({ type: 'existing', conversationId: 'conversation-id' })
  })

  it('rejects a URL segment that identifies no account', () => {
    expect(resolvePendingConversationTarget('not-a-jami-account', [], [])).toEqual({ type: 'unknown' })
  })

  it('shows the conversation of a known contact the name server cannot resolve', () => {
    const target = resolvePendingConversationTarget(
      'contact-bob-uri',
      [contactDetails({ id: 'contact-bob-uri', conversationId: 'conversation-id' })],
      [],
    )

    expect(target).toEqual({ type: 'existing', conversationId: 'conversation-id' })
  })
})
