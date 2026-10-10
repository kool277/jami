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

import { buildDefaultTheme } from '../../themes/Default.js'
import ConfirmDialog from './ConfirmDialog.js'
import EmptyState from './EmptyState.js'
import ErrorBanner from './ErrorBanner.js'
import LoadingSkeleton from './LoadingSkeleton.js'

const renderWithTheme = (children: React.ReactNode) =>
  render(<ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>{children}</ThemeProvider>)

describe('UX vocabulary', () => {
  it('renders an empty state with an accessible heading and optional action', () => {
    renderWithTheme(
      <EmptyState title="No conversations" description="Start a new conversation." action={<button>Start</button>} />,
    )

    expect(screen.getByRole('heading', { name: 'No conversations' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Start' })).toBeVisible()
  })

  it('marks loading skeletons as busy without exposing decorative placeholders', () => {
    const { rerender } = renderWithTheme(<LoadingSkeleton fullPage />)

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getAllByTestId('loading-skeleton-island')).toHaveLength(1)
    expect(screen.getByTestId('loading-skeleton-navigation')).toBeVisible()
    expect(screen.getAllByTestId('loading-skeleton-conversation')).toHaveLength(5)

    rerender(
      <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
        <LoadingSkeleton fullPage contentIsland navigation="settings" />
      </ThemeProvider>,
    )

    expect(screen.getAllByTestId('loading-skeleton-island')).toHaveLength(2)
    expect(screen.getByTestId('loading-skeleton-settings-navigation')).toBeVisible()
    expect(screen.getAllByTestId('loading-skeleton-settings-row')).toHaveLength(5)

    rerender(
      <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
        <LoadingSkeleton
          fullPage
          contentIsland
          content={<output data-testid="loading-skeleton-custom-content">Invitation detail</output>}
        />
      </ThemeProvider>,
    )

    expect(screen.getByTestId('loading-skeleton-custom-content')).toBeVisible()
  })

  it('exposes durable errors as alerts', () => {
    renderWithTheme(<ErrorBanner title="Could not load messages">Try again later.</ErrorBanner>)

    expect(screen.getByRole('alert')).toHaveTextContent('Could not load messages')
  })

  it('keeps a destructive confirm action visually and semantically distinct', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onClose = vi.fn()
    renderWithTheme(
      <ConfirmDialog
        open
        title="Delete conversation?"
        description="This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onConfirm).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass('MuiButton-colorError')
  })
})
