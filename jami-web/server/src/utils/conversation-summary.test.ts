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

import { Message } from '@savoirfairelinux/jami-web-common'

import { getLastDisplayableMessage } from './conversation-summary.js'

const message = (type: Message['type']) => ({ type }) as Message

describe('getLastDisplayableMessage', () => {
  it('skips internal group metadata to retain the latest visible message', () => {
    const latestMessage = message('text/plain')

    assert.equal(getLastDisplayableMessage([message('merge'), message('vote'), latestMessage]), latestMessage)
  })

  it('skips profile updates without visible content', () => {
    const latestMessage = message('member')

    assert.equal(getLastDisplayableMessage([message('application/update-profile'), latestMessage]), latestMessage)
  })

  it('keeps profile updates with visible content', () => {
    const latestMessage = { ...message('application/update-profile'), body: 'Updated profile' }

    assert.equal(getLastDisplayableMessage([latestMessage, message('member')]), latestMessage)
  })
})
