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
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { buildDefaultTheme } from '../themes/Default.js'
import {
  ConversationSummaryList,
  createConversationMenuOptions,
  getConversationContactUri,
} from './ConversationSummaryList.js'
import { NotificationsActiveIcon } from './SvgIcon.js'

describe('ConversationSummaryList', () => {
  // The list is a flex child of the scrolling pane: letting it shrink would make it
  // clip its own items instead of overflowing, leaving nothing for the pane to scroll.
  it('keeps its natural height so the surrounding pane can scroll', () => {
    const { container } = render(
      <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
        <ConversationSummaryList conversationsSummaries={[]} />
      </ThemeProvider>,
    )

    expect(container.querySelector('ul')).toHaveStyle({ flexShrink: '0' })
  })

  it('exposes a removable contact only for direct conversations', () => {
    expect(getConversationContactUri('0', ['contact-uri'])).toBe('contact-uri')
    expect(getConversationContactUri('1', ['contact-uri'])).toBeUndefined()
    expect(getConversationContactUri('0', [])).toBeUndefined()
  })

  it('emits the block and mark-as-read actions for direct conversations', () => {
    const startCall = vi.fn()
    const handlers = {
      openConversation: vi.fn(),
      openInNewTab: vi.fn(),
      toggleMute: vi.fn(),
      markConversationRead: vi.fn(),
      openContactInfo: vi.fn(),
      leaveConversation: vi.fn(),
      blockConversation: vi.fn(),
    }
    const options = createConversationMenuOptions({
      conversationId: 'conversation-id',
      conversationMemberUri: 'contact-uri',
      isMuted: false,
      hasUnreadMessages: true,
      translate: (key) => key,
      startCall,
      isMutePreferenceReady: true,
      ...handlers,
    })

    const labels = options.map(({ label }) => label)
    expect(labels).toContain('conversation_block_action')
    expect(labels).toContain('conversation_mark_as_read')
    expect(labels).toContain('conversation_contact_info')
    expect(labels).not.toContain('conversation_group_info')

    options.forEach(({ onClick }) => onClick())

    expect(startCall).toHaveBeenNthCalledWith(1, 'conversation-id')
    expect(startCall).toHaveBeenNthCalledWith(2, 'conversation-id', true)
    expect(handlers.openConversation).toHaveBeenCalledTimes(2)
    expect(handlers.openInNewTab).toHaveBeenCalledOnce()
    expect(handlers.toggleMute).toHaveBeenCalledOnce()
    expect(handlers.markConversationRead).toHaveBeenCalledOnce()
    expect(handlers.openContactInfo).toHaveBeenCalledOnce()
    expect(handlers.leaveConversation).toHaveBeenCalledOnce()
    expect(handlers.blockConversation).toHaveBeenCalledOnce()
  })

  it('omits the block action for group conversations', () => {
    const options = createConversationMenuOptions({
      conversationId: 'conversation-id',
      isMuted: false,
      hasUnreadMessages: true,
      translate: (key) => key,
      startCall: vi.fn(),
      isMutePreferenceReady: true,
      openConversation: vi.fn(),
      openInNewTab: vi.fn(),
      toggleMute: vi.fn(),
      markConversationRead: vi.fn(),
      openContactInfo: vi.fn(),
      leaveConversation: vi.fn(),
      blockConversation: vi.fn(),
    })

    const labels = options.map(({ label }) => label)
    expect(labels).not.toContain('conversation_block_action')
    expect(labels).toContain('conversation_mark_as_read')
    expect(labels).toContain('conversation_group_info')
    expect(labels).not.toContain('conversation_contact_info')
  })

  it('uses the unmute action and omits mark-as-read without unread messages', () => {
    const options = createConversationMenuOptions({
      conversationId: 'conversation-id',
      isMuted: true,
      hasUnreadMessages: false,
      translate: (key) => key,
      startCall: vi.fn(),
      isMutePreferenceReady: false,
      openConversation: vi.fn(),
      openInNewTab: vi.fn(),
      toggleMute: vi.fn(),
      markConversationRead: vi.fn(),
      openContactInfo: vi.fn(),
      leaveConversation: vi.fn(),
      blockConversation: vi.fn(),
    })

    const labels = options.map(({ label }) => label)
    expect(labels).not.toContain('conversation_mark_as_read')
    expect(labels).not.toContain('conversation_block_action')
    expect(options[3].Icon).toBe(NotificationsActiveIcon)
    expect(options[3].disabled).toBe(true)
  })
})
