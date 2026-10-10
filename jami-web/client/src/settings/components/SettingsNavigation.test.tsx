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
import { userEvent } from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { buildDefaultTheme } from '../../themes/Default.js'
import SettingsNavigation from './SettingsNavigation.js'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        ['settings_search_aria_label']: 'Search settings',
        ['settings_search_placeholder']: 'Search settings',
        ['settings_search_moderator']: 'moderator',
        ['settings_search_moderators']: 'moderators',
        ['settings_search_conference']: 'conference',
        ['settings_search_biometric']: 'biometric',
        ['app_access_search_terms']: 'api token tokens app access developer integration',
      })[key] ?? key,
  }),
}))

const renderSettingsNavigation = (path: string, compact = false) => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: compact && query.includes('max-width'),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))

  return render(
    <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
      <MemoryRouter initialEntries={[path]}>
        <SettingsNavigation />
      </MemoryRouter>
    </ThemeProvider>,
  )
}

describe('SettingsNavigation', () => {
  it('shows all submenu links from the compact settings index', async () => {
    renderSettingsNavigation('/settings', true)

    expect(await screen.findByRole('link', { name: 'settings_title_system' })).toHaveAttribute(
      'href',
      '/settings/general/system',
    )
    expect(screen.getByRole('link', { name: 'settings_account_information' })).toHaveAttribute(
      'href',
      '/settings/account/manage-account',
    )
  })

  it('exposes every settings page as a navigable link', () => {
    renderSettingsNavigation('/settings/general/system')

    expect(screen.getByRole('link', { name: 'settings_title_system' })).toHaveAttribute(
      'href',
      '/settings/general/system',
    )
    expect(screen.getByRole('link', { name: 'settings_appearance' })).toHaveAttribute(
      'href',
      '/settings/general/appearance',
    )
    expect(screen.getByRole('link', { name: 'settings_title_chat' })).toHaveAttribute('href', '/settings/general/chat')
    expect(screen.queryByRole('link', { name: 'settings_account_information' })).not.toBeInTheDocument()
  })

  it('links to app access from account settings', async () => {
    const user = userEvent.setup()
    renderSettingsNavigation('/settings/account/manage-account')

    await user.type(screen.getByRole('textbox', { name: 'Search settings' }), 'api token')

    expect(screen.getByRole('link', { name: 'app_access_title' })).toHaveAttribute(
      'href',
      '/settings/account/app-access',
    )
  })

  it('marks the route-matched page as current', () => {
    renderSettingsNavigation('/settings/account/linked-devices')

    expect(screen.getByRole('link', { name: 'settings_linked_devices' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'settings_account_information' })).not.toHaveAttribute('aria-current')
    expect(screen.queryByRole('link', { name: 'settings_title_system' })).not.toBeInTheDocument()
  })

  it('renders parent settings items as fully rounded pills', () => {
    renderSettingsNavigation('/settings/general/system')

    expect(screen.getByRole('link', { name: 'settings_title_general' })).toHaveStyle({ borderRadius: '9999px' })
  })

  it('aligns the settings controls with the navigation rail slots', () => {
    renderSettingsNavigation('/settings/general/system')

    expect(screen.getByRole('heading', { name: 'settings' })).toHaveStyle({
      height: '40px',
      paddingTop: '0px',
      paddingBottom: '0px',
    })

    const search = screen.getByRole('textbox', { name: 'Search settings' }).closest('.MuiFormControl-root')
    if (!search) {
      throw new Error('Expected the settings search control to have a form-control container')
    }
    expect(search).toHaveStyle({ marginTop: '4px', marginBottom: '0px' })
    expect(screen.getAllByRole('list')[0]).toHaveStyle({ marginTop: '1px' })
  })

  it('keeps a parent page selected while visiting one of its nested routes', () => {
    renderSettingsNavigation('/settings/account/linked-devices/export')

    expect(screen.getByRole('link', { name: 'settings_linked_devices' })).toHaveAttribute('aria-current', 'page')
  })

  it('finds settings from contextual search terms', async () => {
    const user = userEvent.setup()
    renderSettingsNavigation('/settings/general/system')

    await user.type(screen.getByRole('textbox', { name: 'Search settings' }), 'moderator')

    expect(screen.getByRole('link', { name: 'settings_calls' })).toHaveAttribute('href', '/settings/account/calls')
    expect(screen.queryByRole('link', { name: 'settings_title_system' })).not.toBeInTheDocument()
  })

  it('finds contextual settings outside the calls page', async () => {
    const user = userEvent.setup()
    renderSettingsNavigation('/settings/general/system')

    await user.type(screen.getByRole('textbox', { name: 'Search settings' }), 'biometric')

    expect(screen.getByRole('link', { name: 'password_and_passkeys' })).toHaveAttribute(
      'href',
      '/settings/account/passkeys',
    )
    expect(screen.queryByRole('link', { name: 'settings_calls' })).not.toBeInTheDocument()
  })
})
