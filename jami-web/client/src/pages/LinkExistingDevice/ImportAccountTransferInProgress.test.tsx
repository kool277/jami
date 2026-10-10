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
import ImportAccountTransferInProgress from './ImportAccountTransferInProgress.js'

const { navigate, cancelLinkDevice, importDeviceContext } = vi.hoisted(() => ({
  navigate: vi.fn(),
  cancelLinkDevice: vi.fn(),
  importDeviceContext: {
    value: { state: 4 as DeviceAuthStateCode, token: 'link-token', accountId: 'account-1' },
  },
}))

vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('../../contexts/ImportDeviceProvider.js', () => ({
  useImportDeviceContext: () => importDeviceContext.value,
}))
vi.mock('../../services/authQueries.js', () => ({
  useCancelLinkDeviceMutation: () => ({ mutate: cancelLinkDevice, isPending: false }),
}))
vi.mock('../../components/UnconnectedUserLayout.js', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const renderPage = () =>
  render(
    <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
      <ImportAccountTransferInProgress />
    </ThemeProvider>,
  )

describe('ImportAccountTransferInProgress', () => {
  beforeEach(() => {
    navigate.mockClear()
    cancelLinkDevice.mockClear()
    importDeviceContext.value = { state: DeviceAuthStateCode.InProgress, token: 'link-token', accountId: 'account-1' }
  })

  it('stays on the page while the transfer is in progress', () => {
    renderPage()

    expect(navigate).not.toHaveBeenCalled()
    expect(screen.getByText('progress_activity')).toBeInTheDocument()
  })

  it('lets the user leave a transfer that never completes', () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'dialog_cancel' }))

    expect(cancelLinkDevice).toHaveBeenCalledWith('account-1')
  })

  it('follows the flow to the done page', () => {
    importDeviceContext.value = { state: DeviceAuthStateCode.Done, token: 'link-token', accountId: 'account-1' }

    renderPage()

    expect(navigate).toHaveBeenCalledWith('/import-account-done')
  })

  it('returns home when no link token is available', () => {
    importDeviceContext.value = { state: DeviceAuthStateCode.InProgress, token: '', accountId: 'account-1' }

    renderPage()

    expect(navigate).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith('/')
  })
})
