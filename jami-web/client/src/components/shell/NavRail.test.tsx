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
import { render, screen, waitFor, within } from '@testing-library/react'
import { type ReactNode, useState } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { MessengerContext } from '../../contexts/MessengerProvider.js'
import { buildDefaultTheme } from '../../themes/Default.js'
import NavRail from './NavRail.js'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock('../SvgIcon.js', () => {
  // Declared inside the factory: `vi.mock` is hoisted above module scope.
  const symbol = (name: string) =>
    function Symbol({ filled }: { filled?: boolean }) {
      return <span data-symbol={name} data-filled={String(Boolean(filled))} />
    }
  return {
    ChatBubbleIcon: symbol('chat_bubble'),
    MailIcon: symbol('mail'),
    SettingsIcon: symbol('settings'),
  }
})

const renderNavRail = (initialPath: string, inviteCount?: number, unreadConversationCount?: number) => {
  const MessengerContextProvider = ({ children }: { children: ReactNode }) => {
    const [lastConversationId, setLastConversationId] = useState<string>()
    return <MessengerContext value={{ lastConversationId, setLastConversationId }}>{children}</MessengerContext>
  }

  return render(
    <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
      <MessengerContextProvider>
        <MemoryRouter initialEntries={[initialPath]}>
          <NavRail
            inviteCount={inviteCount}
            unreadConversationCount={unreadConversationCount}
            accountSlot={<button>account_menu</button>}
          />
        </MemoryRouter>
      </MessengerContextProvider>
    </ThemeProvider>,
  )
}

describe('NavRail', () => {
  it('offers exactly the four top-level destinations', () => {
    renderNavRail('/conversation')

    const rail = screen.getByRole('navigation', { name: 'nav_primary' })
    expect(
      within(rail)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual(['/conversation', '/invites', '/settings'])
    expect(within(rail).getByRole('button', { name: 'account_menu' })).toBeVisible()
  })

  it('marks the destination containing the current route as the current page', () => {
    renderNavRail('/settings/account/manage-account')

    expect(screen.getByRole('link', { name: 'settings' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'conversations' })).not.toHaveAttribute('aria-current')
  })

  it('does not select a destination with only a shared prefix', () => {
    renderNavRail('/conversation-settings')

    expect(screen.getByRole('link', { name: 'conversations' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: 'settings' })).not.toHaveAttribute('aria-current')
  })

  it('fills the symbol of the current destination only', () => {
    renderNavRail('/conversation')

    const symbolOf = (name: string) =>
      screen.getByRole('link', { name }).querySelector('[data-symbol]')?.getAttribute('data-filled')
    expect(symbolOf('conversations')).toBe('true')
    expect(symbolOf('settings')).toBe('false')
  })

  it('returns to the last opened conversation', async () => {
    renderNavRail('/conversation/conversation-1')

    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'conversations' })).toHaveAttribute(
        'href',
        '/conversation/conversation-1',
      ),
    )
  })

  it('badges invites only while some are pending', () => {
    const { unmount } = renderNavRail('/conversation', 3)
    expect(screen.getByRole('link', { name: 'invitations' })).toHaveTextContent('3')

    unmount()
    renderNavRail('/conversation', 0)
    expect(screen.getByRole('link', { name: 'invitations' })).not.toHaveTextContent('0')
  })

  it('badges conversations only while some are unread', () => {
    const { unmount } = renderNavRail('/conversation', undefined, 3)
    expect(screen.getByRole('link', { name: 'conversations' })).toHaveTextContent('3')

    unmount()
    renderNavRail('/conversation', undefined, 0)
    expect(screen.getByRole('link', { name: 'conversations' })).not.toHaveTextContent('0')
  })
})
