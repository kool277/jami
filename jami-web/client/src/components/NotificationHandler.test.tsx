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
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import NotificationHandler from './NotificationHandler.js'

const contactRefetch = vi.fn().mockResolvedValue({ data: {} })
const preferencesRefetch = vi.fn().mockResolvedValue({ data: {} })

vi.mock('../contexts/AuthProvider.js', () => ({
  useAuthContext: () => ({ account: { getUri: () => 'self' } }),
}))

vi.mock('../contexts/WebSocketProvider.js', () => ({
  useWebSocketContext: () => ({ bind: vi.fn(), unbind: vi.fn() }),
}))

vi.mock('../services/contactQueries.js', () => ({
  useContactQuery: () => ({ refetch: contactRefetch }),
}))

vi.mock('../services/conversationQueries.js', () => ({
  useConversationPreferencesQuery: () => ({ refetch: preferencesRefetch }),
}))

describe('NotificationHandler', () => {
  it('does not fetch preferences before receiving a conversation message', () => {
    render(
      <NotificationHandler>
        <div />
      </NotificationHandler>,
    )

    expect(preferencesRefetch).not.toHaveBeenCalled()
  })
})
