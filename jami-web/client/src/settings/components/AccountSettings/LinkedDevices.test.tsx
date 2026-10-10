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
import { ThemeProvider } from '@mui/material'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { buildDefaultTheme } from '../../../themes/Default.js'
import LinkedDevices from './LinkedDevices.js'

vi.mock('../../../contexts/AuthProvider.js', () => ({
  useAuthContext: () => ({
    account: {
      details: { 'Account.deviceName': 'This device' },
      devices: {},
      volatileDetails: { 'Account.deviceID': 'device-id' },
    },
  }),
}))
vi.mock('../../../services/accountQueries.js', () => ({
  useRemoveLinkedDevice: () => ({ mutate: vi.fn() }),
}))
vi.mock('./PasswordRequiredModal.js', () => ({
  default: () => null,
}))

describe('LinkedDevices', () => {
  it('wraps pagination controls so their actions remain visible in narrow layouts', () => {
    const { container } = render(
      <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
        <LinkedDevices />
      </ThemeProvider>,
    )

    expect(screen.getByLabelText('Go to next page').closest('.MuiTablePagination-toolbar')).toHaveStyle({
      flexWrap: 'wrap',
    })
    expect(container.querySelector('.material-symbols-outlined')).toHaveStyle({ fontSize: '20px' })
    expect(screen.getByTestId('current-device-id')).toHaveStyle({
      flex: '1 1 auto',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    })
  })
})
