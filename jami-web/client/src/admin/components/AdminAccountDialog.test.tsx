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
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { buildDefaultTheme } from '../../themes/Default.js'
import AdminAccountDialog from './AdminAccountDialog.js'

const { usernameAvailability } = vi.hoisted(() => ({
  usernameAvailability: { data: 'available' as 'available' | 'taken' | 'invalid' | undefined, isFetching: false },
}))

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('../services/adminQueries.js', () => ({
  useCheckAdminUsernameAvailabilityQuery: () => usernameAvailability,
}))

describe('AdminAccountDialog', () => {
  beforeEach(() => {
    usernameAvailability.data = 'available'
    usernameAvailability.isFetching = false
  })

  it('explains name server registration and keeps the username icon static', () => {
    render(
      <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
        <AdminAccountDialog open mode="create" pending={false} onClose={vi.fn()} onSubmit={vi.fn()} />
      </ThemeProvider>,
    )

    expect(screen.getByLabelText('admin_account_username_nameserver_info')).toBeVisible()
    expect(screen.getByText('person')).toBeVisible()
    expect(screen.queryByText('username_input_helper_text_success')).not.toBeInTheDocument()
  })

  it('keeps the person icon while the name server is queried', () => {
    usernameAvailability.data = undefined
    usernameAvailability.isFetching = true

    render(
      <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
        <AdminAccountDialog open mode="create" pending={false} onClose={vi.fn()} onSubmit={vi.fn()} />
      </ThemeProvider>,
    )

    expect(screen.getByText('person')).toBeVisible()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'admin_account_create' })).toBeDisabled()
  })

  it('reports a taken username in helper text without changing the icon', () => {
    usernameAvailability.data = 'taken'

    render(
      <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
        <AdminAccountDialog open mode="create" pending={false} onClose={vi.fn()} onSubmit={vi.fn()} />
      </ThemeProvider>,
    )

    expect(screen.getByText('person')).toBeVisible()
    expect(screen.getByText('username_input_helper_text_taken')).toBeVisible()
  })

  it('submits a confirmed local account password and username', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(
      <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
        <AdminAccountDialog open mode="create" pending={false} onClose={vi.fn()} onSubmit={onSubmit} />
      </ThemeProvider>,
    )

    await user.type(screen.getByLabelText(/admin_page_accounts_overview_title_username/), 'alice')
    await user.type(screen.getAllByLabelText(/password_input_label/)[0], 'secure-password')
    await user.type(screen.getByLabelText(/password_input_label_repeat/), 'secure-password')
    await user.click(screen.getByRole('button', { name: 'admin_account_create' }))

    expect(onSubmit).toHaveBeenCalledWith({ username: 'alice', password: 'secure-password' })
  })

  it('prevents submitting an invalid username', async () => {
    const user = userEvent.setup()

    render(
      <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
        <AdminAccountDialog open mode="create" pending={false} onClose={vi.fn()} onSubmit={vi.fn()} />
      </ThemeProvider>,
    )

    await user.type(screen.getByLabelText(/admin_page_accounts_overview_title_username/), 'a!')
    await user.type(screen.getAllByLabelText(/password_input_label/)[0], 'secure-password')
    await user.type(screen.getByLabelText(/password_input_label_repeat/), 'secure-password')

    expect(screen.getByText('username_input_helper_text_invalid')).toHaveClass('Mui-error')
    expect(screen.getByRole('button', { name: 'admin_account_create' })).toBeDisabled()
  })

  it('shows an account creation rejection in the dialog', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockRejectedValue(new Error('Username already exists'))

    render(
      <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
        <AdminAccountDialog open mode="create" pending={false} onClose={vi.fn()} onSubmit={onSubmit} />
      </ThemeProvider>,
    )

    await user.type(screen.getByLabelText(/admin_page_accounts_overview_title_username/), 'alice')
    await user.type(screen.getAllByLabelText(/password_input_label/)[0], 'secure-password')
    await user.type(screen.getByLabelText(/password_input_label_repeat/), 'secure-password')
    await user.click(screen.getByRole('button', { name: 'admin_account_create' }))

    expect(await screen.findByText('Username already exists')).toHaveClass('MuiAlert-message')
  })

  it('uses compact, icon-led fields and the password length guidance', () => {
    render(
      <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
        <AdminAccountDialog open mode="create" pending={false} onClose={vi.fn()} onSubmit={vi.fn()} />
      </ThemeProvider>,
    )

    const username = screen.getByLabelText(/admin_page_accounts_overview_title_username/)
    const [password] = screen.getAllByLabelText(/password_input_label/)
    const confirmation = screen.getByLabelText(/password_input_label_repeat/)

    for (const field of [username, password, confirmation]) {
      expect(field.closest('.MuiInputBase-root')).toHaveClass('MuiInputBase-sizeSmall')
    }
    expect(username.parentElement).toHaveTextContent('person')
    expect(password.parentElement).toHaveTextContent('password')
    expect(confirmation.parentElement).toHaveTextContent('password')
    expect(screen.queryByText('password_input_helper_text_too_short')).not.toBeInTheDocument()
  })

  it('shows localized password errors only when their validation conditions apply', async () => {
    const user = userEvent.setup()

    render(
      <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
        <AdminAccountDialog open mode="create" pending={false} onClose={vi.fn()} onSubmit={vi.fn()} />
      </ThemeProvider>,
    )

    const [password] = screen.getAllByLabelText(/password_input_label/)
    const confirmation = screen.getByLabelText(/password_input_label_repeat/)

    await user.type(password, 'short')
    expect(screen.getByText('password_input_helper_text_too_short')).toHaveClass('Mui-error')

    await user.type(password, 'password')
    expect(screen.queryByText('password_input_helper_text_too_short')).not.toBeInTheDocument()

    await user.type(confirmation, 'different')
    expect(screen.getByText('password_input_helper_text_not_match')).toHaveClass('Mui-error')
    expect(screen.queryByText('passwords_do_not_match')).not.toBeInTheDocument()
  })

  it('keeps the floating username label clear of the outlined border', () => {
    render(
      <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
        <AdminAccountDialog open mode="create" pending={false} onClose={vi.fn()} onSubmit={vi.fn()} />
      </ThemeProvider>,
    )

    expect(screen.getByText(/admin_page_accounts_overview_title_username/, { selector: 'label' })).toHaveStyle({
      backgroundColor: 'rgb(250, 246, 240)',
    })
    expect(document.getElementById('admin-account-form')?.closest('.MuiDialogContent-root')).toHaveStyle({
      paddingTop: '12px',
    })
  })

  it('retains new-password labels when resetting a password', () => {
    render(
      <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
        <AdminAccountDialog open mode="reset-password" pending={false} onClose={vi.fn()} onSubmit={vi.fn()} />
      </ThemeProvider>,
    )

    expect(screen.getByLabelText(/admin_page_password_placeholder/)).toBeVisible()
    expect(screen.getByLabelText(/admin_page_password_repeat_placeholder/)).toBeVisible()
    expect(screen.getByRole('heading', { name: 'change_password' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'change_password' })).toBeVisible()
  })
})
