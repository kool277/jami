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
import { createContext } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { buildDefaultTheme } from '../themes/Default.js'
import { submitButtonWidth } from '../utils/constants.js'
import Login from './Login.js'

const { adminConfig, providers } = vi.hoisted(() => ({
  adminConfig: {
    localAuthEnabled: true,
    jamsAuthEnabled: false,
    guestAccessEnabled: true,
    openIdAuthEnabled: false,
  },
  providers: [] as {
    provider: string
    displayName: string
    colorTheme: string
    icon: string
    redirectUri: string
  }[],
}))

vi.mock('@simplewebauthn/browser', () => ({ browserSupportsWebAuthn: () => true }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('react-router-dom', () => ({
  Form: ({ children }: { children: React.ReactNode }) => <form>{children}</form>,
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  useNavigate: () => vi.fn(),
}))
vi.mock('../components/JamiWelcomeLogo.js', () => ({ default: () => <div /> }))
vi.mock('../components/ProcessingRequest.js', () => ({ default: () => null }))
vi.mock('../components/UnconnectedUserLayout.js', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
vi.mock('../contexts/AlertSnackbarProvider.js', () => ({
  AlertSnackbarContext: createContext({ setAlertContent: vi.fn() }),
}))
vi.mock('../services/adminConfigQueries.js', () => ({
  useGetAdminConfigQuery: () => ({ data: adminConfig }),
}))
vi.mock('../services/authQueries.js', () => ({
  useGetAllProviders: () => ({ data: providers }),
  useLoginMutation: () => ({ isPending: false, mutate: vi.fn() }),
}))
vi.mock('../services/passkeyQueries.js', () => ({
  usePasskeyLoginMutation: () => ({ isPending: false, mutate: vi.fn() }),
}))
vi.mock('../utils/electron.js', () => ({ isElectronMode: () => false }))

describe('Login', () => {
  beforeEach(() => {
    adminConfig.openIdAuthEnabled = false
    providers.length = 0
  })

  it('groups login actions into the requested columns', () => {
    const theme = buildDefaultTheme('light', 'ltr')

    render(
      <ThemeProvider theme={theme}>
        <Login />
      </ThemeProvider>,
    )

    const password = screen.getByLabelText('password_input_label')
    const login = screen.getByRole('button', { name: 'login_form_submit_button' })
    const guest = screen.getByRole('button', { name: 'login_as_guest' })
    const passkey = screen.getByRole('button', { name: 'passkey_login_button' })
    const createAccount = screen.getByRole('button', { name: 'login_form_to_registration_link' })
    const deviceTransfer = screen.getByRole('button', { name: 'connect_from_another_device' })

    expect(password.compareDocumentPosition(login)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(login.closest('form')).toBe(passkey.closest('form'))
    expect(passkey.closest('form')).toBe(guest.closest('form'))
    expect(passkey.compareDocumentPosition(guest)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(guest.compareDocumentPosition(createAccount)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(createAccount.compareDocumentPosition(deviceTransfer)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(createAccount.parentElement).toHaveStyle({ justifyContent: 'center' })

    const actionWidth = theme.typography.pxToRem(submitButtonWidth + 140)
    expect(login).toHaveStyle({ width: actionWidth })
    expect(guest).toHaveStyle({ width: actionWidth })
    expect(passkey).toHaveStyle({ width: actionWidth })
    expect(createAccount).toHaveStyle({ width: actionWidth })
    expect(deviceTransfer).toHaveStyle({ width: actionWidth })
  })

  it('groups enabled OpenID providers in a responsive grid', () => {
    adminConfig.openIdAuthEnabled = true
    providers.push(
      {
        provider: 'google',
        displayName: 'Google',
        colorTheme: '#ef4d30',
        icon: '/google.svg',
        redirectUri: 'https://accounts.google.com',
      },
      {
        provider: 'github',
        displayName: 'GitHub',
        colorTheme: '#000000',
        icon: '',
        redirectUri: 'https://github.com',
      },
    )

    const theme = buildDefaultTheme('light', 'ltr')
    render(
      <ThemeProvider theme={theme}>
        <Login />
      </ThemeProvider>,
    )

    const providerGrid = screen.getByRole('list', { name: 'openid' })
    expect(screen.getByText('openid_login_with')).toHaveStyle({
      fontStyle: 'italic',
      fontSize: theme.typography.body2.fontSize,
    })
    expect(providerGrid).toHaveStyle({ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' })
    const actionWidth = theme.typography.pxToRem(submitButtonWidth + 140)
    const googleButton = within(providerGrid).getByRole('button', { name: 'openid_login_with Google' })
    expect(googleButton).toHaveClass('MuiButton-contained')
    expect(googleButton).toHaveStyle({
      width: actionWidth,
      color: theme.palette.getContrastText('#ef4d30'),
    })
    const googleLogo = googleButton.querySelector('img')
    expect(googleLogo).not.toBeNull()
    expect(googleLogo!).toHaveStyle({ gridColumn: '1' })
    expect(within(googleButton).getByText('Google')).toHaveStyle({
      gridColumn: '2',
      overflowWrap: 'anywhere',
    })
    const githubButton = within(providerGrid).getByRole('button', { name: 'openid_login_with GitHub' })
    expect(githubButton).toHaveClass('MuiButton-contained')
    expect(githubButton).toHaveStyle({
      width: actionWidth,
      color: theme.palette.getContrastText('#000000'),
    })
  })
})
