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
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SettingTips from '../settings/components/GeneralSettings/SettingTips.js'
import { buildDefaultTheme } from '../themes/Default.js'
import { areTipsEnabled, setTipsEnabled } from '../utils/tips.js'
import TipsDialog from './TipsDialog.js'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

function renderTipsDialog(includeSetting = false) {
  return render(
    <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
      <TipsDialog />
      {includeSetting && <SettingTips />}
    </ThemeProvider>,
  )
}

async function closeDialog() {
  await waitFor(() => expect(document.querySelector('.MuiDialog-root')).not.toBeInTheDocument())
}

describe('TipsDialog', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('moves keyboard focus into the dialog and restores it after Escape', async () => {
    const user = userEvent.setup()
    renderTipsDialog()

    const trigger = screen.getByRole('button', { name: 'tips' })
    await user.tab()
    expect(trigger).toHaveFocus()
    await user.keyboard('{Enter}')

    expect(screen.getByRole('dialog', { name: /^tips/ })).toBeVisible()
    expect(screen.getByRole('button', { name: 'next' })).toHaveFocus()

    await user.keyboard('{Escape}')
    await closeDialog()
    expect(trigger).toHaveFocus()
  })

  it('closes on click-away and restores focus to its trigger', async () => {
    const user = userEvent.setup()
    renderTipsDialog()

    const trigger = screen.getByRole('button', { name: 'tips' })
    await user.click(trigger)
    fireEvent.click(document.body)

    await closeDialog()
    expect(trigger).toHaveFocus()
  })

  it('enforces navigation bounds and announces the selected tip', async () => {
    const user = userEvent.setup()
    renderTipsDialog()

    await user.click(screen.getByRole('button', { name: 'tips' }))
    const previous = screen.getByRole('button', { name: 'previous' })
    const next = screen.getByRole('button', { name: 'next' })
    expect(previous).toBeDisabled()

    await user.click(next)
    expect(screen.getByText('tip_2_title')).toBeVisible()
    expect(screen.getByText('tip_2_title. tip_2_description')).toHaveAttribute('aria-live', 'polite')

    for (let index = 0; index < 9; index += 1) {
      await user.click(next)
    }

    expect(screen.getByText('tip_11_title')).toBeVisible()
    expect(next).toBeDisabled()
    expect(previous).toBeEnabled()
  })

  it('updates its trigger from settings immediately and keeps the disabled setting after remount', async () => {
    const user = userEvent.setup()
    const { unmount } = renderTipsDialog(true)
    expect(screen.getByRole('button', { name: 'tips' })).toBeVisible()

    await user.click(screen.getByRole('switch', { name: 'show_tips' }))
    expect(screen.queryByRole('button', { name: 'tips' })).not.toBeInTheDocument()
    expect(areTipsEnabled()).toBe(false)

    unmount()
    renderTipsDialog()
    expect(screen.queryByRole('button', { name: 'tips' })).not.toBeInTheDocument()
    act(() => setTipsEnabled(true))
  })
})
