/*
 * Copyright (C) 2025 Savoir-faire Linux Inc.
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
import { IConversationSummary, Message } from '@savoirfairelinux/jami-web-common'
import { MessageStatusCode } from '@savoirfairelinux/jami-web-common/src/enums/message-status-code'
import { describe, expect, it } from 'vitest'

import { getReadReceiptTarget, markSummaryRead } from './readReceipts.js'

const ACCOUNT_URI = 'b3624029a5ec47330bfcf23e22aef7c1ce970718'
const PEER_URI = '260d9aaee80c84ffda86bdc579a0be8d07a70b65'

const buildMessage = (id: string, author: string, status: Record<string, MessageStatusCode> = {}): Message =>
  ({
    id,
    author,
    type: 'text/plain',
    body: id,
    status: new Map(Object.entries(status)),
  }) as unknown as Message

describe('getReadReceiptTarget', () => {
  it('returns nothing when there are no messages', () => {
    expect(getReadReceiptTarget([], ACCOUNT_URI)).toBeUndefined()
  })

  it('targets only the newest message so the daemon back-fills older ones', () => {
    // `messages` is ordered newest first, mirroring the chat view's column-reverse layout.
    const messages = [
      buildMessage('newest', PEER_URI),
      buildMessage('middle', PEER_URI),
      buildMessage('oldest', PEER_URI),
    ]

    expect(getReadReceiptTarget(messages, ACCOUNT_URI)).toBe('newest')
  })

  it('returns nothing when the newest message is already read by the account', () => {
    const messages = [
      buildMessage('newest', PEER_URI, { [ACCOUNT_URI]: MessageStatusCode.read }),
      buildMessage('oldest', PEER_URI),
    ]

    expect(getReadReceiptTarget(messages, ACCOUNT_URI)).toBeUndefined()
  })

  it('targets the newest message even when the account authored it', () => {
    const messages = [buildMessage('newest', ACCOUNT_URI), buildMessage('oldest', PEER_URI)]

    expect(getReadReceiptTarget(messages, ACCOUNT_URI)).toBe('newest')
  })
})

describe('markSummaryRead', () => {
  const summaries = [
    { id: 'a', unreadMessages: 3 },
    { id: 'b', unreadMessages: 7 },
  ] as IConversationSummary[]

  it('clears the unread count of the targeted conversation only', () => {
    const updated = markSummaryRead(summaries, 'a')

    expect(updated[0].unreadMessages).toBe(0)
    expect(updated[1].unreadMessages).toBe(7)
  })

  it('returns the same reference when nothing changes, to avoid needless re-renders', () => {
    const cleared = markSummaryRead(summaries, 'a')

    expect(markSummaryRead(summaries, 'unknown')).toBe(summaries)
    expect(markSummaryRead(cleared, 'a')).toBe(cleared)
  })
})
