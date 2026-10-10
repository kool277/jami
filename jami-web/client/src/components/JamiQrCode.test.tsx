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
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import JamiQrCode from './JamiQrCode.js'

vi.mock('qrcode.react', () => ({
  QRCodeCanvas: ({
    size,
    value,
    bgColor,
    fgColor,
    marginSize,
  }: {
    size: number
    value: string
    bgColor: string
    fgColor: string
    marginSize: number
  }) => (
    <output
      data-bg-color={bgColor}
      data-fg-color={fgColor}
      data-margin-size={marginSize}
      data-size={size}
      data-value={value}
    >
      QR code
    </output>
  ),
}))

describe('JamiQrCode', () => {
  it('uses scanner-safe colors and a quiet zone', () => {
    render(<JamiQrCode size={160} value="jami:0123456789abcdef" />)

    expect(screen.getByTestId('jami-qr-code')).toHaveStyle({
      backgroundColor: '#fff',
      overflow: 'hidden',
      padding: '1px',
    })
    expect(screen.getByText('QR code')).toHaveAttribute('data-value', 'jami:0123456789abcdef')
    expect(screen.getByText('QR code')).toHaveAttribute('data-size', '160')
    expect(screen.getByText('QR code')).toHaveAttribute('data-bg-color', '#fff')
    expect(screen.getByText('QR code')).toHaveAttribute('data-fg-color', '#000')
    expect(screen.getByText('QR code')).toHaveAttribute('data-margin-size', '4')
  })
})
