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

import { toDaemonConversationUri } from './conversation-uri.js'

describe('toDaemonConversationUri', () => {
  it('qualifies a bare conversation ID as a swarm URI', () => {
    assert.equal(toDaemonConversationUri('conversation-id'), 'swarm:conversation-id')
  })

  it('preserves an already-qualified conversation URI', () => {
    assert.equal(toDaemonConversationUri('swarm:conversation-id'), 'swarm:conversation-id')
  })
})
