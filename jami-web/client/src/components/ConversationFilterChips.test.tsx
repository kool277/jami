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

import { buildDefaultTheme } from '../themes/Default.js'
import ConversationFilterChips from './ConversationFilterChips.js'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

describe('ConversationFilterChips', () => {
  it('shows unread conversations and selects a clicked filter', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
        <ConversationFilterChips value="all" unreadConversationCount={3} onChange={onChange} />
      </ThemeProvider>,
    )

    expect(screen.getByRole('button', { name: 'unread (3)' })).toHaveAttribute('aria-pressed', 'false')
    await user.click(screen.getByRole('button', { name: 'groups' }))
    expect(onChange).toHaveBeenCalledWith('groups')
  })

  it('hides the unread count when there are no unread conversations', () => {
    render(
      <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
        <ConversationFilterChips value="all" unreadConversationCount={0} onChange={() => {}} />
      </ThemeProvider>,
    )

    expect(screen.getByRole('button', { name: 'unread' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'unread (0)' })).not.toBeInTheDocument()
  })
})
