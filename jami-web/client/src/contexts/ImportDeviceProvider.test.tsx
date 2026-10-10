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
import { DeviceAuthStateCode, WebSocketMessageType } from '@savoirfairelinux/jami-web-common'
import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ImportDeviceProvider, { useImportDeviceContext } from './ImportDeviceProvider.js'

const { navigate, setAlertContent } = vi.hoisted(() => ({ navigate: vi.fn(), setAlertContent: vi.fn() }))
let deviceAuthListener: ((data: unknown) => void) | undefined

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
}))

vi.mock('./AlertSnackbarProvider.js', async () => {
  const { createContext } = await import('react')
  return { AlertSnackbarContext: createContext({ setAlertContent }) }
})

vi.mock('./WebSocketLinkProvider.js', () => ({
  useWebSocketLinkContext: () => ({
    bind: (type: WebSocketMessageType, listener: (data: unknown) => void) => {
      if (type === WebSocketMessageType.DeviceAuthStateChanged) {
        deviceAuthListener = listener
      }
    },
    unbind: () => undefined,
    send: () => undefined,
    setToken: () => undefined,
    token: 'ws-token',
  }),
}))

const StateProbe = () => {
  const { state, details } = useImportDeviceContext()
  return (
    <div>
      <span data-testid="state">{state}</span>
      <span data-testid="peer-id">{details.get('peer_id') ?? ''}</span>
    </div>
  )
}

const renderProvider = () =>
  render(
    <ImportDeviceProvider>
      <StateProbe />
    </ImportDeviceProvider>,
  )

/** The daemon details map is JSON-serialised by the server, so it arrives as a plain object. */
const emit = (data: { accountId: string; state: DeviceAuthStateCode; details: Record<string, string> }) =>
  act(() => {
    deviceAuthListener?.(data)
  })

describe('ImportDeviceProvider', () => {
  beforeEach(() => {
    navigate.mockClear()
    setAlertContent.mockClear()
    deviceAuthListener = undefined
  })

  it('exposes details received as a plain JSON object', () => {
    renderProvider()

    emit({
      accountId: 'account-1',
      state: DeviceAuthStateCode.Authenticating,
      details: { ['peer_id']: 'peer-1', ['auth_scheme']: 'password' },
    })

    expect(screen.getByTestId('peer-id')).toHaveTextContent('peer-1')
    expect(navigate).toHaveBeenCalledWith('/import-account-unlock')
  })

  it('routes back to the import page when the transfer fails on authentication', () => {
    renderProvider()

    emit({
      accountId: 'account-1',
      state: DeviceAuthStateCode.Done,
      details: { error: 'authentication' },
    })

    expect(setAlertContent).toHaveBeenCalledWith({
      messageI18nKey: 'device_auth_error_authentication',
      severity: 'error',
      alertOpen: true,
    })
    expect(navigate).toHaveBeenCalledWith('/import-account')
  })

  it('accepts a new attempt after a failed one', () => {
    renderProvider()

    emit({ accountId: 'account-1', state: DeviceAuthStateCode.Connecting, details: {} })
    emit({ accountId: 'account-1', state: DeviceAuthStateCode.Done, details: { error: 'network' } })
    navigate.mockClear()

    emit({ accountId: 'account-1', state: DeviceAuthStateCode.Connecting, details: {} })

    expect(screen.getByTestId('state')).toHaveTextContent(String(DeviceAuthStateCode.Connecting))
    expect(navigate).toHaveBeenCalledWith('/import-account-connecting')
  })
})
