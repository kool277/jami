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
import ValidationRequiredModal from './ValidationRequiredModal.js'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

describe('ValidationRequiredModal', () => {
  it('centers content and prioritizes the destructive action', () => {
    render(
      <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
        <ValidationRequiredModal
          buttonText="remove_button"
          info="remove_account_info"
          onClose={vi.fn()}
          onValidation={vi.fn()}
          open
          title="dialog_confirm_title_default"
        />
      </ThemeProvider>,
    )

    const remove = screen.getByRole('button', { name: 'remove_button' })
    const cancel = screen.getByRole('button', { name: 'dialog_cancel' })

    expect(screen.getByRole('heading', { name: 'dialog_confirm_title_default' })).toBeVisible()
    expect(remove).toHaveClass('MuiButton-contained', 'MuiButton-colorError')
    expect(remove).toHaveStyle({ backgroundColor: 'rgb(204, 0, 34)' })
    expect(cancel).toHaveClass('MuiButton-text')
    expect(cancel.compareDocumentPosition(remove) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByText('remove_account_info')).toHaveStyle({ textAlign: 'center' })
    expect(screen.getByText('remove_account_info')).not.toHaveStyle({ minHeight: '160px' })
  })
})
