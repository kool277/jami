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
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { ContactDetails } from '@savoirfairelinux/jami-web-common'
import { Subject } from 'rxjs'

import { ConversationReady } from '../jamid/jami-signal-interfaces.js'
import { addContactAndResolveConversation, ContactAdder } from './add-contact.js'

const accountId = 'account-id'
const contactId = 'contact-id'

class FakeContactAdder implements ContactAdder {
  readonly onConversationReady = new Subject<ConversationReady>()
  readonly events = { onConversationReady: this.onConversationReady.asObservable() }
  readonly addedContacts: string[] = []
  readonly trustRequests: string[] = []

  constructor(private contactDetails: Partial<ContactDetails> | undefined) {}

  addContact(_accountId: string, contactId: string) {
    this.addedContacts.push(contactId)
  }

  sendTrustRequest(_accountId: string, contactId: string) {
    this.trustRequests.push(contactId)
  }

  getContactDetails() {
    return (this.contactDetails ?? {}) as ContactDetails
  }

  becomeReady(conversationId: string) {
    this.contactDetails = { ...this.contactDetails, conversationId }
    this.onConversationReady.next({ accountId, conversationId })
  }
}

describe('addContactAndResolveConversation', () => {
  it('adds the contact and sends the trust request', async () => {
    const jamid = new FakeContactAdder({ id: contactId, conversationId: 'conversation-id' })

    await addContactAndResolveConversation(jamid, accountId, contactId)

    assert.deepEqual(jamid.addedContacts, [contactId])
    assert.deepEqual(jamid.trustRequests, [contactId])
  })

  it('returns the conversation the daemon already knows about', async () => {
    const jamid = new FakeContactAdder({ id: contactId, conversationId: 'conversation-id' })

    const contactDetails = await addContactAndResolveConversation(jamid, accountId, contactId)

    assert.equal(contactDetails?.conversationId, 'conversation-id')
  })

  it('waits for the daemon to create the swarm before answering', async () => {
    const jamid = new FakeContactAdder({ id: contactId, conversationId: '' })

    const pending = addContactAndResolveConversation(jamid, accountId, contactId)
    setImmediate(() => jamid.becomeReady('late-conversation-id'))

    assert.equal((await pending)?.conversationId, 'late-conversation-id')
  })

  it('ignores a swarm created for another account', async () => {
    const jamid = new FakeContactAdder({ id: contactId, conversationId: '' })

    const pending = addContactAndResolveConversation(jamid, accountId, contactId, 20)
    setImmediate(() => jamid.onConversationReady.next({ accountId: 'other', conversationId: 'other-id' }))

    assert.equal((await pending)?.conversationId, '')
  })

  it('gives up on the swarm once the timeout elapses', async () => {
    const jamid = new FakeContactAdder({ id: contactId, conversationId: '' })

    const contactDetails = await addContactAndResolveConversation(jamid, accountId, contactId, 10)

    assert.equal(contactDetails?.conversationId, '')
  })

  it('reports an unknown contact', async () => {
    const jamid = new FakeContactAdder(undefined)

    assert.equal(await addContactAndResolveConversation(jamid, accountId, contactId, 10), undefined)
  })
})
