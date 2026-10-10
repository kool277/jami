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

import { MAX_UNREAD_MESSAGE_COUNT, Message } from '@savoirfairelinux/jami-web-common'

import { countUnreadMessages } from './unread-message-count.js'

const message = (id: string, author: string) => ({ id, author }) as Message

describe('countUnreadMessages', () => {
  it('counts only messages received from other conversation members', () => {
    const messages = [message('c', 'me'), message('b', 'other'), message('a', 'another')]

    assert.equal(countUnreadMessages(messages, 'me'), 2)
  })

  it('stops counting at the read marker, ignoring anything older', () => {
    // Messages are ordered newest first, as returned by the daemon.
    const messages = [
      message('newest', 'other'),
      message('marker', 'other'),
      message('older', 'other'),
      message('oldest', 'other'),
    ]

    assert.equal(countUnreadMessages(messages, 'me', 'marker'), 1)
  })

  it('returns zero when the newest message is already the read marker', () => {
    const messages = [message('marker', 'other'), message('older', 'other')]

    assert.equal(countUnreadMessages(messages, 'me', 'marker'), 0)
  })

  it('never reports more than the bounded window it is given', () => {
    const messages = Array.from({ length: MAX_UNREAD_MESSAGE_COUNT + 1 }, (_, index) => message(`m${index}`, 'other'))

    assert.equal(countUnreadMessages(messages, 'me'), MAX_UNREAD_MESSAGE_COUNT)
  })
})
