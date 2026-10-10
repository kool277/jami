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
import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { type ReactNode } from 'react'
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import Invites from '../pages/Invites.js'
import { buildDefaultTheme } from '../themes/Default.js'
import { ConversationRequestList } from './ConversationRequestList.js'
import { EmptyInvitations } from './InviteList.js'

const hash = '260d9aaee80c84ffda86bdc579a0be8d07a70b65'
let isConversationRequestsPending = false

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('../services/conversationQueries.js', () => ({
  useConversationRequestsQuery: () => ({
    data: isConversationRequestsPending
      ? undefined
      : [
          {
            conversationId: 'request-1',
            infos: { title: '' },
            from: { uri: hash, registeredName: '' },
            received: '2026-08-04T12:00:00Z',
            membersNames: [hash],
          },
          {
            conversationId: 'request-2',
            infos: { title: 'Second invitation' },
            from: { uri: '0c32ab20bb55bd442334553dc5c9a1dfb31c3152', registeredName: '' },
            received: '2026-08-04T11:00:00Z',
            membersNames: ['Second invitation'],
          },
        ],
    isPending: isConversationRequestsPending,
  }),
}))

vi.mock('./ConversationAvatar.js', () => ({
  default: ({ displayName }: { displayName: string }) => <span aria-hidden="true">{displayName}</span>,
}))

vi.mock('./EllipsisMiddle.js', () => ({
  default: ({ text }: { text: string }) => <span data-testid="invite-name">{text}</span>,
}))

vi.mock('./shell/AppShell.js', () => ({
  default: ({ placeholder }: { placeholder?: ReactNode }) => (
    <>
      {placeholder}
      <Outlet />
    </>
  ),
}))

afterEach(() => {
  isConversationRequestsPending = false
})

describe('EmptyInvitations', () => {
  it('explains when there are no pending invitations', () => {
    render(
      <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
        <EmptyInvitations />
      </ThemeProvider>,
    )

    expect(screen.getByRole('heading', { name: 'invitations_empty' })).toBeVisible()
    expect(screen.getByText('invitations_empty_description')).toBeVisible()
  })
})

describe('ConversationRequestList', () => {
  it('opens an invite in the detail route instead of a dialog', async () => {
    const user = userEvent.setup()

    render(
      <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
        <MemoryRouter>
          <ConversationRequestList />
          <CurrentPath />
        </MemoryRouter>
      </ThemeProvider>,
    )

    expect(screen.getByText(hash, { selector: '[data-testid="invite-name"]' })).toBeVisible()

    await user.click(screen.getByRole('button', { name: hash }))

    expect(screen.getByTestId('current-path')).toHaveTextContent('/invites/request-1')
    expect(document.querySelector('.MuiDialog-root')).not.toBeInTheDocument()
  })
})

describe('Invites', () => {
  it('shows the detail skeleton while invitations are loading', () => {
    isConversationRequestsPending = true

    render(
      <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
        <MemoryRouter initialEntries={['/invites']}>
          <Routes>
            <Route path="/invites" element={<Invites />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    )

    expect(screen.getByTestId('invite-detail-skeleton')).toBeVisible()
  })

  it('opens the first invitation by default', async () => {
    render(
      <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
        <MemoryRouter initialEntries={['/invites']}>
          <Routes>
            <Route path="/invites" element={<Invites />}>
              <Route path=":conversationId" element={<span>Invitation detail</span>} />
            </Route>
          </Routes>
          <CurrentPath />
        </MemoryRouter>
      </ThemeProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('current-path')).toHaveTextContent('/invites/request-1'))
    expect(screen.getByText('Invitation detail')).toBeVisible()
  })
})

function CurrentPath() {
  const { pathname } = useLocation()
  return <output data-testid="current-path">{pathname}</output>
}
