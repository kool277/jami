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
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { buildDefaultTheme } from '../../themes/Default.js'
import LinkedDevicesPage from './LinkedDevicesPage.js'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock('../components/AccountSettings/LinkedDevices.js', () => ({
  default: () => <div>Device list</div>,
}))

describe('LinkedDevicesPage', () => {
  it('uses the shared settings island layout', () => {
    render(
      <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
        <LinkedDevicesPage />
      </ThemeProvider>,
    )

    expect(screen.queryByRole('heading', { level: 1, name: 'settings_linked_devices' })).not.toBeInTheDocument()
    expect(screen.getByText('Device list')).toBeInTheDocument()
    expect(screen.getByTestId('settings-page-island')).toBeVisible()
    expect(screen.getByTestId('settings-page-island').parentElement).toHaveStyle({ maxWidth: '900px' })
  })
})
