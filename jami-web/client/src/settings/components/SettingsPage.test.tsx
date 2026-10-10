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
import { Button, ThemeProvider } from '@mui/material'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { buildDefaultTheme } from '../../themes/Default.js'
import { SettingsPage, SettingsRow, SettingsSection } from './SettingsPage.js'

describe('SettingsPage', () => {
  it('provides page and section hierarchy around accessible controls', () => {
    render(
      <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
        <SettingsPage title="General" description="App preferences">
          <SettingsSection title="System" description="Device-wide preferences">
            <SettingsRow
              title="Notifications"
              description="Show alerts for activity"
              control={<Button>Configure</Button>}
            />
          </SettingsSection>
        </SettingsPage>
      </ThemeProvider>,
    )

    expect(screen.getByRole('heading', { level: 1, name: 'General' })).toBeVisible()
    expect(screen.getByRole('heading', { level: 2, name: 'System' })).toBeInTheDocument()
    expect(screen.getByText('App preferences')).toBeVisible()
    expect(screen.getByText('Show alerts for activity')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Configure' })).toBeInTheDocument()
    expect(screen.getAllByTestId('settings-page-island')).toHaveLength(1)
  })

  it('places its description below the title row', () => {
    render(
      <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
        <SettingsPage title="Jami authentication" description="Use a Jami account">
          <SettingsSection list={false}>
            <SettingsRow title="Enabled" />
          </SettingsSection>
        </SettingsPage>
      </ThemeProvider>,
    )

    const title = screen.getByRole('heading', { level: 1, name: 'Jami authentication' })
    const description = screen.getByText('Use a Jami account')

    expect(title.parentElement).not.toContainElement(description)
  })

  it('keeps a trailing header action alongside the page title', () => {
    render(
      <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
        <SettingsPage title="Jami authentication" headerEndAction={<Button>Enabled</Button>} />
      </ThemeProvider>,
    )

    const title = screen.getByRole('heading', { level: 1, name: 'Jami authentication' })
    expect(title.parentElement?.parentElement).toContainElement(screen.getByRole('button', { name: 'Enabled' }))
  })

  it('can expand its card to accommodate wider content', () => {
    render(
      <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
        <SettingsPage contentMaxWidth={960} />
      </ThemeProvider>,
    )

    expect(screen.getByTestId('settings-page-island').parentElement).toHaveStyle({ maxWidth: '960px' })
  })
})
