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

import { buildDefaultTheme } from '../../themes/Default.js'
import AccountsOverview from './AccountsOverview.js'

vi.mock('i18next', () => ({ t: (key: string) => key }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: 'en' }, t: (key: string) => key }),
}))
vi.mock('../services/adminQueries.js', () => ({
  useGetAllAccounts: () => ({
    data: [
      {
        accountUri: 'jami:abcdef1234567890',
        accountId: 'abcdef1234567890',
        auth: 'openid',
        storage: 0,
        username: 'alice',
      },
      {
        accountUri: 'jami:0123456789abcdef',
        accountId: '0123456789abcdef',
        auth: 'local',
        storage: 0,
        username: 'zed',
      },
    ],
  }),
  useDeleteAccounts: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateAccount: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useResetAccountPassword: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

describe('AccountsOverview', () => {
  it('uses compact filters with search and person-add affordances', () => {
    render(
      <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
        <AccountsOverview />
      </ThemeProvider>,
    )

    const searchInput = screen.getByLabelText('admin_account_search')
    const authFilter = screen.getByRole('combobox', { name: 'admin_account_auth_filter' })
    const addAccountButton = screen.getByRole('button', { name: 'admin_account_add' })

    expect(searchInput.closest('.MuiInputBase-root')).toHaveClass('MuiInputBase-sizeSmall')
    expect(authFilter.closest('.MuiInputBase-root')).toHaveClass('MuiInputBase-sizeSmall')
    expect(searchInput.parentElement).toHaveTextContent('search')
    expect(addAccountButton).toHaveTextContent('admin_account_add')
    expect(addAccountButton).toHaveTextContent('person_add')
  })

  it('uses a monospace font for account hashes and identifiers', () => {
    render(
      <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
        <AccountsOverview />
      </ThemeProvider>,
    )

    expect(screen.getByText('jami:abcdef1234567890')).toHaveStyle({ fontFamily: 'monospace' })
    expect(screen.getByText('abcdef1234567890')).toHaveStyle({ fontFamily: 'monospace' })
  })

  it('sorts accounts by username by default', () => {
    render(
      <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
        <AccountsOverview />
      </ThemeProvider>,
    )

    expect(document.querySelector('tbody tr')).toHaveTextContent('alice')
  })
})
