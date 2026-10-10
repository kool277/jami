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
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { type ContextType } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { AlertSnackbarContext } from '../contexts/AlertSnackbarProvider.js'
import { Account } from '../models/account.js'
import { buildDefaultTheme } from '../themes/Default.js'
import JamiIdDisplay from './JamiIdDisplay.js'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock('./SvgIcon.js', () => ({
  ContentCopyIcon: () => <span />,
  FingerprintIcon: () => <span />,
  JamiIdIcon: () => <span />,
  QrCodeIcon: () => <span />,
}))

const jamiUri = 'jami:0123456789abcdef'
const registeredName = 'alice'

function createAccount(accountRegisteredName?: string) {
  const account = Object.create(Account.prototype)
  vi.spyOn(account, 'getUri').mockReturnValue(jamiUri)
  vi.spyOn(account, 'getRegisteredName').mockReturnValue(accountRegisteredName)
  return account
}

function renderJamiIdDisplay({
  registeredName: accountRegisteredName,
  setAlertContent,
}: {
  registeredName?: string
  setAlertContent?: ContextType<typeof AlertSnackbarContext>['setAlertContent']
} = {}) {
  const alertContentSetter = setAlertContent ?? vi.fn<ContextType<typeof AlertSnackbarContext>['setAlertContent']>()
  const alertContext: ContextType<typeof AlertSnackbarContext> = {
    alertContent: {
      alertOpen: false,
      messageI18nKey: '',
      severity: 'info',
    },
    closeAlert: () => {},
    setAlertContent: alertContentSetter,
  }

  render(
    <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
      <AlertSnackbarContext value={alertContext}>
        <JamiIdDisplay account={createAccount(accountRegisteredName)} />
      </AlertSnackbarContext>
    </ThemeProvider>,
  )

  return alertContentSetter
}

function setClipboard(writeText: ReturnType<typeof vi.fn> | undefined) {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: writeText === undefined ? undefined : { writeText },
  })
}

describe('JamiIdDisplay clipboard feedback', () => {
  it('copies the account URI and shows a success notification', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn()
    setClipboard(writeText)
    const setAlertContent = renderJamiIdDisplay()

    await user.click(screen.getByRole('button', { name: 'copy_to_clipboard' }))

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(jamiUri))
    expect(setAlertContent).toHaveBeenCalledWith({
      alertOpen: true,
      messageI18nKey: 'copied_to_clipboard',
      severity: 'success',
    })
  })

  it('shows an error notification when clipboard access is rejected', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockRejectedValue(new Error('Clipboard denied'))
    setClipboard(writeText)
    const setAlertContent = renderJamiIdDisplay()

    await user.click(screen.getByRole('button', { name: 'copy_to_clipboard' }))

    await waitFor(() =>
      expect(setAlertContent).toHaveBeenCalledWith({
        alertOpen: true,
        messageI18nKey: 'unknown_error_alert',
        severity: 'error',
      }),
    )
  })

  it('shows an error notification when clipboard access is unavailable', async () => {
    const user = userEvent.setup()
    setClipboard(undefined)
    const setAlertContent = renderJamiIdDisplay()

    await user.click(screen.getByRole('button', { name: 'copy_to_clipboard' }))

    await waitFor(() =>
      expect(setAlertContent).toHaveBeenCalledWith({
        alertOpen: true,
        messageI18nKey: 'unknown_error_alert',
        severity: 'error',
      }),
    )
  })
})

describe('JamiIdDisplay registered name', () => {
  it('shows the registered name initially and toggles to the account hash', () => {
    const getBoundingClientRect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      const width = this.textContent === jamiUri ? 180 : 90
      return { bottom: 20, height: 20, left: 0, right: width, toJSON: () => {}, top: 0, width, x: 0, y: 0 } as DOMRect
    })
    const scrollWidth = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.textContent === jamiUri ? 200 : 100
    })
    renderJamiIdDisplay({ registeredName })

    expect(screen.getByTestId('jami-id-display-identity')).toHaveStyle('transition: width 300ms ease-out')
    expect(screen.getByTestId('jami-id-display-identity')).toHaveStyle('width: 100px')
    expect(screen.getByTestId('jami-id-display-text')).toHaveStyle('align-items: center')
    expect(screen.getByTestId('jami-id-display-name')).toHaveAttribute('aria-hidden', 'false')
    expect(screen.getByTestId('jami-id-display-hash')).toHaveAttribute('aria-hidden', 'true')

    const toggle = screen.getByRole('button', { name: 'show_jami_id' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')

    vi.useFakeTimers()
    fireEvent.click(toggle)

    expect(screen.getByTestId('jami-id-display-identity')).toHaveStyle('width: 0px')
    act(() => vi.advanceTimersByTime(300))
    expect(screen.getByTestId('jami-id-display-identity')).toHaveStyle('width: 200px')
    expect(screen.getByTestId('jami-id-display-name')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByTestId('jami-id-display-hash')).toHaveAttribute('aria-hidden', 'false')
    expect(screen.getByRole('button', { name: 'show_registered_name' })).toHaveAttribute('aria-pressed', 'true')
    getBoundingClientRect.mockRestore()
    scrollWidth.mockRestore()
    vi.useRealTimers()
  })

  it('shows the hash without a fingerprint toggle when no registered name exists', () => {
    renderJamiIdDisplay()

    expect(screen.getByText(jamiUri)).toBeVisible()
    expect(screen.queryByRole('button', { name: 'show_jami_id' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'show_registered_name' })).not.toBeInTheDocument()
  })
})
