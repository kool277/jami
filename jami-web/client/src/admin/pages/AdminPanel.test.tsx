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
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SettingsPage } from '../../settings/components/SettingsPage.js'
import { buildDefaultTheme } from '../../themes/Default.js'
import AdminSettingsNavigation from '../components/AdminSettingsNavigation.js'
import AdminPanel from './AdminPanel.js'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

describe('AdminPanel', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    })
  })

  it('shows only configuration submenu links from the compact index', () => {
    render(
      <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
        <MemoryRouter initialEntries={['/admin/settings']}>
          <AdminPanel>
            <AdminSettingsNavigation compact compactSection="configuration" />
          </AdminPanel>
        </MemoryRouter>
      </ThemeProvider>,
    )

    const compactRailLink = screen
      .getAllByRole('link', { name: 'admin_account_configuration' })
      .find((link) => link.getAttribute('href') === '/admin/settings')
    if (!compactRailLink) {
      throw new Error('Expected the compact rail to link to the admin settings index')
    }
    expect(compactRailLink).toHaveAttribute('aria-current', 'page')
    const settingsNavigation = screen.getAllByRole('navigation')[0]
    expect(
      within(settingsNavigation).queryByRole('link', { name: 'admin_account_configuration' }),
    ).not.toBeInTheDocument()
    expect(within(settingsNavigation).queryByRole('link', { name: 'accounts' })).not.toBeInTheDocument()
    expect(within(settingsNavigation).queryByRole('link', { name: 'authentication' })).not.toBeInTheDocument()
    expect(within(settingsNavigation).getByRole('link', { name: 'download_limit' })).toHaveAttribute(
      'href',
      '/admin/configuration/auto-download-limit',
    )
    expect(within(settingsNavigation).getByRole('link', { name: 'media_settings' })).toHaveAttribute(
      'href',
      '/admin/configuration/media',
    )
    expect(within(settingsNavigation).queryByRole('link', { name: 'jami' })).not.toBeInTheDocument()
    expect(within(settingsNavigation).queryByRole('link', { name: 'openid' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'logout' })).toHaveLength(1)
  })

  it('returns from a configuration submenu page to the compact index', () => {
    render(
      <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
        <MemoryRouter initialEntries={['/admin/configuration/media']}>
          <AdminPanel>
            <SettingsPage title="Media settings" />
          </AdminPanel>
        </MemoryRouter>
      </ThemeProvider>,
    )

    expect(screen.getByTestId('settings-page-island')).toContainElement(screen.getByRole('link', { name: 'back' }))
    expect(screen.getByRole('link', { name: 'back' })).toHaveAttribute('href', '/admin/settings')
  })
})
