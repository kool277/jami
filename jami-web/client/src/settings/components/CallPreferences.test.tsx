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
import { describe, expect, it, vi } from 'vitest'

import { buildDefaultTheme } from '../../themes/Default.js'
import CallPreferences from './CallPreferences.js'

const { put } = vi.hoisted(() => ({ put: vi.fn() }))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('../../contexts/AuthProvider.js', () => ({
  useAuthContext: () => ({
    account: {
      defaultModerators: [],
      details: {},
      updateDetails: vi.fn(),
    },
    axiosInstance: {
      delete: vi.fn(),
      patch: vi.fn(),
      put,
    },
  }),
}))

vi.mock('../../services/contactQueries.js', () => ({
  useContactsSearchQuery: () => ({
    data: [{ getDisplayName: () => 'Ada Lovelace', registeredName: 'Ada Lovelace', uri: 'ada-uri' }],
    isFetching: false,
  }),
  useJamsContactsSearchQuery: () => ({ data: [], isFetching: false }),
  useContactListQuery: () => ({
    data: [{ displayName: 'Grace Hopper', id: 'grace-uri', username: 'grace' }],
  }),
  useContactProfilePicture: () => ({ data: undefined }),
}))

describe('CallPreferences', () => {
  it('keeps the moderator input visible with an entry placeholder', () => {
    render(
      <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
        <CallPreferences />
      </ThemeProvider>,
    )

    expect(screen.getByRole('combobox', { name: 'settings_add_moderator' })).toHaveAttribute(
      'placeholder',
      'settings_add_moderator_placeholder',
    )
  })

  it('adds a selected name as a default moderator', async () => {
    const user = userEvent.setup()
    put.mockResolvedValueOnce({})

    render(
      <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
        <CallPreferences />
      </ThemeProvider>,
    )

    await user.type(screen.getByRole('combobox', { name: 'settings_add_moderator' }), 'Ada')
    await user.click(await screen.findByRole('option', { name: /Ada Lovelace/ }))

    expect(put).toHaveBeenCalledWith('/default-moderators/ada-uri')
    const moderatorName = await screen.findByText('Ada Lovelace')
    const moderatorAvatar = screen.getByAltText('ADA LOVELACE')
    expect(moderatorAvatar.compareDocumentPosition(moderatorName) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('shows local contacts when opened and filters them by name', async () => {
    const user = userEvent.setup()

    render(
      <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
        <CallPreferences />
      </ThemeProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Open' }))
    expect(await screen.findByRole('option', { name: /Grace Hopper/ })).toBeVisible()
    expect(screen.getByAltText('GRACE HOPPER')).toBeVisible()

    await user.type(screen.getByRole('combobox', { name: 'settings_add_moderator' }), 'Grace')
    expect(await screen.findByRole('option', { name: /Grace Hopper/ })).toBeVisible()
  })

  it('keeps the menu open when typing right after the empty input collapsed it', async () => {
    const user = userEvent.setup()

    render(
      <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
        <CallPreferences />
      </ThemeProvider>,
    )

    const moderatorInput = screen.getByRole('combobox', { name: 'settings_add_moderator' })
    await user.click(screen.getByRole('button', { name: 'Open' }))
    expect(await screen.findByRole('option', { name: /Grace Hopper/ })).toBeVisible()

    // Clicking the empty input asks MUI to collapse the menu. Typing before the collapse animation
    // has finished must bring it back rather than let the pending close win.
    await user.click(moderatorInput)
    await user.type(moderatorInput, 'Grace')

    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(await screen.findByRole('option', { name: /Grace Hopper/ })).toBeVisible()
  })
})
