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
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { buildDefaultTheme } from '../../../themes/Default.js'
import PasskeyManager from './PasskeyManager.js'

vi.mock('@simplewebauthn/browser', () => ({ browserSupportsWebAuthn: () => true }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('../../../services/passkeyQueries.js', () => ({
  useDeletePasskeyMutation: () => ({ isPending: false, mutate: vi.fn() }),
  usePasskeyCredentialsQuery: () => ({ data: [], isLoading: false }),
  useRegisterPasskeyMutation: () => ({ isPending: false, mutateAsync: vi.fn() }),
}))

describe('PasskeyManager', () => {
  it('uses the standard dialog cancel label when registering a passkey', async () => {
    const user = userEvent.setup()

    render(
      <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
        <PasskeyManager />
      </ThemeProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'passkey_register_button' }))

    expect(screen.getByRole('button', { name: 'dialog_cancel' })).toBeVisible()
  })
})
