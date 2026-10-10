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
import { type Direction, type PaletteMode, ThemeProvider } from '@mui/material/styles'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { type ReactNode, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { buildDefaultTheme } from '../../themes/Default.js'
import BaseButton, { type BaseButtonVariant } from './BaseButton.js'
import BaseIconButton from './BaseIconButton.js'
import BaseModalDialog, { type ModalClosePolicy } from './BaseModalDialog.js'
import PasswordField from './PasswordField.js'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      if (key === 'password_hide') return 'Hide password'
      if (key === 'password_show') return 'Show password'
      return key
    },
  }),
}))

function renderWithTheme(children: ReactNode, mode: PaletteMode = 'light', direction: Direction = 'ltr') {
  const theme = buildDefaultTheme(mode, direction)
  return {
    theme,
    ...render(
      <ThemeProvider theme={theme}>
        <div dir={direction}>{children}</div>
      </ThemeProvider>,
    ),
  }
}

function DialogHarness({
  closePolicy,
  nonModal,
}: {
  closePolicy: ModalClosePolicy | ModalClosePolicy[]
  nonModal?: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button onClick={() => setOpen(true)}>Open dialog</button>
      <BaseModalDialog
        open={open}
        selectedValue="selected"
        title="Dialog title"
        nonModal={nonModal}
        closePolicy={closePolicy}
        onClose={() => setOpen(false)}
      >
        Dialog content
      </BaseModalDialog>
    </>
  )
}

describe('BaseModalDialog', () => {
  it('has an accessible name and restores focus after an Escape close', async () => {
    const user = userEvent.setup()
    renderWithTheme(<DialogHarness closePolicy="escapeKeyDown" />)

    const trigger = screen.getByRole('button', { name: 'Open dialog' })
    await user.click(trigger)
    await user.keyboard('{Escape}')

    await waitFor(() => expect(document.querySelector('.MuiDialog-root')).not.toBeInTheDocument())
    expect(trigger).toHaveFocus()
  })

  it('honors Escape, backdrop, and no-close policies', async () => {
    const user = userEvent.setup()
    const { rerender } = renderWithTheme(<DialogHarness closePolicy="escapeKeyDown" />)

    await user.click(screen.getByRole('button', { name: 'Open dialog' }))
    await user.keyboard('{Escape}')
    await waitFor(() => expect(document.querySelector('.MuiDialog-root')).not.toBeInTheDocument())

    rerender(
      <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
        <DialogHarness closePolicy="backdropClick" />
      </ThemeProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'Open dialog' }))
    const backdrop = document.querySelector('.MuiBackdrop-root')
    expect(backdrop).not.toBeNull()
    fireEvent.click(backdrop!)
    await waitFor(() => expect(document.querySelector('.MuiDialog-root')).not.toBeInTheDocument())

    rerender(
      <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
        <DialogHarness closePolicy="none" />
      </ThemeProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'Open dialog' }))
    await user.keyboard('{Escape}')
    fireEvent.click(document.querySelector('.MuiBackdrop-root')!)
    expect(screen.getByRole('dialog', { name: 'Dialog title' })).toBeVisible()
  })

  it('is non-modal without a backdrop when configured', async () => {
    const user = userEvent.setup()
    renderWithTheme(<DialogHarness closePolicy="escapeKeyDown" nonModal />)

    await user.click(screen.getByRole('button', { name: 'Open dialog' }))
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'false')
    expect(document.querySelector('.MuiBackdrop-root')).not.toBeInTheDocument()
  })
})

describe('BaseButton', () => {
  it.each<BaseButtonVariant>(['contained', 'outlined', 'text'])('renders the %s variant', (variant) => {
    renderWithTheme(<BaseButton variant={variant}>Action</BaseButton>)

    expect(screen.getByRole('button', { name: 'Action' })).toHaveClass(`MuiButton-${variant}`)
  })

  it('defaults to the contained variant', () => {
    renderWithTheme(<BaseButton>Action</BaseButton>)

    expect(screen.getByRole('button', { name: 'Action' })).toHaveClass('MuiButton-contained')
  })

  it.each([
    ['light', 'ltr'],
    ['dark', 'ltr'],
    ['light', 'rtl'],
  ] as const)('renders the default button and dialog styling in %s %s mode', (mode, direction) => {
    const { theme } = renderWithTheme(
      <>
        <BaseButton>Action</BaseButton>
        <BaseModalDialog aria-label="Styled dialog" onClose={() => {}} open selectedValue="">
          Dialog content
        </BaseModalDialog>
      </>,
      mode,
      direction,
    )

    const button = screen.getByText('Action')
    const dialog = screen.getByRole('dialog', { name: 'Styled dialog' })

    expect(button).toHaveStyle({ borderRadius: '9999px' })
    expect(button).toHaveStyle({
      backgroundColor: theme.palette.primary.dark,
      color: theme.palette.getContrastText(theme.palette.primary.dark),
    })
    expect(dialog).toHaveStyle({ backgroundColor: theme.palette.background.paper })
    expect(button.parentElement).toHaveAttribute('dir', direction)
  })
})

describe('BaseIconButton', () => {
  it('exposes its required accessible label and tooltip', async () => {
    const user = userEvent.setup()
    renderWithTheme(
      <BaseIconButton aria-label="Copy Jami ID" tooltip="Copy Jami ID">
        <span>content_copy</span>
      </BaseIconButton>,
    )

    const button = screen.getByRole('button', { name: 'Copy Jami ID' })
    await user.hover(button)

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Copy Jami ID')
  })
})

describe('PasswordField', () => {
  it('keeps the password masked until the accessible reveal control is pressed', async () => {
    const user = userEvent.setup()
    renderWithTheme(<PasswordField label="Password" />)

    const input = screen.getByLabelText('Password')
    expect(input).toHaveAttribute('type', 'password')

    await user.click(screen.getByRole('button', { name: 'Show password' }))
    expect(input).toHaveAttribute('type', 'text')

    await user.click(screen.getByRole('button', { name: 'Hide password' }))
    expect(input).toHaveAttribute('type', 'password')
  })
})
