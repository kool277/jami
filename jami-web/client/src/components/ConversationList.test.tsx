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
import { ThemeProvider } from '@mui/material/styles'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { buildDefaultTheme } from '../themes/Default.js'
import {
  conversationSummaryRefreshEvents,
  EmptyConversations,
  EmptyGroupsConversations,
  EmptyUnreadConversations,
  getConversationListFades,
  getEmptyConversationState,
} from './ConversationList.js'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

describe('EmptyConversations', () => {
  it('does not refresh summaries for message editions', async () => {
    const { WebSocketMessageType } = await import('@savoirfairelinux/jami-web-common')

    expect(conversationSummaryRefreshEvents).toEqual([
      WebSocketMessageType.ConversationMessage,
      WebSocketMessageType.ConversationReady,
    ])
    expect(conversationSummaryRefreshEvents).not.toContain(WebSocketMessageType.MessageEdition)
  })

  it('shows fades only for scrollable content beyond the current edge', () => {
    expect(getConversationListFades(0, 400, 400)).toEqual({ top: false, bottom: false })
    expect(getConversationListFades(0, 400, 800)).toEqual({ top: false, bottom: true })
    expect(getConversationListFades(200, 400, 800)).toEqual({ top: true, bottom: true })
    expect(getConversationListFades(400, 400, 800)).toEqual({ top: true, bottom: false })
  })

  it('prioritizes the unread empty state when the unread tab is selected', () => {
    expect(getEmptyConversationState('unread', 0, 0)).toBe('unread')
  })

  it('prioritizes the groups empty state when the groups tab is selected', () => {
    expect(getEmptyConversationState('groups', 0, 0)).toBe('groups')
  })

  it('shows the tumbleweed empty state for an account without conversations', () => {
    render(
      <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
        <EmptyConversations />
      </ThemeProvider>,
    )

    expect(screen.getByRole('heading', { name: 'conversation_empty_title' })).toBeVisible()
    expect(screen.getByText('conversation_empty_description')).toBeVisible()
    expect(document.querySelector('img')).toHaveAttribute('src', '/jami-tumbleweed.svg')
  })

  it('shows the unread illustration when there are no unread messages', () => {
    render(
      <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
        <EmptyUnreadConversations />
      </ThemeProvider>,
    )

    expect(screen.getByRole('heading', { name: 'conversation_no_unread_title' })).toBeVisible()
    expect(screen.getByText('conversation_no_unread_description')).toBeVisible()
    expect(document.querySelector('img')).toHaveAttribute('src', '/no-unread-messages.svg')
  })

  it('shows the groups illustration when there are no group conversations', () => {
    render(
      <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
        <EmptyGroupsConversations />
      </ThemeProvider>,
    )

    expect(screen.getByRole('heading', { name: 'conversation_no_groups_title' })).toBeVisible()
    expect(screen.getByText('conversation_no_groups_description')).toBeVisible()
    expect(document.querySelector('img')).toHaveAttribute('src', '/no-groups.svg')
  })
})
