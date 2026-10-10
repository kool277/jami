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
import { DeviceAuthStateCode, WebSocketMessageType } from '@savoirfairelinux/jami-web-common'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { buildDefaultTheme } from '../../themes/Default.js'
import { ExportToAnotherDevice } from './ExportToAnotherDevice.js'

const {
  navigate,
  setAlertContent,
  exportAccount,
  confirmAddDevice,
  cancelAddDevice,
  confirmOpIds,
  cancelOpIds,
  exportAccountFailed,
} = vi.hoisted(() => ({
  navigate: vi.fn(),
  setAlertContent: vi.fn(),
  exportAccount: vi.fn(),
  confirmAddDevice: vi.fn(),
  cancelAddDevice: vi.fn(),
  confirmOpIds: [] as number[],
  cancelOpIds: [] as number[],
  exportAccountFailed: { value: false },
}))

let addDeviceListener: ((data: unknown) => void) | undefined

vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('../../contexts/AlertSnackbarProvider.js', async () => {
  const { createContext } = await import('react')
  return { AlertSnackbarContext: createContext({ setAlertContent }) }
})
vi.mock('../../contexts/WebSocketProvider.js', () => ({
  useWebSocketContext: () => ({
    bind: (type: WebSocketMessageType, listener: (data: unknown) => void) => {
      if (type === WebSocketMessageType.AddDeviceStateChanged) {
        addDeviceListener = listener
      }
    },
    unbind: () => undefined,
    send: () => undefined,
  }),
}))
vi.mock('../../services/accountQueries.js', () => ({
  useExportAccountMutation: () => ({ mutate: exportAccount, isPending: false, isError: exportAccountFailed.value }),
  useConfirmAddDeviceMutation: (opId: number) => {
    confirmOpIds.push(opId)
    return { mutate: () => confirmAddDevice(opId), isPending: false }
  },
  useCancelAddDeviceMutation: (opId: number) => {
    cancelOpIds.push(opId)
    return { mutate: () => cancelAddDevice(opId), isPending: false }
  },
}))
vi.mock('../components/QrReader.js', () => ({ default: () => <div>qr-reader</div> }))

const renderPage = () =>
  render(
    <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
      <ExportToAnotherDevice />
    </ThemeProvider>,
  )

const emit = (data: { opId: number; state: DeviceAuthStateCode; details: Record<string, string> }) =>
  act(() => {
    addDeviceListener?.(data)
  })

const startExport = () => {
  fireEvent.click(screen.getByText('export_account_alternatively_enter_code'))
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'jami-auth://code' } })
  fireEvent.click(screen.getByRole('button', { name: 'connect' }))
}

describe('ExportToAnotherDevice', () => {
  beforeEach(() => {
    navigate.mockClear()
    setAlertContent.mockClear()
    exportAccount.mockClear()
    confirmAddDevice.mockClear()
    cancelAddDevice.mockClear()
    confirmOpIds.length = 0
    cancelOpIds.length = 0
    exportAccountFailed.value = false
    addDeviceListener = undefined
  })

  it('adopts the operation id of the first event, even when it skips the connecting state', () => {
    renderPage()
    startExport()

    emit({ opId: 7, state: DeviceAuthStateCode.Authenticating, details: { ['peer_address']: '10.0.0.1' } })

    expect(setAlertContent).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
    expect(screen.getByText(/10\.0\.0\.1/)).toBeInTheDocument()
    expect(confirmOpIds.at(-1)).toBe(7)
  })

  it('ignores events belonging to another operation', () => {
    renderPage()
    startExport()

    emit({ opId: 7, state: DeviceAuthStateCode.Connecting, details: {} })
    emit({ opId: 9, state: DeviceAuthStateCode.Done, details: { error: 'network' } })

    expect(setAlertContent).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
    expect(screen.getByText('please_wait')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'dialog_cancel' }))

    expect(cancelAddDevice).toHaveBeenCalledWith(7)
  })

  it('reports a transfer failure once', () => {
    renderPage()
    startExport()

    emit({ opId: 7, state: DeviceAuthStateCode.Connecting, details: {} })
    emit({ opId: 7, state: DeviceAuthStateCode.Done, details: { error: 'authentication' } })

    expect(setAlertContent).toHaveBeenCalledTimes(1)
    expect(setAlertContent).toHaveBeenCalledWith({
      messageI18nKey: 'device_auth_error_authentication',
      severity: 'error',
      alertOpen: true,
    })
    expect(navigate).toHaveBeenCalledWith('/settings/account/linked-devices')
  })

  it('reports an initiation failure', () => {
    exportAccountFailed.value = true

    renderPage()
    startExport()

    expect(setAlertContent).toHaveBeenCalledWith({
      messageI18nKey: 'link_device_could_not_initiate',
      severity: 'error',
      alertOpen: true,
    })
    expect(navigate).toHaveBeenCalledWith('/settings/account/linked-devices')
  })

  it('confirms the linking with the operation id of the running operation', () => {
    renderPage()
    startExport()

    emit({ opId: 7, state: DeviceAuthStateCode.Connecting, details: {} })
    emit({ opId: 7, state: DeviceAuthStateCode.Authenticating, details: { ['peer_address']: '10.0.0.1' } })
    fireEvent.click(screen.getByRole('button', { name: 'confirm' }))

    expect(confirmAddDevice).toHaveBeenCalledWith(7)
  })

  it('lets the user cancel while connecting to the new device', () => {
    renderPage()
    startExport()

    emit({ opId: 7, state: DeviceAuthStateCode.Connecting, details: {} })
    fireEvent.click(screen.getByRole('button', { name: 'dialog_cancel' }))

    // Leaving without cancelling strands the operation on the daemon.
    expect(cancelAddDevice).toHaveBeenCalledWith(7)
  })

  it('lets the user cancel while the transfer is running', () => {
    renderPage()
    startExport()

    emit({ opId: 7, state: DeviceAuthStateCode.InProgress, details: {} })
    fireEvent.click(screen.getByRole('button', { name: 'dialog_cancel' }))

    expect(cancelAddDevice).toHaveBeenCalledWith(7)
  })
})
