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

/**
 * Picks the single message a read receipt should be sent for.
 *
 * The daemon keeps one read marker per conversation member and overwrites it
 * with whatever commit it is handed, then back-fills every commit between the
 * previous marker and the new one. Sending a receipt per message therefore
 * races: the marker ends up on whichever receipt the daemon happens to handle
 * last, which leaves newer messages permanently unread. Only the newest
 * message must be acknowledged, exactly like the Qt client does.
 *
 * @param messages conversation messages ordered newest first
 * @param accountUri uri of the local account
 */
export const getReadReceiptTarget = (messages: Message[], accountUri: string): string | undefined => {
  const newestMessage = messages[0]
  if (!newestMessage) {
    return undefined
  }

  if (newestMessage.status?.get(accountUri) === MessageStatusCode.read) {
    return undefined
  }

  return newestMessage.id
}

/**
 * Clears the unread count of a conversation summary.
 *
 * Read receipts only reach the daemon, so the cached summaries keep serving a
 * stale count until they are refetched. Opening a conversation must clear its
 * badge right away, exactly like the Qt client's `clearUnreadInteractions`.
 *
 * Returns the original array when nothing changes so React Query consumers do
 * not re-render.
 */
export const markSummaryRead = (summaries: IConversationSummary[], conversationId: string): IConversationSummary[] => {
  const isStale = summaries.some((summary) => summary.id === conversationId && summary.unreadMessages !== 0)
  if (!isStale) {
    return summaries
  }

  return summaries.map((summary) => (summary.id === conversationId ? { ...summary, unreadMessages: 0 } : summary))
}
