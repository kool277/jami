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
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { Account } from '../models/account.js'
import { buildDefaultTheme } from '../themes/Default.js'
import QrCodeModal from './QrCodeModal.js'

vi.mock('qrcode.react', () => ({
  QRCodeCanvas: ({ size, value }: { size: number; value: string }) => (
    <output data-size={size} data-value={value}>
      QR code
    </output>
  ),
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

const jamiUri = 'jami:0123456789abcdef'

function createAccount() {
  const account = Object.create(Account.prototype)
  vi.spyOn(account, 'getUri').mockReturnValue(jamiUri)
  return account
}

function QrCodeModalHarness() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button onClick={() => setOpen(true)}>Show QR code</button>
      <QrCodeModal account={createAccount()} open={open} onClose={() => setOpen(false)} />
    </>
  )
}

function renderQrCodeModal() {
  render(
    <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
      <QrCodeModalHarness />
    </ThemeProvider>,
  )
}

async function expectDialogClosed() {
  await waitFor(() => expect(document.querySelector('.MuiDialog-root')).not.toBeInTheDocument())
}

describe('QrCodeModal', () => {
  it('encodes the current Jami ID in a named dialog', async () => {
    const user = userEvent.setup()
    renderQrCodeModal()

    await user.click(screen.getByRole('button', { name: 'Show QR code' }))

    expect(screen.getByRole('dialog', { name: 'contact_details_qr_code' })).toBeVisible()
    expect(screen.getByText('QR code')).toHaveAttribute('data-value', jamiUri)
    expect(screen.getByText('QR code')).toHaveAttribute('data-size', '250')
  })

  it('closes from Escape and the backdrop, restoring trigger focus', async () => {
    const user = userEvent.setup()
    renderQrCodeModal()

    const trigger = screen.getByRole('button', { name: 'Show QR code' })
    await user.click(trigger)
    await user.keyboard('{Escape}')
    await expectDialogClosed()
    expect(trigger).toHaveFocus()

    await user.click(trigger)
    const backdrop = document.querySelector('.MuiBackdrop-root')
    expect(backdrop).not.toBeNull()
    fireEvent.click(backdrop!)
    await expectDialogClosed()
    expect(trigger).toHaveFocus()
  })
})
