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
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { buildDefaultTheme } from '../../themes/Default.js'
import AdminSettingsNavigation from './AdminSettingsNavigation.js'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock('../../components/SvgIcon.js', () => {
  const symbol = (name: string) =>
    function Symbol({ filled }: { filled?: boolean }) {
      return <span data-symbol={name} data-filled={String(Boolean(filled))} />
    }
  return {
    AdminPanelSettingsIcon: symbol('admin_panel_settings'),
    GppMaybeIcon: symbol('gpp_maybe'),
    LogoutIcon: symbol('logout'),
    ManageAccountsIcon: symbol('manage_accounts'),
  }
})

const renderAdminSettingsNavigation = (path: string) =>
  render(
    <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
      <MemoryRouter initialEntries={[path]}>
        <AdminSettingsNavigation />
      </MemoryRouter>
    </ThemeProvider>,
  )

describe('AdminSettingsNavigation', () => {
  it('keeps a parent authentication method current on a provider route', () => {
    renderAdminSettingsNavigation('/admin/authentication/openid/google')

    expect(screen.getByRole('link', { name: 'authentication' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'openid' })).toHaveAttribute('aria-current', 'page')
  })

  it('matches parent items to the user navigation rail radius', () => {
    renderAdminSettingsNavigation('/admin/authentication')

    expect(screen.getByRole('link', { name: 'authentication' })).toHaveStyle({ borderRadius: '40px' })
  })

  it('fills only the selected section icon', () => {
    renderAdminSettingsNavigation('/admin/authentication')

    expect(
      screen.getByRole('link', { name: 'authentication' }).querySelector('[data-symbol="gpp_maybe"]'),
    ).toHaveAttribute('data-filled', 'true')
    expect(
      screen
        .getByRole('link', { name: 'admin_account_configuration' })
        .querySelector('[data-symbol="admin_panel_settings"]'),
    ).toHaveAttribute('data-filled', 'false')
  })
})
