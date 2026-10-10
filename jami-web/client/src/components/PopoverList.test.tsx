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
import { type SvgIconProps } from '@mui/material'
import { ThemeProvider } from '@mui/material/styles'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { buildDefaultTheme } from '../themes/Default.js'
import PopoverList from './PopoverList.js'

describe('PopoverList', () => {
  it('does not activate disabled menu items', () => {
    const onClick = vi.fn()
    const TestIcon = ({ className }: SvgIconProps) => <span className={className} />

    render(
      <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
        <PopoverList items={[{ label: 'disabled', Icon: TestIcon, disabled: true, onClick }]} />
      </ThemeProvider>,
    )

    const item = screen.getByRole('menuitem')
    expect(item).toHaveAttribute('aria-disabled', 'true')
    item.click()
    expect(onClick).not.toHaveBeenCalled()
  })
})
