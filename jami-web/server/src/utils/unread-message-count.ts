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
import { MAX_UNREAD_MESSAGE_COUNT, Message } from '@savoirfairelinux/jami-web-common'

/**
 * Counts messages received since the account's read marker.
 *
 * @param messages bounded window of conversation messages, ordered newest first
 * @param accountUri uri of the local account
 * @param lastDisplayed commit id of the account's read marker, if any
 */
export const countUnreadMessages = (messages: Message[], accountUri: string, lastDisplayed = ''): number => {
  let unreadMessages = 0

  for (const message of messages) {
    if (message.id === lastDisplayed) {
      break
    }
    if (message.author !== accountUri) {
      unreadMessages++
    }
  }

  return Math.min(unreadMessages, MAX_UNREAD_MESSAGE_COUNT)
}
