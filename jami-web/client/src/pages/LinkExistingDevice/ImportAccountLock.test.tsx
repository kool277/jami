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
import { DeviceAuthStateCode } from '@savoirfairelinux/jami-web-common'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { buildDefaultTheme } from '../../themes/Default.js'
import ImportAccountLock from './ImportAccountLock.js'

const { navigate, setAlertContent, provideAuthentication, isPending, importDeviceContext } = vi.hoisted(() => ({
  navigate: vi.fn(),
  setAlertContent: vi.fn(),
  provideAuthentication: vi.fn(),
  isPending: { value: false },
  importDeviceContext: {
    value: {
      state: 3 as DeviceAuthStateCode,
      token: 'link-token',
      accountId: 'account-1',
      details: new Map<string, string>(),
    },
  },
}))

vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('../../contexts/AlertSnackbarProvider.js', async () => {
  const { createContext } = await import('react')
  return { AlertSnackbarContext: createContext({ setAlertContent }) }
})
vi.mock('../../contexts/ImportDeviceProvider.js', () => ({
  useImportDeviceContext: () => importDeviceContext.value,
}))
vi.mock('../../services/accountQueries.js', () => ({
  useProvideAccountAuthentication: () => ({ mutate: provideAuthentication, isPending: isPending.value }),
}))
vi.mock('../../components/UnconnectedUserLayout.js', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const renderPage = () =>
  render(
    <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
      <ImportAccountLock />
    </ThemeProvider>,
  )

describe('ImportAccountLock', () => {
  beforeEach(() => {
    navigate.mockClear()
    setAlertContent.mockClear()
    provideAuthentication.mockClear()
    isPending.value = false
    importDeviceContext.value = {
      state: DeviceAuthStateCode.Authenticating,
      token: 'link-token',
      accountId: 'account-1',
      details: new Map<string, string>(),
    }
  })

  it('stays on the page while authenticating', () => {
    renderPage()

    expect(navigate).not.toHaveBeenCalled()
  })

  it('reports a bad password exactly once per failure', () => {
    importDeviceContext.value.details = new Map([
      ['auth_scheme', 'password'],
      ['auth_error', 'bad_password'],
    ])

    const { rerender } = renderPage()
    rerender(
      <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
        <ImportAccountLock />
      </ThemeProvider>,
    )

    expect(setAlertContent).toHaveBeenCalledTimes(1)
    expect(setAlertContent).toHaveBeenCalledWith({
      messageI18nKey: 'auth_error_while_linking_device',
      severity: 'error',
      alertOpen: true,
    })
    expect(screen.getByRole('alert')).toHaveTextContent('incorrect_password')
  })

  it('submits an empty password for a password protected account', () => {
    importDeviceContext.value.details = new Map([['auth_scheme', 'password']])

    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'connect' }))

    expect(provideAuthentication).toHaveBeenCalledWith({
      password: '',
      scheme: 'password',
      accountId: 'account-1',
    })
  })

  it('follows the flow when the transfer starts', () => {
    importDeviceContext.value.state = DeviceAuthStateCode.InProgress

    renderPage()

    expect(navigate).toHaveBeenCalledWith('/import-account-in-progress')
  })

  it('masks the password while it is typed', () => {
    importDeviceContext.value.details = new Map([['auth_scheme', 'password']])

    renderPage()

    expect(screen.getByLabelText('account_password')).toHaveAttribute('type', 'password')
  })

  it('submits the password when the user presses enter', () => {
    importDeviceContext.value.details = new Map([['auth_scheme', 'password']])

    renderPage()
    const field = screen.getByLabelText('account_password')
    fireEvent.change(field, { target: { value: 'hunter2' } })
    fireEvent.submit(field)

    expect(provideAuthentication).toHaveBeenCalledWith({
      password: 'hunter2',
      scheme: 'password',
      accountId: 'account-1',
    })
  })

  it('does not let the user submit twice while a request is running', () => {
    importDeviceContext.value.details = new Map([['auth_scheme', 'password']])
    isPending.value = true

    renderPage()

    expect(screen.getByRole('button', { name: 'connect' })).toBeDisabled()
  })

  it('does not show a made up peer identity', () => {
    const { container } = renderPage()

    // Showing a plausible looking identity on a security confirmation invites the user
    // to approve a device they never checked.
    expect(container.textContent).not.toContain('e3eaee01f47f98216f4160658179420ff5e30f50')
  })

  it('shows the peer identity reported by the daemon', () => {
    importDeviceContext.value.details = new Map([
      ['peer_id', '761ee5cca44191c6f4649d78fa5910440edce697'],
      ['peer_device_id', '1710b3b1556d555911a4d976acb2d5d3879cbfe8'],
    ])

    const { container } = renderPage()

    expect(screen.getByText('link_device_peer_id')).toBeInTheDocument()
    expect(screen.getByText('link_device_peer_device_id')).toBeInTheDocument()
    expect(screen.queryByText('PeerId:')).not.toBeInTheDocument()
    expect(screen.queryByText('DeviceId:')).not.toBeInTheDocument()
    expect(container.textContent).toContain('761ee5cca44191c6f4649d78fa5910440edce697')
    expect(container.textContent).toContain('1710b3b1556d555911a4d976acb2d5d3879cbfe8')
  })
})
