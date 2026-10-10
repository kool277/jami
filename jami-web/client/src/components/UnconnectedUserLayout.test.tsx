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
import { fireEvent, render, screen } from '@testing-library/react'
import { createContext } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { buildDefaultTheme } from '../themes/Default.js'
import UnconnectedUserLayout from './UnconnectedUserLayout.js'

const { toggleMode } = vi.hoisted(() => ({ toggleMode: vi.fn() }))

vi.mock('./SettingLanguage.js', () => ({
  default: ({ doNotDisplayLabel }: { doNotDisplayLabel?: boolean }) => (
    <div data-testid="language-selector">{doNotDisplayLabel ? null : 'settings_language'}</div>
  ),
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('./common/BaseIconButton.js', () => ({
  default: ({ children, tooltip, ...props }: React.ComponentProps<'button'> & { tooltip: string }) => (
    <button {...props}>{children}</button>
  ),
}))
vi.mock('../contexts/CustomThemeProvider.js', () => ({
  CustomThemeContext: createContext({
    mode: 'light',
    toggleMode,
    animationsEnabled: true,
    toggleAnimations: vi.fn(),
  }),
}))

describe('UnconnectedUserLayout', () => {
  beforeEach(() => {
    toggleMode.mockReset()
  })

  it('hides appearance controls by default', () => {
    render(
      <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
        <UnconnectedUserLayout>Content</UnconnectedUserLayout>
      </ThemeProvider>,
    )

    expect(screen.queryByTestId('language-selector')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'settings_dark_theme' })).not.toBeInTheDocument()
  })

  it('shows appearance controls when enabled', () => {
    render(
      <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
        <UnconnectedUserLayout showAppearanceControls>Content</UnconnectedUserLayout>
      </ThemeProvider>,
    )

    expect(screen.getByTestId('language-selector').closest('.MuiCard-root')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'settings_dark_theme' }))

    expect(toggleMode).toHaveBeenCalledOnce()
  })
})
