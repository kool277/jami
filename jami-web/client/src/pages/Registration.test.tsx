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
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { buildDefaultTheme } from '../themes/Default.js'
import Registration from './Registration.js'

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }))

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('react-router-dom', () => ({
  Form: ({ children }: { children: React.ReactNode }) => <form>{children}</form>,
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  useNavigate: () => navigate,
}))
vi.mock('../components/JamiWelcomeLogo.js', () => ({ default: () => <div data-testid="jami-welcome-logo" /> }))
vi.mock('../components/ProcessingRequest.js', () => ({ default: () => null }))
vi.mock('../components/UnconnectedUserLayout.js', () => ({
  default: ({ children, headerAccessory }: { children: React.ReactNode; headerAccessory?: React.ReactNode }) => (
    <div>
      {headerAccessory}
      {children}
    </div>
  ),
}))
vi.mock('../services/adminConfigQueries.js', () => ({
  useGetAdminConfigQuery: () => ({ data: { localAuthEnabled: true }, isPending: false }),
}))
vi.mock('../services/authQueries.js', () => ({
  checkPasswordStrength: vi.fn(),
  useCheckIfUsernameIsRegisteredQuery: () => ({ data: undefined, isError: false }),
  useGetAllProviders: () => ({ data: [] }),
  useLoginMutation: () => ({ isPending: false, mutate: vi.fn() }),
  useRegisterMutation: () => ({ isPending: false, mutate: vi.fn() }),
}))

describe('Registration', () => {
  beforeEach(() => {
    navigate.mockClear()
  })

  it('separates the username field from the Jami logo', () => {
    const theme = buildDefaultTheme('light', 'ltr')

    render(
      <ThemeProvider theme={theme}>
        <Registration />
      </ThemeProvider>,
    )

    expect(screen.getByTestId('jami-welcome-logo').parentElement).toHaveStyle({ marginBottom: '36px' })
  })

  it('does not reserve validation space between fields before an error occurs', () => {
    const theme = buildDefaultTheme('light', 'ltr')

    render(
      <ThemeProvider theme={theme}>
        <Registration />
      </ThemeProvider>,
    )

    expect(document.querySelectorAll('.MuiFormHelperText-root')).toHaveLength(0)
  })

  it('matches the login spacing above the create account action', () => {
    const theme = buildDefaultTheme('light', 'ltr')

    render(
      <ThemeProvider theme={theme}>
        <Registration />
      </ThemeProvider>,
    )

    const createAccount = screen.getByRole('button', { name: 'registration_form_submit_button' })
    expect(createAccount.parentElement).toHaveStyle({ marginTop: '12px' })
    expect(createAccount).toHaveStyle({ marginTop: theme.typography.pxToRem(5) })
  })

  it('returns to login with a back button', () => {
    const theme = buildDefaultTheme('light', 'ltr')
    render(
      <ThemeProvider theme={theme}>
        <Registration />
      </ThemeProvider>,
    )

    expect(screen.queryByText('registration_form_to_login_text')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'back' }))

    expect(navigate).toHaveBeenCalledWith('/login')
  })
})
